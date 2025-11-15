import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  type Prompt,
  type AnalysisResult,
  ResultType,
  type BoundingBox,
  type BboxChildResult,
  type AnalysisStatus,
} from './types';
import {
  fetchAnalysis,
  fetchAnalysisStream,
  fetchBboxChildAnalysis,
  generatePrompts as generatePromptsApi,
} from './services/api';
import { getFullPromptText } from './services/api';

type ImageObject = {
  id: string;
  file: File;
  url: string;
};

interface AppState {
  // Image state
  images: ImageObject[];
  selectedImageId: string | null;
  imageBase64s: Record<string, string>;
  analysisStates: Record<string, AnalysisStatus>;

  // Prompt state
  prompts: Prompt[];

  // Results state
  results: Record<string, Record<string, AnalysisResult[]>>;
  overlayVisibility: Record<string, Record<string, boolean>>;

  // Analysis process state
  isAnalyzing: boolean;
  analysisProgress: { current: number, total: number } | null;
  runningSinglePrompts: Set<string>;
  abortControllers: Record<string, AbortController>;

  // Region Selection state
  regionSelection: { promptId: string | null; type: 'point' | 'bbox' | null };

  // Settings
  apiEndpoint: string;
  modelName: string;
  apiKey: string;
  temperature?: number;
  maxTokens?: number;
  theme: 'light' | 'dark';
  apiInspectorMode: boolean;

  // Actions
  setInitialImages: (files: File[]) => void;
  appendImages: (files: File[]) => void;
  removeImage: (imageId: string) => void;
  setSelectedImageId: (id: string | null) => void;
  reset: (silent?: boolean) => void;

  addPrompt: (parentId?: string) => void;
  updatePrompt: (id: string, newPrompt: Partial<Prompt>) => void;
  deletePrompt: (id: string) => void;
  dropPrompt: (draggedId: string, targetId: string) => void;
  setPrompts: (prompts: Prompt[]) => void;

  runSingleAnalysisFlow: (prompt: Prompt) => void;
  runPendingAnalysis: () => void;
  runAllImagesAnalysis: () => void;
  sendFollowUp: (promptId: string, question: string) => Promise<void>;
  generatePrompts: (goal: string, numPrompts: number, includeImage: boolean, allowedTypes: ResultType[], replace: boolean) => Promise<void>;
  
  setOverlayVisibility: (imageId: string, visibility: Record<string, boolean>) => void;

  toggleTheme: () => void;
  saveSettings: (endpoint: string, model: string, apiKey: string, maxTokens?: number, temperature?: number, apiInspectorMode?: boolean) => void;

