import React from 'react';

interface SideTabButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel: string;
  position: 'left' | 'right';
  top: string;
}

const FloatingActionButton: React.FC<SideTabButtonProps> = ({ onClick, children, ariaLabel, position, top }) => {
  const positionClasses = position === 'left' 
    ? "left-0 rounded-r-2xl" 
    : "right-0 rounded-l-2xl";

  const styleClasses = position === 'left'
    ? "bg-gradient-to-br from-orange-600 to-yellow-400 text-white"
    : "bg-gradient-to-br from-gray-300 to-gray-100 text-gray-800";
    
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={`no-print fixed -translate-y-1/2 z-30 shadow-lg hover:opacity-90 transition-all duration-300 p-1 ${positionClasses} ${styleClasses}`}
      style={{ top, writingMode: 'vertical-rl' }}
    >
      <div className="py-1.5 px-0.5 font-bold text-xs tracking-wide rotate-180 flex items-center justify-center gap-2">
        {children}
      </div>
    </button>
  );
};

export default FloatingActionButton;