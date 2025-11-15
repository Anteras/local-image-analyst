import React, { useState } from 'react';
import { type Prompt, type AnalysisResult, ResultType } from '../types';
import { PlusIcon, TrashIcon, PlayIcon, SitemapIcon, DragHandleIcon, SpinnerIcon, SparklesIcon, CogIcon, MapPinIcon, ViewfinderCircleIcon, XCircleIcon } from './icons';
import ManagePromptsModal from './ManagePromptsModal';
import PromptSettingsModal from './PromptSettingsModal';
import { useAppStore } from '../store';

interface PromptCardProps {
  prompt: Prompt;
  allPrompts: Prompt[];
  results: Record<string, AnalysisResult[]>;
  onUpdate: (id: string, newPrompt: Partial<Prompt>) => void;
  onDelete: (id: string) => void;
  onRun: (prompt: Prompt) => void;
  onAddChild: (parentId: string) => void;
  onOpenSettings: (prompt: Prompt) => void;
  onStartRegionSelection: (promptId: string, type: 'point' | 'bbox') => void;
  isAnalyzing: boolean;
  imageLoaded: boolean;
  isPromptRunning: boolean;
}

const PromptCard: React.FC<PromptCardProps> = ({ prompt, allPrompts, results, onUpdate, onDelete, onRun, onAddChild, onOpenSettings, onStartRegionSelection, isAnalyzing, imageLoaded, isPromptRunning }) => {
  const isChild = !!prompt.parentId;
  const parentPrompt = isChild ? allPrompts.find(p => p.id === prompt.parentId) : null;

  const handleTypeChange = (newType: ResultType) => {
    const update: Partial<Prompt> = { type: newType };
    if (newType === ResultType.Score && !prompt.scoreRange) {
        update.scoreRange = [0, 10];
    }
    onUpdate(prompt.id, update);
  };
  
  const needsConfiguration =
    (prompt.type === ResultType.Category && (!prompt.categories || prompt.categories.length === 0)) ||
    (prompt.type === ResultType.JSON && (!prompt.jsonSchema || prompt.jsonSchema.trim() === ''));

  const hasResult = results[prompt.id] && results[prompt.id].length > 0;
    
  const getRunButtonTitle = () => {
    if (needsConfiguration) return 'Prompt needs configuration';
    if (isChild) return "Conditional prompts run automatically";
    if (hasResult) return 'Rerun analysis';
    return "Run this prompt";
  };
    
  return (
    <div className="bg-brand-tertiary p-3 rounded-md flex flex-col gap-2">
      {isChild && parentPrompt?.type === ResultType.YesNo && (
        <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text-tertiary">Run when parent is:</span>
            <button 
                onClick={() => onUpdate(prompt.id, { condition: 'yes' })}
                className={`text-xs px-2 py-0.5 rounded transition-colors ${prompt.condition === 'yes' ? 'bg-green-600 text-white font-bold' : 'bg-brand-primary text-text-secondary'}`}
            >
                YES
            </button>
            <button 
                  onClick={() => onUpdate(prompt.id, { condition: 'no' })}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${prompt.condition === 'no' ? 'bg-red-600 text-white font-bold' : 'bg-brand-primary text-text-secondary'}`}
            >
                NO
            </button>
        </div>
      )}
      {isChild && parentPrompt?.type === ResultType.Score && (
          <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-tertiary">Run when score is:</span>
              <select
                  value={prompt.scoreConditionOperator || 'above'}
                  onChange={(e) => onUpdate(prompt.id, { scoreConditionOperator: e.target.value as 'above' | 'below' })}
                  className="bg-brand-primary text-text-secondary text-xs rounded-md p-1 focus:ring-2 focus:ring-brand-accent focus:outline-none"
              >
                  <option value="above">Above</option>
                  <option value="below">Below</option>
              </select>
              <input 
                  type="number"
                  value={prompt.scoreConditionValue ?? ''}
                  onChange={(e) => onUpdate(prompt.id, { scoreConditionValue: parseFloat(e.target.value) })}
                  className="w-16 bg-brand-primary text-text-secondary text-xs rounded-md p-1 focus:ring-2 focus:ring-brand-accent focus:outline-none"
                  placeholder={`e.g. ${(parentPrompt.scoreRange || [0,10]).reduce((a, b) => a + b) / 2}`}
                  step="0.1"
              />
          </div>
      )}
      <div className="flex gap-2">
        {!isChild && (
            <div className="text-text-tertiary pt-2 cursor-grab">
                <DragHandleIcon className="h-5 w-5" />
            </div>
        )}
        <textarea
            value={prompt.text}
            onChange={(e) => onUpdate(prompt.id, { text: e.target.value })}
            className="w-full flex-grow bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none resize-y min-h-[80px]"
            placeholder="Enter your analysis prompt..."
        />
      </div>
      {prompt.type === ResultType.Score && (
          <div className="flex items-center gap-2">
              <label className="text-xs text-text-tertiary">Range:</label>
              <input 
                  type="number"
                  value={prompt.scoreRange?.[0] ?? 0}
                  onChange={(e) => onUpdate(prompt.id, { scoreRange: [Number(e.target.value), prompt.scoreRange?.[1] ?? 10] })}
                  className="w-16 bg-brand-primary text-text-secondary text-xs rounded-md p-1 focus:ring-2 focus:ring-brand-accent focus:outline-none"
              />
              <span className="text-xs text-text-tertiary">to</span>
              <input 
                  type="number"
                  value={prompt.scoreRange?.[1] ?? 10}
                  onChange={(e) => onUpdate(prompt.id, { scoreRange: [prompt.scoreRange?.[0] ?? 0, Number(e.target.value)] })}
                  className="w-16 bg-brand-primary text-text-secondary text-xs rounded-md p-1 focus:ring-2 focus:ring-brand-accent focus:outline-none"
              />
          </div>
      )}
      {prompt.type === ResultType.Text && (
          <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-tertiary">Target:</span>
              {prompt.regionCoords ? (
                <div className="flex items-center gap-2 text-xs bg-brand-primary px-2 py-1 rounded-md text-text-secondary">
                    <span>{prompt.regionType === 'point' ? 'Point' : 'Box'} @ [{prompt.regionCoords.join(', ')}]</span>
                    <button onClick={() => onUpdate(prompt.id, { regionCoords: undefined, regionType: undefined })} className="text-text-tertiary hover:text-red-500"><XCircleIcon className="h-4 w-4" /></button>
                </div>
              ) : (
                <span className="text-xs text-text-tertiary italic">None selected</span>
              )}
          </div>
      )}
      <div className="flex items-center justify-between">
        <select
          value={prompt.type}
          onChange={(e) => handleTypeChange(e.target.value as ResultType)}
          className="bg-brand-primary text-text-secondary text-xs rounded-md p-1.5 focus:ring-2 focus:ring-brand-accent focus:outline-none"
        >
          <option value={ResultType.Text}>Text</option>
          <option value={ResultType.BoundingBox}>Bounding Box</option>
          <option value={ResultType.Score}>Score</option>
          <option value={ResultType.Number}>Number</option>
          <option value={ResultType.YesNo}>Yes/No</option>
          <option value={ResultType.Category}>Category</option>
          <option value={ResultType.JSON}>JSON</option>
        </select>
        <div className="flex items-center gap-1">
          {prompt.type === ResultType.Text && (
            <>
              <button onClick={() => onStartRegionSelection(prompt.id, 'point')} className="p-1.5 text-text-tertiary hover:text-brand-accent transition-colors" title="Select Point"><MapPinIcon/></button>
              <button onClick={() => onStartRegionSelection(prompt.id, 'bbox')} className="p-1.5 text-text-tertiary hover:text-brand-accent transition-colors" title="Select Bounding Box"><ViewfinderCircleIcon/></button>
            </>
          )}
          {(prompt.type === ResultType.YesNo || prompt.type === ResultType.BoundingBox || prompt.type === ResultType.Score) && !isChild && (
            <button
                onClick={() => onAddChild(prompt.id)}
                className="p-1.5 text-text-tertiary hover:text-brand-accent transition-colors"
                title="Add conditional prompt"
            >
                <SitemapIcon />
            </button>
          )}
          {(prompt.type === ResultType.Category || prompt.type === ResultType.JSON) && (
             <button
                onClick={() => onOpenSettings(prompt)}
                className="relative p-1.5 text-text-tertiary hover:text-brand-accent transition-colors"
                title="Configure prompt"
            >
                <CogIcon />
                {needsConfiguration && <div className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full border border-brand-secondary"></div>}
            </button>
          )}
          <button
            onClick={() => onRun(prompt)}
            disabled={isAnalyzing || !imageLoaded || isChild || isPromptRunning || needsConfiguration}
            className="p-1.5 text-text-tertiary hover:text-green-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            title={getRunButtonTitle()}
          >
            {isPromptRunning ? <SpinnerIcon /> : <PlayIcon />}
          </button>
          <button
            onClick={() => onDelete(prompt.id)}
            className="p-1.5 text-text-tertiary hover:text-red-500 transition-colors"
            title="Delete prompt"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
};

interface PromptNodeProps extends Omit<PromptCardProps, 'isPromptRunning' | 'allPrompts'> {
  allPrompts: Prompt[];
  results: Record<string, AnalysisResult[]>;
  onDrop: (draggedId: string, targetId: string) => void;
  draggingId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  runningSinglePrompts: Set<string>;
}

const PromptNode: React.FC<PromptNodeProps> = ({ prompt, allPrompts, results, onDrop, draggingId, runningSinglePrompts, ...props }) => {
    const children = allPrompts.filter(p => p.parentId === prompt.id);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    const isDraggable = !prompt.parentId;

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        if (!isDraggable) return;
        e.dataTransfer.setData('application/prompt-id', prompt.id);
        e.dataTransfer.effectAllowed = 'move';
        props.onDragStart(prompt.id);
    };

    const handleDragEnd = () => {
        props.onDragEnd();
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (isDraggable && draggingId && draggingId !== prompt.id) {
            setIsDraggingOver(true);
        }
    };
    
    const handleDragLeave = () => {
        setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingOver(false);
        if (isDraggable) {
            const draggedId = e.dataTransfer.getData('application/prompt-id');
            if (draggedId && draggedId !== prompt.id) {
                onDrop(draggedId, prompt.id);
            }
        }
    };
    
    const isBeingDragged = draggingId === prompt.id;

    return (
        <div
            className={`relative transition-opacity ${isDraggable ? '' : ''} ${isBeingDragged ? 'opacity-40' : ''}`}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDraggingOver && <div className="absolute top-[-4px] left-0 right-0 h-1.5 bg-brand-accent rounded-full z-10" />}
            <PromptCard 
                prompt={prompt}
                allPrompts={allPrompts}
                results={results}
                {...props} 
                isPromptRunning={runningSinglePrompts.has(prompt.id)}
            />
            {children.length > 0 && (
                <div className="ml-4 pl-3 mt-3 border-l-2 border-brand-tertiary space-y-3">
                    {children.map(child => (
                        <PromptNode key={child.id} prompt={child} allPrompts={allPrompts} onDrop={onDrop} draggingId={draggingId} runningSinglePrompts={runningSinglePrompts} results={results} {...props} />
                    ))}
                </div>
            )}
        </div>
    );
};


interface PromptEditorProps {
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
  onAddPrompt: (parentId?: string) => void;
  onUpdatePrompt: (id: string, newPrompt: Partial<Prompt>) => void;
  onDeletePrompt: (id: string) => void;
  onDropPrompt: (draggedId: string, targetId: string) => void;
  onAnalyzePending: () => void;
  onAnalyzeAllImages: () => void;
  onAnalyzeSingle: (prompt: Prompt) => void;
  onAutoGenerateClick: () => void;
  onStartRegionSelection: (promptId: string, type: 'point' | 'bbox') => void;
  isAnalyzing: boolean;
  imageLoaded: boolean;
  analysisProgress: { current: number, total: number } | null;
  results: Record<string, AnalysisResult[]>;
  runningSinglePrompts: Set<string>;
  hasMultipleImages: boolean;
}

const PromptEditor: React.FC<PromptEditorProps> = ({ 
    prompts, 
    setPrompts, 
    onAddPrompt,
    onUpdatePrompt,
    onDeletePrompt,
    onDropPrompt,
    onAnalyzePending,
    onAnalyzeAllImages,
    onAnalyzeSingle,
    onAutoGenerateClick, 
    onStartRegionSelection,
    isAnalyzing, 
    imageLoaded, 
    analysisProgress, 
    results,
    runningSinglePrompts,
    hasMultipleImages,
}) => {
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  const topLevelPrompts = prompts.filter(p => !p.parentId);

  const pendingCount = prompts.filter(p => !results[p.id] || results[p.id].length === 0).length;

  const getButtonText = () => {
    if (isAnalyzing) return `Analyzing... ${analysisProgress ? `(${analysisProgress.current}/${analysisProgress.total})` : ''}`;
    if (!imageLoaded) return 'Upload an Image';
    if (prompts.length === 0) return 'Add a Prompt';
    if (pendingCount > 0) {
        return `Analyze ${pendingCount} Pending`;
    }
    return 'All Analyzed';
  };
  
  return (
    <>
      <div className="bg-brand-secondary rounded-lg p-4 flex flex-col h-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-text-primary">Analysis Prompts</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onAutoGenerateClick}
              className="bg-brand-tertiary hover:bg-opacity-80 text-text-secondary text-sm font-semibold py-1 px-3 rounded-md transition-colors flex items-center gap-1.5"
              title="Generate prompts with AI"
            >
              <SparklesIcon /> Auto
            </button>
            <button
              onClick={() => setIsManageModalOpen(true)}
              className="bg-brand-tertiary hover:bg-opacity-80 text-text-secondary text-sm font-semibold py-1 px-3 rounded-md transition-colors"
            >
              Manage
            </button>
          </div>
        </div>
        <div className="flex-grow space-y-3 overflow-y-auto pr-2">
          {topLevelPrompts.map((prompt) => (
            <PromptNode
              key={prompt.id}
              prompt={prompt}
              allPrompts={prompts}
              results={results}
              onUpdate={onUpdatePrompt}
              onDelete={onDeletePrompt}
              onRun={onAnalyzeSingle}
              onAddChild={onAddPrompt}
              onStartRegionSelection={onStartRegionSelection}
              isAnalyzing={isAnalyzing}
              imageLoaded={imageLoaded}
              onDrop={onDropPrompt}
              draggingId={draggingId}
              onDragStart={setDraggingId}
              onDragEnd={() => setDraggingId(null)}
              runningSinglePrompts={runningSinglePrompts}
              onOpenSettings={setEditingPrompt}
            />
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-brand-tertiary flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <button
                    onClick={() => onAddPrompt()}
                    className="flex-shrink-0 flex items-center justify-center gap-2 bg-brand-tertiary hover:bg-opacity-80 text-text-secondary font-semibold py-2 px-4 rounded-md transition-colors"
                >
                    <PlusIcon /> Add
                </button>
                <button
                    onClick={onAnalyzePending}
                    disabled={isAnalyzing || !imageLoaded || prompts.length === 0 || pendingCount === 0}
                    className="w-full bg-brand-accent hover:bg-brand-accent-hover text-white font-bold py-2 px-4 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {getButtonText()}{hasMultipleImages && ' (This Image)'}
                </button>
            </div>
            {hasMultipleImages && (
                 <button
                    onClick={onAnalyzeAllImages}
                    disabled={isAnalyzing || !imageLoaded || prompts.length === 0}
                    className="w-full bg-brand-tertiary hover:bg-opacity-80 text-text-secondary font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                    Analyze All Images
                </button>
            )}
        </div>
      </div>
      {isManageModalOpen && (
        <ManagePromptsModal
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          prompts={prompts}
          setPrompts={setPrompts}
        />
      )}
      {editingPrompt && (
        <PromptSettingsModal
            prompt={editingPrompt}
            onClose={() => setEditingPrompt(null)}
            onSave={(id, update) => {
                onUpdatePrompt(id, update);
                setEditingPrompt(null);
            }}
        />
      )}
    </>
  );
};

export default PromptEditor;
