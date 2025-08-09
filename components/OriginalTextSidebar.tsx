import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SavedBook } from '../types';
import { XIcon, ChevronDownIcon } from './icons';

declare const pdfjsLib: any;

interface OriginalTextSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    activeBook: SavedBook | null;
}

const OriginalTextSidebar: React.FC<OriginalTextSidebarProps> = ({ isOpen, onClose, activeBook }) => {
    const [pdfDoc, setPdfDoc] = useState<any>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [numPages, setNumPages] = useState(0);
    const [scale, setScale] = useState(1.5);
    const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textLayerRef = useRef<HTMLDivElement>(null);

    // Load PDF document
    useEffect(() => {
        if (isOpen && activeBook && activeBook.fileContent && typeof pdfjsLib !== 'undefined') {
            const loadingTask = pdfjsLib.getDocument({ data: activeBook.fileContent });
            loadingTask.promise.then((doc: any) => {
                setPdfDoc(doc);
                setNumPages(doc.numPages);
                setCurrentPage(1); // Reset to first page on new book
            }).catch((error: any) => {
                console.error("Error loading PDF for viewer:", error);
            });
        } else if (!isOpen) {
            setPdfDoc(null); // Clean up
        }
    }, [isOpen, activeBook]);

    // Render page
    const renderPage = useCallback(async (pageNum: number) => {
        if (!pdfDoc) return;
        
        pdfDoc.getPage(pageNum).then(async (page: any) => {
            const canvas = canvasRef.current;
            const textLayerDiv = textLayerRef.current;
            if (!canvas || !textLayerDiv) return;

            const viewport = page.getViewport({ scale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const context = canvas.getContext('2d');
            if (!context) return;

            // Clear canvas before rendering new page
            context.clearRect(0, 0, canvas.width, canvas.height);

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            
            await page.render(renderContext).promise;

            // Render text layer to make text selectable
            const textContent = await page.getTextContent();
            
            while (textLayerDiv.firstChild) {
                textLayerDiv.removeChild(textLayerDiv.firstChild);
            }
            textLayerDiv.style.height = `${viewport.height}px`;
            textLayerDiv.style.width = `${viewport.width}px`;
            
            pdfjsLib.renderTextLayer({
                textContentSource: textContent,
                container: textLayerDiv,
                viewport: viewport,
                textDivs: []
            });
        });
    }, [pdfDoc, scale]);

    useEffect(() => {
        renderPage(currentPage);
    }, [currentPage, renderPage]);

    const onPrevPage = () => setCurrentPage(p => Math.max(1, p - 1));
    const onNextPage = () => setCurrentPage(p => Math.min(numPages, p + 1));
    const handleGoToPage = (e: React.ChangeEvent<HTMLInputElement>) => {
        let num = parseInt(e.target.value, 10);
        if (e.target.value === '') {
             setCurrentPage(1); // Or whatever behavior you prefer for empty input
        } else if (!isNaN(num) && num > 0 && num <= numPages) {
            setCurrentPage(num);
        }
    };
    
    const selectContent = (startPage: number) => {
        setCurrentPage(startPage);
    };
    
    const handleChapterToggle = (chapterId: string) => {
        setActiveChapterId(prevId => (prevId === chapterId ? null : chapterId));
    };

    return (
        <>
            <div 
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            />
            <aside 
                className={`fixed top-0 left-0 h-full bg-[var(--color-background-secondary)] shadow-2xl transition-transform duration-300 ease-in-out z-50 flex flex-col w-full md:w-3/4 lg:w-2/3 ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                aria-hidden={!isOpen}
            >
                {isOpen && activeBook && (
                    <>
                        <div className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center bg-[var(--color-background-primary)]">
                            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Original Document</h2>
                            <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close">
                                <XIcon className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="flex-grow flex flex-row-reverse min-h-0">
                            {/* Navigation Panel */}
                            <nav className="w-1/3 border-r border-[var(--color-border-primary)] flex-shrink-0 overflow-y-auto no-scrollbar p-3">
                                <ul className="space-y-1">
                                    {activeBook.chapters.map(chapter => (
                                        <li key={chapter.id}>
                                            <div 
                                                onClick={() => chapter.lessons && chapter.lessons.length > 0 ? handleChapterToggle(chapter.id) : selectContent(chapter.startPage)}
                                                className={`flex justify-between items-center w-full text-left p-2 rounded-md cursor-pointer hover:bg-[var(--color-background-tertiary)]`}
                                            >
                                                <span className="font-semibold">{chapter.title}</span>
                                                {chapter.lessons && chapter.lessons.length > 0 && (
                                                    <ChevronDownIcon className={`w-5 h-5 transition-transform ${activeChapterId === chapter.id ? 'rotate-180' : ''}`} />
                                                )}
                                            </div>
                                            {chapter.lessons && chapter.lessons.length > 0 && activeChapterId === chapter.id && (
                                                <ul className="pl-4 mt-1 space-y-1 border-l-2 border-[var(--color-border-primary)]">
                                                    {chapter.lessons.map(lesson => (
                                                         <li key={lesson.id}>
                                                            <button 
                                                                onClick={() => selectContent(lesson.startPage)}
                                                                className={`w-full text-left p-2 text-sm rounded-md hover:bg-[var(--color-background-tertiary)]`}
                                                            >
                                                                {lesson.title}
                                                            </button>
                                                         </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </nav>

                            {/* Content Panel */}
                            <div className="flex-grow flex flex-col overflow-hidden bg-gray-400/20">
                                {pdfDoc ? (
                                    <>
                                        <div className="flex-grow overflow-auto p-4 flex justify-center">
                                            <div className="relative shadow-lg">
                                                <canvas ref={canvasRef} />
                                                <div ref={textLayerRef} className="textLayer absolute top-0 left-0"></div>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 flex items-center justify-center gap-4 p-2 border-t bg-[var(--color-background-primary)] text-[var(--color-text-primary)]">
                                            <button onClick={onPrevPage} disabled={currentPage <= 1} className="px-3 py-1 rounded disabled:opacity-50 bg-[var(--color-background-tertiary)] hover:bg-[var(--color-border-primary)]">Prev</button>
                                            <span className="flex items-center">
                                                <input type="number" value={currentPage} onChange={handleGoToPage} className="w-16 text-center bg-transparent border-b border-[var(--color-border-primary)] focus:outline-none focus:border-[var(--color-accent-primary)]"/>
                                                <span className="mx-1">/</span>
                                                <span>{numPages}</span>
                                            </span>
                                            <button onClick={onNextPage} disabled={currentPage >= numPages} className="px-3 py-1 rounded disabled:opacity-50 bg-[var(--color-background-tertiary)] hover:bg-[var(--color-border-primary)]">Next</button>
                                            <div className="w-px h-6 bg-[var(--color-border-primary)] mx-2"></div>
                                            <button onClick={() => setScale(s => s + 0.2)} className="px-3 py-1 rounded bg-[var(--color-background-tertiary)] hover:bg-[var(--color-border-primary)]">+</button>
                                            <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="px-3 py-1 rounded bg-[var(--color-background-tertiary)] hover:bg-[var(--color-border-primary)]">-</button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">Loading document...</div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </aside>
        </>
    );
};

export default OriginalTextSidebar;