
import React, { useState } from 'react';
import { KeyIcon, RomanTempleIcon } from './icons';

interface ApiKeyModalProps {
  onSetKey: (key: string) => void;
  onCancel: () => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSetKey, onCancel }) => {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) {
      onSetKey(key.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div 
        className="w-full max-w-lg rounded-2xl p-[2px] bg-gradient-to-br from-[#c09a3e] to-[#856a3d] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div 
          className="w-full h-full text-center rounded-[calc(1rem-2px)] p-8 bg-[var(--color-background-primary)]"
          style={{ backgroundImage: 'var(--color-background-container-gradient)' }}
        >
          <div className="flex justify-center mb-4">
            <RomanTempleIcon className="w-16 h-16" />
          </div>
          <h2 className="text-3xl font-bold mb-3 golden-text">API Key Required</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            To use the AI-powered features of this application, you need to provide a Google AI API key.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <KeyIcon className="w-5 h-5 text-[var(--color-text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your Google AI API Key"
                className="w-full p-3 pl-10 bg-[var(--color-background-tertiary)] rounded-lg border border-[var(--color-border-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)] transition text-[var(--color-text-primary)]"
              />
            </div>
            <button
              type="submit"
              disabled={!key.trim()}
              className="w-full px-6 py-3 text-lg font-bold text-white rounded-lg shadow-lg hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' }}
            >
              Save and Continue
            </button>
          </form>

          <div className="mt-6 text-sm">
            <p className="text-[var(--color-text-tertiary)]">Don't have a key?</p>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold golden-text hover:underline"
            >
              Get one from Google AI Studio
            </a>
          </div>
          <button onClick={onCancel} className="text-xs text-[var(--color-text-tertiary)] hover:underline mt-4">Continue without AI features</button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
