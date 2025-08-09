import React, { useRef, useCallback, useMemo } from 'react';
import { hslToHex } from '../services/themeService';

type ThemeMode = 'light' | 'dark';

interface ColorPickerSidebarProps {
  hue: number;
  themeMode: ThemeMode;
  onThemeChange: (hue: number, mode: ThemeMode) => void;
}

const ColorPickerSidebar: React.FC<ColorPickerSidebarProps> = ({ hue, themeMode, onThemeChange }) => {
  const barRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleThemeSelection = useCallback((clientX: number, clientY: number) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    
    // Calculate hue from vertical position
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const newHue = Math.round((y / rect.height) * 360);
    
    // Calculate theme mode from horizontal position
    const x = clientX - rect.left;
    const newMode: ThemeMode = x < rect.width / 2 ? 'dark' : 'light';

    onThemeChange(newHue, newMode);
  }, [barRef, onThemeChange]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleThemeSelection(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging.current) {
      handleThemeSelection(e.clientX, e.clientY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };
  
  const indicatorY = barRef.current ? (hue / 360) * barRef.current.clientHeight : 0;
  const indicatorX = themeMode === 'dark' ? '25%' : '75%';
  const indicatorColor = themeMode === 'dark' ? 'white' : 'black';

  const colorSlots = useMemo(() => {
    return Array.from({ length: 100 }).map((_, i) => {
      const slotHue = Math.round((i / 99) * 360);
      const darkShade = hslToHex(slotHue, 30, 15);
      const lightShade = hslToHex(slotHue, 75, 95);
      const gradient = `linear-gradient(to right, ${darkShade}, ${lightShade})`;
      return (
        <div
          key={i}
          className="w-full h-[1%]"
          style={{ background: gradient }}
        />
      );
    });
  }, []);

  const ringColorClass = indicatorColor === 'white' ? 'ring-white' : 'ring-black';

  return (
    <aside className="fixed top-0 left-0 h-full w-[10px] bg-white/50 backdrop-blur-sm border-r border-black/10 flex flex-col items-center z-40 select-none">
      <div
        ref={barRef}
        className="relative w-full h-full cursor-pointer flex flex-col"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {colorSlots}
        <div
          className={`absolute w-2 h-2 rounded-full pointer-events-none ring-2 ring-offset-2 ring-offset-transparent transition-all duration-100 ${ringColorClass}`}
          style={{ 
            top: `${indicatorY}px`,
            left: indicatorX,
            transform: 'translate(-50%, -50%)',
            backgroundColor: indicatorColor,
            filter: 'drop-shadow(0 0 4px rgba(0, 0, 0, 0.5))',
          }}
        />
      </div>
    </aside>
  );
};

export default ColorPickerSidebar;