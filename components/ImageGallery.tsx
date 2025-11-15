import React from 'react';
import { CheckCircleIcon, XIcon, SpinnerIcon, XCircleIcon } from './icons';
import { AnalysisResult, AnalysisStatus } from '../types';

interface ImageGalleryProps {
  images: { id: string; url: string; file: File }[];
  selectedImageId: string | null;
  onSelectImage: (id: string) => void;
  onRemoveImage: (id: string) => void;
  analysisStates: Record<string, AnalysisStatus>;
}

const ImageGallery: React.FC<ImageGalleryProps> = ({ images, selectedImageId, onSelectImage, onRemoveImage, analysisStates }) => {
  return (
    <div className="mt-4 pt-4 border-t border-brand-tertiary">
      <div className="flex space-x-3 overflow-x-auto p-2">
        {images.map(image => {
          const isSelected = image.id === selectedImageId;
          const status = analysisStates[image.id] || 'idle';
          
          return (
            <div 
              key={image.id}
              onClick={() => onSelectImage(image.id)}
              className={`relative flex-shrink-0 w-24 h-24 rounded-md overflow-hidden cursor-pointer transition-all duration-200 group ${isSelected ? 'ring-4 ring-brand-accent' : 'ring-2 ring-transparent hover:ring-brand-tertiary'}`}
            >
               <button
                  onClick={(e) => {
                      e.stopPropagation();
                      onRemoveImage(image.id);
                  }}
                  className="absolute top-1 right-1 z-20 p-0.5 bg-black bg-opacity-40 rounded-full text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                  title="Remove image"
              >
                  <XIcon className="h-4 w-4" />
              </button>
              <img 
                src={image.url}
                alt={image.file.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-10 transition-opacity"></div>
              
              {status !== 'idle' && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                      {status === 'loading' && <SpinnerIcon />}
                      {status === 'success' && <CheckCircleIcon className="h-8 w-8 text-green-400" />}
                      {status === 'error' && <XCircleIcon className="h-8 w-8 text-red-500" />}
                  </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-1 bg-black bg-opacity-50 z-10">
                  <p className="text-white text-xs truncate">{image.file.name}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImageGallery;