import React, { useState, useEffect, useRef } from 'react';
import { InteractiveContent, UserAnswer, FeedbackItem, InteractiveBlock, SavedBook } from '../types';
import { CheckCircleIcon, XCircleIcon, PdfIcon, PrintIcon, HtmlIcon, ArrowLeftIcon, LightbulbIcon, BookOpenIcon, RomanTempleIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';
import OriginalTextSidebar from './OriginalTextSidebar';

declare const katex: any;

const MathRenderer: React.FC<{ latex: string, isDisplayMode: boolean }> = ({ latex, isDisplayMode }) => {
    const containerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (containerRef.current && typeof katex !== 'undefined') {
            try {
                katex.render(latex, containerRef.current, {
                    throwOnError: false,
                    displayMode: isDisplayMode
                });
            } catch (e) {
                console.error("Katex rendering error:", e);
                if (containerRef.current) {
                    containerRef.current.textContent = latex; // Fallback
                }
            }
        }
    }, [latex, isDisplayMode]);

    return <span ref={containerRef} />;
};

interface InteractiveSessionProps {
  content: InteractiveContent;
  activeBook: SavedBook;
  onSubmitAnswers: (answers: UserAnswer[]) => void;
  feedback: FeedbackItem[] | null;
  isSubmitting: boolean;
  onBack: () => void;
  backButtonText: string;
  onGenerateInitialQuestions: () => void;
  onGenerateMoreQuestions: () => void;
  isGeneratingMore: boolean;
  isCorrecting: boolean;
  isRetryMode: boolean;
  onRetryIncorrect: (incorrectQuestionIds: string[]) => void;
  onGetDeeperExplanation: (text: string) => void;
  onAiCorrectAnswers: () => void;
}

