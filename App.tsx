import React, { useState, useCallback, useEffect } from 'react';
import { ResultType, type Prompt, type AnalysisResult, type BoundingBox } from './types';
import ImageDropzone from './components/ImageDropzone';
import ImageViewer from './components/ImageViewer';
import PromptEditor from './components/PromptEditor';
import ResultsDisplay from './components/ResultsDisplay';
import MaximizedTextViewer from './components/MaximizedTextViewer';
import ImageGallery from './components/ImageGallery';
import { CogIcon, RefreshIcon, SunIcon, MoonIcon, UploadIcon } from './components/icons';
import SettingsModal from './components/SettingsModal';
import AutoPromptModal from './components/AutoPromptModal';
import { useAppStore } from './store';

const RegionSelectionOverlay: React.FC<{ onCancel: () => void, selectionType: 'point' | 'bbox' | null }> = ({ onCancel, selectionType }) => {
    if (!selectionType) return null;
    const instruction = selectionType === 'point' 
        ? 'Click on the image to select a point.'
        : 'Click and drag on the image to select a region.';

    return (
        <div 
            className="absolute inset-0 bg-black bg-opacity-70 z-30 flex items-center justify-center pointer-events-none"
        >
            <div className="text-center text-white bg-black bg-opacity-50 p-4 rounded-lg">
                <p className="text-xl font-semibold">{instruction}</p>
                <p className="mt-2 text-sm">Press ESC to cancel.</p>
            </div>
        </div>
    );
};