  startRegionSelection: (promptId: string, type: 'point' | 'bbox') => void;
  cancelRegionSelection: () => void;
  completeRegionSelection: (coords: [number, number] | [number, number, number, number]) => void;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

const DEFAULT_PROMPTS: Prompt[] = [
  { id: '1', text: 'Describe this image in detail.', type: ResultType.Text },
  { id: 'yesno-1', text: 'Does this image contain any animals?', type: ResultType.YesNo },
  { id: 'child-1', text: 'How many animals are in the image?', type: ResultType.Number, parentId: 'yesno-1', condition: 'yes' },
  { id: 'child-2', text: 'Identify the animals.', type: ResultType.BoundingBox, parentId: 'yesno-1', condition: 'yes' },
  { id: '2', text: 'Rate the aesthetic quality of this image.', type: ResultType.Score, scoreRange: [0, 10] },
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // State
      images: [],
      selectedImageId: null,
      imageBase64s: {},
      analysisStates: {},
      prompts: DEFAULT_PROMPTS,
      results: {},
      overlayVisibility: {},
      isAnalyzing: false,
      analysisProgress: null,
      runningSinglePrompts: new Set(),
      abortControllers: {},
      regionSelection: { promptId: null, type: null },
      
      // Settings
      apiEndpoint: 'http://127.0.0.1:1234/v1/chat/completions',
      modelName: 'qwen3-vl-30b-a3b-thinking',
      apiKey: '',
      temperature: undefined,
      maxTokens: undefined,
      theme: 'dark',
      apiInspectorMode: false,

      // Actions
      setInitialImages: (files) => {
        get().reset(true);
        const newImageObjects: ImageObject[] = files.map(file => ({
          id: `${file.name}-${file.lastModified}`,
          file,
          url: URL.createObjectURL(file),
        }));
        // FIX: Cast 'idle' to AnalysisStatus to ensure correct type for newAnalysisStates
        const newAnalysisStates = Object.fromEntries(newImageObjects.map(img => [img.id, 'idle' as AnalysisStatus]));
        set({ images: newImageObjects, analysisStates: newAnalysisStates });
        if (newImageObjects.length > 0) {
          set({ selectedImageId: newImageObjects[0].id });
        }
      },

      appendImages: (files) => {
        const { images, selectedImageId } = get();
        const existingIds = new Set(images.map(img => img.id));
        const newImageObjects: ImageObject[] = files
          .map(file => ({
            id: `${file.name}-${file.lastModified}`,
            file,
            url: URL.createObjectURL(file),
          }))
          .filter(imgObj => !existingIds.has(imgObj.id));

        if (newImageObjects.length > 0) {
          const newAnalysisStates = { ...get().analysisStates };
          newImageObjects.forEach(img => newAnalysisStates[img.id] = 'idle');
          set({ images: [...images, ...newImageObjects], analysisStates: newAnalysisStates });
          if (!selectedImageId) {
            set({ selectedImageId: newImageObjects[0].id });
          }
        }
      },

      removeImage: (imageIdToRemove) => {
        const { images, selectedImageId, results, imageBase64s, overlayVisibility, analysisStates } = get();
        const imageToRemove = images.find(img => img.id === imageIdToRemove);
        if (imageToRemove) {
          URL.revokeObjectURL(imageToRemove.url);
        }
        const remainingImages = images.filter(img => img.id !== imageIdToRemove);
        
        const cleanupState = (prevState: Record<string, any>) => {
            const nextState = {...prevState};
            delete nextState[imageIdToRemove];
            return nextState;
        };

        set({
          images: remainingImages,
          selectedImageId: selectedImageId === imageIdToRemove ? (remainingImages.length > 0 ? remainingImages[0].id : null) : selectedImageId,
          results: cleanupState(results),
          imageBase64s: cleanupState(imageBase64s),
          overlayVisibility: cleanupState(overlayVisibility),
          analysisStates: cleanupState(analysisStates),
        });
      },

      setSelectedImageId: (id) => set({ selectedImageId: id }),

      reset: (silent = false) => {
        const { results, images } = get();
        if (!silent && Object.keys(results).length > 0) {
          // No confirm dialog for better sandboxed experience
        } else if (images.length === 0 && Object.keys(results).length === 0) {
          return;
        }

        images.forEach(img => URL.revokeObjectURL(img.url));
        set({
          images: [],
          selectedImageId: null,
          imageBase64s: {},
          results: {},
          overlayVisibility: {},
          analysisStates: {},
        });
      },

      addPrompt: (parentId) => {
        const { prompts } = get();
        const parentPrompt = prompts.find(p => p.id === parentId);
        const newPrompt: Prompt = {
          id: Date.now().toString(),
          text: '',
          type: ResultType.Text
        };
        if (parentId && parentPrompt) {
          newPrompt.parentId = parentId;
          if (parentPrompt.type === ResultType.YesNo) {
            newPrompt.condition = 'yes';
          }
          if (parentPrompt.type === ResultType.Score) {
            newPrompt.scoreConditionOperator = 'above';
            const [min, max] = parentPrompt.scoreRange || [0, 10];
            newPrompt.scoreConditionValue = (min + max) / 2;
          }
        }
        set({ prompts: [...prompts, newPrompt] });
      },

      updatePrompt: (id, newPrompt) => {
        set(state => ({
          prompts: state.prompts.map(p => (p.id === id ? { ...p, ...newPrompt } : p))
        }));
      },

      deletePrompt: (id) => {
        const { prompts } = get();
        const children = prompts.filter(p => p.parentId === id);
        if (children.length > 0) {
          if (!window.confirm("Deleting this prompt will also delete its conditional children. Are you sure?")) {
            return;
          }
        }
        const idsToDelete = [id, ...children.map(c => c.id)];

        set(state => {
          const newPrompts = state.prompts.filter(p => !idsToDelete.includes(p.id));
          const newResults = { ...state.results };
          const newOverlays = { ...state.overlayVisibility };

          for (const imageId in newResults) {
            const newImageResults = { ...newResults[imageId] };
            const newImageOverlays = { ...newOverlays[imageId] };
            let wasModified = false;
            for (const promptId of idsToDelete) {
              if (promptId in newImageResults) {
                delete newImageResults[promptId];
                delete newImageOverlays[promptId];
                wasModified = true;
              }
            }
            if (wasModified) {
              newResults[imageId] = newImageResults;
              newOverlays[imageId] = newImageOverlays;
            }
          }
          return { prompts: newPrompts, results: newResults, overlayVisibility: newOverlays };
        });
      },

      dropPrompt: (draggedId, targetId) => {
        set(state => {
          const { prompts } = state;
          const newPrompts = [...prompts];

          const draggedParent = newPrompts.find(p => p.id === draggedId);
          if (!draggedParent || draggedParent.parentId) return { prompts };

          const draggedChildren = newPrompts.filter(p => p.parentId === draggedId);
          const draggedGroup = [draggedParent, ...draggedChildren];
          const draggedGroupIds = new Set(draggedGroup.map(p => p.id));
          
          const remainingPrompts = newPrompts.filter(p => !draggedGroupIds.has(p.id));

          const targetIndex = remainingPrompts.findIndex(p => p.id === targetId);
          if (targetIndex === -1) return { prompts };

          remainingPrompts.splice(targetIndex, 0, ...draggedGroup);
          
          return { prompts: remainingPrompts };
        });
      },

      setPrompts: (prompts) => set({ prompts }),

      setOverlayVisibility: (imageId, visibility) => {
        set(state => ({
          overlayVisibility: {
            ...state.overlayVisibility,
            [imageId]: visibility,
          }
        }));
      },

      toggleTheme: () => set(state => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      saveSettings: (endpoint, model, apiKey, maxTokens, temperature, apiInspectorMode) => {
        set({ apiEndpoint: endpoint, modelName: model, apiKey, maxTokens, temperature, apiInspectorMode });
      },
      
      startRegionSelection: (promptId, type) => {
        set({ regionSelection: { promptId, type } });
      },
      cancelRegionSelection: () => {
        set({ regionSelection: { promptId: null, type: null } });
      },
      completeRegionSelection: (coords) => {
        const { regionSelection, prompts } = get();
        if (!regionSelection.promptId || !regionSelection.type) return;
        
        const newPrompts = prompts.map(p => 
            p.id === regionSelection.promptId 
                ? { ...p, regionCoords: coords, regionType: regionSelection.type } 
                : p
        );

        set({
            prompts: newPrompts,
            regionSelection: { promptId: null, type: null }
        });
      },

      generatePrompts: async (goal, numPrompts, includeImage, allowedTypes, replace) => {
        const { selectedImageId, apiEndpoint, modelName, apiKey, maxTokens, temperature, imageBase64s } = get();
        
        let imageBase64: string | null = null;
        if (includeImage && selectedImageId) {
          // FIX: Use fileToBase64 instead of undefined getBase64ForImage
          imageBase64 = imageBase64s[selectedImageId] || await fileToBase64(get().images.find(i => i.id === selectedImageId)!.file);
          set(state => ({ imageBase64s: { ...state.imageBase64s, [selectedImageId!]: imageBase64! } }));
        }

        const generatedPrompts = await generatePromptsApi({
            goal,
            numPrompts,
            includeImage,
            imageBase64,
            config: { apiEndpoint, modelName, apiKey, maxTokens: maxTokens || 4096, temperature },
            allowedTypes,
        });
        
        if (replace) {
          set({ prompts: generatedPrompts });
        } else {
          set(state => ({ prompts: [...state.prompts, ...generatedPrompts] }));
        }
      },

      runSingleAnalysisFlow: async (prompt: Prompt) => {
        const { selectedImageId, prompts } = get();
        if (!selectedImageId) return;

        const descendantsIds = new Set<string>();
        const findDescendants = (parentId: string) => {
            prompts.forEach(p => {
                if (p.parentId === parentId) {
                    descendantsIds.add(p.id);
                    findDescendants(p.id);
                }
            });
        };
        findDescendants(prompt.id);

        if (descendantsIds.size > 0) {
            set(state => {
                const currentImageResults = state.results[selectedImageId];
                if (!currentImageResults) return state;

                const newImageResults = { ...currentImageResults };
                let wasModified = false;
                for (const id of descendantsIds) {
                    if (id in newImageResults) {
                        delete newImageResults[id]; // Clear the entire history for the descendant
                        wasModified = true;
                    }
                }

                if (wasModified) {
                    return {
                        ...state,
                        results: {
                            ...state.results,
                            [selectedImageId]: newImageResults,
                        },
                    };
                }
                return state;
            });
        }

        const result = await runSinglePrompt(prompt, selectedImageId);
        
        if (result) {
            await handlePromptCompletion(prompt, result, selectedImageId);
        }
      },
      
      runPendingAnalysis: () => {
        const { prompts, selectedImageId, results } = get();
        if (!selectedImageId) {
            alert("Please select an image to analyze.");
            return;
        }
        const currentImageResults = results[selectedImageId] || {};
        const allPendingPrompts = prompts.filter(p => !currentImageResults[p.id] || currentImageResults[p.id].length === 0);

        if (allPendingPrompts.length === 0) return;

        const tasksToRun = new Map<string, Prompt>();

        allPendingPrompts
            .filter(p => !p.parentId)
            .forEach(p => tasksToRun.set(p.id, p));

        allPendingPrompts
            .filter(p => p.parentId)
            .forEach(child => {
                if (child.parentId) {
                    const parentResultHistory = currentImageResults[child.parentId];
                    const parentPrompt = prompts.find(p => p.id === child.parentId);
                    if (parentPrompt && parentResultHistory && parentResultHistory.length > 0) {
                      const latestParentResult = parentResultHistory[parentResultHistory.length - 1];
                      if (latestParentResult.status === 'success') {
                          tasksToRun.set(parentPrompt.id, parentPrompt);
                      }
                    }
                }
            });
        
        if (tasksToRun.size === 0) return;
        
        const runTasks = async () => {
            const taskList = Array.from(tasksToRun.values());
            set({ isAnalyzing: true, analysisProgress: { current: 1, total: taskList.length } });

            for (let i = 0; i < taskList.length; i++) {
                const task = taskList[i];
                set(state => ({ ...state, analysisProgress: { current: i + 1, total: taskList.length } }));
                await get().runSingleAnalysisFlow(task);
            }

            set({ isAnalyzing: false, analysisProgress: null });
        };

        runTasks();
      },

      runAllImagesAnalysis: () => {
        const { prompts, images } = get();
        const allImageIds = images.map(i => i.id);
        runAnalysis(prompts, allImageIds);
      },

      sendFollowUp: async (promptId, question) => {
        const { selectedImageId, prompts, results } = get();
        if (!selectedImageId) return;
        const prompt = prompts.find(p => p.id === promptId);
        if (!prompt) return;
        
        const currentHistoryArray = results[selectedImageId]?.[promptId] || [];
        if (currentHistoryArray.length === 0) return;

        const latestResult = currentHistoryArray[currentHistoryArray.length - 1];
        const conversationHistory = latestResult.conversationHistory || [];

        await runSinglePrompt(prompt, selectedImageId, conversationHistory, question);
      },
    }),
    {
      name: 'local-image-analyst-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        prompts: state.prompts,
        apiEndpoint: state.apiEndpoint,
        modelName: state.modelName,
        apiKey: state.apiKey,
        temperature: state.temperature,
        maxTokens: state.maxTokens,
        theme: state.theme,
        apiInspectorMode: state.apiInspectorMode,
      }),
      // This is a bit of a hack to prevent rehydration of file objects
      // which are not serializable. On rehydration, we will have empty image array.
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.images = [];
          state.selectedImageId = null;
          state.imageBase64s = {};
          state.results = {};
          state.overlayVisibility = {};
          state.isAnalyzing = false;
          state.analysisProgress = null;
          state.runningSinglePrompts = new Set();
        }
      }
    }
  )
);

