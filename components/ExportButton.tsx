import React, { useState, useRef, useEffect } from 'react';
import { type Prompt, type AnalysisResult, ResultType, type BoundingBox, type BboxChildResult } from '../types';
import { DownloadIcon, ChevronDownIcon } from './icons';

interface ExportButtonProps {
  prompts: Prompt[];
  results: Record<string, AnalysisResult[]>;
  imageBase64: string | null;
  imageFileName: string | null;
}

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
        default:
            return 'N/A';
    }
}

const ExportButton: React.FC<ExportButtonProps> = ({ prompts, results, imageBase64, imageFileName }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getFilename = (extension: string) => {
        const base = imageFileName ? imageFileName.split('.').slice(0, -1).join('.') : 'analysis';
        return `${base}-results.${extension}`;
    }

    const handleExport = (format: 'txt' | 'md' | 'html') => {
        let content = '';
        const promptsWithResults = prompts.filter(p => results[p.id] && results[p.id].length > 0);

        if (format === 'txt') {
            content = promptsWithResults.map(p => {
                const latestResult = results[p.id][results[p.id].length - 1];
                const resultText = getResultAsString(p, latestResult);
                const prefix = p.parentId ? '  - ' : '';
                return `${prefix}Q: ${p.text}\nA: ${resultText}\n`;
            }).join('\n');
        } else if (format === 'md') {
            content = promptsWithResults.map(p => {
                const latestResult = results[p.id][results[p.id].length - 1];
                const resultText = getResultAsString(p, latestResult);
                const prefix = p.parentId ? '  - ' : '## ';
                return `${prefix}Q: ${p.text}\n\n**A:**\n\`\`\`\n${resultText}\n\`\`\`\n`;
            }).join('\n');
        } else if (format === 'html') {
            const latestResultsForExport: Record<string, AnalysisResult> = {};
            prompts.forEach(p => {
                const history = results[p.id];
                if (history && history.length > 0) {
                    latestResultsForExport[p.id] = history[history.length - 1];
                }
            });
            content = generateHtmlReport(prompts, latestResultsForExport, imageBase64, imageFileName);
        }

        const blob = new Blob([content], { type: `text/${format === 'html' ? 'html' : 'plain'}` });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = getFilename(format);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setIsOpen(false);
    };
    
    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-brand-tertiary hover:bg-opacity-80 text-text-secondary font-semibold py-2 px-4 rounded-md transition-colors"
            >
                <DownloadIcon /> Export <ChevronDownIcon />
            </button>
            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-brand-secondary rounded-md shadow-lg z-10">
                    <ul className="py-1">
                        <li>
                            <a href="#" onClick={(e) => { e.preventDefault(); handleExport('txt'); }} className="block px-4 py-2 text-sm text-text-secondary hover:bg-brand-tertiary">
                                As Text (.txt)
                            </a>
                        </li>
                        <li>
                            <a href="#" onClick={(e) => { e.preventDefault(); handleExport('md'); }} className="block px-4 py-2 text-sm text-text-secondary hover:bg-brand-tertiary">
                                As Markdown (.md)
                            </a>
                        </li>
                        <li>
                            <a href="#" onClick={(e) => { e.preventDefault(); handleExport('html'); }} className="block px-4 py-2 text-sm text-text-secondary hover:bg-brand-tertiary">
                                As HTML (.html)
                            </a>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
};

export default ExportButton;

