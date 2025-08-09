
import React, { useState, useEffect, useRef } from 'react';
import { InteractiveContent, UserAnswer, FeedbackItem, InteractiveBlock, SavedBook } from '../types';
import { CheckCircleIcon, XCircleIcon, PdfIcon, PrintIcon, HtmlIcon, ArrowLeftIcon, LightbulbIcon, BookOpenIcon, RomanTempleIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

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
                title="Request Deeper Explanation"
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
              <textarea value={(userAnswers[block.id] as string) || ''} onChange={(e) => handleAnswerChange(block.id, e.target.value)} placeholder="Write your answer here..." className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-lg border border-[var(--color-border-primary)] focus:ring-2 focus:ring-[var(--color-accent-primary)] focus:border-[var(--color-accent-primary)] transition text-[var(--color-text-brown-dark)] font-medium" rows={3} disabled={!!feedback} />
            )}
            {blockFeedback && (
              <div className={`mt-3 p-3 rounded-lg flex items-start space-x-3 ${blockFeedback.isCorrect ? 'bg-[var(--color-accent-success)]/10 border border-[var(--color-accent-success)]/30' : 'bg-[var(--color-accent-danger)]/10 border border-[var(--color-accent-danger)]/30'}`}>
                {blockFeedback.isCorrect ? <CheckCircleIcon className="w-6 h-6 text-[var(--color-accent-success)] flex-shrink-0" /> : <XCircleIcon className="w-6 h-6 text-[var(--color-accent-danger)] flex-shrink-0" />}
                <div className="flex items-start gap-2">
                  <RomanTempleIcon className="w-5 h-5 golden-text/80 flex-shrink-0 mt-1" />
                  <p className="flex-grow text-sm font-semibold text-[var(--color-text-brown-dark)] whitespace-pre-wrap">{blockFeedback.explanation}</p>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const hasQuestions = questionBlocks.length > 0;
  const correctCount = feedback ? feedback.filter(f => f.isCorrect).length : 0;
  const totalQuestions = feedback ? feedback.length : 0;
  const hasIncorrect = totalQuestions > correctCount;

  return (
    <div 
        className="w-full max-w-4xl mx-auto rounded-2xl p-[2px]"
        style={{ backgroundImage: 'var(--color-background-container-gradient)' }}
    >
        <div className="w-full h-full text-center rounded-[calc(1rem-2px)] p-6 sm:p-8 flex flex-col">
            <header className="mb-6 flex flex-col sm:flex-row justify-between items-center gap-4 no-print">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundImage: goldenGradient }}>
                    <ArrowLeftIcon className="w-5 h-5"/>
                    <span>{backButtonText}</span>
                </button>
                 <div className="flex items-center gap-2">
                    <button onClick={() => downloadHtmlFromElement('printable-session', '_full_session')} className="p-2 text-white rounded-md shadow-lg" style={{ backgroundImage: goldenGradient }} title="Download as HTML"> <HtmlIcon className="w-5 h-5"/> </button>
                    <button onClick={handlePrint} className="p-2 text-white rounded-md shadow-lg" style={{ backgroundImage: goldenGradient }} title="Download as PDF/Print"> <PdfIcon className="w-5 h-5"/> </button>
                    <button onClick={handlePrintQuestions} className="p-2 text-white rounded-md shadow-lg" style={{ backgroundImage: goldenGradient }} title="Print Questions Only"> <PrintIcon className="w-5 h-5"/> </button>
                </div>
            </header>

            <div id="printable-session" className="flex-grow space-y-8 text-left" dir="auto">
                <div id="lesson-section-wrapper">
                    <div className="flex items-center gap-3 mb-4 text-left">
                        <BookOpenIcon className="w-8 h-8 flex-shrink-0 text-[var(--color-accent-primary)]"/>
                        <h2 className="text-3xl font-bold golden-text">{content.title}</h2>
                    </div>
                    {content.content.filter(b => !b.type.endsWith('_question')).map(renderBlock)}
                </div>
                
                <div id="questions-section-wrapper" className="space-y-6">
                  {hasQuestions && !feedback && (
                      <div className="space-y-6">
                          {questionBlocks.map(renderBlock)}
                          <div className="pt-6 border-t border-dashed border-[var(--color-border-primary)] flex justify-end no-print">
                              <button onClick={handleSubmit} disabled={isSubmitting || Object.keys(userAnswers).length === 0} className="px-8 py-3 text-lg font-bold text-white rounded-lg shadow-lg disabled:opacity-50" style={{ backgroundImage: goldenGradient }}>
                                  {isSubmitting ? "Evaluating..." : "Submit Answers"}
                              </button>
                          </div>
                      </div>
                  )}

                  {!hasQuestions && !isGeneratingMore && (
                     <div className="text-center p-6 border border-dashed border-[var(--color-border-primary)] rounded-xl space-y-4 no-print">
                        <p className="text-lg font-semibold text-[var(--color-text-secondary)]">No questions have been generated for this lesson yet.</p>
                        <button onClick={onGenerateInitialQuestions} className="px-6 py-2 text-white font-bold rounded-lg" style={{backgroundImage: goldenGradient}}>Generate Initial 50 Questions</button>
                     </div>
                  )}

                  {feedback && (
                      <div className="space-y-6">
                          <div className="p-4 bg-[var(--color-background-secondary)] rounded-lg text-center no-print">
                              <h3 className="text-2xl font-bold golden-text">Results</h3>
                              <p className="mt-2 text-lg text-dark-gold-gradient">
                                  You answered {correctCount} out of {totalQuestions} questions correctly.
                              </p>
                              {hasIncorrect && (
                                  <div className="mt-4 flex flex-wrap justify-center gap-4">
                                      <button onClick={handleRetry} className="px-4 py-2 text-white font-bold rounded-lg" style={{backgroundImage: goldenGradient}}>Retry Incorrect Questions</button>
                                      <button onClick={onAiCorrectAnswers} disabled={isCorrecting} className="px-4 py-2 text-white font-bold rounded-lg" style={{backgroundImage: goldenGradient}}>
                                          {isCorrecting ? 'Correcting...' : 'AI Correction'}
                                      </button>
                                  </div>
                              )}
                          </div>
                          {questionBlocks.map(renderBlock)}
                          <div className="pt-6 border-t border-dashed border-[var(--color-border-primary)] flex justify-end no-print">
                                <button onClick={onBack} className="px-8 py-3 text-lg font-bold text-white rounded-lg shadow-lg" style={{ backgroundImage: goldenGradient }}>
                                    {backButtonText}
                                </button>
                          </div>
                      </div>
                  )}
                </div>
                
                {hasQuestions && !feedback && (
                     <div className="text-center p-6 border border-dashed border-[var(--color-border-primary)] rounded-xl space-y-4 no-print">
                        <button onClick={onGenerateMoreQuestions} disabled={isGeneratingMore} className="px-6 py-2 text-white font-bold rounded-lg" style={{backgroundImage: goldenGradient}}>
                            {isGeneratingMore ? "Generating..." : "Generate 10 More Questions"}
                        </button>
                     </div>
                )}
            </div>
        </div>
    </div>
  );
};

export default InteractiveSession;
