
import React, { useState, useMemo } from 'react';
import { Chapter, Lesson, PageText } from '../types';
import { BookOpenIcon, SearchIcon, RomanTempleIcon } from './icons';

interface ChapterSelectorProps {
  chapters: Chapter[];
  pageTexts: PageText[];
  onGenerate: (selection: Lesson) => void;
  onBack: () => void;
  onAnalyzeSubstructure: (chapterIndex: number) => void;
  onTestChapter: (chapter: Chapter) => void;
}

const ChapterSelector: React.FC<ChapterSelectorProps> = ({ chapters, pageTexts, onGenerate, onBack, onAnalyzeSubstructure, onTestChapter }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = useMemo(() => {
    if (!searchTerm.trim() || !pageTexts) {
      return [];
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const results: { pageNumber: number; snippet: string }[] = [];

    for (const page of pageTexts) {
      const lowerCaseText = page.text.toLowerCase();
      let lastIndex = -1;
      while ((lastIndex = lowerCaseText.indexOf(lowerCaseSearchTerm, lastIndex + 1)) !== -1) {
        const start = Math.max(0, lastIndex - 30);
        const end = Math.min(page.text.length, lastIndex + searchTerm.length + 30);
        const snippet = `...${page.text.substring(start, end)}...`;
        results.push({ pageNumber: page.pageNumber, snippet });
        if (results.length >= 50) return results; // Limit results for performance
      }
    }
    return results;
  }, [searchTerm, pageTexts]);


  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl p-[2px] bg-gradient-to-br from-[#c09a3e] to-[#856a3d]">
      <div 
        className="w-full h-full text-center rounded-[calc(1rem-2px)] p-6 sm:p-8"
        style={{ backgroundImage: 'var(--color-background-container-gradient)' }}
      >
        <h2 className="text-3xl font-bold mb-4 golden-text">Book Structure</h2>
        
        {/* In-document Search */}
        <div className="mb-6 max-w-xl mx-auto">
            <div className="relative">
                <input 
                    type="search"
                    placeholder="Search within the document..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-8 bg-[var(--color-background-tertiary)] rounded-lg border border-[var(--color-border-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] transition text-[var(--color-text-primary)] font-semibold"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <SearchIcon className="w-4 h-4 text-[var(--color-text-secondary)]" />
                </div>
            </div>
            {searchTerm && (
                <div className="mt-4 text-left max-h-60 overflow-y-auto bg-[var(--color-background-primary)] rounded-lg p-3 space-y-2">
                    {searchResults.length > 0 ? searchResults.map((result, index) => (
                        <div key={index} className="p-2 border-b border-[var(--color-border-primary)]/50">
                            <p className="text-sm" style={{color: 'var(--color-text-brown-dark)'}} dangerouslySetInnerHTML={{__html: result.snippet.replace(new RegExp(searchTerm, "gi"), (match) => `<strong class="text-[var(--color-accent-danger)] bg-[var(--color-accent-danger)]/20">${match}</strong>`)}}></p>
                            <span className="text-xs font-bold text-[var(--color-accent-primary)]">Page: {result.pageNumber}</span>
                        </div>
                    )) : (
                        <p className="text-center text-[var(--color-text-secondary)] p-4">No search results found.</p>
                    )}
                </div>
            )}
        </div>


        <div className="space-y-3">
          {chapters.map((chapter, chapterIndex) => {
            const isAnalyzing = chapter.isAnalyzing === true;
            const lessonsAvailable = chapter.lessons !== undefined;

            return (
              <div key={chapter.id} className="rounded-xl p-[2px] bg-gradient-to-br from-[#D4AF37]/50 to-[#6d4c11]/50 transition-all duration-300">
                <div className="bg-[var(--color-background-secondary)]/80 rounded-[calc(0.75rem-2px)] p-4 text-left">
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div className="flex-grow flex items-center gap-3" dir="auto">
                    <button onClick={() => onTestChapter(chapter)} title={`Test me on: ${chapter.title}`} className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors rounded-full hover:bg-[var(--color-accent-primary)]/10">
                        <RomanTempleIcon className="w-6 h-6"/>
                    </button>
                    <div>
                      <h3 className="font-bold text-lg text-start" style={{ color: 'var(--color-text-brown-dark)' }}>
                        {chapter.title}
                      </h3>
                      <p className="text-sm mt-1" style={{ color: 'var(--color-text-green-dark)' }}>
                        (p. {chapter.startPage}-{chapter.endPage})
                      </p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isAnalyzing ? (
                        <div className="flex items-center p-2 text-dark-gold-gradient">
                            <div className="w-5 h-5 border-2 border-yellow-800/50 border-t-yellow-600 rounded-full animate-spin mr-2"></div>
                            <span className="font-bold">Analyzing structure...</span>
                        </div>
                    ) : !lessonsAvailable && (
                      <button
                          onClick={() => onAnalyzeSubstructure(chapterIndex)}
                          className="px-3 py-1.5 text-xs font-semibold text-white rounded-md shadow hover:opacity-90 transition-all transform hover:scale-105"
                          style={{ backgroundImage: 'linear-gradient(to bottom right, #c09a3e, #856a3d)' }}
                      >
                          Analyze Sub-structure
                      </button>
                    )}
                  </div>
                </div>

                {lessonsAvailable && !isAnalyzing && (
                  <div className="mt-3 pt-3 border-t border-[var(--color-border-primary)]">
                    {chapter.lessons && chapter.lessons.length > 0 ? (
                      <ul className="space-y-2">
                        {chapter.lessons.map((lesson) => (
                          <li key={lesson.id} dir="auto" className="flex flex-col sm:flex-row justify-between items-center gap-4 p-2 rounded-lg bg-[var(--color-background-tertiary)]/70">
                            <div className="flex items-center gap-3 text-start">
                              <BookOpenIcon className="w-5 h-5 text-gold-brown flex-shrink-0" />
                              <span className="font-medium text-sm" style={{color: 'var(--color-text-primary)'}}>{lesson.title}</span>
                            </div>
                            <button
                              onClick={() => onGenerate(lesson)}
                              style={{ backgroundImage: 'linear-gradient(to bottom right, #c09a3e, #856a3d)' }}
                              className="px-3 py-1.5 text-xs font-bold text-white rounded-md shadow-lg hover:opacity-90 transition-all transform hover:scale-105 w-full sm:w-auto flex-shrink-0"
                            >
                              Generate Lesson & Questions
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-center text-[var(--color-text-secondary)] py-2">No analyzable lessons found in this component.</p>
                    )}
                  </div>
                )}
                </div>
              </div>
            );
          })}
        </div>
          
        <div className="mt-6 pt-4 border-t border-[var(--color-border-primary)] flex justify-center">
          <button
            onClick={onBack}
            className="px-6 py-2 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors"
            style={{ backgroundImage: 'linear-gradient(to bottom right, #c09a3e, #856a3d)' }}
          >
            Back to upload another file
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChapterSelector;