async function runSinglePrompt(prompt: Prompt, imageId: string, conversationHistory: { question: string, answer: string }[] = [], followUpQuestion?: string): Promise<AnalysisResult | undefined> {
    const { apiEndpoint, modelName, apiKey, maxTokens, temperature, abortControllers, imageBase64s, images } = useAppStore.getState();
    const isFollowUp = !!followUpQuestion;
    const abortKey = `${imageId}-${prompt.id}`;

    if (abortControllers[abortKey]) {
        abortControllers[abortKey].abort('New request initiated');
    }
    const controller = new AbortController();
    useAppStore.setState({ abortControllers: { ...abortControllers, [abortKey]: controller } });

    const updateResultHistory = (updater: (prevHistory: AnalysisResult[]) => AnalysisResult[]) => {
      useAppStore.setState(state => {
        const currentHistory = state.results[imageId]?.[prompt.id] || [];
        const newHistory = updater(currentHistory);
        return {
          results: {
            ...state.results,
            [imageId]: {
              ...(state.results[imageId] || {}),
              [prompt.id]: newHistory,
            },
          },
        };
      });
    };
    
    const getPayload = (fullPromptText: string, imageBase64: string) => {
        const messages: any[] = [{
            role: "user",
            content: [
                { type: "text", text: fullPromptText },
                { type: "image_url", image_url: { url: imageBase64 } }
            ]
        }];

        if (isFollowUp) {
             conversationHistory.forEach((turn, index) => {
                if (index === 0 && turn.question === fullPromptText) {} 
                else { messages.push({ role: "user", content: turn.question }); }
                messages.push({ role: "assistant", content: turn.answer });
            });
            messages.push({ role: "user", content: followUpQuestion });
        }

        const body: any = {
            model: modelName,
            messages,
            stream: prompt.type === ResultType.Text,
        };
        if (maxTokens) body.max_tokens = maxTokens;
        if (temperature !== undefined) body.temperature = temperature;

        return body;
    };


    if (!isFollowUp) {
      useAppStore.setState(state => ({ runningSinglePrompts: new Set(state.runningSinglePrompts).add(prompt.id) }));
    }

    try {
        const imageBase64 = imageBase64s[imageId] || await fileToBase64(images.find(i => i.id === imageId)!.file);
        useAppStore.setState(state => ({ imageBase64s: { ...state.imageBase64s, [imageId]: imageBase64 } }));

        const fullPromptText = getFullPromptText(prompt);
        const requestPayload = getPayload(fullPromptText, imageBase64);

        if (isFollowUp) {
            updateResultHistory(prev => {
                const newHistory = [...prev];
                if (newHistory.length > 0) {
                    const lastResult = { ...newHistory[newHistory.length - 1] };
                    lastResult.conversationHistory = [...(lastResult.conversationHistory || []), { question: followUpQuestion!, answer: '' }];
                    lastResult.requestPayload = requestPayload;
                    newHistory[newHistory.length - 1] = lastResult;
                }
                return newHistory;
            });
        } else {
            const newResult: AnalysisResult = { promptId: prompt.id, status: 'loading', data: null, requestPayload };
            updateResultHistory(prev => [...prev, newResult]);
        }
        
        if (prompt.type === ResultType.Text) {
            const stream = fetchAnalysisStream({
                prompt, imageBase64, config: { apiEndpoint, modelName, apiKey, maxTokens, temperature },
                conversationHistory, followUpQuestion, signal: controller.signal,
            });

            let finalResultData = '';
            for await (const chunk of stream) {
                if (chunk.type === 'delta') {
                    finalResultData += chunk.content;
                    updateResultHistory(prev => {
                        const newHistory = [...prev];
                        if (newHistory.length > 0) {
                            const lastResult = { ...newHistory[newHistory.length - 1] };
                            if (isFollowUp) {
                                const newConvHistory = [...(lastResult.conversationHistory || [])];
                                if (newConvHistory.length > 0) newConvHistory[newConvHistory.length - 1].answer += chunk.content;
                                lastResult.conversationHistory = newConvHistory;
                            } else {
                                lastResult.data = (lastResult.data as string || '') + chunk.content;
                            }
                            newHistory[newHistory.length - 1] = lastResult;
                        }
                        return newHistory;
                    });
                } else if (chunk.type === 'error') { throw new Error(chunk.error); }
            }
            
            const finalResultDataTrimmed = finalResultData.trim();
            const finalConversation = isFollowUp 
                ? conversationHistory.concat({ question: followUpQuestion!, answer: finalResultDataTrimmed })
                : [{ question: fullPromptText, answer: finalResultDataTrimmed }];
            
            let finalResultForReturn: AnalysisResult | undefined;
            updateResultHistory(prev => {
                const newHistory = [...prev];
                if (newHistory.length === 0) return prev; // Should not happen

                const updatedResult = { ...newHistory[newHistory.length - 1] };
                
                updatedResult.status = 'success';
                updatedResult.conversationHistory = finalConversation;
                updatedResult.rawResponse = { type: 'streamed_text', content: finalResultDataTrimmed };

                if (!isFollowUp) {
                    updatedResult.data = finalResultDataTrimmed;
                }

                newHistory[newHistory.length - 1] = updatedResult;
                finalResultForReturn = updatedResult; 

                return newHistory;
            });

            return finalResultForReturn;

        } else {
            const { parsedData: resultData, rawResponse } = await fetchAnalysis({ prompt, imageBase64, config: { apiEndpoint, modelName, apiKey, maxTokens, temperature }, signal: controller.signal });
            if (prompt.type === ResultType.BoundingBox) {
                useAppStore.setState(state => ({
                    overlayVisibility: { ...state.overlayVisibility, [imageId]: { ...(state.overlayVisibility[imageId] || {}), [prompt.id]: (resultData as BoundingBox[]).length > 0 } }
                }));
            }
            const successResult: AnalysisResult = { promptId: prompt.id, status: 'success', data: resultData, conversationHistory: [{ question: fullPromptText, answer: JSON.stringify(resultData) }], requestPayload, rawResponse };
            updateResultHistory(prev => prev.slice(0, -1).concat(successResult));
            return successResult;
        }
    } catch (error) {
        if ((error as Error).name === 'AbortError') { console.log(`Request for prompt ${prompt.id} was aborted.`); return undefined; }
        console.error("Analysis error for prompt:", prompt.text, error);
        const errorResult: AnalysisResult = { promptId: prompt.id, status: 'error', data: null, error: (error as Error).message };
        updateResultHistory(prev => prev.slice(0, -1).concat(errorResult));
        return errorResult;
    } finally {
        const { abortControllers } = useAppStore.getState();
        delete abortControllers[abortKey];
        useAppStore.setState({ abortControllers });
        if (!isFollowUp) {
          useAppStore.setState(state => {
            const next = new Set(state.runningSinglePrompts);
            next.delete(prompt.id);
            return { runningSinglePrompts: next };
          });
        }
    }
}

