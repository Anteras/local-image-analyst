import React, { useState, useEffect } from 'react';
import { XIcon, SaveIcon, ChevronDownIcon } from './icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (endpoint: string, model: string, apiKey: string, maxTokens?: number, temperature?: number, apiInspectorMode?: boolean) => void;
  currentEndpoint: string;
  currentModel: string;
  currentApiKey: string;
  currentMaxTokens?: number;
  currentTemperature?: number;
  currentApiInspectorMode?: boolean;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    currentEndpoint, 
    currentModel, 
    currentApiKey,
    currentMaxTokens,
    currentTemperature,
    currentApiInspectorMode,
}) => {
  const [endpoint, setEndpoint] = useState(currentEndpoint);
  const [model, setModel] = useState(currentModel);
  const [apiKey, setApiKey] = useState(currentApiKey);
  const [maxTokens, setMaxTokens] = useState(currentMaxTokens?.toString() ?? '');
  const [temperature, setTemperature] = useState(currentTemperature?.toString() ?? '');
  const [apiInspectorMode, setApiInspectorMode] = useState(currentApiInspectorMode ?? false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setEndpoint(currentEndpoint);
        setModel(currentModel);
        setApiKey(currentApiKey);
        setMaxTokens(currentMaxTokens?.toString() ?? '');
        setTemperature(currentTemperature?.toString() ?? '');
        setApiInspectorMode(currentApiInspectorMode ?? false);
        setIsAdvancedOpen(!!(currentMaxTokens || currentTemperature));
    }
  }, [isOpen, currentEndpoint, currentModel, currentApiKey, currentMaxTokens, currentTemperature, currentApiInspectorMode]);

  if (!isOpen) return null;

  const handleSave = () => {
    const parsedMaxTokens = maxTokens ? parseInt(maxTokens, 10) : undefined;
    const parsedTemperature = temperature ? parseFloat(temperature) : undefined;

    onSave(
        endpoint.trim(), 
        model.trim(), 
        apiKey.trim(),
        isNaN(parsedMaxTokens!) ? undefined : parsedMaxTokens,
        isNaN(parsedTemperature!) ? undefined : parsedTemperature,
        apiInspectorMode,
    );
    onClose();
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-brand-tertiary">
          <h2 className="text-xl font-bold text-text-primary">API Settings</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <XIcon />
          </button>
        </header>
        <main className="p-6 space-y-4">
          <div>
            <label htmlFor="api-endpoint" className="block text-sm font-medium text-text-secondary mb-1">
              API Endpoint URL
            </label>
            <input
              id="api-endpoint"
              type="text"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="e.g., http://127.0.0.1:1234/v1/chat/completions"
              className="w-full bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="model-name" className="block text-sm font-medium text-text-secondary mb-1">
              Model Name
            </label>
            <input
              id="model-name"
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., qwen-vl-plus"
              className="w-full bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="api-key" className="block text-sm font-medium text-text-secondary mb-1">
              API Key (Optional)
            </label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key if required"
              className="w-full bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
            />
          </div>
          
          <div className="pt-2">
            <label className="flex items-center gap-2 text-sm font-medium text-text-secondary cursor-pointer">
                <input
                    type="checkbox"
                    checked={apiInspectorMode}
                    onChange={(e) => setApiInspectorMode(e.target.checked)}
                    className="h-4 w-4 rounded border-brand-tertiary text-brand-accent focus:ring-brand-accent bg-brand-primary"
                />
                Enable API Inspector Mode
            </label>
            <p className="text-xs text-text-tertiary mt-1 pl-6">
                When enabled, the copy button on result cards will copy the raw API request payload instead of the result text.
            </p>
          </div>

          {/* Advanced Settings */}
          <div className="pt-2">
            <button 
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary w-full text-left"
            >
                <div className={`transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`}>
                    <ChevronDownIcon />
                </div>
                Advanced
            </button>
            {isAdvancedOpen && (
                <div className="mt-4 pl-6 space-y-4 border-l-2 border-brand-tertiary">
                    <div>
                        <label htmlFor="max-tokens" className="block text-sm font-medium text-text-secondary mb-1">
                          Max Tokens (Optional)
                        </label>
                        <input
                          id="max-tokens"
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(e.target.value)}
                          placeholder="Leave blank for API default (e.g., 4096)"
                          className="w-full bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
                        />
                    </div>
                    <div>
                        <label htmlFor="temperature" className="block text-sm font-medium text-text-secondary mb-1">
                          Temperature (Optional)
                        </label>
                        <input
                          id="temperature"
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          value={temperature}
                          onChange={(e) => setTemperature(e.target.value)}
                          placeholder="Leave blank for API default (e.g., 0.8)"
                          className="w-full bg-brand-primary p-2 rounded-md text-sm text-text-primary focus:ring-2 focus:ring-brand-accent focus:outline-none"
                        />
                    </div>
                </div>
            )}
          </div>
        </main>
        <footer className="p-4 bg-brand-tertiary rounded-b-lg flex justify-end">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-brand-accent hover:bg-brand-accent-hover text-white font-semibold py-2 px-4 rounded-md transition-colors"
          >
            <SaveIcon /> Save Settings
          </button>
        </footer>
      </div>
    </div>
  );
};

export default SettingsModal;
