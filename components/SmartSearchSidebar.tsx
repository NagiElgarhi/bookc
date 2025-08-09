import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { PageText } from '../types';
import { extractTextFromImage } from '../services/geminiService';
import { extractTextPerPage } from '../services/pdfService';
import { XIcon, UploadIcon, HomeIcon, PdfIcon, SearchIcon, HtmlIcon, PrintIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

declare const mammoth: any;
declare const pdfjsLib: any;

interface SmartSearchSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onGoHome: () => void;
}

const SmartSearchSidebar: React.FC<SmartSearchSidebarProps> = ({ isOpen, onClose, onGoHome }) => {
    const [currentStep, setCurrentStep] = useState<'upload' | 'search'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';
    
    // Document state
    const [pageTexts, setPageTexts] = useState<PageText[] | null>(null);
    const [pdfDoc, setPdfDoc] = useState<any>(null);

    // Search & View state
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPageNumber, setSelectedPageNumber] = useState<number | null>(null);
    const viewerContainerRef = useRef<HTMLDivElement>(null);

    // Canvas refs for PDF rendering
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleReset = useCallback((fullReset = true) => {
        if (fullReset) {
            setCurrentStep('upload');
            setFile(null);
            setPageTexts(null);
            setPdfDoc(null);
        }
        setIsLoading(false);
        setLoadingText('');
        setError(null);
        setSearchTerm('');
        setSelectedPageNumber(null);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => handleReset(true), 300);
        }
    }, [isOpen, handleReset]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            if(allowedTypes.includes(selectedFile.type)) {
                setFile(selectedFile);
                setError(null);
            } else {
                 setFile(null);
                 setError("Unsupported file type. Please select a PDF, Word, or image file.");
            }
        }
    };
    
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
        const styles = `body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 2rem; }`;
        const htmlString = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head><body><h3>${title}</h3>${element.innerHTML}</body></html>`;
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

    const handleAnalyze = useCallback(async () => {
        if (!file) return;
        handleReset(false);
        setIsLoading(true);
        let extractedPages: PageText[] | null = null;
        try {
            setLoadingText("Reading file...");
            if (file.type === 'application/pdf') {
                const fileContent = await file.arrayBuffer();
                // Get both for rendering and searching
                const [pages, doc] = await Promise.all([
                    extractTextPerPage(file),
                    pdfjsLib.getDocument({ data: fileContent }).promise
                ]);
                extractedPages = pages;
                setPdfDoc(doc);
            } else if (file.type.startsWith('image/')) {
                const base64Image = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                const text = await extractTextFromImage(base64Image, file.type);
                extractedPages = [{ pageNumber: 1, text: text || '' }];
                setPdfDoc(null);
            } else if (file.type.includes('word')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                extractedPages = [{ pageNumber: 1, text: result.value }];
                setPdfDoc(null);
            }

            if (!extractedPages || extractedPages.every(p => !p.text.trim())) {
                throw new Error("No text was found in the file.");
            }
            
            setPageTexts(extractedPages);
            setCurrentStep('search');

        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
            setCurrentStep('upload');
        } finally {
            setIsLoading(false);
        }
    }, [file, handleReset]);

    const renderPage = useCallback(async (pageNum: number) => {
        if (!pdfDoc) return;
        
        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current;
        if (!canvas) return;

        const viewport = page.getViewport({ scale: 1.5 });
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const context = canvas.getContext('2d');
        if (!context) return;
        
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport,
        };
        
        await page.render(renderContext).promise;
    }, [pdfDoc]);

    useEffect(() => {
        if (selectedPageNumber && pdfDoc) {
            renderPage(selectedPageNumber);
            viewerContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [selectedPageNumber, renderPage, pdfDoc]);

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
            const start = Math.max(0, lastIndex - 40);
            const end = Math.min(page.text.length, lastIndex + searchTerm.length + 40);
            const snippet = `...${page.text.substring(start, end)}...`;
            results.push({ pageNumber: page.pageNumber, snippet });
            if (results.length >= 50) return results; // Limit results
          }
        }
        return results;
    }, [searchTerm, pageTexts]);

    const handleResultClick = (pageNumber: number) => {
        setSelectedPageNumber(pageNumber);
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="flex items-center justify-center h-full"><LoadingSpinner text={loadingText} /></div>;
        }

        switch (currentStep) {
            case 'upload':
                return (
                    <div className="p-6 flex flex-col items-center justify-center h-full text-center">
                        <SearchIcon className="w-16 h-16 golden-text mb-4" />
                        <h3 className="text-xl font-bold mb-2 golden-text">Search Within Documents</h3>
                        <p className="text-sm text-gold-brown mb-6 max-w-sm">Upload any file and search its content to find precise information quickly.</p>
                        {error && <p className="p-3 mb-4 bg-yellow-500/10 text-dark-gold-gradient rounded-lg text-sm">{error}</p>}
                        <label htmlFor="smartsearch-file-upload" className="cursor-pointer w-full max-w-xs text-center p-4 mb-4 text-md font-semibold text-white rounded-lg shadow-lg" style={{ backgroundImage: goldenGradient }}>
                            {file ? file.name : 'Select a file'}
                        </label>
                        <input id="smartsearch-file-upload" type="file" className="sr-only" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} />
                        <button onClick={handleAnalyze} disabled={!file} className="w-full max-w-xs px-8 py-3 text-lg font-bold text-white rounded-lg shadow-lg disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>Start Search</button>
                    </div>
                );
            case 'search':
                return (
                    <div className="flex-grow flex flex-col min-h-0">
                         <div className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)]">
                            <div className="relative">
                                <input 
                                    type="search"
                                    placeholder="Search within document..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full p-3 pl-10 bg-[var(--color-background-tertiary)] rounded-lg border border-[var(--color-border-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)] transition"
                                />
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <SearchIcon className="w-5 h-5 text-[var(--color-text-secondary)]" />
                                </div>
                            </div>
                         </div>
                         <div className="flex-grow flex flex-col md:flex-row min-h-0" id="smartsearch-content">
                            <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-[var(--color-border-primary)] overflow-y-auto p-3">
                                {searchTerm ? (
                                    searchResults.length > 0 ? (
                                        <div className="space-y-2">
                                            {searchResults.map((result, index) => (
                                                <button key={index} onClick={() => handleResultClick(result.pageNumber)} className="w-full text-left p-2 rounded-md hover:bg-[var(--color-background-tertiary)]">
                                                    <p className="text-sm text-dark-gold-gradient" dangerouslySetInnerHTML={{__html: result.snippet.replace(new RegExp(searchTerm, "gi"), (match) => `<strong class="text-[var(--color-accent-danger)] bg-[var(--color-accent-danger)]/20 rounded px-1">${match}</strong>`)}}></p>
                                                    <span className="text-xs font-bold text-dark-gold-gradient/70">Page: {result.pageNumber}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : <p className="text-center text-sm text-gold-brown p-4">No search results found.</p>
                                ) : (
                                    <p className="text-center text-sm text-gold-brown p-4">Enter a search term to display results here.</p>
                                )}
                            </div>
                            <div ref={viewerContainerRef} className="w-full md:w-2/3 overflow-y-auto bg-[var(--color-background-tertiary)]/50 p-4">
                                {selectedPageNumber ? (
                                    pdfDoc ? (
                                        <div className="flex justify-center">
                                            <canvas ref={canvasRef} className="shadow-lg" />
                                        </div>
                                    ) : (
                                        <div className="p-4" style={{ fontFamily: "'Times New Roman', serif" }}>
                                            <h4 className="font-bold text-lg mb-2 text-dark-gold-gradient">Document Content</h4>
                                            <p className="whitespace-pre-wrap text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{__html: (pageTexts?.[0]?.text || '').replace(new RegExp(searchTerm, "gi"), (match) => `<mark class="bg-yellow-300/50 text-black">${match}</mark>`)}} />
                                        </div>
                                    )
                                ) : (
                                    <div className="flex items-center justify-center h-full text-center text-gold-brown">
                                        <p>Click on a search result to view the page here.</p>
                                    </div>
                                )}
                            </div>
                         </div>
                         <div className="flex-shrink-0 p-2 border-t border-[var(--color-border-primary)]">
                             <button onClick={() => handleReset(true)} className="w-full text-sm py-2 rounded-md font-semibold text-white hover:opacity-90 transition-opacity" style={{ backgroundImage: goldenGradient }}>
                                Search in another file
                             </button>
                         </div>
                    </div>
                );
        }
    };

    return (
        <aside ref={sidebarRef} className={`fixed inset-0 bg-[var(--color-background-secondary)]/70 backdrop-blur-lg shadow-2xl transition-transform duration-500 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!isOpen}>
            {isOpen && (
                <>
                    <div className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center bg-[var(--color-background-primary)] no-print-sidebar">
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close"><XIcon className="w-6 h-6 golden-text" /></button>
                             <button onClick={() => downloadHtml('smartsearch-content', `Smart Search Results for ${searchTerm}`)} title="Download HTML" disabled={currentStep !== 'search'} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><HtmlIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Download PDF / Print" disabled={currentStep !== 'search'} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PdfIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Print" disabled={currentStep !== 'search'} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PrintIcon className="w-4 h-4"/></button>
                        </div>
                        <h2 className="text-xl font-bold golden-text flex items-center gap-2"><SearchIcon className="w-6 h-6 golden-text" /> Smart Search</h2>
                        <button onClick={onGoHome} className="p-2 rounded-lg flex items-center gap-2 px-4 text-white" aria-label="Home" style={{ backgroundImage: goldenGradient }}>
                            <HomeIcon className="w-6 h-6" /> <span className="font-bold">Home</span>
                        </button>
                    </div>
                    <div className="flex-grow min-h-0 printable-content">{renderContent()}</div>
                </>
            )}
        </aside>
    );
};

export default SmartSearchSidebar;