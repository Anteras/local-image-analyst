import React, { useState } from 'react';
import { XIcon, SparklesIcon, SpinnerIcon } from './icons';
import { ResultType } from '../types';

interface AutoPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (goal: string, numPrompts: number, includeImage: boolean, allowedTypes: ResultType[], replace: boolean) => Promise<void>;
  imageIsLoaded: boolean;
}

const ALL_TYPES = Object.values(ResultType);

const typeLabels: Record<ResultType, string> = {
    [ResultType.Text]: 'Text',
    [ResultType.BoundingBox]: 'Bounding Box',
    [ResultType.Score]: 'Score',
    [ResultType.Number]: 'Number',
    [ResultType.YesNo]: 'Yes/No',
    [ResultType.Category]: 'Category',
    [ResultType.JSON]: 'JSON',
}

const AutoPromptModal: React.FC<AutoPromptModalProps> = ({ isOpen, onClose, onGenerate, imageIsLoaded }) => {
  const [goal, setGoal] = useState('');
  const [numPrompts, setNumPrompts] = useState(5);
  const [includeImage, setIncludeImage] = useState(true);
  const [allowedTypes, setAllowedTypes] = useState<ResultType[]>(ALL_TYPES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacePrompts, setReplacePrompts] = useState(true);

  if (!isOpen) return null;

  const handleTypeToggle = (type: ResultType) => {
    setAllowedTypes(prev => 
        prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = async () => {
    if (!goal.trim()) {
      setError("Please describe your analysis goal.");
      return;
    }
    if (allowedTypes.length === 0) {
        setError("Please select at least one allowed prompt type.");
        return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await onGenerate(goal, numPrompts, imageIsLoaded && includeImage, allowedTypes, replacePrompts);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-brand-tertiary">
          <h2 className="text-xl font-bold text-text-primary">Auto-Generate Prompts</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <XIcon />
          </button>
        </header>
        <main className="p-6 space-y-6">
          <div>
            <label htmlFor="analysis-goal" className="block text-sm font-medium text-text-secondary mb-1">
              Describe your analysis goal
            </label>
            <textarea
              id="analysis-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Analyze the aesthetic quality and composition of landscape photos."
              className="w-full h-24 bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none resize-y"
            />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label htmlFor="num-prompts" className="block text-sm font-medium text-text-secondary mb-1">
                Number of prompts
              </label>
              <input
                id="num-prompts"
                type="number"
                min="1"
                max="15"
                value={numPrompts}
                onChange={(e) => setNumPrompts(parseInt(e.target.value, 10))}
                className="w-24 bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
              />
            </div>
             <div className="flex flex-col justify-end items-start gap-2">
                {imageIsLoaded && (
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={includeImage}
                            onChange={(e) => setIncludeImage(e.target.checked)}
                            className="h-4 w-4 rounded border-brand-tertiary text-brand-accent focus:ring-brand-accent bg-brand-primary"
                        />
                        Use current image as context
                    </label>
                )}
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                        type="checkbox"
                        checked={replacePrompts}
                        onChange={(e) => setReplacePrompts(e.target.checked)}
                        className="h-4 w-4 rounded border-brand-tertiary text-brand-accent focus:ring-brand-accent bg-brand-primary"
                    />
                    Replace existing prompts
                </label>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Allowed Prompt Types</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {ALL_TYPES.map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={allowedTypes.includes(type)}
                            onChange={() => handleTypeToggle(type)}
                            className="h-4 w-4 rounded border-brand-tertiary text-brand-accent focus:ring-brand-accent bg-brand-primary"
                        />
                        {typeLabels[type as keyof typeof typeLabels]}
                    </label>
                ))}
            </div>
          </div>
          
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </main>
        <footer className="p-4 bg-brand-tertiary rounded-b-lg flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold py-2 px-4 rounded-md transition-colors w-32"
          >
            {isLoading ? <SpinnerIcon /> : <><SparklesIcon /> Generate</>}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default AutoPromptModal;