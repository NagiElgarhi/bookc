import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { UploadIcon, HomeIcon, SaveIcon, SearchIcon, SpellcheckIcon, SummarizeIcon, XIcon, HtmlIcon, PdfIcon, PrintIcon, RomanTempleIcon } from './icons';
import { PageText, Chapter, SavedSummary } from '../types';
import { extractTextPerPage } from '../services/pdfService';
import { analyzeDocumentStructure, summarizeChapterText, proofreadSinglePageText } from '../services/geminiService';
import { saveSummary, loadAllSavedSummaries } from '../services/dbService';
import LoadingSpinner from './LoadingSpinner';

interface SummarizerSidebarProps {
    isOpen: boolean;
    onGoHome: () => void;
    onClose: () => void;
}

const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const SummarizerSidebar: React.FC<SummarizerSidebarProps> = ({ isOpen, onGoHome, onClose }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [analysisResult, setAnalysisResult] = useState<{ name: string, pageTexts: PageText[], chapters: Chapter[] } | null>(null);
    const [currentSummary, setCurrentSummary] = useState<{ chapterTitle: string, text: string } | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [isSpellchecking, setIsSpellchecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summarizationStyle, setSummarizationStyle] = useState('');
    const sidebarRef = useRef<HTMLElement>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';

    // Library State
    const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);
    const [librarySearchTerm, setLibrarySearchTerm] = useState('');

    const fetchSavedSummaries = useCallback(async () => {
        const summaries = await loadAllSavedSummaries();
        setSavedSummaries(summaries);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchSavedSummaries();
        }
    }, [isOpen, fetchSavedSummaries]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setAnalysisResult(null);
            setCurrentSummary(null);
            setError(null);
        } else {
            setFile(null);
            setError("Please select a valid PDF file.");
        }
    };

    const handleAnalyze = useCallback(async () => {
        if (!file) return;

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setCurrentSummary(null);

        try {
            setLoadingText("Analyzing document structure...");
            const pageTexts = await extractTextPerPage(file);
            const chapters = await analyzeDocumentStructure(pageTexts);

            if (chapters) {
                setAnalysisResult({ name: file.name, pageTexts: pageTexts, chapters });
            } else {
                setError("Failed to analyze document structure.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred during analysis.");
        } finally {
            setIsLoading(false);
            setLoadingText('');
        }
    }, [file]);

    const handleSelectChapter = async (chapter: Chapter) => {
        if (!analysisResult) return;
        setIsSummarizing(true);
        setCurrentSummary(null);
        setError(null);
        try {
            const chapterText = analysisResult.pageTexts
                .filter(p => p.pageNumber >= chapter.startPage && p.pageNumber <= chapter.endPage)
                .map(p => p.text)
                .join('\n\n');
            
            if (!chapterText.trim()) {
                setError("This chapter contains no text to summarize.");
                setIsSummarizing(false);
                return;
            }

            const summaryText = await summarizeChapterText(chapterText, summarizationStyle);
            setCurrentSummary({ chapterTitle: chapter.title, text: summaryText });

        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate summary.");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleSaveSummary = useCallback(async () => {
        if (!analysisResult || !currentSummary) {
            setError("There is no summary to save.");
            return;
        }
        setIsLoading(true);
        setLoadingText("Saving summary to library...");
        try {
            const summaryToSave: SavedSummary = {
                id: generateUniqueId(),
                bookName: analysisResult.name,
                chapterTitle: currentSummary.chapterTitle,
                summaryText: currentSummary.text,
            };
            await saveSummary(summaryToSave);
            await fetchSavedSummaries();
            alert(`Summary for "${currentSummary.chapterTitle}" saved successfully.`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save summary.");
        } finally {
            setIsLoading(false);
            setLoadingText('');
        }
    }, [analysisResult, currentSummary, fetchSavedSummaries]);
    
    const handlePrint = () => {
        if (!sidebarRef.current) return;
        
        const sidebarElement = sidebarRef.current;
        document.body.classList.add('printing-sidebar');
        sidebarElement.classList.add('is-printing');

        const cleanup = () => {
            document.body.classList.remove('printing-sidebar');
            sidebarElement.classList.remove('is-printing');
            window.removeEventListener('afterprint', cleanup);
        };
        window.addEventListener('afterprint', cleanup);
        window.print();
    };

    const downloadHtml = (elementId: string, title: string) => {
        const element = document.getElementById(elementId);
        if (!element) return;

        const styles = `
            body { font-family: 'Times New Roman', serif; line-height: 1.8; padding: 2rem; margin: auto; max-width: 800px; }
            h3 { font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem; }
            p { white-space: pre-wrap; }
        `;
        
        const htmlString = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>${styles}</style>
            </head>
            <body>${element.innerHTML}</body>
            </html>
        `;

        const blob = new Blob([htmlString], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, '_')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleLoadSummary = (summary: SavedSummary) => {
        setAnalysisResult(null);
        setCurrentSummary({ chapterTitle: `${summary.bookName} - ${summary.chapterTitle}`, text: summary.summaryText });
        setFile(null);
    };

    const handleSpellcheck = async () => {
        if (!currentSummary) return;
        setIsSpellchecking(true);
        try {
            const correctedText = await proofreadSinglePageText(currentSummary.text);
            setCurrentSummary(prev => prev ? { ...prev, text: correctedText } : null);
        } catch (e) {
            setError("Failed to spellcheck the summary.");
        } finally {
            setIsSpellchecking(false);
        }
    };

    const filteredSummaries = useMemo(() => {
        if (!savedSummaries) return [];
        return savedSummaries.filter(s => 
            s.bookName.toLowerCase().includes(librarySearchTerm.toLowerCase()) || 
            s.chapterTitle.toLowerCase().includes(librarySearchTerm.toLowerCase())
        );
    }, [savedSummaries, librarySearchTerm]);

    return (
        <aside
            ref={sidebarRef}
            className={`fixed inset-0 bg-[var(--color-background-secondary)]/70 backdrop-blur-lg shadow-2xl transition-transform duration-500 ease-in-out z-50 flex flex-col ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            aria-hidden={!isOpen}
        >
            {isOpen && (
                <>
                    <div className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center bg-[var(--color-background-primary)] no-print-sidebar">
                        <button onClick={onGoHome} className="p-2 rounded-lg text-white flex items-center gap-2 px-4" aria-label="Home" style={{backgroundImage: goldenGradient}}>
                            <HomeIcon className="w-6 h-6" /> <span className="font-bold">Home</span>
                        </button>
                        <h2 className="text-xl font-bold golden-text flex items-center gap-2">
                            <SummarizeIcon className="w-6 h-6 rotate-90 golden-text" />
                            Summaries
                        </h2>
                         <div className="flex items-center gap-2">
                             <button onClick={() => downloadHtml('summary-content', `Summary_${currentSummary?.chapterTitle}`)} title="Download HTML" disabled={!currentSummary} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><HtmlIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Download PDF / Print" disabled={!currentSummary} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PdfIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Print" disabled={!currentSummary} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PrintIcon className="w-4 h-4"/></button>
                             <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close">
                                <XIcon className="w-6 h-6 golden-text" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--color-border-primary)] flex justify-center items-center gap-4 no-print-sidebar">
                        <label htmlFor="summarizer-file-upload" className="cursor-pointer flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:opacity-90 transition-all" style={{ backgroundImage: goldenGradient }}>
                            <UploadIcon className="w-4 h-4"/> New File
                        </label>
                        <input id="summarizer-file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                        <button onClick={handleAnalyze} disabled={!file || isLoading} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:opacity-90 disabled:bg-none disabled:bg-gray-500 disabled:cursor-not-allowed" style={{ backgroundImage: goldenGradient }}>
                            {isLoading ? '...' : 'Analyze'}
                        </button>
                        <button onClick={handleSaveSummary} disabled={!currentSummary || isLoading} className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:opacity-90 disabled:bg-none disabled:bg-gray-500 disabled:cursor-not-allowed" style={{ backgroundImage: goldenGradient }}>
                            <SaveIcon className="w-4 h-4"/> Save Summary
                        </button>
                    </div>
                    
                     <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--color-border-primary)] no-print-sidebar">
                        {file && !isLoading && ( <div className="p-2 bg-yellow-500/10 rounded-md text-xs text-center text-dark-gold-gradient"> Selected File: <span className="font-bold">{file.name}</span></div>)}
                        {error && ( <div className="p-2 bg-yellow-500/10 text-dark-gold-gradient rounded-md text-sm text-center"> {error} </div> )}
                     </div>

                    <div className="flex-grow flex flex-row-reverse min-h-0">
                        {isLoading ? <div className="w-full flex items-center justify-center"><LoadingSpinner text={loadingText} /></div> :
                        <>
                            {/* Navigation Panel */}
                            <nav className="w-1/4 border-r border-[var(--color-border-primary)] flex-shrink-0 flex flex-col no-print-sidebar">
                                <div className="flex-grow overflow-y-auto p-3">
                                {analysisResult ? (
                                    <>
                                        <div className="px-1 pb-3 mb-3 border-b border-[var(--color-border-primary)]">
                                            <label htmlFor="summary-style" className="block text-sm font-bold text-center golden-text mb-2">
                                               Summarization Style
                                            </label>
                                            <input
                                                id="summary-style"
                                                type="text"
                                                value={summarizationStyle}
                                                onChange={(e) => setSummarizationStyle(e.target.value)}
                                                placeholder="e.g., in bullet points..."
                                                className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-md border border-yellow-800/30 text-sm"
                                            />
                                        </div>
                                        <ul className="space-y-1">
                                            {analysisResult.chapters.map(chapter => (
                                                <li key={chapter.id}>
                                                    <button 
                                                        onClick={() => handleSelectChapter(chapter)} 
                                                        dir="auto"
                                                        className={`flex justify-between items-center w-full text-start p-2 rounded-md cursor-pointer ${currentSummary?.chapterTitle === chapter.title ? 'bg-yellow-500/20 text-dark-gold-gradient font-bold' : 'text-gold-brown hover:bg-yellow-500/10'}`}
                                                    >
                                                        <span className="font-semibold">{chapter.title}</span>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                ) : ( <div className="text-center p-4 text-gold-brown text-sm"> {file ? 'Click "Analyze" to begin.' : 'Select a PDF file or load a summary from your library.'} </div> )}
                                </div>
                                <div className="flex-shrink-0 border-t border-[var(--color-border-primary)] p-3 space-y-3">
                                    <h4 className="font-bold text-center golden-text">Summary Library</h4>
                                    <div className="relative">
                                        <input type="search" placeholder="Search..." value={librarySearchTerm} onChange={e => setLibrarySearchTerm(e.target.value)} className="w-full p-2 pl-8 text-sm bg-[var(--color-background-tertiary)] rounded-md border border-yellow-800/30"/>
                                        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 golden-text"/>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-2">
                                        {filteredSummaries.length > 0 ? filteredSummaries.map(s => (
                                            <div key={s.id} dir="auto" className="p-2 bg-[var(--color-background-tertiary)] rounded-md text-sm text-start">
                                                <p className="font-semibold text-gold-brown truncate" title={`${s.bookName} - ${s.chapterTitle}`}>
                                                    <span className="font-bold text-dark-gold-gradient">{s.chapterTitle}</span>
                                                    <span className="text-xs"> ({s.bookName})</span>
                                                </p>
                                                <div className="flex gap-2 mt-1">
                                                    <button onClick={() => handleLoadSummary(s)} className="flex-1 text-xs py-1 rounded text-white hover:opacity-90" style={{ backgroundImage: goldenGradient }}>View</button>
                                                </div>
                                            </div>
                                        )) : <p className="text-xs text-center text-gold-brown p-2">Your library is empty.</p>}
                                    </div>
                                </div>
                            </nav>
                            {/* Content Panel */}
                            <div className="flex-grow overflow-y-auto p-6 bg-[var(--color-background-primary)] w-3/4 printable-content">
                                {isSummarizing ? (
                                    <div className="flex items-center justify-center h-full"> <LoadingSpinner text="Generating summary..." /> </div>
                                ) : currentSummary ? (
                                    <div id="summary-content" dir="auto" style={{ fontFamily: "'Times New Roman', serif" }}>
                                        <div className="flex justify-between items-center border-b border-[var(--color-border-primary)] pb-3 mb-4">
                                            <h3 className="text-2xl font-bold golden-text">Summary: {currentSummary.chapterTitle}</h3>
                                            <div className="flex items-center gap-2 no-print-sidebar">
                                                <button onClick={handleSpellcheck} disabled={isSpellchecking} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow hover:opacity-90 disabled:bg-none disabled:bg-gray-500" style={{ backgroundImage: goldenGradient }}>
                                                    {isSpellchecking ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <SpellcheckIcon className="w-4 h-4" />}
                                                    <span>Correct</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <RomanTempleIcon className="w-5 h-5 golden-text flex-shrink-0 mt-1" />
                                            <p className="flex-grow text-lg leading-relaxed whitespace-pre-wrap text-dark-gold-gradient">{currentSummary.text}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-center text-lg text-gold-brown">
                                            {analysisResult ? 'Select a chapter from the list to generate a summary.' : (file ? 'Click "Analyze" to begin.' : 'Select a PDF file or load a summary from your library.')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                        }
                    </div>
                </>
            )}
        </aside>
    );
};

export default SummarizerSidebar;