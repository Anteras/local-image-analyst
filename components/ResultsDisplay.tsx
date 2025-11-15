import React, { useState, useEffect } from 'react';
import { type Prompt, type AnalysisResult, ResultType, type BoundingBox, type BboxChildResult } from '../types';
import { EyeIcon, EyeOffIcon, ArrowsExpandIcon, CheckCircleIcon, XCircleIcon, ChevronDownIcon, SpinnerIcon, ClipboardIcon, ArrowLeftIcon, ArrowRightIcon } from './icons';
import ExportButton from './ExportButton';
import { useAppStore } from '../store';

interface ResultsDisplayProps {
  prompts: Prompt[];
  results: Record<string, AnalysisResult[]>;
  overlayVisibility: Record<string, boolean>;
  setOverlayVisibility: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onMaximizeText: (text: string) => void;
  imageBase64: string | null;
  imageFileName: string | null;
}

const SimpleMarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  const toHtml = (markdown: string) => {
    if (typeof markdown !== 'string') return '';
    return markdown
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mb-1">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mb-2">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-extrabold mb-3">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em><em>$1</em></em>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div
      className="text-text-secondary text-sm"
      dangerouslySetInnerHTML={{ __html: toHtml(text) }}
    />
  );
};

const FollowUpConversation: React.FC<{
  prompt: Prompt;
  result: AnalysisResult;
}> = ({ prompt, result }) => {
  const { sendFollowUp } = useAppStore.getState();
  const [followUpText, setFollowUpText] = React.useState('');
  const [isExpanded, setIsExpanded] = React.useState(true);
  const history = result.conversationHistory || [];
  const conversationTurns = history.slice(1);
  const isProcessingFollowUp = history.length > 0 && history[history.length - 1].answer === '';

  const handleSend = () => {
    if (followUpText.trim() && !isProcessingFollowUp) {
      sendFollowUp(prompt.id, followUpText);
      setFollowUpText('');
      setIsExpanded(true);
    }
  };
  
  const hasConversation = conversationTurns.length > 0;

  return (
    <div className="mt-4 pt-3 border-t border-brand-tertiary">
       {hasConversation && (
         <div className="mb-3">
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="text-xs font-semibold text-brand-accent hover:underline mb-2 flex items-center gap-1"
            >
              {isExpanded ? 'Hide Conversation' : `Show Conversation (${conversationTurns.length} turn${conversationTurns.length > 1 ? 's' : ''})`}
              <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDownIcon />
              </div>
            </button>
            {isExpanded && (
              <div className="space-y-3 text-sm max-h-64 overflow-y-auto pr-2">
                {conversationTurns.map((turn, index) => (
                  <div key={index} className="space-y-2">
                    <div className="p-2 rounded-md">
                      <p className="font-semibold text-text-tertiary text-xs">You</p>
                      <p className="text-text-secondary">{turn.question}</p>
                    </div>
                    <div className="p-2 rounded-md bg-brand-tertiary/50">
                      <p className="font-semibold text-text-tertiary text-xs">AI Response</p>
                       {turn.answer === '' ? (
                         <div className="flex items-center gap-2 text-sm text-text-tertiary italic">
                             <SpinnerIcon />
                             <span>AI is thinking...</span>
                         </div>
                       ) : (
                         <SimpleMarkdownRenderer text={turn.answer} />
                       )}
                    </div>
                  </div>
                ))}
              </div>
            )}
         </div>
       )}
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={followUpText}
          onChange={(e) => setFollowUpText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ask a follow-up..."
          disabled={isProcessingFollowUp}
          className="w-full bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={isProcessingFollowUp}
          className="bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          Send
        </button>
      </div>
    </div>
  );
};


const CollapsibleTextView: React.FC<{ text: string, onMaximize: () => void, hasConversation: boolean }> = ({ text, onMaximize, hasConversation }) => {
    const isLong = typeof text === 'string' && text.length > 300;
    const [isCollapsed, setIsCollapsed] = React.useState(isLong && !hasConversation);

    return (
        <div>
            <div className={`relative ${isCollapsed ? 'max-h-24 overflow-hidden' : ''}`}>
                <SimpleMarkdownRenderer text={text} />
                {isCollapsed && <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-brand-secondary"></div>}
            </div>
            <div className="mt-2 flex items-center gap-4">
                 {isLong && (
                    <button onClick={() => setIsCollapsed(!isCollapsed)} className="text-xs text-brand-accent hover:underline">
                        {isCollapsed ? 'Show More' : 'Show Less'}
                    </button>
                )}
                <button onClick={onMaximize} className="text-text-tertiary hover:text-brand-accent" title="Maximize">
                    <ArrowsExpandIcon />
                </button>
            </div>
        </div>
    )
}

const BboxChildResultDisplay: React.FC<{
    prompt: Prompt;
    resultData: string | number | null;
}> = ({ prompt, resultData }) => {
    const renderMiniContent = () => {
        if (typeof resultData === 'string' && resultData.startsWith('Error:')) {
            return <p className="text-red-400 text-xs">{resultData}</p>;
        }
        switch (prompt.type) {
            case ResultType.Text:
                return <p className="text-text-secondary text-xs whitespace-pre-wrap">{resultData as string}</p>;
            case ResultType.Number:
                const num = parseFloat(resultData as any);
                return <span className="text-xl font-bold text-brand-accent">{isNaN(num) ? 'N/A' : num}</span>;
            case ResultType.YesNo:
                const answer = (resultData as string)?.toLowerCase().trim() || '';
                const isYes = answer.includes('yes');
                return (
                    <div className="flex items-center gap-1">
                        {isYes ? <CheckCircleIcon className="h-5 w-5 text-green-400" /> : <XCircleIcon className="h-5 w-5 text-red-400" />}
                        <span className={`text-lg font-bold ${isYes ? 'text-green-400' : 'text-red-400'}`}>{isYes ? 'Yes' : 'No'}</span>
                    </div>
                );
            case ResultType.Score:
                const scoreValue = parseFloat(resultData as any);
                if (isNaN(scoreValue)) {
                    return <span className="text-xl font-bold text-brand-accent">N/A</span>;
                }
                const [min, max] = prompt.scoreRange || [0, 10];
                return (
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-brand-accent">{scoreValue.toFixed(1)}</span>
                        <span className="text-xs text-text-tertiary">/ {max}</span>
                    </div>
                );
            default: return null;
        }
    };
    return (
        <div className="mt-2">
            <p className="text-xs font-semibold text-text-tertiary truncate" title={prompt.text}>{prompt.text}</p>
            {renderMiniContent()}
        </div>
    );
};

const getResultAsString = (prompt: Prompt, result: AnalysisResult): string => {
    if (result.status !== 'success') return `${result.status}...`;
    switch (prompt.type) {
        case ResultType.Text:
        case ResultType.YesNo:
            return result.data as string;
        case ResultType.Number:
        case ResultType.Score:
            return (result.data as number).toString();
        case ResultType.BoundingBox:
            const boxes = result.data as BoundingBox[];
            if (!boxes || boxes.length === 0) return "No objects detected.";
            return boxes.map(b => `${b.label}: [${b.box.join(', ')}]`).join('\n');
        case ResultType.Category:
             return result.data as string;
        case ResultType.JSON:
             return JSON.stringify(result.data, null, 2);
        default:
            return 'N/A';
    }
}

const ResultCard: React.FC<{
  prompts: Prompt[];
  results: Record<string, AnalysisResult[]>;
  prompt: Prompt;
  resultHistory: AnalysisResult[];
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  onMaximizeText: (text: string) => void;
}> = ({ prompts, results, prompt, resultHistory, isVisible, onToggleVisibility, onMaximizeText }) => {
  const { apiInspectorMode } = useAppStore();
  const [historyIndex, setHistoryIndex] = useState(resultHistory.length - 1);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    setHistoryIndex(resultHistory.length - 1);
  }, [resultHistory]);

  const currentResult = resultHistory[historyIndex];
  if (!currentResult) return null;

  const handleMaximize = () => {
    if (prompt.type !== ResultType.Text) return;
    
    const history = currentResult.conversationHistory || [];
    if (history.length === 0) {
        if (typeof currentResult.data === 'string') {
            onMaximizeText(currentResult.data);
        }
        return;
    }

    const fullConversationText = history.map((turn, index) => {
        if (index === 0) {
            return `## Initial Response\n\n${turn.answer.trim()}`;
        }
        return `### You\n\n${turn.question.trim()}\n\n### AI Response\n\n${turn.answer.trim()}`;
    }).join('\n\n---\n\n');

    onMaximizeText(fullConversationText);
  };

   const handleCopy = () => {
    let textToCopy = '';
    if (apiInspectorMode) {
        const inspectionData = {
            request: currentResult.requestPayload || 'No request payload data available.',
            response: currentResult.rawResponse || 'No raw response data available.'
        };
        textToCopy = JSON.stringify(inspectionData, null, 2);
    } else {
        textToCopy = getResultAsString(prompt, currentResult);
    }
    navigator.clipboard.writeText(textToCopy).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const goToPrev = () => setHistoryIndex(i => Math.max(0, i - 1));
  const goToNext = () => setHistoryIndex(i => Math.min(resultHistory.length - 1, i + 1));


  const renderContent = () => {
    switch (currentResult.status) {
      case 'loading':
        return <div className="animate-pulse h-5 bg-brand-tertiary rounded w-3/4"></div>;
      case 'error':
        return <p className="text-red-400 text-sm">Error: {currentResult.error}</p>;
      case 'success':
        const hasFollowUps = !!currentResult.conversationHistory && currentResult.conversationHistory.length > 1;
        switch (prompt.type) {
          case ResultType.Text:
            if (currentResult.data === '' && !currentResult.conversationHistory?.length) {
                return (
                    <div className="flex items-center gap-2 text-sm text-text-tertiary italic">
                        <SpinnerIcon />
                        <span>AI is thinking...</span>
                    </div>
                );
            }
            return (
              <>
                <CollapsibleTextView 
                    text={currentResult.data as string} 
                    onMaximize={handleMaximize} 
                    hasConversation={hasFollowUps}
                />
                <FollowUpConversation prompt={prompt} result={currentResult} />
              </>
            );
          case ResultType.Number:
            const num = currentResult.data as number;
            return <span className="text-3xl font-bold text-brand-accent">{isNaN(num) ? 'N/A' : num}</span>;
          case ResultType.YesNo:
            const answer = (currentResult.data as string)?.toLowerCase().trim() || '';
            const isYes = answer.includes('yes');
            return (
                <div className="flex items-center gap-2">
                    {isYes ? <CheckCircleIcon className="h-8 w-8 text-green-400" /> : <XCircleIcon className="h-8 w-8 text-red-400" />}
                    <span className={`text-2xl font-bold ${isYes ? 'text-green-400' : 'text-red-400'}`}>
                        {isYes ? 'Yes' : 'No'}
                    </span>
                    <span className="text-sm text-text-tertiary ml-2 truncate" title={currentResult.data as string}>({currentResult.data as string})</span>
                </div>
            );
          case ResultType.Score:
            const score = currentResult.data as number;
            const [min, max] = prompt.scoreRange || [0, 10];
            const percentage = max > min ? ((score - min) / (max - min)) * 100 : 0;
            return (
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-3xl font-bold text-brand-accent">{isNaN(score) ? 'N/A' : score.toFixed(1)}</span>
                    <span className="text-sm text-text-tertiary">/ {max}</span>
                </div>
                <div className="w-full bg-brand-tertiary rounded-full h-2.5">
                    <div className="bg-brand-accent h-2.5 rounded-full" style={{ width: `${isNaN(score) ? 0 : Math.max(0, Math.min(100, percentage))}%` }}></div>
                </div>
              </div>
            );
          case ResultType.BoundingBox:
            const boxes = currentResult.data as BoundingBox[];
            if (!boxes || boxes.length === 0) {
                return <p className="text-text-tertiary text-sm">No objects detected.</p>
            }
            
            const childrenPrompts = prompts.filter(p => {
                if (p.parentId !== prompt.id) return false;
                const childResultHistory = results[p.id];
                return childResultHistory && childResultHistory.length > 0;
            });

            const colors = ['#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];
            
            if (childrenPrompts.length === 0) {
                return <p className="text-text-secondary text-sm">Detected {boxes.length} object{boxes.length > 1 ? 's' : ''}. Toggle visibility to see them on the image.</p>
            }

            return (
                <div>
                    <p className="text-text-secondary text-sm mb-3">Detected {boxes.length} object{boxes.length > 1 ? 's' : ''} with follow-up analysis:</p>
                    <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {boxes.map((box, index) => (
                            <div key={index} className="bg-brand-primary p-3 rounded-md">
                                <h5 className="font-bold text-text-primary text-sm flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full" style={{backgroundColor: colors[index % colors.length]}}></span>
                                    {box.label}
                                </h5>
                                <div className="pl-5 mt-2 space-y-2">
                                    {childrenPrompts.map(childPrompt => {
                                        const childResultHistory = results[childPrompt.id];
                                        if (!childResultHistory || childResultHistory.length === 0) return null;
                                        const childResult = childResultHistory[childResultHistory.length - 1]; // Show latest child result

                                        if (childResult.status === 'loading') {
                                            return <div key={childPrompt.id} className="flex items-center gap-2 text-xs text-text-tertiary"><SpinnerIcon /><span>{childPrompt.text}</span></div>
                                        }

                                        if (childResult.status !== 'success' || !Array.isArray(childResult.data)) return null;

                                        const childResultData = childResult.data as BboxChildResult[];
                                        const boxResult = childResultData.find(cr => 
                                            cr.parentBox.label === box.label && 
                                            JSON.stringify(cr.parentBox.box) === JSON.stringify(box.box)
                                        );
                                        
                                        if (boxResult) {
                                            return <BboxChildResultDisplay key={childPrompt.id} prompt={childPrompt} resultData={boxResult.resultData} />;
                                        }
                                        return null;
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
          case ResultType.Category:
            return (
                <div className="flex items-center">
                    <span className="bg-brand-accent text-white text-sm font-semibold px-3 py-1 rounded-full">
                        {currentResult.data as string}
                    </span>
                </div>
            );
          case ResultType.JSON:
            try {
                const jsonData = typeof currentResult.data === 'string' 
                    ? JSON.parse(currentResult.data) 
                    : currentResult.data;
                return (
                    <pre className="text-xs bg-brand-primary p-3 rounded-md max-h-64 overflow-auto text-text-secondary">
                        <code>{JSON.stringify(jsonData, null, 2)}</code>
                    </pre>
                );
            } catch (e) {
                return <p className="text-red-400 text-sm">Error: Invalid JSON response received.</p>;
            }
          default:
            return <p className="text-text-tertiary">Unknown result type.</p>;
        }
      default:
        return null;
    }
  };

  const getTitle = () => {
      let typeName: string;
      switch (prompt.type) {
        case ResultType.Text: typeName = 'Text'; break;
        case ResultType.BoundingBox: typeName = 'Bounding Box'; break;
        case ResultType.Score: typeName = 'Score'; break;
        case ResultType.Number: typeName = 'Number'; break;
        case ResultType.YesNo: typeName = 'Yes/No'; break;
        case ResultType.Category: typeName = 'Category'; break;
        case ResultType.JSON: typeName = 'JSON'; break;
        default:
          const typeString = prompt.type as string;
          typeName = typeString.charAt(0).toUpperCase() + typeString.slice(1);
          break;
      }
      
      const title = `${typeName} Analysis`;
      
      if (prompt.parentId) {
          return `Conditional ${title}`;
      }
      return title;
  }

  return (
    <div className="bg-brand-secondary p-4 rounded-lg">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-grow">
            <h4 className="font-bold text-text-primary">{getTitle()}</h4>
            <p className="text-xs text-text-tertiary italic mb-3 line-clamp-2">"{prompt.text}"</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
            {resultHistory.length > 1 && (
                <div className="flex items-center gap-1.5 text-text-tertiary bg-brand-primary px-2 py-1 rounded-md">
                    <button onClick={goToPrev} disabled={historyIndex === 0} className="disabled:opacity-40 hover:text-text-primary transition-colors"><ArrowLeftIcon /></button>
                    <span className="text-xs font-mono select-none">{historyIndex + 1}/{resultHistory.length}</span>
                    <button onClick={goToNext} disabled={historyIndex === resultHistory.length - 1} className="disabled:opacity-40 hover:text-text-primary transition-colors"><ArrowRightIcon /></button>
                </div>
            )}
             <button onClick={handleCopy} className="text-text-tertiary hover:text-brand-accent transition-colors p-1" title={apiInspectorMode ? "Copy API Payload" : "Copy Result"}>
                {copySuccess ? <CheckCircleIcon className="h-5 w-5 text-green-500" /> : <ClipboardIcon />}
            </button>
            {prompt.type === ResultType.BoundingBox && currentResult.status === 'success' && (
                <button onClick={onToggleVisibility} className="text-text-tertiary hover:text-brand-accent transition-colors p-1">
                    {isVisible ? <EyeOffIcon /> : <EyeIcon />}
                </button>
            )}
        </div>
      </div>
      {renderContent()}
    </div>
  );
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ prompts, results, overlayVisibility, setOverlayVisibility, onMaximizeText, imageBase64, imageFileName }) => {
  const topLevelPromptsWithResults = prompts.filter(p => !p.parentId && results[p.id] && results[p.id].length > 0);

  if (topLevelPromptsWithResults.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-text-primary">Analysis Results</h2>
        <ExportButton 
            prompts={prompts} 
            results={results}
            imageBase64={imageBase64}
            imageFileName={imageFileName}
        />
      </div>
      <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
        {topLevelPromptsWithResults.map(prompt => {
            const resultHistory = results[prompt.id] || [];
            if (resultHistory.length === 0) return null;

            const childrenPrompts = prompts.filter(p => 
                p.parentId === prompt.id && 
                results[p.id] &&
                results[p.id].length > 0 &&
                prompt.type === ResultType.YesNo
            );

            return (
                <div key={prompt.id} className="break-inside-avoid mb-6 flex flex-col gap-4">
                    <ResultCard
                        prompts={prompts}
                        results={results}
                        prompt={prompt}
                        resultHistory={resultHistory}
                        isVisible={overlayVisibility[prompt.id]}
                        onToggleVisibility={() => setOverlayVisibility(prev => ({...prev, [prompt.id]: !prev[prompt.id]}))}
                        onMaximizeText={onMaximizeText}
                    />
                    {childrenPrompts.length > 0 && (
                        <div className="pl-4 border-l-2 border-brand-tertiary flex flex-col gap-4">
                            {childrenPrompts.map(childPrompt => (
                                <ResultCard
                                    key={childPrompt.id}
                                    prompts={prompts}
                                    results={results}
                                    prompt={childPrompt}
                                    resultHistory={results[childPrompt.id]}
                                    isVisible={overlayVisibility[childPrompt.id]}
                                    onToggleVisibility={() => setOverlayVisibility(prev => ({...prev, [childPrompt.id]: !prev[childPrompt.id]}))}
                                    onMaximizeText={onMaximizeText}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )
        })}
      </div>
    </div>
  );
};

export default ResultsDisplay;