async function handlePromptCompletion(prompt: Prompt, result: AnalysisResult, imageId: string) {
    const { prompts, results, apiEndpoint, modelName, apiKey, maxTokens, temperature, images, imageBase64s } = useAppStore.getState();
    const currentImageResults = () => useAppStore.getState().results[imageId] || {};

    if (prompt.type === ResultType.YesNo && result.status === 'success' && typeof result.data === 'string') {
        const answer = result.data.toLowerCase().trim();
        const conditionMet: 'yes' | 'no' = answer.includes('yes') ? 'yes' : 'no';
        const childrenToRun = prompts.filter(c => c.parentId === prompt.id && c.condition === conditionMet && (!currentImageResults()[c.id] || currentImageResults()[c.id].length === 0));
        for (const child of childrenToRun) { await runSinglePrompt(child, imageId); }
    }

    if (prompt.type === ResultType.Score && result.status === 'success' && typeof result.data === 'number') {
        const score = result.data;
        const childrenToRun = prompts.filter(child => {
            if (child.parentId !== prompt.id || (currentImageResults()[child.id] && currentImageResults()[child.id].length > 0)) return false;
            const op = child.scoreConditionOperator;
            const val = child.scoreConditionValue;
            if (op && typeof val === 'number') {
                if (op === 'above' && score > val) return true;
                if (op === 'below' && score < val) return true;
            }
            return false;
        });
        for (const child of childrenToRun) { await runSinglePrompt(child, imageId); }
    }

    if (prompt.type === ResultType.BoundingBox && result.status === 'success' && Array.isArray(result.data) && result.data.length > 0) {
        const bboxes = result.data as BoundingBox[];
        const childrenToRun = prompts.filter(c => c.parentId === prompt.id && (!currentImageResults()[c.id] || currentImageResults()[c.id].length === 0));
        
        if (childrenToRun.length === 0) return;

        const imageBase64 = imageBase64s[imageId] || await fileToBase64(images.find(i => i.id === imageId)!.file);
        useAppStore.setState(state => ({ imageBase64s: { ...state.imageBase64s, [imageId]: imageBase64 } }));
        const apiConfig = { apiEndpoint, modelName, apiKey, maxTokens, temperature };

        for (const child of childrenToRun) {
            const loadingResult: AnalysisResult = { promptId: child.id, status: 'loading', data: [] };
            useAppStore.setState(state => ({ results: { ...state.results, [imageId]: { ...(state.results[imageId] || {}), [child.id]: [loadingResult] } } }));
            
            const childResultsPromises = bboxes.map(bbox => fetchBboxChildAnalysis({ prompt: child, bbox, imageBase64, config: apiConfig }));
            const resolvedChildResults = await Promise.all(childResultsPromises);
            const finalChildData = resolvedChildResults.filter(r => r !== null) as BboxChildResult[];

            const successResult: AnalysisResult = { promptId: child.id, status: 'success', data: finalChildData };
            useAppStore.setState(state => ({ results: { ...state.results, [imageId]: { ...(state.results[imageId] || {}), [child.id]: [successResult] } } }));
        }
    }
}

async function runAnalysis(targetPrompts: Prompt[], imageIds: string[]) {
    if (imageIds.length === 0) return;

    useAppStore.setState({ isAnalyzing: true, analysisProgress: { current: 0, total: imageIds.length } });

    for (let i = 0; i < imageIds.length; i++) {
        const imageId = imageIds[i];
        useAppStore.setState(state => ({ 
            analysisProgress: { current: i + 1, total: imageIds.length },
            analysisStates: { ...state.analysisStates, [imageId]: 'loading' }
        }));
        
        let imageHadError = false;
        const independentPrompts = targetPrompts.filter(p => !p.parentId);
        
        for (const p of independentPrompts) {
            const currentResults = useAppStore.getState().results;
            if (currentResults[imageId]?.[p.id]?.length > 0) { continue; }
            const result = await runSinglePrompt(p, imageId);
            if (result?.status === 'error') { imageHadError = true; }
            if (result) { await handlePromptCompletion(p, result, imageId); }
        }
        useAppStore.setState(state => ({ 
            analysisStates: { ...state.analysisStates, [imageId]: imageHadError ? 'error' : 'success' }
        }));
    }

    useAppStore.setState({ isAnalyzing: false, analysisProgress: null });
}