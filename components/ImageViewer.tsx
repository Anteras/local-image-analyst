
import React, { useRef, useState } from 'react';
import { type BoundingBox, type Prompt } from '../types';

interface InputRegion {
  id: string;
  coords: [number, number] | [number, number, number, number];
  type: 'point' | 'bbox';
}

interface ImageViewerProps {
  imageUrl: string;
  boundingBoxes: BoundingBox[];
  inputRegions: InputRegion[];
  regionSelection: { promptId: string | null, type: 'point' | 'bbox' | null };
  onCompleteRegionSelection: (coords: [number, number] | [number, number, number, number]) => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ imageUrl, boundingBoxes, inputRegions, regionSelection, onCompleteRegionSelection }) => {
  const colors = [
    '#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'
  ];
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawingBox, setDrawingBox] = useState<[number, number, number, number] | null>(null);
  const isSelecting = !!regionSelection.promptId;

  const getCoords = (e: React.MouseEvent): [number, number] | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Normalize to 1000x1000
    const normalizedX = Math.round((x / rect.width) * 1000);
    const normalizedY = Math.round((y / rect.height) * 1000);

    return [
        Math.max(0, Math.min(1000, normalizedX)), 
        Math.max(0, Math.min(1000, normalizedY))
    ];
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (regionSelection.type !== 'bbox') return;
    const coords = getCoords(e);
    if (coords) {
        setDrawingBox([coords[0], coords[1], coords[0], coords[1]]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawingBox) return;
    const coords = getCoords(e);
    if (coords) {
        setDrawingBox([drawingBox[0], drawingBox[1], coords[0], coords[1]]);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!drawingBox) return;
    const coords = getCoords(e);
    if (coords) {
        const finalBox: [number, number, number, number] = [
            Math.min(drawingBox[0], coords[0]),
            Math.min(drawingBox[1], coords[1]),
            Math.max(drawingBox[0], coords[0]),
            Math.max(drawingBox[1], coords[1]),
        ];
        // Prevent creating a zero-size box
        if (finalBox[0] < finalBox[2] && finalBox[1] < finalBox[3]) {
            onCompleteRegionSelection(finalBox);
        }
    }
    setDrawingBox(null);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (regionSelection.type !== 'point') return;
    const coords = getCoords(e);
    if (coords) {
        onCompleteRegionSelection(coords);
    }
  };
  
  const renderRegion = (region: InputRegion, index: number) => {
    const key = `${region.id}-${index}`;
    if (region.type === 'point') {
        const [x, y] = region.coords as [number, number];
        const left = (x / 1000) * 100;
        const top = (y / 1000) * 100;
        return (
            <div key={key} style={{ left: `${left}%`, top: `${top}%`, position: 'absolute' }}>
                <div className="w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70 border-2 border-dashed border-black" />
            </div>
        );
    } else { // bbox
        const [x1, y1, x2, y2] = region.coords as [number, number, number, number];
        const left = (x1 / 1000) * 100;
        const top = (y1 / 1000) * 100;
        const width = ((x2 - x1) / 1000) * 100;
        const height = ((y2 - y1) / 1000) * 100;
        return (
            <div
              key={key}
              className="absolute border-2 border-dashed rounded-sm"
              style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, borderColor: 'white', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
            />
        );
    }
  };

  const renderDrawingBox = () => {
    if (!drawingBox) return null;
    const [x1, y1, x2, y2] = drawingBox;
    const left = (Math.min(x1, x2) / 1000) * 100;
    const top = (Math.min(y1, y2) / 1000) * 100;
    const width = (Math.abs(x2 - x1) / 1000) * 100;
    const height = (Math.abs(y2 - y1) / 1000) * 100;
    return (
        <div
          className="absolute border-2 border-dashed rounded-sm bg-white/20"
          style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, borderColor: 'white' }}
        />
    );
  };

  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <div 
        ref={containerRef}
        className="relative inline-block"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        style={{ cursor: isSelecting ? 'crosshair' : 'default' }}
      >
        <img
          src={imageUrl}
          alt="Analysis subject"
          className="max-w-full max-h-full object-contain rounded-md block select-none"
          draggable={false}
        />
        {/* Render Saved Input Regions */}
        {inputRegions.map(renderRegion)}

        {/* Render BBox Results */}
        {boundingBoxes.map((bbox, index) => {
          const [x1, y1, x2, y2] = bbox.box;

          if ([x1, y1, x2, y2].some(coord => typeof coord !== 'number') || x1 >= x2 || y1 >= y2) {
              console.warn("Invalid bounding box coordinates received:", bbox);
              return null;
          }

          const left = (x1 / 1000) * 100;
          const top = (y1 / 1000) * 100;
          const width = ((x2 - x1) / 1000) * 100;
          const height = ((y2 - y1) / 1000) * 100;
          const color = colors[index % colors.length];

          return (
            <div
              key={index}
              className="absolute border-2 rounded-sm shadow-lg pointer-events-none"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
                borderColor: color,
              }}
            >
              <span 
                className="absolute -top-6 left-0 text-xs font-semibold px-1.5 py-0.5 rounded-sm"
                style={{ backgroundColor: color, color: 'white' }}
              >
                {bbox.label}
              </span>
            </div>
          );
        })}
        {/* Render temporary drawing box */}
        {renderDrawingBox()}
      </div>
    </div>
  );
};

export default ImageViewer;