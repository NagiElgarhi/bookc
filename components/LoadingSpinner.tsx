import React from 'react';

interface LoadingSpinnerProps {
    text: string;
    progress?: { current: number; total: number };
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ text, progress }) => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Shimmering, spinning golden gradient ring */}
        <div 
          className="absolute w-full h-full rounded-full animate-spin animate-shimmer"
          style={{ 
            backgroundImage: 'linear-gradient(145deg, #6d4c11, #D4AF37, #6d4c11)',
            backgroundSize: '200% 200%',
          }}
        >
        </div>
        {/* Inner circle to create the ring effect */}
        <div 
          className="absolute w-[calc(100%-16px)] h-[calc(100%-16px)] bg-[var(--color-background-primary)] rounded-full"
        >
        </div>
        {/* Progress text */}
        {progress && (
          <span className="text-xl font-bold text-[var(--color-text-primary)] z-10">
            {progress.current}/{progress.total}
          </span>
        )}
      </div>
      <p className="text-lg font-semibold text-[var(--color-text-secondary)] mt-4 text-center">{text}</p>
    </div>
  );
};

export default LoadingSpinner;