const generateHtmlReport = (prompts: Prompt[], results: Record<string, AnalysisResult>, imageBase64: string | null, imageFileName: string | null): string => {
    const topLevelPrompts = prompts.filter(p => !p.parentId && results[p.id]);
    
    const renderBboxChildResultData = (prompt: Prompt, resultData: string | number | null): string => {
        if (resultData === null) return `<p>N/A</p>`;
        if (typeof resultData === 'string' && resultData.startsWith('Error:')) {
            return `<p class="error-text">${resultData}</p>`;
        }

        switch (prompt.type) {
            case ResultType.Text:
                return `<p>${String(resultData).replace(/\n/g, '<br>')}</p>`;
            case ResultType.Number:
                const num = parseFloat(resultData as any);
                return `<span class="big-number">${isNaN(num) ? 'N/A' : num}</span>`;
            case ResultType.YesNo:
                const answer = String(resultData).toLowerCase().trim();
                const isYes = answer.includes('yes');
                return `<p class="yes-no ${isYes ? 'yes' : 'no'}">${isYes ? 'Yes' : 'No'}</p>`;
            case ResultType.Score:
                const score = parseFloat(resultData as any);
                if (isNaN(score)) return `<span class="big-number">N/A</span>`;
                const [min, max] = prompt.scoreRange || [0, 10];
                const percentage = max > min ? ((score - min) / (max - min)) * 100 : 0;
                return `
                    <div class="score-display">
                        <span class="big-number">${score.toFixed(1)}</span>
                        <span>/ ${max}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar" style="width: ${Math.max(0, Math.min(100, percentage))}%"></div>
                    </div>
                `;
            default: return '';
        }
    };

    const renderResult = (prompt: Prompt, result: AnalysisResult): string => {
        if (result.status !== 'success') return `<p class="status-${result.status}">${result.status}...</p>`;
        
        const data = result.data;
        if (data === null) return '<p>No data</p>';

        switch(prompt.type) {
            case ResultType.Text:
                return `<p>${String(data).replace(/\n/g, '<br>')}</p>`;
            case ResultType.Number:
                const num = parseFloat(data as any);
                return `<p class="big-number">${isNaN(num) ? 'N/A' : num}</p>`;
            case ResultType.Score:
                const score = parseFloat(data as any);
                if (isNaN(score)) return `<p class="big-number">N/A</p>`;
                const [min, max] = prompt.scoreRange || [0, 10];
                const percentage = max > min ? ((score - min) / (max - min)) * 100 : 0;
                return `
                    <div class="score-display">
                        <span class="big-number">${score.toFixed(1)}</span>
                        <span>/ ${max}</span>
                    </div>
                    <div class="progress-bar-bg">
                        <div class="progress-bar" style="width: ${percentage}%;"></div>
                    </div>
                `;
            case ResultType.YesNo:
                 if (typeof data !== 'string') return `<p class="error-text">Invalid data format for Yes/No result.</p>`;
                 const isYes = (data as string).toLowerCase().includes('yes');
                 return `<p class="yes-no ${isYes ? 'yes' : 'no'}">${data}</p>`;
            case ResultType.BoundingBox:
                if (!Array.isArray(data)) return `<p class="error-text">Invalid data format for Bounding Box result.</p>`;
                const boxes = data as BoundingBox[];
                if (!boxes || boxes.length === 0) return `<p>No objects detected.</p>`;
                
                const childrenPrompts = prompts.filter(p => p.parentId === prompt.id && results[p.id]);

                if (childrenPrompts.length === 0) {
                    return `<ul>${boxes.map(b => `<li><b>${b.label}:</b> [${b.box.join(', ')}]</li>`).join('')}</ul>`;
                }
                
                const colors = ['#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899'];
                return `
                    <p class="bbox-summary">Detected ${boxes.length} object${boxes.length > 1 ? 's' : ''} with follow-up analysis:</p>
                    <div class="bbox-children-container">
                        ${boxes.map((box, index) => `
                            <div class="bbox-child-card">
                                <h5 class="bbox-label" style="border-left-color: ${colors[index % colors.length]};">
                                    ${box.label}
                                </h5>
                                <div class="child-results-wrapper">
                                ${childrenPrompts.map(childPrompt => {
                                    const childResult = results[childPrompt.id];
                                    if (!childResult || childResult.status !== 'success' || !Array.isArray(childResult.data)) return '';
                                    
                                    const childResultDataArray = childResult.data as BboxChildResult[];
                                    const boxResult = childResultDataArray.find(cr => 
                                        cr.parentBox.label === box.label && 
                                        JSON.stringify(cr.parentBox.box) === JSON.stringify(box.box)
                                    );
                                    
                                    if (boxResult) {
                                        return `
                                            <div class="child-result-item">
                                                <p class="prompt-text-mini">${childPrompt.text}</p>
                                                ${renderBboxChildResultData(childPrompt, boxResult.resultData)}
                                            </div>
                                        `;
                                    }
                                    return '';
                                }).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            default: return '';
        }
    };
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Analysis Report</title>
    <style>
        body { font-family: sans-serif; background-color: #1e1f22; color: #f2f3f5; margin: 0; padding: 2rem; }
        .container { max-width: 1200px; margin: auto; }
        header { text-align: center; border-bottom: 1px solid #383a40; padding-bottom: 1rem; margin-bottom: 2rem; }
        h1 { color: #f2f3f5; }
        h2 { color: #b8bac1; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: flex-start; }
        .image-container { position: sticky; top: 2rem; }
        img { max-width: 100%; border-radius: 8px; }
        .card { background-color: #2b2d31; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
        .card-child { margin-left: 2rem; border-left: 2px solid #383a40; padding-left: 1.5rem; }
        .prompt { font-style: italic; color: #949ba4; border-left: 3px solid #5865f2; padding-left: 1rem; margin-bottom: 1rem; }
        .big-number { font-size: 2rem; font-weight: bold; color: #5865f2; }
        .score-display { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.5rem; }
        .progress-bar-bg { background-color: #383a40; border-radius: 99px; height: 10px; width: 100%; }
        .progress-bar { background-color: #5865f2; border-radius: 99px; height: 100%; }
        .yes-no { font-size: 1.5rem; font-weight: bold; }
        .yes { color: #22c55e; } .no { color: #f43f5e; }
        ul { padding-left: 1.5rem; color: #b8bac1; }
        .error-text { color: #f43f5e; font-style: italic; }
        .bbox-summary { margin-bottom: 1rem; color: #b8bac1; }
        .bbox-children-container { display: flex; flex-direction: column; gap: 1rem; }
        .bbox-child-card { background-color: #1e1f22; border-radius: 6px; padding: 1rem; }
        .bbox-label { font-size: 1.1em; font-weight: bold; color: #f2f3f5; margin: 0 0 0.75rem 0; padding-left: 0.75rem; border-left: 4px solid #5865f2; }
        .child-results-wrapper { padding-left: calc(0.75rem + 4px); display: flex; flex-direction: column; gap: 1rem; }
        .child-result-item .prompt-text-mini { font-size: 0.8em; color: #949ba4; margin: 0 0 0.25rem 0; font-style: italic; }
        @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Image Analysis Report</h1>
            ${imageFileName ? `<h2>${imageFileName}</h2>` : ''}
        </header>
        <div class="grid">
            <div class="results-container">
                ${topLevelPrompts.map(p => `
                    <div class="card">
                        <p class="prompt">${p.text}</p>
                        <div class="result-content">${renderResult(p, results[p.id])}</div>
                    </div>
                    ${prompts.filter(child => child.parentId === p.id && results[child.id] && p.type !== ResultType.BoundingBox).map(childP => `
                        <div class="card card-child">
                            <p class="prompt">${childP.text}</p>
                            <div class="result-content">${renderResult(childP, results[childP.id])}</div>
                        </div>
                    `).join('')}
                `).join('')}
            </div>
            ${imageBase64 ? `<div class="image-container"><img src="${imageBase64}" alt="Analyzed Image"></div>` : ''}
        </div>
    </div>
</body>
</html>
    `;
};