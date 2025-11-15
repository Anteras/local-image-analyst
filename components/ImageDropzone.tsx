
import React, { useCallback, useEffect, useState } from 'react';
import { UploadIcon } from './icons';

interface ImageDropzoneProps {
  onInitialImageUpload: (files: File[]) => void;
}

const ImageDropzone: React.FC<ImageDropzoneProps> = ({ onInitialImageUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (files) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      if (imageFiles.length > 0) {
        onInitialImageUpload(imageFiles);
      }
    }
  }, [onInitialImageUpload]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }
    if (imageFiles.length > 0) {
      onInitialImageUpload(imageFiles);
    }
  }, [onInitialImageUpload]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [handlePaste]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  return (
    <div 
        className={`relative w-full h-full min-h-[400px] flex flex-col justify-center items-center border-2 border-dashed rounded-lg transition-colors duration-200 ${isDragging ? 'border-brand-accent bg-brand-tertiary' : 'border-brand-tertiary'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      <input 
        type="file" 
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center text-center cursor-pointer p-6">
        <UploadIcon />
        <p className="mt-4 text-lg font-semibold text-text-primary">
            Drag & drop images here
        </p>
        <p className="mt-1 text-sm text-text-secondary">
            or click to select, or paste from clipboard
        </p>
      </label>
    </div>
  );
};

export default ImageDropzone;
