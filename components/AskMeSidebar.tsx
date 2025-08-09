import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { Chapter, PageText } from '../types';
import { createChatWithContext, analyzeDocumentStructure, extractTextFromImage } from '../services/geminiService';
import { extractTextPerPage } from '../services/pdfService';
import { XIcon, RomanTempleIcon, UploadIcon, SendIcon, HomeIcon, LightbulbIcon, HtmlIcon, PdfIcon, PrintIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

// Make mammoth.js available in the component
declare const mammoth: any;

interface AskMeSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onGoHome: () => void;
}

type Message = {
    role: 'user' | 'model';
    text: string;
};

const AskMeSidebar: React.FC<AskMeSidebarProps> = ({ isOpen, onClose, onGoHome }) => {
    const [currentStep, setCurrentStep] = useState<'upload' | 'analyzing' | 'chapters' | 'qa'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';
    
    // Document state
    const [pageTexts, setPageTexts] = useState<PageText[] | null>(null);
    const [chapters, setChapters] = useState<Chapter[] | null>(null);
    const [activeChapterText, setActiveChapterText] = useState<string | null>(null);
    const [activeChapterTitle, setActiveChapterTitle] = useState<string>('');
    
    // QA State
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isAnswering, setIsAnswering] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleReset = useCallback((fullReset = true) => {
        if (fullReset) {
            setCurrentStep('upload');
            setFile(null);
            setPageTexts(null);
            setChapters(null);
        }
        setIsLoading(false);
        setLoadingText('');
        setError(null);
        setActiveChapterText(null);
        setActiveChapterTitle('');
        setChat(null);
        setMessages([]);
        setUserInput('');
        setIsAnswering(false);
    }, []);

    useEffect(() => {
        if (!isOpen) {
            // Delay reset to allow closing animation to finish
            setTimeout(() => handleReset(true), 300);
        }
    }, [isOpen, handleReset]);
    
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
            body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 2rem; }
            .message-container { display: flex; flex-direction: column; gap: 1rem; }
            .message { max-width: 80%; padding: 0.75rem; border-radius: 1rem; }
            .user-message { background-color: #0d6efd; color: white; border-bottom-right-radius: 0; align-self: flex-end; text-align: right;}
            .model-message { background-color: #e9ecef; color: #212529; border-bottom-left-radius: 0; align-self: flex-start; text-align: left; }
            .model-message-inner { display: flex; align-items: flex-start; gap: 0.5rem; }
            p { white-space: pre-wrap; margin: 0; }
        `;
        
        const htmlMessages = messages.map(msg => `
            <div class="message ${msg.role === 'user' ? 'user-message' : 'model-message'}">
                ${msg.role === 'model' ? `<div class="model-message-inner"><span>&#127963;</span><p>${msg.text}</p></div>` : `<p>${msg.text}</p>`}
            </div>
        `).join('');

        const htmlString = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>${styles}</style>
            </head>
            <body>
                <h3>${title}</h3>
                <div class="message-container">${htmlMessages}</div>
            </body>
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

    const handleAnalyze = useCallback(async () => {
        if (!file) return;
        handleReset(false);
        setIsLoading(true);
        setCurrentStep('analyzing');
        let extractedPages: PageText[] | null = null;
        try {
            setLoadingText("Reading file...");
            if (file.type === 'application/pdf') {
                extractedPages = await extractTextPerPage(file);
            } else if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                const promise = new Promise<PageText[]>((resolve, reject) => {
                    reader.onload = async () => {
                        const base64Image = reader.result as string;
                        const text = await extractTextFromImage(base64Image, file.type);
                        resolve([{ pageNumber: 1, text: text || '', images: [base64Image] }]);
                    };
                    reader.onerror = reject;
                });
                reader.readAsDataURL(file);
                extractedPages = await promise;
            } else if (file.type.includes('word')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                extractedPages = [{ pageNumber: 1, text: result.value, images: [] }];
            }

            if (!extractedPages || extractedPages.every(p => !p.text.trim())) {
                throw new Error("No text was found in the file.");
            }
            
            setPageTexts(extractedPages);
            setLoadingText("Analyzing document structure...");
            const chapterData = await analyzeDocumentStructure(extractedPages);

            if (chapterData && chapterData.length > 1) {
                setChapters(chapterData);
                setCurrentStep('chapters');
            } else if (chapterData && chapterData.length === 1) {
                const fullText = extractedPages.map(p => p.text).join('\n\n');
                setActiveChapterText(fullText);
                setActiveChapterTitle(chapterData[0].title);
                setCurrentStep('qa');
            } else {
                throw new Error("Failed to analyze document structure.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
            setCurrentStep('upload');
        } finally {
            setIsLoading(false);
        }
    }, [file, handleReset]);
    
    const handleChapterSelect = (chapter: Chapter) => {
        if (!pageTexts) return;
        const chapterText = pageTexts.filter(p => p.pageNumber >= chapter.startPage && p.pageNumber <= chapter.endPage).map(p => p.text).join('\n\n');
        setActiveChapterText(chapterText);
        setActiveChapterTitle(chapter.title);
        setCurrentStep('qa');
    };
    
    // Setup chat when QA step begins
    useEffect(() => {
        if (currentStep === 'qa' && activeChapterText && !chat) {
            const newChat = createChatWithContext(activeChapterText);
            setChat(newChat);
            setMessages([{ role: 'model', text: `Welcome! You can now ask questions about "${activeChapterTitle}".` }]);
        }
    }, [currentStep, activeChapterText, chat, activeChapterTitle]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);
    
    const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!userInput.trim() || !chat || isAnswering) return;

        const newUserMessage: Message = { role: 'user', text: userInput };
        setMessages(prev => [...prev, newUserMessage, { role: 'model', text: '' }]);
        setUserInput('');
        setIsAnswering(true);

        try {
            const stream = await chat.sendMessageStream({ message: userInput });
            for await (const chunk of stream) {
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage?.role === 'model') {
                        return [...prev.slice(0, -1), { ...lastMessage, text: lastMessage.text + chunk.text }];
                    }
                    return prev;
                });
            }
        } catch (error) {
            console.error("QA Chat error:", error);
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, an error occurred. Please try again.' }]);
        } finally {
            setIsAnswering(false);
        }
    }, [userInput, chat, isAnswering]);

    const renderContent = () => {
        if (isLoading || currentStep === 'analyzing') {
            return <div className="flex items-center justify-center h-full"><LoadingSpinner text={loadingText} /></div>;
        }

        switch (currentStep) {
            case 'upload':
                return (
                    <div className="p-6 flex flex-col items-center justify-center h-full text-center">
                        <LightbulbIcon className="w-16 h-16 golden-text mb-4" />
                        <h3 className="text-xl font-bold mb-2 golden-text">Ask Me About Any Document</h3>
                        <p className="text-sm text-gold-brown mb-6 max-w-sm">Upload a PDF, Word, or image file, and I'll analyze it to answer your questions directly from its content.</p>
                        {error && <p className="p-3 mb-4 bg-yellow-500/10 text-dark-gold-gradient rounded-lg text-sm">{error}</p>}
                        <label htmlFor="askme-file-upload" className="cursor-pointer w-full max-w-xs text-center p-4 mb-4 text-md font-semibold text-white rounded-lg shadow-lg" style={{ backgroundImage: goldenGradient }}>
                            {file ? file.name : 'Select a File'}
                        </label>
                        <input id="askme-file-upload" type="file" className="sr-only" accept=".pdf,.doc,.docx,image/*" onChange={handleFileChange} />
                        <button onClick={handleAnalyze} disabled={!file} className="w-full max-w-xs px-8 py-3 text-lg font-bold text-white rounded-lg shadow-lg disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>Analyze & Start Chat</button>
                    </div>
                );
            case 'chapters':
                return (
                    <div className="p-4">
                        <h3 className="text-xl font-bold text-center mb-4 golden-text">Select a chapter to ask about</h3>
                        {error && <p className="p-3 my-2 bg-yellow-500/10 text-dark-gold-gradient rounded-lg text-sm">{error}</p>}
                        {chapters?.length ? (
                            <ul className="space-y-2 max-h-[80vh] overflow-y-auto">
                                {chapters.map(c => <li key={c.id}><button onClick={() => handleChapterSelect(c)} className="w-full text-left p-3 rounded-lg font-semibold text-dark-gold-gradient bg-[var(--color-background-tertiary)] hover:bg-yellow-500/10"><span>{c.title} (p. {c.startPage}-{c.endPage})</span></button></li>)}
                            </ul>
                        ) : <p className="text-center text-dark-gold-gradient">No chapters found.</p>}
                        <button onClick={() => handleReset(true)} style={{ backgroundImage: goldenGradient }} className="mt-4 px-4 py-2 w-full text-white font-bold rounded-lg">Select another file</button>
                    </div>
                );
            case 'qa':
                return (
                     <div className="flex-grow flex flex-col min-h-0 overflow-hidden printable-content">
                        <div className="flex-shrink-0 p-2 text-center border-b border-[var(--color-border-primary)] bg-[var(--color-background-tertiary)] no-print-sidebar">
                            <p className="text-sm font-bold golden-text">Now asking about: {activeChapterTitle}</p>
                        </div>
                        <div id="askme-content" className="flex-grow p-4 overflow-y-auto space-y-4" style={{ fontFamily: "'Times New Roman', serif" }}>
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                    <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${msg.role === 'user' ? 'text-white rounded-bl-none' : 'bg-yellow-500/10 text-dark-gold-gradient rounded-br-none'}`}
                                         style={msg.role === 'user' ? {backgroundImage: goldenGradient} : {}}
                                    >
                                        <div className="flex items-start gap-2">
                                            {msg.role === 'model' && <RomanTempleIcon className="w-5 h-5 golden-text flex-shrink-0 mt-1" />}
                                            <p className="whitespace-pre-wrap">{msg.text}{isAnswering && msg.role === 'model' && index === messages.length - 1 && <span className="inline-block w-2 h-4 bg-current ml-1 animate-ping"></span>}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                        <div className="flex-shrink-0 p-4 border-t border-[var(--color-border-primary)] bg-[var(--color-background-primary)] no-print-sidebar">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Type your question here..." disabled={isAnswering} className="flex-grow p-3 bg-[var(--color-background-tertiary)] rounded-lg border border-yellow-800/30 focus:ring-2 focus:ring-yellow-600 transition" />
                                <button type="submit" disabled={isAnswering || !userInput.trim()} className="p-3 px-4 text-white rounded-lg shadow hover:opacity-90 disabled:opacity-50 flex items-center justify-center" style={{ backgroundImage: goldenGradient }}>
                                    {isAnswering ? <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <SendIcon className="w-6 h-6"/>}
                                </button>
                            </form>
                            <button onClick={() => handleReset(true)} className="mt-2 text-xs text-center w-full text-gold-brown hover:text-dark-gold-gradient">Start over with another file</button>
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
                        <button onClick={onGoHome} className="p-2 rounded-lg flex items-center gap-2 px-4 text-white" aria-label="Home" style={{ backgroundImage: goldenGradient }}>
                            <HomeIcon className="w-6 h-6" /> <span className="font-bold">Home</span>
                        </button>
                        <h2 className="text-xl font-bold golden-text flex items-center gap-2">
                            <LightbulbIcon className="w-6 h-6 golden-text" />
                            Ask Me
                        </h2>
                        <div className="flex items-center gap-2">
                            <button onClick={() => downloadHtml('askme-content', `Chat about ${activeChapterTitle}`)} title="Download HTML" disabled={currentStep !== 'qa'} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><HtmlIcon className="w-4 h-4"/></button>
                            <button onClick={handlePrint} title="Download PDF / Print" disabled={currentStep !== 'qa'} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PdfIcon className="w-4 h-4"/></button>
                            <button onClick={handlePrint} title="Print" disabled={currentStep !== 'qa'} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PrintIcon className="w-4 h-4"/></button>
                            <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close"><XIcon className="w-6 h-6 golden-text" /></button>
                        </div>
                    </div>
                    <div className="flex-grow min-h-0 printable-content">{renderContent()}</div>
                </>
            )}
        </aside>
    );
};

export default AskMeSidebar;