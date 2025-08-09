import React from 'react';
import { XIcon, RomanTempleIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface ExplanationPopupProps {
    content: string | null;
    isLoading: boolean;
    position: { x: number, y: number };
    onClose: () => void;
}

const ExplanationPopup: React.FC<ExplanationPopupProps> = ({ content, isLoading, position, onClose }) => {
    return (
        <div 
            className="fixed z-[60] w-[400px] h-[400px] bg-[var(--color-background-secondary)] rounded-2xl shadow-2xl border-2 border-[var(--color-accent-primary)]/50 flex flex-col p-[2px]"
            style={{ 
                top: position.y, 
                left: position.x,
                transform: 'translate(-100%, -100%)', // Position it above and to the left of the click
                backgroundImage: 'linear-gradient(to bottom right, #c09a3e, #856a3d)',
            }}
        >
            <div className="w-full h-full rounded-[calc(1rem-2px)] p-4 flex flex-col bg-[var(--color-background-primary)]">
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h3 className="text-lg font-bold golden-text flex items-center gap-2"><RomanTempleIcon className="w-5 h-5"/> Explanation</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-background-tertiary)]">
                        <XIcon className="w-5 h-5 text-[var(--color-text-secondary)]"/>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto text-base text-[var(--color-text-primary)] pr-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <LoadingSpinner text="Explaining..." />
                        </div>
                    ) : (
                        <p style={{whiteSpace: 'pre-wrap'}}>{content}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExplanationPopup;
