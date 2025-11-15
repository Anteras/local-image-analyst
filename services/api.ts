import { type Prompt, ResultType, type BoundingBox, type BboxChildResult } from '../types';

interface ApiConfig {
  apiEndpoint: string;
  modelName: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

interface FetchStreamParams {
    prompt: Prompt;
    imageBase64: string;
    config: ApiConfig;
    conversationHistory?: { question: string, answer: string }[];
    followUpQuestion?: string;
    signal: AbortSignal;
}

interface FetchParams {
    prompt: Prompt;
    imageBase64: string;
    config: ApiConfig;
    signal: AbortSignal;
}

interface FetchBboxChildParams {
    prompt: Prompt;
    bbox: BoundingBox;
    imageBase64: string;
    config: ApiConfig;
}

interface GeneratePromptsParams {
    goal: string;
    numPrompts: number;
    includeImage: boolean;
    imageBase64: string | null;
    config: ApiConfig;
    allowedTypes: ResultType[];
}

const stripThinking = (rawContent: string): string => {
    return rawContent.replace(/<think>[\s\S]*?<\/think>[\s\n]*/, '').trim();
};

export const getFullPromptText = (prompt: Prompt): string => {
    let regionContext = '';
    if (prompt.type === ResultType.Text && prompt.regionCoords) {
        if (prompt.regionType === 'point') {
            regionContext = ` Focus your analysis specifically on the point located at coordinates [${prompt.regionCoords[0]}, ${prompt.regionCoords[1]}] on a 1000x1000 grid of the image.`;
        } else if (prompt.regionType === 'bbox') {
            regionContext = ` Focus your analysis specifically on the content within the bounding box defined by the coordinates [${prompt.regionCoords[0]}, ${prompt.regionCoords[1]}, ${prompt.regionCoords[2]}, ${prompt.regionCoords[3]}] on a 1000x1000 grid of the image.`;
        }
    }

    switch (prompt.type) {
        case ResultType.Text:
            return prompt.text + regionContext;
        case ResultType.Score:
            const [min, max] = prompt.scoreRange || [0, 10];
            return `${prompt.text} Respond with only a single number on a scale of ${min} to ${max}.`;
        case ResultType.Number:
             return `${prompt.text} Respond with only a single number.`;
        case ResultType.YesNo:
            return `${prompt.text} Respond with only the word "Yes" or "No".`;
        case ResultType.BoundingBox:
            return `${prompt.text} For each detected object, provide its bounding box using relative coordinates from 0 to 1000 in an [x1, y1, x2, y2] format. If no objects are found, return an empty array. Return ONLY a valid JSON array of objects, where each object has keys "box" (an array of 4 numbers) and "label" (a string).`;
        case ResultType.Category:
            if (!prompt.categories || prompt.categories.length === 0) return prompt.text;
            return `${prompt.text} Respond with only one of the following categories: ${JSON.stringify(prompt.categories)}.`;
        case ResultType.JSON:
            if (!prompt.jsonSchema) return prompt.text;
            return `${prompt.text} Return ONLY a valid JSON object that strictly adheres to the following schema. Do not include any other text or markdown formatting. Schema: ${prompt.jsonSchema}`;
        default:
            return prompt.text;
    }
};

const getFullPromptTextForBboxChild = (prompt: Prompt, bbox: BoundingBox): string => {
    const baseText = prompt.text;
    const context = `Focus your answer ONLY on the object labeled "${bbox.label}" within the area defined by the bounding box [${bbox.box.join(', ')}] (relative to a 1000x1000 image).`;
    const fullText = `${baseText} ${context}`;

    switch (prompt.type) {
        case ResultType.Text:
            return fullText;
        case ResultType.Score:
            const [min, max] = prompt.scoreRange || [0, 10];
            return `${fullText} Respond with only a single number on a scale of ${min} to ${max}.`;
        case ResultType.Number:
             return `${fullText} Respond with only a single number.`;
        case ResultType.YesNo:
            return `${fullText} Respond with only the word "Yes" or "No".`;
        case ResultType.BoundingBox:
             return `${baseText} Search for objects ONLY within the area defined by [${bbox.box.join(', ')}]. ${context} Return ONLY a valid JSON array of objects, where each object has keys "box" (an array of 4 numbers relative to the 1000x1000 canvas) and "label" (a string).`;
        default:
            return fullText;
    }
};

export async function* fetchAnalysisStream(params: FetchStreamParams): AsyncGenerator<{ type: 'delta', content: string } | { type: 'error', error: string }> {
    const { prompt, imageBase64, config, conversationHistory = [], followUpQuestion, signal } = params;

    const messages: any[] = [{
        role: "user",
        content: [
            { type: "text", text: getFullPromptText(prompt) },
            { type: "image_url", image_url: { url: imageBase64 } }
        ]
    }];

    if (followUpQuestion) {
        conversationHistory.forEach((turn, index) => {
            if (index === 0 && turn.question === getFullPromptText(prompt)) {
                // Handled by initial message
            } else {
                messages.push({ role: "user", content: turn.question });
            }
            messages.push({ role: "assistant", content: turn.answer });
        });
        messages.push({ role: "user", content: followUpQuestion });
    }

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    
    const body: any = {
        model: config.modelName,
        messages,
        stream: true,
    };
    if (config.maxTokens) body.max_tokens = config.maxTokens;
    if (config.temperature !== undefined) body.temperature = config.temperature;

    const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
    });

    if (!response.ok || !response.body) {
        throw new Error(`API request failed with status ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // State machine: 'initial', 'skipping_think', 'streaming'
    let parsingState: 'initial' | 'skipping_think' | 'streaming' = 'initial';
    let accumulatedContent = '';
    
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                if (jsonStr === '[DONE]') continue;
                try {
                    const chunk = JSON.parse(jsonStr);
                    if (chunk.choices[0]?.finish_reason === 'length') {
                        yield { type: 'error', error: 'Response was truncated due to token limit.' };
                        return;
                    }
                    const delta = chunk.choices[0]?.delta?.content || '';
                    if (!delta) continue;

                    if (parsingState === 'initial') {
                        accumulatedContent += delta;
                        // Once we have some content, decide the state
                        if (accumulatedContent.trim().length > 0) {
                            if (accumulatedContent.trim().startsWith('<think>')) {
                                parsingState = 'skipping_think';
                                // Check if the think block is already complete in this chunk
                                const endThinkTagIndex = accumulatedContent.indexOf('</think>');
                                if (endThinkTagIndex !== -1) {
                                    parsingState = 'streaming';
                                    const remainingContent = accumulatedContent.substring(endThinkTagIndex + '</think>'.length);
                                    if (remainingContent) {
                                        yield { type: 'delta', content: remainingContent.trimStart() };
                                    }
                                    accumulatedContent = '';
                                }
                            } else {
                                // No think block, start streaming immediately
                                parsingState = 'streaming';
                                yield { type: 'delta', content: accumulatedContent };
                                accumulatedContent = ''; // clear buffer
                            }
                        }
                    } else if (parsingState === 'skipping_think') {
                        accumulatedContent += delta;
                        const endThinkTagIndex = accumulatedContent.indexOf('</think>');
                        if (endThinkTagIndex !== -1) {
                            parsingState = 'streaming';
                            const remainingContent = accumulatedContent.substring(endThinkTagIndex + '</think>'.length);
                            if (remainingContent) {
                                yield { type: 'delta', content: remainingContent.trimStart() };
                            }
                            accumulatedContent = ''; // clear buffer
                        }
                    } else if (parsingState === 'streaming') {
                        yield { type: 'delta', content: delta };
                    }

                } catch (e) {
                    console.warn("Failed to parse stream chunk:", jsonStr);
                }
            }
        }
    }
}

export async function fetchAnalysis(params: FetchParams): Promise<{ parsedData: any, rawResponse: any }> {
    const { prompt, imageBase64, config, signal } = params;

    const messages: any[] = [{
        role: "user",
        content: [
            { type: "text", text: getFullPromptText(prompt) },
            { type: "image_url", image_url: { url: imageBase64 } }
        ]
    }];

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    
    const body: any = {
        model: config.modelName,
        messages,
        stream: false,
    };
    if (config.maxTokens) body.max_tokens = config.maxTokens;
    if (config.temperature !== undefined) body.temperature = config.temperature;
    
    const response = await fetch(config.apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
    });
    
    if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
    
    const data = await response.json();
    if (data.choices[0]?.finish_reason === 'length') {
        throw new Error("Response was truncated due to token limit.");
    }
    const content = stripThinking(data.choices[0].message.content);
    let parsedData;
    if (prompt.type === ResultType.BoundingBox || prompt.type === ResultType.JSON) {
        try {
            const cleanedContent = content.replace(/```json\n?|```/g, '').trim();
            parsedData = JSON.parse(cleanedContent);
        } catch (e) { throw new Error(`Failed to parse JSON for ${prompt.type}.`); }
    } else if (prompt.type === ResultType.Score || prompt.type === ResultType.Number) {
        const scoreMatch = content.match(/-?\d+(\.\d+)?/);
        parsedData = scoreMatch ? parseFloat(scoreMatch[0]) : NaN;
    } else {
        parsedData = content;
    }

    return { parsedData, rawResponse: data };
}

export async function fetchBboxChildAnalysis(params: FetchBboxChildParams): Promise<BboxChildResult | null> {
    const { prompt, bbox, imageBase64, config } = params;
    try {
        const fullPromptText = getFullPromptTextForBboxChild(prompt, bbox);
        
        const messages = [{
            role: "user",
            content: [
                { type: "text", text: fullPromptText },
                { type: "image_url", image_url: { url: imageBase64 } }
            ]
        }];
        
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
        
        const body = {
            model: config.modelName,
            messages: messages,
            stream: false,
            ...(config.maxTokens && {max_tokens: config.maxTokens}),
            ...(config.temperature !== undefined && {temperature: config.temperature}),
        };

        const response = await fetch(config.apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });

        if (!response.ok) throw new Error(`API failed: ${response.status}`);
        
        const data = await response.json();
        const content = stripThinking(data.choices[0].message.content);
        
        let resultData: string | number | null = null;
        if (prompt.type === ResultType.Score || prompt.type === ResultType.Number) {
            const match = content.match(/-?\d+(\.\d+)?/);
            resultData = match ? parseFloat(match[0]) : NaN;
        } else { // Text, YesNo
            resultData = content;
        }

        return { parentBox: bbox, resultData: resultData };

    } catch (error) {
        console.error(`Bbox child prompt error for "${prompt.text}" on box "${bbox.label}":`, error);
        return { parentBox: bbox, resultData: `Error: ${(error as Error).message}` };
    }
}


export async function generatePrompts(params: GeneratePromptsParams): Promise<Prompt[]> {
    const { goal, numPrompts, includeImage, imageBase64, config, allowedTypes } = params;

    const typeSpecificInstructions: string[] = [];
    if (allowedTypes.includes(ResultType.Score)) {
        typeSpecificInstructions.push(`- If the "type" is "score", you MUST also include a "scoreRange" property, which is an array of two numbers [min, max]. Choose a reasonable range for the prompt's context.`);
    }
    if (allowedTypes.includes(ResultType.Category)) {
        typeSpecificInstructions.push(`- If the "type" is "category", you MUST also include a "categories" property, which is an array of 3 to 5 distinct strings representing the possible categories. Choose a relevant, non-overlapping set of categories.`);
    }
    if (allowedTypes.includes(ResultType.JSON)) {
        typeSpecificInstructions.push(`- If the "type" is "json", you MUST also include a "jsonSchema" property, which is a string containing a valid, simple JSON schema that defines the structure of the expected output. The schema itself should be a JSON string.`);
    }
    
    const metaPrompt = `You are an expert prompt engineer designing prompts for a vision-language model. Your task is to generate a set of analysis prompts based on a user's high-level goal.
${includeImage ? "\nThe user has provided an image for context. Your prompts should be tailored to the contents of this image." : ""}
User's Goal: "${goal}"
Number of Prompts to Generate: ${numPrompts}

Instructions:
1. Generate exactly ${numPrompts} prompts.
2. The prompts should be diverse and cover different aspects of the user's goal ${includeImage ? "in relation to the provided image" : ""}.
3. The output MUST be a valid JSON array of objects. Do not output any text before or after the JSON array. Do not wrap it in markdown code blocks like \`\`\`json.
4. Each object in the array must have a "text" (string) and a "type" (string) property.
5. The "type" MUST be one of the following values: ${JSON.stringify(allowedTypes)}.
6. For certain types, you must include additional properties as described:
${typeSpecificInstructions.join('\n')}
7. Do not generate conditional prompts (i.e., do not include "parentId" or "condition" properties).
8. Do not generate "region" prompts.

Example JSON Output Structure (your output should only contain types from the allowed list):
[
  { "text": "Describe the main subject.", "type": "text" },
  { "text": "Is the image professionally taken?", "type": "yes/no" },
  { "text": "How many people are visible?", "type": "number" },
  { "text": "Rate the overall composition.", "type": "score", "scoreRange": [1, 5] },
  { "text": "What is the primary color mood?", "type": "category", "categories": ["Warm", "Cool", "Neutral", "Vibrant"] },
  { "text": "Extract details of the main product.", "type": "json", "jsonSchema": "{\\"type\\":\\"object\\",\\"properties\\":{\\"productName\\":{\\"type\\":\\"string\\"},\\"brand\\":{\\"type\\":\\"string\\"}},\\"required\\":[\\"productName\\"]}" }
]`;
    
    try {
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

        const content: any[] = [{ type: "text", text: metaPrompt }];

        if (includeImage && imageBase64) {
            content.push({ type: "image_url", image_url: { url: imageBase64 } });
        }
        
        const body: any = {
            model: config.modelName,
            messages: [{ role: "user", content: content }],
            stream: false,
        };
        body.max_tokens = config.maxTokens || 4096;
        if (config.temperature !== undefined) body.temperature = config.temperature;

        const response = await fetch(config.apiEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body),
        });
        
        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
        }
        
        const data = await response.json();
        if (data.choices[0]?.finish_reason === 'length') {
            throw new Error("Response truncated: The model hit the maximum token limit. Consider increasing 'Max Tokens' in advanced settings.");
        }
        const responseContent = data.choices[0].message.content;
        
        let parsedPrompts: Omit<Prompt, 'id'>[];
        try {
            const contentWithoutThinking = stripThinking(responseContent);
            const cleanedContent = contentWithoutThinking.replace(/```json\n?|```/g, '').trim();
            parsedPrompts = JSON.parse(cleanedContent);
        } catch (e) {
            console.error("Failed to parse JSON from LLM response:", responseContent);
            throw new Error("The AI returned an invalid format. Please try again.");
        }
        
        if (!Array.isArray(parsedPrompts) || !parsedPrompts.every(p => typeof p.text === 'string' && typeof p.type === 'string')) {
            throw new Error("The AI returned data in an unexpected structure.");
        }
        
        return parsedPrompts.map((p, index) => ({
            ...p,
            id: `${Date.now()}-${index}`,
        }));

    } catch (error) {
        console.error("Failed to generate prompts:", error);
        throw error;
    }
}