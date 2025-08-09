import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { UploadIcon, ChevronDownIcon, HomeIcon, SaveIcon, SearchIcon, SpellcheckIcon, XIcon, HtmlIcon, PdfIcon, PrintIcon, RomanTempleIcon, EditIcon } from './icons';
import { PageText, Chapter, SavedBook } from '../types';
import { extractTextPerPage } from '../services/pdfService';
import { analyzeDocumentStructure, proofreadSinglePageText } from '../services/geminiService';
import { saveBook, loadAllSavedBooks } from '../services/dbService';
import LoadingSpinner from './LoadingSpinner';

interface EditSidebarProps {
    isOpen: boolean;
    onGoHome: () => void;
    onClose: () => void;
}

const EditSidebar: React.FC<EditSidebarProps> = ({ isOpen, onGoHome, onClose }) => {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [analysisResult, setAnalysisResult] = useState<SavedBook | null>(null);
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const [selectedPage, setSelectedPage] = useState<PageText | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSpellchecking, setIsSpellchecking] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);

    // Library State
    const [savedBooks, setSavedBooks] = useState<SavedBook[]>([]);
    const [librarySearchTerm, setLibrarySearchTerm] = useState('');

    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';

    const fetchSavedBooks = useCallback(async () => {
        const books = await loadAllSavedBooks();
        setSavedBooks(books);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchSavedBooks();
        }
    }, [isOpen, fetchSavedBooks]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setAnalysisResult(null);
            setSelectedPage(null);
            setActiveChapterId(null);
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
        setSelectedPage(null);

        try {
            setLoadingText("Extracting text...");
            const pageTexts = await extractTextPerPage(file);
            const fileContent = await file.arrayBuffer();

            setLoadingText("Analyzing document structure...");
            const chapters = await analyzeDocumentStructure(pageTexts);

            if (chapters) {
                const newBook: SavedBook = {
                    id: `${Date.now()}`, // Temporary ID for unsaved book
                    name: file.name,
                    pageTexts,
                    chapters,
                    fileContent,
                };
                setAnalysisResult(newBook);
            } else {
                setError("Failed to analyze document structure.");
            }
        } catch (err: any) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred during analysis.");
        } finally {
            setIsLoading(false);
            setLoadingText('');
        }
    }, [file]);

    const handleSaveChanges = useCallback(async () => {
        if (!analysisResult) {
            setError("No book is currently loaded for analysis.");
            return;
        }
        setIsLoading(true);
        setLoadingText("Saving changes...");
        try {
            const bookToSave = { ...analysisResult };
            if (bookToSave.id.length < 15) { // Simple check for temp ID
                bookToSave.id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            }

            await saveBook(bookToSave);
            await fetchSavedBooks(); // Refresh the list
            setAnalysisResult(bookToSave); // Update state with the potentially new ID
            alert(`Changes to "${bookToSave.name}" have been saved successfully.`);
        } catch (err: any) {
            setError(err instanceof Error ? err.message : "Failed to save the book.");
        } finally {
            setIsLoading(false);
            setLoadingText('');
        }
    }, [analysisResult, fetchSavedBooks]);

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
            body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 2rem; margin: auto; max-width: 800px; }
            h3, h4 { color: #333; }
            textarea { width: 100%; border: 1px solid #ccc; padding: 1rem; font-family: inherit; font-size: inherit; }
            img { max-width: 100%; height: auto; border-radius: 4px; margin-top: 1rem; }
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

    const handleLoadBook = (book: SavedBook) => {
        setAnalysisResult(book);
        setFile(null);
        setSelectedPage(null);
        setActiveChapterId(null);
    };

    const handleSpellcheck = async () => {
        if (!selectedPage) return;
        setIsSpellchecking(true);
        try {
            const correctedText = await proofreadSinglePageText(selectedPage.text);
            const updatedPage = { ...selectedPage, text: correctedText };
            setSelectedPage(updatedPage);

            if (analysisResult) {
                const updatedPageTexts = analysisResult.pageTexts.map(p => p.pageNumber === updatedPage.pageNumber ? updatedPage : p);
                setAnalysisResult(prev => prev ? { ...prev, pageTexts: updatedPageTexts } : null);
            }

        } catch (e) {
            setError("Failed to spellcheck the page.");
        } finally {
            setIsSpellchecking(false);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!selectedPage || !analysisResult) return;
        const newText = e.target.value;

        const updatedPage = { ...selectedPage, text: newText };
        setSelectedPage(updatedPage);

        const updatedPageTexts = analysisResult.pageTexts.map(p =>
            p.pageNumber === updatedPage.pageNumber ? updatedPage : p
        );
        setAnalysisResult(prev => prev ? { ...prev, pageTexts: updatedPageTexts } : null);
    };

    const filteredBooks = useMemo(() => {
        if (!savedBooks) return [];
        return savedBooks.filter(b => b.name.toLowerCase().includes(librarySearchTerm.toLowerCase()));
    }, [savedBooks, librarySearchTerm]);

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
                        <button onClick={onGoHome} className="p-2 rounded-lg text-white flex items-center gap-2 px-4" aria-label="Home" style={{ backgroundImage: goldenGradient }}>
                            <HomeIcon className="w-6 h-6" /> <span className="font-bold">Home</span>
                        </button>
                        <h2 className="text-xl font-bold golden-text flex items-center gap-2">
                            <EditIcon className="w-6 h-6 golden-text" />
                             Edit Text
                        </h2>
                        <div className="flex items-center gap-2">
                             <button onClick={() => downloadHtml(`page-content-${selectedPage?.pageNumber}`, `${analysisResult?.name || 'document'}_page_${selectedPage?.pageNumber}`)} title="Download HTML" disabled={!selectedPage} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><HtmlIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Download PDF / Print" disabled={!selectedPage} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PdfIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Print" disabled={!selectedPage} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PrintIcon className="w-4 h-4"/></button>
                             <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close">
                                <XIcon className="w-6 h-6 golden-text" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-shrink-0 px-4 py-2 border-b border-[var(--color-border-primary)] flex justify-center items-center gap-4 no-print-sidebar">
                        <label htmlFor="edit-file-upload" className="cursor-pointer flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:opacity-90 transition-all" style={{backgroundImage: goldenGradient}}>
                            <UploadIcon className="w-4 h-4"/> New File
                        </label>
                        <input id="edit-file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} />
                        <button onClick={handleAnalyze} disabled={!file || isLoading} className="px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:opacity-90 disabled:bg-none disabled:bg-[var(--color-border-secondary)] disabled:cursor-not-allowed" style={{backgroundImage: goldenGradient}}>
                            {isLoading ? '...' : 'Analyze'}
                        </button>
                        <button onClick={handleSaveChanges} disabled={!analysisResult || isLoading} className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow-md hover:opacity-90 disabled:bg-none disabled:bg-[var(--color-border-secondary)] disabled:cursor-not-allowed" style={{backgroundImage: goldenGradient}}>
                            <SaveIcon className="w-4 h-4"/> Save Changes
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
                                    <ul className="space-y-1">
                                        {analysisResult.chapters.map(chapter => (
                                            <li key={chapter.id}>
                                                <div onClick={() => setActiveChapterId(prev => prev === chapter.id ? null : chapter.id)} className="flex justify-between items-center w-full text-left p-2 rounded-md cursor-pointer hover:bg-yellow-500/10">
                                                    <span className="font-semibold text-dark-gold-gradient">{chapter.title}</span>
                                                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${activeChapterId === chapter.id ? 'rotate-180' : ''}`} />
                                                </div>
                                                {activeChapterId === chapter.id && (
                                                    <ul className="pl-4 mt-1 space-y-1 border-l-2 border-yellow-700/30">
                                                        {analysisResult.pageTexts.filter(p => p.pageNumber >= chapter.startPage && p.pageNumber <= chapter.endPage).map(page => (
                                                            <li key={page.pageNumber}>
                                                                <button onClick={() => setSelectedPage(page)} className={`w-full text-left p-1.5 text-sm rounded-md ${selectedPage?.pageNumber === page.pageNumber ? 'bg-yellow-500/20 text-dark-gold-gradient font-bold' : 'text-gold-brown hover:bg-yellow-500/10'}`}>
                                                                    Page {page.pageNumber}
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : ( <div className="text-center p-4 text-gold-brown text-sm"> {file ? 'Click "Analyze" to begin.' : 'Select a PDF file or load a book from your library.'} </div> )}
                                </div>
                                <div className="flex-shrink-0 border-t border-[var(--color-border-primary)] p-3 space-y-3">
                                    <h4 className="font-bold text-center golden-text">Book Library</h4>
                                     <div className="relative">
                                        <input type="search" placeholder="Search..." value={librarySearchTerm} onChange={e => setLibrarySearchTerm(e.target.value)} className="w-full p-2 pl-8 text-sm bg-[var(--color-background-tertiary)] rounded-md border border-yellow-800/30"/>
                                        <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 golden-text"/>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-2">
                                        {filteredBooks.length > 0 ? filteredBooks.map(b => (
                                            <div key={b.id} className="p-2 bg-[var(--color-background-tertiary)] rounded-md text-sm">
                                                <p className="font-semibold text-gold-brown truncate" title={b.name}>{b.name}</p>
                                                <div className="flex gap-2 mt-1">
                                                    <button onClick={() => handleLoadBook(b)} className="flex-1 text-xs py-1 rounded text-white hover:opacity-90" style={{ backgroundImage: goldenGradient }}>View</button>
                                                </div>
                                            </div>
                                        )) : <p className="text-xs text-center text-gold-brown p-2">Your library is empty.</p>}
                                    </div>
                                </div>
                            </nav>

                            {/* Content Panel */}
                            <div className="flex-grow overflow-y-auto p-6 bg-[var(--color-background-primary)] printable-content" style={{ fontFamily: "'Times New Roman', serif" }}>
                                {selectedPage ? (
                                    <div id={`page-content-${selectedPage.pageNumber}`}>
                                        <div className="flex justify-between items-center border-b border-[var(--color-border-primary)] pb-3 mb-4">
                                            <h3 className="text-2xl font-bold golden-text">Page {selectedPage.pageNumber}</h3>
                                            <div className="flex items-center gap-2 no-print-sidebar">
                                                <button onClick={handleSpellcheck} disabled={isSpellchecking} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-white rounded-lg shadow hover:opacity-90 disabled:bg-none disabled:bg-[var(--color-border-secondary)]" style={{backgroundImage: goldenGradient}}>
                                                    {isSpellchecking ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <SpellcheckIcon className="w-4 h-4" />}
                                                    <span>Correct</span>
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3">
                                            <RomanTempleIcon className="w-5 h-5 golden-text flex-shrink-0 mt-4" />
                                            <textarea
                                                value={selectedPage.text}
                                                onChange={handleTextChange}
                                                className="flex-grow w-full h-[60vh] p-4 font-sans text-base bg-transparent rounded-lg border border-dashed border-[var(--color-border-secondary)] focus:border-solid focus:border-[var(--color-accent-primary)] focus:ring-1 focus:ring-[var(--color-accent-primary)]"
                                                style={{ fontFamily: "inherit" }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <p className="text-center text-lg text-gold-brown">
                                            {analysisResult ? 'Select a page from the list to view and edit it.' : (file ? 'Click "Analyze" to begin.' : 'Select a PDF file or load a book from your library.')}
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

export default EditSidebar;