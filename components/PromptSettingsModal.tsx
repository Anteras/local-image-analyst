import React, { useState, useEffect } from 'react';
import { type Prompt, ResultType } from '../types';
import { XIcon, SaveIcon, CogIcon, TrashIcon, PlusIcon } from './icons';

interface PromptSettingsModalProps {
  prompt: Prompt;
  onClose: () => void;
  onSave: (id: string, update: Partial<Prompt>) => void;
}

const CategoryEditor: React.FC<{ prompt: Prompt, onSave: (update: Partial<Prompt>) => void }> = ({ prompt, onSave }) => {
    const [categories, setCategories] = useState<string[]>(prompt.categories || []);
    const [newCategory, setNewCategory] = useState('');

    const handleAdd = () => {
        if (newCategory.trim() && !categories.includes(newCategory.trim())) {
            setCategories([...categories, newCategory.trim()]);
            setNewCategory('');
        }
    };

    const handleRemove = (catToRemove: string) => {
        setCategories(categories.filter(c => c !== catToRemove));
    };

    const handleSave = () => {
        onSave({ categories });
    };

    return (
        <>
            <main className="p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">
                        Response Categories
                    </label>
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            placeholder="Add a category..."
                            className="flex-grow bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
                        />
                         <button
                            onClick={handleAdd}
                            className="flex-shrink-0 flex items-center justify-center gap-2 bg-brand-tertiary hover:bg-opacity-80 text-text-secondary font-semibold py-2 px-3 rounded-md transition-colors"
                        >
                            <PlusIcon /> Add
                        </button>
                    </div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {categories.length > 0 ? (
                        categories.map(cat => (
                            <div key={cat} className="bg-brand-primary p-2 rounded-md flex items-center justify-between text-sm">
                                <span className="text-text-secondary">{cat}</span>
                                <button onClick={() => handleRemove(cat)} className="text-text-tertiary hover:text-red-500"><TrashIcon /></button>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-text-tertiary text-center py-4">No categories defined.</p>
                    )}
                </div>
            </main>
            <footer className="p-4 bg-brand-tertiary rounded-b-lg flex justify-end">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold py-2 px-4 rounded-md transition-colors"
                >
                    <SaveIcon /> Save
                </button>
            </footer>
        </>
    );
};

const JsonEditor: React.FC<{ prompt: Prompt, onSave: (update: Partial<Prompt>) => void }> = ({ prompt, onSave }) => {
    const [schema, setSchema] = useState(prompt.jsonSchema || '');
    const [error, setError] = useState<string | null>(null);

    const handleSchemaChange = (text: string) => {
        setSchema(text);
        try {
            JSON.parse(text);
            setError(null);
        } catch (e) {
            setError("Invalid JSON format.");
        }
    };

    const handleSave = () => {
        if (!error) {
            onSave({ jsonSchema: schema });
        }
    };

    return (
        <>
            <main className="p-6 space-y-4">
                <div>
                    <label htmlFor="json-schema" className="block text-sm font-medium text-text-secondary mb-1">
                        JSON Schema
                    </label>
                    <textarea
                        id="json-schema"
                        value={schema}
                        onChange={(e) => handleSchemaChange(e.target.value)}
                        placeholder={'{\n  "type": "object",\n  "properties": {\n    "name": {"type": "string"},\n    "age": {"type": "number"}\n  }\n}'}
                        className={`w-full h-64 bg-brand-primary p-2 rounded-md text-sm text-text-primary font-mono focus:ring-2 focus:ring-brand-accent focus:outline-none resize-y ${error ? 'ring-2 ring-red-500' : ''}`}
                    />
                     {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>
            </main>
            <footer className="p-4 bg-brand-tertiary rounded-b-lg flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={!!error || !schema.trim()}
                    className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold py-2 px-4 rounded-md transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    <SaveIcon /> Save
                </button>
            </footer>
        </>
    );
};


const PromptSettingsModal: React.FC<PromptSettingsModalProps> = ({ prompt, onClose, onSave }) => {
  const getTitle = () => {
    switch (prompt.type) {
        case ResultType.Category: return "Configure Categories";
        case ResultType.JSON: return "Configure JSON Schema";
        default: return "Prompt Settings";
    }
  };

  const handleSave = (update: Partial<Prompt>) => {
      onSave(prompt.id, update);
      onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-brand-tertiary">
          <div className="flex items-center gap-3">
            <CogIcon />
            <h2 className="text-xl font-bold text-text-primary">{getTitle()}</h2>
          </div>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <XIcon />
          </button>
        </header>
        
        {prompt.type === ResultType.Category && <CategoryEditor prompt={prompt} onSave={handleSave} />}
        {prompt.type === ResultType.JSON && <JsonEditor prompt={prompt} onSave={handleSave} />}

      </div>
    </div>
  );
};

export default PromptSettingsModal;