const InteractiveSession: React.FC<InteractiveSessionProps> = ({ 
    content, 
    activeBook,
    onSubmitAnswers, 
    feedback, 
    isSubmitting, 
    onBack, 
    backButtonText,
    onGenerateInitialQuestions,
    onGenerateMoreQuestions,
    isGeneratingMore,
    isCorrecting,
    isRetryMode,
    onRetryIncorrect,
    onGetDeeperExplanation,
    onAiCorrectAnswers
}) => {
  const [userAnswers, setUserAnswers] = useState<Record<string, any>>({});
  const [isOriginalTextSidebarOpen, setIsOriginalTextSidebarOpen] = useState(false);
  const goldenGradient = 'linear-gradient(to bottom right, #c09a3e, #856a3d)';
  
  const handlePrint = () => {
    window.print();
  };
  
  const downloadHtmlFromElement = (elementId: string, titleSuffix: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    const title = (content.title || 'Interactive Lesson') + titleSuffix;
    const rootStyles = document.documentElement.style.cssText;
    const bodyClasses = document.body.className;

    const printableClone = element.cloneNode(true) as HTMLElement;
    printableClone.querySelectorAll('.no-print').forEach(el => el.remove());

    const htmlString = `
        <!DOCTYPE html>
        <html lang="en" dir="ltr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
            <style>
                body {
                    font-family: 'Times New Roman', serif;
                    padding: 1.5rem;
                }
                .dark {
                     --color-background-primary: #000000;
                     --color-text-primary: #f5f5f5;
                }
                .light {
                    --color-background-primary: #fdfaf6;
                    --color-text-primary: #4a3a2a;
                }
                body {
                    background-color: var(--color-background-primary);
                    color: var(--color-text-primary);
                }
            </style>
        </head>
        <body class="${bodyClasses}">
            ${printableClone.outerHTML}
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

  const handlePrintQuestions = () => {
    document.body.classList.add('print-questions-only');
    const cleanup = () => {
        document.body.classList.remove('print-questions-only');
        window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
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

  const handleSubmit = () => {
    const answersToSubmit: UserAnswer[] = Object.entries(userAnswers).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
    onSubmitAnswers(answersToSubmit);
  };
  
  const getFeedbackForQuestion = (questionId: string): FeedbackItem | undefined => {
      if (!feedback) return undefined;
      return feedback.find(f => f.questionId === questionId);
  }

  const handleRetry = () => {
    if (!feedback) return;
    const incorrectQuestionIds = feedback
      .filter(fb => !fb.isCorrect)
      .map(fb => fb.questionId);
      
    onRetryIncorrect(incorrectQuestionIds);
    setUserAnswers({});
  };
  
  const questionBlocks = content.content.filter(b => b && b.type && b.type.endsWith('_question'));

  const renderBlock = (block: InteractiveBlock) => {
    const blockFeedback = block.type.endsWith('_question') ? getFeedbackForQuestion(block.id) : undefined;
    
    const questionIndex = questionBlocks.findIndex(q => q.id === block.id);

    switch (block.type) {
      case 'explanation':
        return (
          <div className="relative group flex items-start gap-3">
             <RomanTempleIcon className="w-5 h-5 text-[var(--color-text-tertiary)] flex-shrink-0 mt-1" />
            <div className="flex-grow">
              <p className="text-base font-semibold leading-relaxed" style={{whiteSpace: 'pre-wrap', color: 'var(--color-text-brown-dark)'}}>{block.text}</p>
              <button 
                onClick={() => onGetDeeperExplanation(block.text)}
                className="absolute top-0 right-0 p-1 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--color-background-primary)]/50 rounded-full"
                title="Request deeper explanation"
              >
                <LightbulbIcon className="w-4 h-4"/>
              </button>
            </div>
          </div>
        );
      
      case 'math_formula':
        return (
          <div className="bg-[var(--color-background-tertiary)] p-4 rounded-lg my-2 text-lg flex justify-center text-[var(--color-text-primary)]">
            <MathRenderer latex={block.latex} isDisplayMode={true} />
          </div>
        );

      case 'multiple_choice_question':
      case 'open_ended_question':
      case 'true_false_question':
      case 'fill_in_the_blank_question':
        return (
          <div className="space-y-3">
            <div className="flex items-start gap-3 text-lg font-bold" style={{color: 'var(--color-text-green-dark)'}}>
                <div className="flex items-center gap-2 flex-shrink-0" style={{lineHeight: 2.5}}>
                   <span className="font-black text-[var(--color-accent-primary)]">{questionIndex + 1}.</span>
                   <RomanTempleIcon className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                </div>
                <div className="flex-grow" style={{lineHeight: 2.5}}>
                    {block.type !== 'fill_in_the_blank_question' ? block.question :
                        block.questionParts.map((part, partIndex) => (
                        <React.Fragment key={partIndex}>
                            {part}
                            {partIndex < block.correctAnswers.length && (
                            <input type="text" value={((userAnswers[block.id] || [])[partIndex]) || ''} onChange={(e) => handleFillBlankChange(block.id, partIndex, e.target.value)} placeholder="..." disabled={!!feedback} className="inline-block w-40 p-0 mx-1 align-baseline bg-transparent text-center text-lg font-bold text-[var(--color-accent-success)] border-0 border-b-2 border-dashed border-[var(--color-text-secondary)] focus:outline-none focus:ring-0 focus:border-solid focus:border-[var(--color-accent-primary)] transition" />
                            )}
                        </React.Fragment>
                        ))
                    }
                </div>
            </div>
            {block.type === 'multiple_choice_question' && (
              <div className="space-y-2">
                {block.options.map((option, optionIndex) => (
                  <label key={optionIndex} className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${userAnswers[block.id] === optionIndex ? 'bg-[var(--color-accent-primary)]/20 ring-2 ring-[var(--color-accent-primary)]' : 'bg-[var(--color-background-tertiary)] hover:bg-[var(--color-border-primary)]'}`}>
                    <input type="radio" name={`question-${block.id}`} value={optionIndex} checked={userAnswers[block.id] === optionIndex} onChange={() => handleAnswerChange(block.id, optionIndex)} className="w-4 h-4 text-[var(--color-accent-primary)] form-radio focus:ring-[var(--color-accent-primary)] bg-[var(--color-background-secondary)] border-[var(--color-border-primary)] mr-4" disabled={!!feedback} />
                    <span className="text-sm font-medium" style={{color: 'var(--color-text-brown-dark)'}}>{option}</span>
                  </label>
                ))}
              </div>
            )}
            {block.type === 'true_false_question' && (
                <div className="flex gap-4">
                    {[true, false].map(value => ( <button key={String(value)} onClick={() => handleAnswerChange(block.id, value)} disabled={!!feedback} className={`flex-1 p-3 rounded-lg font-bold text-base transition-all duration-200 ${userAnswers[block.id] === value ? (value ? 'bg-[var(--color-accent-success)]/80 ring-2 ring-[var(--color-accent-success)] text-white' : 'bg-[var(--color-accent-danger)]/80 ring-2 ring-[var(--color-accent-danger)] text-white') : 'bg-[var(--color-background-tertiary)] hover:bg-[var(--color-border-primary)]'}`} > {value ? "True" : "False"} </button> ))}
                </div>
            )}
            {block.type === 'open_ended_question' && (
              <textarea value={(userAnswers[block.id] as string) || ''} onChange={(e) => handleAnswerChange(block.id, e.target.value)} placeholder="Type your answer here..." className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-lg border border-[var(--color-border-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] transition text-[var(--color-text-brown-dark)] font-medium" rows={3} disabled={!!feedback} />
            )}
            {blockFeedback && (
              <div className={`mt-3 p-3 rounded-lg flex items-start space-x-3 ${blockFeedback.isCorrect ? 'bg-[var(--color-accent-success)]/10 border border-[var(--color-accent-success)]/30' : 'bg-[var(--color-accent-danger)]/10 border border-[var(--color-accent-danger)]/30'}`}>
                {blockFeedback.isCorrect ? <CheckCircleIcon className="w-5 h-5 text-[var(--color-accent-success)] flex-shrink-0" /> : <XCircleIcon className="w-5 h-5 text-[var(--color-accent-danger)] flex-shrink-0" />}
                <div className="flex-grow">
                  <p className={`font-bold ${blockFeedback.isCorrect ? 'text-[var(--color-accent-success)]' : 'text-[var(--color-accent-danger)]'}`}>{blockFeedback.isCorrect ? 'Correct!' : 'Incorrect'}</p>
                  <div className="flex items-start gap-2 mt-1">
                      <RomanTempleIcon className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
                      <p className="flex-grow text-sm font-medium" style={{whiteSpace: 'pre-wrap', color: 'var(--color-text-primary)'}}>{blockFeedback.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      default: return null;
    }
  };

  const lessonBlocks = content.content.filter(b => b && b.type && !b.type.endsWith('_question'));
  const hasQuestions = questionBlocks.length > 0;
  const incorrectCount = feedback ? feedback.filter(f => !f.isCorrect).length : 0;

  return (
    <>
    <div className="w-full max-w-4xl mx-auto rounded-2xl p-[2px] bg-gradient-to-br from-[#c09a3e] to-[#856a3d]">
        <div 
          className="w-full h-full rounded-[calc(1rem-2px)] p-6 sm:p-8 space-y-6"
          style={{ backgroundImage: 'var(--color-background-container-gradient)' }}
        >
            <div id="printable-session" style={{ fontFamily: "'Times New Roman', serif" }}>
                <div className="no-print flex justify-between items-center flex-wrap gap-4 border-b border-[var(--color-border-primary)] pb-4">
                    <div className="flex items-center gap-2">
                        <button onClick={onBack} className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundImage: goldenGradient }}>
                            <ArrowLeftIcon className="w-4 h-4"/>
                            <span>{isRetryMode ? "Back to Results" : backButtonText}</span>
                        </button>
                        <button 
                            onClick={() => setIsOriginalTextSidebarOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors"
                            style={{ backgroundImage: goldenGradient }}
                            title="View Original Document"
                        >
                            <BookOpenIcon className="w-4 h-4"/>
                            <span>Original Document</span>
                        </button>
                    </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => downloadHtmlFromElement('printable-session', '')} title="Download HTML" className="p-2 text-white rounded-lg hover:opacity-90 transition-colors shadow-md" style={{ backgroundImage: goldenGradient }}><HtmlIcon className="w-5 h-5" /></button>
                    <button onClick={handlePrint} title="Download PDF" className="p-2 text-white rounded-lg hover:opacity-90 transition-colors shadow-md" style={{ backgroundImage: goldenGradient }}><PdfIcon className="w-5 h-5" /></button>
                    <button onClick={handlePrint} title="Print" className="p-2 text-white rounded-lg hover:opacity-90 transition-colors shadow-md" style={{ backgroundImage: goldenGradient }}><PrintIcon className="w-5 h-5" /></button>
                </div>
                </div>

                <h1 className="text-4xl font-bold text-center mt-6 golden-text">{content.title} {isRetryMode && "(Retry Mode)"}</h1>

                {lessonBlocks.length > 0 && !isRetryMode && (
                <div id="lesson-content-area" className="mt-6 space-y-4">
                    {lessonBlocks.map((block) => (
                        <div key={block.id} className="rounded-xl p-[1px] bg-gradient-to-br from-[#c09a3e]/40 to-[#856a3d]/40">
                            <div className="bg-[var(--color-background-secondary)]/60 p-4 rounded-[calc(0.75rem-1px)]">
                                {renderBlock(block)}
                            </div>
                        </div>
                    ))}
                </div>
                )}
                
                {hasQuestions && (
                    <div className="mt-10 rounded-2xl p-[2px] bg-gradient-to-br from-[#c09a3e] to-[#856a3d] shadow-lg">
                        <div id="questions-section-wrapper" className="bg-[var(--color-background-primary)] p-6 sm:p-8 rounded-[calc(1rem-2px)] space-y-6">
                            <div className="no-print flex justify-between items-center flex-wrap gap-4">
                                <h2 className="text-2xl font-bold golden-text">{isRetryMode ? "Incorrect Questions" : "Questions"}</h2>
                                {!isRetryMode && (<div className="flex items-center gap-3">
                                    <button onClick={() => downloadHtmlFromElement('questions-content', ` - Questions`)} title="Download Questions HTML" className="p-2 text-white rounded-lg hover:opacity-90 transition-colors shadow-md" style={{ backgroundImage: goldenGradient }}><HtmlIcon className="w-5 h-5" /></button>
                                    <button onClick={handlePrintQuestions} title="Download Questions PDF" className="p-2 text-white rounded-lg hover:opacity-90 transition-colors shadow-md" style={{ backgroundImage: goldenGradient }}><PdfIcon className="w-5 h-5" /></button>
                                    <button onClick={handlePrintQuestions} title="Print Questions" className="p-2 text-white rounded-lg hover:opacity-90 transition-colors shadow-md" style={{ backgroundImage: goldenGradient }}><PrintIcon className="w-5 h-5" /></button>
                                </div>)}
                            </div>
                            <div id="questions-content" className="space-y-4">
                                {questionBlocks.map((block) => (
                                    <div key={block.id} className="rounded-xl p-[1px] bg-gradient-to-br from-[#c09a3e]/40 to-[#856a3d]/40">
                                        <div className="bg-[var(--color-background-secondary)]/60 p-4 rounded-[calc(0.75rem-1px)]">
                                            {renderBlock(block)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {isSubmitting && <div className="no-print"><LoadingSpinner text="Evaluating your answers..." /></div>}

            {!hasQuestions && !isSubmitting && !feedback && (
                <div className="no-print mt-6 pt-6 border-t border-[var(--color-border-primary)] flex flex-col items-center space-y-4 text-center">
                    {isGeneratingMore ? <LoadingSpinner text="Generating questions..." /> : (
                        <>
                            <p className="text-base font-semibold" style={{color: 'var(--color-text-brown-dark)'}}>You have finished the lesson. Ready to test your understanding?</p>
                            <button onClick={onGenerateInitialQuestions} disabled={isGeneratingMore} style={{ backgroundImage: goldenGradient }} className="px-9 py-3 text-lg font-bold text-white rounded-lg shadow-lg hover:opacity-90 transform hover:scale-105 transition-all duration-300">
                                Generate Test Questions
                            </button>
                        </>
                    )}
                </div>
            )}

            {hasQuestions && !feedback && !isSubmitting && (
                <div className="no-print mt-6 pt-4 border-t border-[var(--color-border-primary)] flex justify-center">
                <button onClick={handleSubmit} disabled={Object.keys(userAnswers).length === 0} style={{ backgroundImage: goldenGradient }} className="px-9 py-3 text-lg font-bold text-white rounded-lg shadow-lg hover:opacity-90 disabled:bg-none disabled:bg-[var(--color-border-secondary)] disabled:text-[var(--color-text-tertiary)] disabled:cursor-not-allowed disabled:shadow-none transform hover:scale-105 transition-all duration-300">
                    Submit Answers
                </button>
                </div>
            )}

            {feedback && !isRetryMode && (
                <div className="no-print mt-6 pt-6 border-t border-[var(--color-border-primary)] space-y-6 flex flex-col items-center">
                    <div className="w-full max-w-md bg-[var(--color-background-primary)] rounded-2xl shadow-lg p-6 text-center">
                    <h3 className="text-xl font-bold golden-text mb-4">Final Score</h3>
                    <div className="flex justify-around items-center">
                        <div className="text-center">
                        <p className="text-4xl font-extrabold text-[var(--color-accent-success)]">{feedback.length - incorrectCount}</p>
                        <p className="font-semibold text-base text-[var(--color-text-secondary)]">Correct</p>
                        </div>
                        <div className="text-center">
                        <p className="text-4xl font-extrabold text-[var(--color-accent-danger)]">{incorrectCount}</p>
                        <p className="font-semibold text-base text-[var(--color-text-secondary)]">Incorrect</p>
                        </div>
                    </div>
                    </div>
                    
                    <div className="w-full text-center space-y-4">
                        <h4 className="text-lg font-bold golden-text">What would you like to do now?</h4>
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
                        {incorrectCount > 0 && (
                            <button onClick={handleRetry} className="w-full sm:w-auto px-6 py-2 text-base font-bold text-white bg-gradient-to-r from-red-600 to-orange-500 rounded-lg shadow-lg hover:opacity-90 transform hover:scale-105 transition-all duration-300">
                            Retry Incorrect Questions
                            </button>
                        )}
                        {incorrectCount > 0 && (
                            <button onClick={onAiCorrectAnswers} disabled={isCorrecting} className="w-full sm:w-auto px-6 py-2 text-base font-bold text-white bg-gradient-to-r from-green-600 to-teal-500 rounded-lg shadow-lg disabled:bg-none disabled:bg-[var(--color-border-secondary)] transform hover:scale-105 transition-all duration-300 flex items-center justify-center gap-2">
                                {isCorrecting ? (<><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div><span>Correcting...</span></>) : (<span>AI Correction</span>)}
                            </button>
                        )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
    <OriginalTextSidebar 
        isOpen={isOriginalTextSidebarOpen} 
        onClose={() => setIsOriginalTextSidebarOpen(false)}
        activeBook={activeBook}
    />
    </>
  );
};

export default InteractiveSession;