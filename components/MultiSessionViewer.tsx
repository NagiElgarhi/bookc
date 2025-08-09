import React from 'react';
import { InteractiveContent } from '../types';
import { BookOpenIcon, ArrowLeftIcon } from './icons';

interface MultiSessionViewerProps {
  sessions: InteractiveContent[];
  onSelectSession: (session: InteractiveContent) => void;
  onBack: () => void;
}

export const MultiSessionViewer: React.FC<MultiSessionViewerProps> = ({ sessions, onSelectSession, onBack }) => {
  return (
    <div className="w-full max-w-3xl mx-auto text-center bg-[var(--color-background-secondary)]/50 backdrop-blur-sm border border-[var(--color-border-primary)]/50 rounded-2xl p-8">
      <h2 className="text-3xl font-bold text-[var(--color-text-primary)] mb-4">الدروس المتاحة</h2>
      <p className="text-[var(--color-text-secondary)] mb-8">
        لقد قمنا بإنشاء الدروس التالية. اختر درسًا للبدء.
      </p>
      
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
        {sessions.length > 0 ? (
          sessions.map((session, index) => (
            <button
              key={index}
              onClick={() => onSelectSession(session)}
              className="w-full text-right p-4 rounded-lg transition-all duration-200 bg-[var(--color-background-tertiary)]/60 border-2 border-transparent hover:bg-[var(--color-accent-info)]/20 hover:border-[var(--color-accent-info)]/80 flex justify-between items-center gap-4"
            >
              <div className="flex items-center gap-4">
                <BookOpenIcon className="w-6 h-6 text-[var(--color-accent-info)] flex-shrink-0" />
                <span className="font-semibold text-lg text-[var(--color-text-primary)]">{session.title}</span>
              </div>
              <span className="text-sm font-semibold text-[var(--color-accent-info)]">ابدأ الدرس</span>
            </button>
          ))
        ) : (
          <p className="text-[var(--color-text-secondary)] py-8">لم يتم إنشاء أي دروس بنجاح. قد يكون محتوى الفصول فارغًا.</p>
        )}
      </div>
        
      <div className="mt-8 pt-6 border-t border-[var(--color-border-primary)] flex justify-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-8 py-3 text-lg font-semibold text-[var(--color-text-primary)] bg-[var(--color-background-tertiary)] rounded-lg hover:bg-[var(--color-border-primary)] transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5"/>
          <span>عودة</span>
        </button>
      </div>
    </div>
  );
};