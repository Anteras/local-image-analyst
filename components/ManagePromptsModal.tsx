import React, { useState, useEffect, useRef } from 'react';
import { type Prompt } from '../types';
import { XIcon, TrashIcon, SaveIcon, FolderOpenIcon, DownloadIcon } from './icons';

interface ManagePromptsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompts: Prompt[];
  setPrompts: React.Dispatch<React.SetStateAction<Prompt[]>>;
}

const STORAGE_KEY = 'image-analyst-prompt-sets';

const ManagePromptsModal: React.FC<ManagePromptsModalProps> = ({ isOpen, onClose, prompts, setPrompts }) => {
  const [savedSets, setSavedSets] = useState<Record<string, Prompt[]>>({});
  const [newSetName, setNewSetName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const storedSets = localStorage.getItem(STORAGE_KEY);
      if (storedSets) {
        setSavedSets(JSON.parse(storedSets));
      }
    } catch (error) {
      console.error("Failed to load prompt sets from local storage:", error);
      setSavedSets({});
    }
  }, []);

  const handleSave = () => {
    if (!newSetName.trim()) {
      alert("Please enter a name for the prompt set.");
      return;
    }
    const newSavedSets = { ...savedSets, [newSetName.trim()]: prompts };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSavedSets));
    setSavedSets(newSavedSets);
    setNewSetName('');
  };

  const handleLoad = (setName: string) => {
    if (savedSets[setName]) {
      setPrompts(savedSets[setName]);
      onClose();
    }
  };

  const handleDelete = (setName: string) => {
    if (window.confirm(`Are you sure you want to delete the prompt set "${setName}"?`)) {
      const newSavedSets = { ...savedSets };
      delete newSavedSets[setName];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSavedSets));
      setSavedSets(newSavedSets);
    }
  };

  const handleExport = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(prompts, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonString;
    link.download = 'image-analyst-prompts.json';
    link.click();
  };
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        // Basic validation
        if (Array.isArray(parsed) && parsed.every(p => p.id && p.text && p.type)) {
          setPrompts(parsed);
          onClose();
        } else {
          throw new Error("Invalid prompt file format.");
        }
      } catch (error) {
        alert(`Error importing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      } finally {
        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <header className="flex items-center justify-between p-4 border-b border-brand-tertiary">
          <h2 className="text-xl font-bold text-text-primary">Manage Prompts</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <XIcon />
          </button>
        </header>
        
        <main className="p-6 overflow-y-auto space-y-6">
          {/* Local Storage Section */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-3">Browser Storage</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="Save current set as..."
                  className="flex-grow bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
                />
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm"
                >
                  <SaveIcon /> Save
                </button>
              </div>
              
              <div className="space-y-2 pt-2">
                {Object.keys(savedSets).length > 0 ? (
                  Object.keys(savedSets).map(setName => (
                    <div key={setName} className="bg-brand-tertiary p-2 rounded-md flex items-center justify-between">
                      <span className="text-sm text-text-secondary">{setName}</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleLoad(setName)} className="text-sm font-semibold text-brand-accent hover:underline">Load</button>
                        <button onClick={() => handleDelete(setName)} className="text-text-tertiary hover:text-red-500"><TrashIcon /></button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-text-tertiary text-center py-2">No saved prompt sets.</p>
                )}
              </div>
            </div>
          </div>
          
          {/* File Management Section */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-3">File Management</h3>
            <div className="flex items-center gap-3">
                <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden"/>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 bg-brand-tertiary hover:bg-opacity-80 text-text-secondary font-semibold py-2 px-4 rounded-md transition-colors">
                    <FolderOpenIcon /> Import
                </button>
                <button onClick={handleExport} className="flex-1 flex items-center justify-center gap-2 bg-brand-tertiary hover:bg-opacity-80 text-text-secondary font-semibold py-2 px-4 rounded-md transition-colors">
                    <DownloadIcon /> Export
                </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ManagePromptsModal;