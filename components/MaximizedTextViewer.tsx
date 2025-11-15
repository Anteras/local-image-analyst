import React from 'react';
import { XIcon } from './icons';

interface MaximizedTextViewerProps {
  text: string;
  onClose: () => void;
}

const SimpleMarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
  const toHtml = (markdown: string) => {
    if (typeof markdown !== 'string') return '';
    // Basic markdown for bold, italics, and converting newlines to <br>
    // Headings are handled by the parent component's labels now.
    return markdown
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  return (
    <div
      className="text-text-secondary leading-relaxed"
      dangerouslySetInnerHTML={{ __html: toHtml(text) }}
    />
  );
};

const MaximizedTextViewer: React.FC<MaximizedTextViewerProps> = ({ text, onClose }) => {
  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const conversationalTurns = text.split('\n\n---\n\n').map((turnString, index) => {
    const lines = turnString.trim().split('\n');
    const headerLine = lines.shift() || '';
    const label = headerLine.replace(/^[#\s]+/, ''); // "Initial Response", "You", "AI Response"
    const content = lines.join('\n').trim();
    return { id: index, label, content };
  });

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-brand-secondary rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()} // Prevent clicks inside from closing the modal
      >
        <header className="flex items-center justify-between p-4 border-b border-brand-tertiary flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary">Text Analysis</h2>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary">
            <XIcon />
          </button>
        </header>
        <main className="p-6 overflow-y-auto space-y-6">
          {conversationalTurns.map(turn => {
            const isAiResponse = turn.label === 'Initial Response' || turn.label === 'AI Response';
            return (
              <div key={turn.id}>
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  {turn.label}
                </p>
                {isAiResponse ? (
                  <div className="bg-brand-primary p-4 rounded-lg">
                    <SimpleMarkdownRenderer text={turn.content} />
                  </div>
                ) : (
                  // "You" block - simpler styling
                  <div className="p-2">
                     <SimpleMarkdownRenderer text={turn.content} />
                  </div>
                )}
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
};

export default MaximizedTextViewer;