export default function App() {
  const {
    images,
    selectedImageId,
    prompts,
    results,
    overlayVisibility,
    theme,
    apiEndpoint,
    modelName,
    apiKey,
    maxTokens,
    temperature,
    apiInspectorMode,
    isAnalyzing,
    analysisProgress,
    runningSinglePrompts,
    analysisStates,
    imageBase64s,
    regionSelection,
  } = useAppStore();

  const {
    appendImages,
    setInitialImages,
    removeImage,
    setSelectedImageId,
    reset,
    toggleTheme,
    saveSettings,
    runSingleAnalysisFlow,
    runPendingAnalysis,
    runAllImagesAnalysis,
    generatePrompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    dropPrompt,
    setPrompts,
    setOverlayVisibility,
    startRegionSelection,
    cancelRegionSelection,
    completeRegionSelection,
  } = useAppStore.getState();

  const [maximizedText, setMaximizedText] = useState<string | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAutoPromptModalOpen, setIsAutoPromptModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && regionSelection.promptId) {
            cancelRegionSelection();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [regionSelection.promptId, cancelRegionSelection]);


  const handleFiles = useCallback((files: FileList | null) => {
    if (files) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        appendImages(imageFiles);
      }
    }
  }, [appendImages]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (images.length > 0) {
        setIsDraggingOver(true);
    }
  }, [images.length]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const currentResults = selectedImageId ? (results[selectedImageId] || {}) : {};
  const currentOverlays = selectedImageId ? (overlayVisibility[selectedImageId] || {}) : {};
  const currentImage = images.find(i => i.id === selectedImageId);

  const visibleOverlays = prompts
    .filter(p => p.type === ResultType.BoundingBox)
    .flatMap(p => {
        if (!currentOverlays?.[p.id]) return [];
        const resultHistory = currentResults?.[p.id] || [];
        if (resultHistory.length === 0) return [];
        // Only show boxes for the latest result in the history
        const latestResult = resultHistory[resultHistory.length - 1];
        return (latestResult.data as BoundingBox[]) || [];
    });

  const inputRegions = prompts
    .filter(p => p.type === ResultType.Text && p.regionCoords)
    .map(p => ({
        id: p.id,
        coords: p.regionCoords!,
        type: p.regionType!,
    }));

  return (
    <>
      <RegionSelectionOverlay onCancel={cancelRegionSelection} selectionType={regionSelection.type} />
      <div className="min-h-screen bg-brand-primary p-4 lg:p-8 flex flex-col items-center">
        <header className="w-full max-w-7xl mb-6 relative">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-text-primary tracking-wider">Local Image Analyst</h1>
            <p className="text-text-secondary mt-2">Upload an image and run custom analyses with your local vision LLM.</p>
          </div>
          <div className="absolute top-0 right-0 h-full flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="text-text-tertiary hover:text-brand-accent p-2 rounded-full transition-colors"
              title="Toggle Theme"
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button
              onClick={() => reset()}
              className="text-text-tertiary hover:text-brand-accent p-2 rounded-full transition-colors"
              title="Start New Analysis"
            >
              <RefreshIcon />
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-text-tertiary hover:text-brand-accent p-2 rounded-full transition-colors"
              title="API Settings"
            >
              <CogIcon />
            </button>
          </div>
        </header>
        
        <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow">
          <div className="lg:col-span-4 relative">
            <div className="absolute inset-0">
              <PromptEditor 
                prompts={prompts} 
                setPrompts={setPrompts}
                onAddPrompt={addPrompt}
                onUpdatePrompt={updatePrompt}
                onDeletePrompt={deletePrompt}
                onDropPrompt={dropPrompt}
                onAnalyzePending={runPendingAnalysis}
                onAnalyzeAllImages={runAllImagesAnalysis}
                onAnalyzeSingle={runSingleAnalysisFlow}
                onAutoGenerateClick={() => setIsAutoPromptModalOpen(true)}
                isAnalyzing={isAnalyzing}
                analysisProgress={analysisProgress}
                imageLoaded={images.length > 0}
                results={currentResults}
                runningSinglePrompts={runningSinglePrompts}
                hasMultipleImages={images.length > 1}
                onStartRegionSelection={startRegionSelection}
              />
            </div>
          </div>

          <div 
            className="lg:col-span-8 flex flex-col gap-6 relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDraggingOver && (
              <div className="absolute inset-0 bg-brand-accent bg-opacity-80 z-20 rounded-lg flex items-center justify-center pointer-events-none border-4 border-dashed border-white">
                <div className="text-center text-white flex flex-col items-center">
                  <UploadIcon className="h-16 w-16 text-white"/>
                  <p className="mt-4 text-xl font-semibold">Drop to add images</p>
                </div>
              </div>
            )}
            <div className="bg-brand-secondary rounded-lg p-4 h-full flex flex-col min-h-[400px] justify-between">
              <div className="flex-grow flex items-center justify-center">
                {currentImage ? (
                  <ImageViewer 
                    imageUrl={currentImage.url} 
                    boundingBoxes={visibleOverlays} 
                    inputRegions={inputRegions}
                    regionSelection={regionSelection}
                    onCompleteRegionSelection={completeRegionSelection}
                  />
                ) : (
                  <ImageDropzone onInitialImageUpload={setInitialImages} />
                )}
              </div>
              {images.length > 0 && (
                <ImageGallery 
                  images={images}
                  selectedImageId={selectedImageId}
                  onSelectImage={setSelectedImageId}
                  onRemoveImage={removeImage}
                  analysisStates={analysisStates}
                />
              )}
            </div>
          </div>
        </main>

        {selectedImageId && Object.keys(currentResults).length > 0 && (
          <footer className="w-full max-w-7xl mt-8">
              <ResultsDisplay 
                  prompts={prompts} 
                  results={currentResults}
                  overlayVisibility={currentOverlays || {}}
                  setOverlayVisibility={(updater) => {
                    const currentVis = overlayVisibility[selectedImageId] || {};
                    const newVis = typeof updater === 'function' ? updater(currentVis) : updater;
                    setOverlayVisibility(selectedImageId, newVis);
                  }}
                  onMaximizeText={setMaximizedText}
                  imageBase64={imageBase64s[selectedImageId]}
                  imageFileName={currentImage?.file.name || null}
              />
          </footer>
        )}
      </div>
      {maximizedText && (
          <MaximizedTextViewer
              text={maximizedText}
              onClose={() => setMaximizedText(null)}
          />
      )}
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={saveSettings}
        currentEndpoint={apiEndpoint}
        currentModel={modelName}
        currentApiKey={apiKey}
        currentMaxTokens={maxTokens}
        currentTemperature={temperature}
        currentApiInspectorMode={apiInspectorMode}
      />
      <AutoPromptModal
        isOpen={isAutoPromptModalOpen}
        onClose={() => setIsAutoPromptModalOpen(false)}
        onGenerate={generatePrompts}
        imageIsLoaded={!!selectedImageId}
      />
    </>
  );
}