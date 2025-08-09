

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InteractiveBlock, PageText } from '../types';
import { XIcon, HomeIcon, LightbulbIcon, UploadIcon, PdfIcon, HtmlIcon, WordIcon, SpellcheckIcon, QuestionMarkCircleIcon, PrintIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import { extractTextPerPage } from '../services/pdfService';
import { proofreadSinglePageText, generateQuestionsForPageText } from '../services/geminiService';

const QuestionPopup: React.FC<{
    questions: InteractiveBlock[];
    pageNumber: number;
    onClose: () => void;
}> = ({ questions, pageNumber, onClose }) => {

    const renderQuestionText = (block: InteractiveBlock) => {
        switch (block.type) {
            case 'multiple_choice_question':
                return (
                    <>
                        <p>{block.question}</p>
                        <ul className="list-disc list-inside pl-4 text-sm mt-1">
                            {block.options.map((opt, i) => <li key={i}>{opt}</li>)}
                        </ul>
                    </>
                );
            case 'open_ended_question':
            case 'true_false_question':
                return <p>{block.question}</p>;
            case 'fill_in_the_blank_question':
                return <p>{block.questionParts.join(' ___ ')}</p>;
            case 'explanation':
            case 'math_formula':
                 return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-[var(--color-background-primary)] w-full max-w-2xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center">
                    <h3 className="text-lg font-bold golden-text">Questions for Page {pageNumber}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-[var(--color-background-tertiary)]">
                        <XIcon className="w-5 h-5 text-[var(--color-text-secondary)]"/>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto p-6">
                    <ul className="space-y-4">
                        {questions.map((q, i) => (
                           <li key={q.id} className="p-3 bg-[var(--color-background-secondary)] rounded-lg text-dark-gold-gradient">
                                <span className="font-bold">{i + 1}. </span>
                                {renderQuestionText(q)}
                           </li>
                        ))}
                    </ul>
                </div>
                 <div className="flex-shrink-0 p-2 border-t border-[var(--color-border-primary)] text-center">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-300 text-black rounded-md">Close</button>
                </div>
            </div>
        </div>
    );
};


interface PdfReaderSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onGoHome: () => void;
    onExplainPage: (pageText: string, event: React.MouseEvent) => void;
}

const PdfReaderSidebar: React.FC<PdfReaderSidebarProps> = ({ isOpen, onClose, onGoHome, onExplainPage }) => {
    const [pageTexts, setPageTexts] = useState<PageText[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [proofingPageNumber, setProofingPageNumber] = useState<number | null>(null);
    const [generatingQuestionsPage, setGeneratingQuestionsPage] = useState<number | null>(null);
    const [questionsPopup, setQuestionsPopup] = useState<{ questions: InteractiveBlock[], pageNumber: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';

    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setPageTexts(null);
                setIsLoading(false);
                setError(null);
                setProofingPageNumber(null);
                setGeneratingQuestionsPage(null);
                setQuestionsPopup(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }, 300);
        }
    }, [isOpen]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setError("Please select a valid PDF file.");
            return;
        }

        setIsLoading(true);
        setLoadingText("Extracting text from PDF...");
        setError(null);
        setPageTexts(null);

        try {
            const extractedPages = await extractTextPerPage(file);
            if (!extractedPages || extractedPages.length === 0) {
                throw new Error("Could not extract any text from this PDF.");
            }
            setPageTexts(extractedPages);
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
            setLoadingText("");
        }
    };

    const handleProofreadPage = useCallback(async (pageToProof: PageText) => {
        if (proofingPageNumber) return; // Don't allow concurrent proofreads

        setProofingPageNumber(pageToProof.pageNumber);
        setError(null);
        try {
            const correctedText = await proofreadSinglePageText(pageToProof.text);
            setPageTexts(currentPages => 
                currentPages?.map(p => 
                    p.pageNumber === pageToProof.pageNumber 
                        ? { ...p, text: correctedText } 
                        : p
                ) || null
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred during proofreading.");
        } finally {
            setProofingPageNumber(null);
        }
    }, [proofingPageNumber]);

    const handleGenerateQuestions = async (page: PageText) => {
        if (generatingQuestionsPage) return;
        setGeneratingQuestionsPage(page.pageNumber);
        setError(null);
        try {
            const questions = await generateQuestionsForPageText(page.text);
            if (questions) {
                setQuestionsPopup({ questions, pageNumber: page.pageNumber });
            } else {
                setError("Failed to generate questions for this page.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred while generating questions.");
        } finally {
            setGeneratingQuestionsPage(null);
        }
    };


    const triggerFileInput = () => fileInputRef.current?.click();
    
    const handlePrint = () => {
        const sidebarElement = sidebarRef.current;
        if (!sidebarElement) return;

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

    const handleDownloadPdf = async () => {
        const content = sidebarRef.current?.querySelector('.printable-content');
        if (!content) return;

        if (typeof (window as any).jspdf === 'undefined' || typeof (window as any).html2canvas === 'undefined') {
            setError("PDF generation library failed to load. Please check your connection and refresh the page.");
            console.error("jsPDF or html2canvas not found on window object.");
            return;
        }

        setIsLoading(true);
        setLoadingText("Generating PDF...");
        try {
            const { jsPDF } = (window as any).jspdf;
            const doc = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = doc.internal.pageSize.getHeight();
            
            const allPageElements = Array.from(content.querySelectorAll('.page-container')) as HTMLElement[];

            for (let i = 0; i < allPageElements.length; i++) {
                const pageElement = allPageElements[i];
                const canvas = await (window as any).html2canvas(pageElement, {
                    scale: 2,
                    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-background-primary').trim(),
                    useCORS: true
                });

                const imgData = canvas.toDataURL('image/png');
                const imgWidth = canvas.width;
                const imgHeight = canvas.height;
                const ratio = imgWidth / imgHeight;
                let imgHeightInPdf = pdfWidth / ratio;
                let heightLeft = imgHeightInPdf;
                let position = 0;

                if (i > 0) doc.addPage();
                
                doc.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInPdf);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position -= pdfHeight;
                    doc.addPage();
                    doc.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeightInPdf);
                    heightLeft -= pdfHeight;
                }
            }
            const title = fileInputRef.current?.files?.[0]?.name || "Document";
            doc.save(`${title.replace(/\.pdf$/i, '')}.pdf`);
        } catch (e) {
            setError("Failed to generate PDF. This can happen with very large documents.");
            console.error("PDF Generation Error:", e);
        } finally {
            setIsLoading(false);
            setLoadingText("");
        }
    };

    const getContentAsHtmlString = (title: string): string => {
        if (!pageTexts) return '';
        
        const contentHtml = pageTexts.map(page => `
            <div class="page" dir="rtl">
                <h2 class="page-header">Page ${page.pageNumber}</h2>
                <p class="page-content">${page.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br />')}</p>
            </div>
        `).join('');

        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; line-height: 1.8; padding: 2rem; margin: auto; max-width: 800px; background-color: #ffffff; color: #000000; direction: rtl; }
                    .page { margin-bottom: 2rem; padding: 1.5rem; border: 1px solid #ccc; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
                    .page-header { font-size: 1.2rem; font-weight: bold; color: #333; border-bottom: 1px solid #ddd; margin-bottom: 1rem; padding-bottom: 0.5rem;}
                    .page-content { white-space: pre-wrap; font-size: 1rem; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                ${contentHtml}
            </body>
            </html>
        `;
    };

    const handleDownloadHtml = () => {
        const title = fileInputRef.current?.files?.[0]?.name || "Document";
        const htmlString = getContentAsHtmlString(title);
        
        const blob = new Blob([htmlString], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\.pdf$/i, '')}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadWord = () => {
        const title = fileInputRef.current?.files?.[0]?.name || "Document";
        const htmlString = getContentAsHtmlString(title);

        const blob = new Blob([htmlString], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/\.pdf$/i, '')}.doc`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <aside
            ref={sidebarRef}
            className={`fixed inset-y-0 left-0 h-full bg-[var(--color-background-tertiary)]/30 backdrop-blur-lg shadow-2xl transition-transform duration-300 ease-in-out z-40 flex flex-col w-full ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="sr-only"
                accept=".pdf"
            />
            {questionsPopup && (
                <QuestionPopup 
                    questions={questionsPopup.questions}
                    pageNumber={questionsPopup.pageNumber}
                    onClose={() => setQuestionsPopup(null)}
                />
            )}
            {isOpen && (
                <>
                    <header className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] grid grid-cols-3 items-center bg-[var(--color-background-primary)] no-print-sidebar">
                         <div className="flex justify-start">
                            <button onClick={onGoHome} className="p-2 rounded-lg text-white flex items-center gap-2 px-4" aria-label="Home" style={{ backgroundImage: goldenGradient }}>
                                <HomeIcon className="w-6 h-6" /> <span className="font-bold">Home</span>
                            </button>
                        </div>
                        <h2 className="text-xl font-bold golden-text truncate text-center">
                            PDF Text Reader
                        </h2>
                        <div className="flex justify-end">
                            <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close">
                                <XIcon className="w-6 h-6 golden-text" />
                            </button>
                        </div>
                    </header>

                    {(isLoading && !pageTexts) ? (
                        <main className="flex-grow flex items-center justify-center">
                            <LoadingSpinner text={loadingText || "Extracting text from PDF..."} />
                        </main>
                    ) : error ? (
                        <main className="flex-grow flex flex-col items-center justify-center p-8 text-center">
                            <p className="p-4 bg-red-500/10 text-red-500 rounded-lg">{error}</p>
                            <button onClick={triggerFileInput} className="mt-4 flex items-center gap-3 px-6 py-3 text-lg font-bold text-white rounded-lg shadow-lg" style={{ backgroundImage: goldenGradient }}>
                                Try Another File
                            </button>
                        </main>
                    ) : pageTexts ? (
                        <>
                             <main className="flex-grow overflow-y-auto p-6 bg-[var(--color-background-secondary)]/80 printable-content">
                                <div className="flex flex-col gap-5">
                                    {pageTexts.map((page) => (
                                        <div key={page.pageNumber} className="page-container bg-dark-gold-gradient rounded-lg shadow-md relative overflow-hidden">
                                            <div className="p-4 pb-20">
                                                <div className="flex justify-between items-center mb-2 pb-2 border-b border-dashed border-white/20">
                                                    <h4 className="font-bold text-yellow-200">Page {page.pageNumber}</h4>
                                                </div>
                                                <p dir="rtl" className="text-[18px] leading-8 whitespace-pre-wrap text-white" style={{ fontFamily: "'Times New Roman', serif" }}>
                                                    {page.text || <span className="italic text-gray-300">This page is empty or contains only images.</span>}
                                                </p>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 h-16 p-3 bg-black/20 backdrop-blur-sm border-t border-white/10 flex items-center justify-center gap-2">
                                                <button
                                                    onClick={(e) => onExplainPage(page.text, e)}
                                                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-black bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-lg shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={!!proofingPageNumber || !page.text.trim()}
                                                    title="Explain Page"
                                                >
                                                    <LightbulbIcon className="w-5 h-5" />
                                                    <span>Explain</span>
                                                </button>
                                                <button
                                                    onClick={() => handleProofreadPage(page)}
                                                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-black bg-gradient-to-br from-green-300 to-green-500 rounded-lg shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={!!proofingPageNumber || !page.text.trim()}
                                                    title="Proofread Page"
                                                >
                                                    {proofingPageNumber === page.pageNumber ? (
                                                        <div className="w-5 h-5 border-2 border-black/50 border-t-black rounded-full animate-spin"></div>
                                                    ) : (
                                                        <SpellcheckIcon className="w-5 h-5" />
                                                    )}
                                                    <span>Proofread</span>
                                                </button>
                                                <button
                                                    onClick={() => handleGenerateQuestions(page)}
                                                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold text-black bg-gradient-to-br from-blue-300 to-blue-500 rounded-lg shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                                    disabled={!!proofingPageNumber || !!generatingQuestionsPage || !page.text.trim()}
                                                    title="Generate 10 Questions"
                                                >
                                                    {generatingQuestionsPage === page.pageNumber ? (
                                                        <div className="w-5 h-5 border-2 border-black/50 border-t-black rounded-full animate-spin"></div>
                                                    ) : (
                                                        <QuestionMarkCircleIcon className="w-5 h-5" />
                                                    )}
                                                    <span>Questions</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </main>
                            <footer className="flex-shrink-0 flex items-center justify-around p-3 border-t bg-[var(--color-background-primary)] no-print-sidebar">
                                <button onClick={triggerFileInput} disabled={isLoading} title="Upload New PDF" className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg shadow disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>
                                    <UploadIcon className="w-5 h-5" />
                                </button>
                                <button onClick={handleDownloadPdf} disabled={isLoading} title="Download as PDF" className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg shadow disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>
                                    <PdfIcon className="w-5 h-5" />
                                </button>
                                <button onClick={handlePrint} disabled={isLoading} title="Print" className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg shadow disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>
                                    <PrintIcon className="w-5 h-5" />
                                </button>
                                <button onClick={handleDownloadWord} disabled={isLoading} title="Download as Word" className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg shadow disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>
                                    <WordIcon className="w-5 h-5" />
                                </button>
                                <button onClick={handleDownloadHtml} disabled={isLoading} title="Download as HTML" className="flex items-center gap-2 px-4 py-2 text-white font-bold rounded-lg shadow disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>
                                    <HtmlIcon className="w-5 h-5" />
                                </button>
                            </footer>
                        </>
                    ) : (
                        <main className="flex-grow flex flex-col items-center justify-center p-8 text-center">
                            <UploadIcon className="w-20 h-20 text-dark-gold-gradient mb-4" />
                            <h3 className="text-2xl font-bold golden-text mb-4">Upload a PDF to Start</h3>
                            <p className="text-[var(--color-text-secondary)] mb-6 max-w-md">Once uploaded, you can read the extracted text page by page and get AI-powered explanations for any page's content.</p>
                            <button onClick={triggerFileInput} className="flex items-center gap-3 px-6 py-3 text-lg font-bold text-white rounded-lg shadow-lg hover:opacity-90 transition-all" style={{ backgroundImage: goldenGradient }}>
                                <UploadIcon className="w-6 h-6" />
                                Upload PDF
                            </button>
                        </main>
                    )}
                </>
            )}
        </aside>
    );
};

export default PdfReaderSidebar;