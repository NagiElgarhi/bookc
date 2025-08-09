import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chapter, PageText, InteractiveBlock, MultipleChoiceQuestionBlock, TrueFalseQuestionBlock, FillInTheBlankQuestionBlock, OpenEndedQuestionBlock, UserAnswer, FeedbackItem, AiCorrection } from '../types';
import { generateInitialQuestions, analyzeDocumentStructure, getFeedbackOnAnswers, getAiCorrections } from '../services/geminiService';
import { extractTextPerPage } from '../services/pdfService';
import { XIcon, RomanTempleIcon, UploadIcon, CheckCircleIcon, XCircleIcon, HomeIcon, HtmlIcon, PdfIcon, PrintIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface QuestionGeneratorSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onGoHome: () => void;
    initialChapter: Chapter | null;
    initialPageTexts: PageText[] | null;
}

const QuestionGeneratorSidebar: React.FC<QuestionGeneratorSidebarProps> = ({ isOpen, onClose, onGoHome, initialChapter, initialPageTexts }) => {
    const [currentStep, setCurrentStep] = useState<'upload' | 'chapters' | 'questions' | 'results'>('upload');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';
    
    // Document state
    const [pageTexts, setPageTexts] = useState<PageText[] | null>(null);
    const [chapters, setChapters] = useState<Chapter[] | null>(null);
    const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
    
    // Interaction State
    const [allQuestionsForChapter, setAllQuestionsForChapter] = useState<InteractiveBlock[] | null>(null);
    const [questionsToDisplay, setQuestionsToDisplay] = useState<InteractiveBlock[] | null>(null);
    const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
    const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCorrecting, setIsCorrecting] = useState(false);

    const handleReset = useCallback((fullReset = true) => {
        if(fullReset) {
            setCurrentStep('upload');
            setFile(null);
            setPageTexts(null);
            setChapters(null);
        }
        setIsLoading(false);
        setLoadingText('');
        setError(null);
        setActiveChapter(null);
        setAllQuestionsForChapter(null);
        setQuestionsToDisplay(null);
        setUserAnswers({});
        setFeedback(null);
        setIsSubmitting(false);
        setIsCorrecting(false);
    }, []);

    const handleGenerate = useCallback(async (chapter: Chapter, pages: PageText[]) => {
        setIsLoading(true);
        setError(null);
        setAllQuestionsForChapter(null);
        setQuestionsToDisplay(null);
        setActiveChapter(chapter);
        try {
            setLoadingText(`Generating questions for: ${chapter.title}`);
            const chapterText = pages.filter(p => p.pageNumber >= chapter.startPage && p.pageNumber <= chapter.endPage).map(p => p.text).join('\n\n');
            if (!chapterText.trim()) throw new Error("The selected chapter is empty and questions cannot be generated.");

            const questions = await generateInitialQuestions(chapterText);
            if (questions) {
                const filteredQuestions = questions.filter(q => q.type.endsWith('_question'));
                setAllQuestionsForChapter(filteredQuestions);
                setQuestionsToDisplay(filteredQuestions);
                setCurrentStep('questions');
            } else {
                throw new Error("Failed to generate questions. Please try again.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
            setCurrentStep('chapters');
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    useEffect(() => {
        if (isOpen) {
            if (initialChapter && initialPageTexts) {
                // Pre-selected chapter flow
                setPageTexts(initialPageTexts);
                handleGenerate(initialChapter, initialPageTexts);
            } else {
                // Standard flow, reset and show upload
                handleReset(true);
            }
        } else {
            // Reset when sidebar closes
            setTimeout(() => handleReset(true), 300);
        }
    }, [isOpen, initialChapter, initialPageTexts, handleReset, handleGenerate]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.type === 'application/pdf') {
            setFile(selectedFile);
            setError(null);
        } else {
            setFile(null);
            setError("Please select a valid PDF file.");
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

        const styles = `
            body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 2rem; margin: auto; max-width: 800px; }
            .question-item { margin-bottom: 1.5rem; padding: 1rem; border: 1px solid #eee; border-radius: 8px; }
            .feedback { margin-top: 0.5rem; padding: 0.5rem; border-radius: 4px; }
            .feedback.correct { background-color: #e8f5e9; }
            .feedback.incorrect { background-color: #ffebee; }
        `;
        
        const htmlString = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>${styles}</style>
            </head>
            <body>
                <h2>${title}</h2>
                ${element.innerHTML}
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


    const handleAnalyze = useCallback(async () => {
        if (!file) return;
        handleReset(false);
        setIsLoading(true);
        try {
            setLoadingText("Extracting text...");
            const pages = await extractTextPerPage(file);
            setPageTexts(pages);
            setLoadingText("Analyzing document structure...");
            const chapterData = await analyzeDocumentStructure(pages);
            if (chapterData) {
                setChapters(chapterData);
                setCurrentStep('chapters');
            } else {
                throw new Error("Failed to analyze document structure.");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        } finally {
            setIsLoading(false);
        }
    }, [file, handleReset]);

    const handleChapterSelect = (chapter: Chapter) => {
        if (pageTexts) {
            handleGenerate(chapter, pageTexts);
        } else {
            setError("Page texts not found. Please try analyzing the file again.");
        }
    };


    const handleAnswerChange = (questionId: string, answer: any) => {
        setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleFillBlankChange = (questionId: string, blankIndex: number, value: string) => {
        setUserAnswers(prev => {
            const currentAnswers = (prev[questionId] as string[]) || [];
            const newAnswers = [...currentAnswers];
            newAnswers[blankIndex] = value;
            return { ...prev, [questionId]: newAnswers };
        });
    };

    const handleSubmitAnswers = useCallback(async () => {
        if (!questionsToDisplay) return;
        setIsSubmitting(true);
        const answersToSubmit: UserAnswer[] = Object.entries(userAnswers).map(([questionId, answer]) => ({ questionId, answer }));
        try {
            const feedbackData = await getFeedbackOnAnswers(answersToSubmit, questionsToDisplay);
            if(feedbackData) {
                setFeedback(feedbackData);
                setCurrentStep('results');
            } else {
                setError("Failed to evaluate answers.");
            }
        } catch(e) {
            setError("An error occurred while evaluating answers.");
        } finally {
            setIsSubmitting(false);
        }
    }, [questionsToDisplay, userAnswers]);

    const handleRetry = () => {
        if (!feedback || !allQuestionsForChapter) return;
        const incorrectQuestions = allQuestionsForChapter.filter(q => feedback.some(f => f.questionId === q.id && !f.isCorrect));
        setQuestionsToDisplay(incorrectQuestions);
        setCurrentStep('questions');
        setUserAnswers({});
        setFeedback(null);
    };
    
    const handleAiCorrect = useCallback(async () => {
        if (!feedback || !allQuestionsForChapter) return;
        const incorrectAnswers = feedback.filter(fb => !fb.isCorrect).map(fb => ({ questionId: fb.questionId, question: fb.question || '', userAnswer: fb.userAnswer || ''})).filter(item => item.question);
        if (incorrectAnswers.length === 0) return;
        setIsCorrecting(true);
        try {
            const corrections = await getAiCorrections(incorrectAnswers);
            if (corrections) {
                const newFeedback = feedback.map(fb => {
                    const correction = corrections.find(c => c.questionId === fb.questionId);
                    return correction ? { ...fb, explanation: correction.correction } : fb;
                });
                setFeedback(newFeedback);
            }
        } catch (error) {
            setError("Failed to get corrections.");
        } finally {
            setIsCorrecting(false);
        }
    }, [feedback, allQuestionsForChapter]);

    const renderQuestion = (questionBlock: InteractiveBlock, index: number) => {
        const isInteractive = currentStep === 'questions';
        const blockFeedback = !isInteractive && feedback ? feedback.find(f => f.questionId === questionBlock.id) : undefined;
        
        const QuestionContent = () => {
            switch(questionBlock.type) {
                case 'multiple_choice_question':
                    return (
                        <>
                            <p className="text-xl font-bold text-dark-gold-gradient mb-3">{questionBlock.question}</p>
                            <div className="space-y-2">
                                {(questionBlock as MultipleChoiceQuestionBlock).options.map((option, i) => (
                                    <label key={i} className={`flex items-center p-3 rounded-lg cursor-pointer transition-all ${userAnswers[questionBlock.id] === i ? 'bg-yellow-500/10 ring-1 ring-yellow-600' : 'bg-[var(--color-background-primary)]'}`}>
                                        <input type="radio" name={`q-${questionBlock.id}`} value={i} checked={userAnswers[questionBlock.id] === i} onChange={() => handleAnswerChange(questionBlock.id, i)} className="w-4 h-4 text-[var(--color-accent-primary)] form-radio" disabled={!isInteractive} />
                                        <span className="ml-3 text-md text-gold-brown">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </>
                    );
                case 'true_false_question':
                    return (
                         <>
                            <p className="text-xl font-bold text-dark-gold-gradient mb-3">{questionBlock.question}</p>
                            <div className="flex gap-4">
                                {[true, false].map(value => (<button key={String(value)} onClick={() => handleAnswerChange(questionBlock.id, value)} disabled={!isInteractive} className={`flex-1 p-3 rounded-lg font-bold transition-all text-white`} style={userAnswers[questionBlock.id] === value ? {backgroundImage: goldenGradient} : {backgroundColor: 'var(--color-background-primary)', color: 'var(--color-text-primary)'}}>{value ? "True" : "False"}</button>))}
                            </div>
                        </>
                    );
                case 'fill_in_the_blank_question':
                     const fitb = questionBlock as FillInTheBlankQuestionBlock;
                     return (
                        <div className="text-xl font-bold text-dark-gold-gradient">
                            {fitb.questionParts.map((part, i) => (
                                <React.Fragment key={i}>
                                    {part}
                                    {i < fitb.correctAnswers.length && <input type="text" value={((userAnswers[fitb.id] || [])[i]) || ''} onChange={(e) => handleFillBlankChange(fitb.id, i, e.target.value)} placeholder="..." disabled={!isInteractive} className="inline-block w-32 p-0 mx-1 align-baseline bg-transparent text-center font-bold text-dark-gold-gradient border-0 border-b-2 border-dashed border-yellow-700/50 focus:outline-none focus:ring-0" />}
                                </React.Fragment>
                            ))}
                        </div>
                    );
                case 'open_ended_question':
                     return (
                        <>
                            <p className="text-xl font-bold text-dark-gold-gradient mb-3">{questionBlock.question}</p>
                            <textarea value={userAnswers[questionBlock.id] || ''} onChange={(e) => handleAnswerChange(questionBlock.id, e.target.value)} placeholder="Type your answer here..." className="w-full p-2 bg-[var(--color-background-primary)] rounded-lg border border-[var(--color-border-primary)]" rows={3} disabled={!isInteractive} />
                        </>
                    );
                default: return null;
            }
        };

        return (
            <div key={questionBlock.id} className="p-4 bg-[var(--color-background-tertiary)] rounded-lg question-item">
                <div className="flex items-start gap-3 font-bold text-[var(--color-text-primary)] mb-2">
                    <div className="flex items-center gap-2 flex-shrink-0 pt-1">
                        <span className="golden-text">{index + 1}.</span>
                        <RomanTempleIcon className="w-5 h-5 golden-text" />
                    </div>
                    <div className="flex-grow"><QuestionContent /></div>
                </div>
                 {blockFeedback && (
                    <div className={`mt-3 p-3 rounded-lg flex items-start gap-2 feedback bg-yellow-400/10 border border-yellow-600/20`}>
                        {blockFeedback.isCorrect ? <CheckCircleIcon className="w-5 h-5 golden-text flex-shrink-0" /> : <XCircleIcon className="w-5 h-5 golden-text flex-shrink-0" />}
                        <div className="flex-grow flex items-start gap-2">
                           <RomanTempleIcon className="w-4 h-4 golden-text/80 flex-shrink-0 mt-1" />
                           <p className="flex-grow text-sm text-gold-brown whitespace-pre-wrap">{blockFeedback.explanation}</p>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const renderContent = () => {
        if (isLoading) return <div className="flex items-center justify-center h-full"><LoadingSpinner text={loadingText} /></div>;
        if (error && currentStep !== 'chapters') return <div className="p-4 text-center"><p className="p-4 bg-yellow-500/10 text-dark-gold-gradient rounded-lg">{error}</p><button onClick={() => handleReset(true)} style={{ backgroundImage: goldenGradient }} className="mt-4 px-4 py-2 text-white rounded-lg">Start Over</button></div>;
        
        switch(currentStep) {
            case 'upload': return <div className="p-6 flex flex-col items-center justify-center h-full text-center"><UploadIcon className="w-16 h-16 golden-text mb-4" /><h3 className="text-xl font-bold mb-2 golden-text">Generate Questions from a Document</h3><p className="text-sm text-gold-brown mb-6 max-w-sm">Upload a PDF, we'll analyze it into chapters, then you can pick any chapter to instantly generate questions about it.</p><label htmlFor="qg-file-upload" className="cursor-pointer w-full max-w-xs text-center p-4 mb-4 text-md font-semibold text-white rounded-lg shadow-lg" style={{ backgroundImage: goldenGradient }}>{file ? file.name : 'Select a PDF file'}</label><input id="qg-file-upload" type="file" className="sr-only" accept=".pdf" onChange={handleFileChange} /><button onClick={handleAnalyze} disabled={!file} className="w-full max-w-xs px-8 py-3 text-lg font-bold text-white rounded-lg shadow-lg disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>Analyze Document</button></div>;
            case 'chapters': return <div className="p-4"><h3 className="text-xl font-bold text-center mb-4 golden-text">Select a chapter to generate questions</h3>{error && <p className="p-3 my-2 bg-yellow-500/10 text-dark-gold-gradient rounded-lg text-sm">{error}</p>}{chapters?.length ? <ul className="space-y-2 max-h-[80vh] overflow-y-auto">{chapters.map(c => <li key={c.id}><button dir="auto" onClick={() => handleChapterSelect(c)} className="w-full text-start p-3 rounded-lg font-semibold text-dark-gold-gradient bg-[var(--color-background-tertiary)] hover:bg-yellow-500/10"><span>{c.title} (p. {c.startPage}-{c.endPage})</span></button></li>)}</ul> : <p>No chapters found.</p>}<button onClick={() => handleReset(true)} style={{ backgroundImage: goldenGradient }} className="mt-4 px-4 py-2 w-full text-white font-bold rounded-lg">Select another file</button></div>;
            case 'questions': return <div className="p-4 flex flex-col h-full"><h3 className="text-xl font-bold text-center flex-grow golden-text mb-4">{`Questions for: ${activeChapter?.title}`}</h3><div id="questions-content" dir="auto" style={{ fontFamily: "'Times New Roman', serif" }} className="space-y-4 overflow-y-auto flex-grow">{questionsToDisplay?.length ? questionsToDisplay.map(renderQuestion) : <p className="text-center text-dark-gold-gradient">No questions generated.</p>}</div><div className="pt-2 mt-2 border-t border-[var(--color-border-primary)]"><button onClick={handleSubmitAnswers} disabled={isSubmitting || Object.keys(userAnswers).length === 0} className="w-full px-4 py-3 text-lg font-bold text-white rounded-lg disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>{isSubmitting ? 'Evaluating...' : 'Submit Answers'}</button></div></div>;
            case 'results':
                const correctCount = feedback?.filter(f => f.isCorrect).length || 0;
                const totalCount = feedback?.length || 0;
                const incorrectCount = totalCount - correctCount;
                return (
                    <div className="p-4 flex flex-col h-full">
                        <h3 className="text-xl font-bold text-center flex-grow golden-text mb-4">{`Results: ${activeChapter?.title}`}</h3>
                        <div className="p-4 bg-yellow-500/10 rounded-lg text-center mb-4"><p className="text-2xl font-bold golden-text">You got <span className="golden-text">{correctCount}</span> out of <span className="golden-text">{totalCount}</span></p></div>
                        <div className="flex gap-2 mb-4">
                            {incorrectCount > 0 && <button onClick={handleRetry} className="flex-1 px-4 py-2 text-white font-bold rounded-lg" style={{ backgroundImage: goldenGradient }}>Retry Incorrect</button>}
                            {incorrectCount > 0 && <button onClick={handleAiCorrect} disabled={isCorrecting} className="flex-1 px-4 py-2 text-white font-bold rounded-lg" style={{ backgroundImage: goldenGradient }}>{isCorrecting ? 'Correcting...': 'AI Correction'}</button>}
                        </div>
                        <div id="results-content" dir="auto" style={{ fontFamily: "'Times New Roman', serif" }} className="space-y-4 overflow-y-auto flex-grow">{allQuestionsForChapter?.map(renderQuestion)}</div>
                        <button onClick={() => initialChapter ? handleReset(true) : setCurrentStep('chapters')} className="mt-4 px-4 py-2 w-full text-white font-bold rounded-lg" style={{ backgroundImage: goldenGradient }}>
                            {initialChapter ? "Start Over" : "Back to Chapters"}
                        </button>
                    </div>
                );
        }
    }

    const isDownloadable = currentStep === 'questions' || currentStep === 'results';
    const downloadContentId = currentStep === 'questions' ? 'questions-content' : 'results-content';
    const downloadTitle = `Test for ${activeChapter?.title || 'Chapter'}`;

    return (
        <aside ref={sidebarRef} className={`fixed inset-0 bg-[var(--color-background-secondary)]/70 backdrop-blur-lg shadow-2xl transition-transform duration-500 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-hidden={!isOpen}>
            {isOpen && (
                <>
                    <div className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center bg-[var(--color-background-primary)] no-print-sidebar">
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close"><XIcon className="w-6 h-6 golden-text" /></button>
                            <button onClick={() => downloadHtml(downloadContentId, downloadTitle)} title="Download HTML" disabled={!isDownloadable} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><HtmlIcon className="w-4 h-4"/></button>
                            <button onClick={handlePrint} title="Download PDF / Print" disabled={!isDownloadable} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PdfIcon className="w-4 h-4"/></button>
                            <button onClick={handlePrint} title="Print" disabled={!isDownloadable} className="p-2 text-white rounded-md disabled:opacity-50" style={{backgroundImage: goldenGradient}}><PrintIcon className="w-4 h-4"/></button>
                        </div>
                        <h2 className="text-xl font-bold golden-text flex items-center gap-2"><RomanTempleIcon className="w-6 h-6 golden-text" /> Test Me</h2>
                        <button onClick={onGoHome} className="p-2 rounded-lg hover:bg-[var(--color-border-primary)] flex items-center gap-2 px-4 text-white" aria-label="Go Home" style={{ backgroundImage: goldenGradient }}>
                            <HomeIcon className="w-6 h-6" /> <span className="font-bold">Home</span>
                        </button>
                    </div>
                    <div className="flex-grow min-h-0 printable-content">{renderContent()}</div>
                </>
            )}
        </aside>
    );
};

export default QuestionGeneratorSidebar;