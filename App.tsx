import React, { useState, useCallback, useEffect, useRef } from 'react';
import FileUploader from './components/FileUploader';
import InteractiveSession from './components/InteractiveSession';
import LoadingSpinner from './components/LoadingSpinner';
import ChapterSelector from './components/ChapterSelector';
import SearchSidebar from './components/SearchSidebar';
import EditSidebar from './components/EditSidebar';
import SummarizerSidebar from './components/SummarizerSidebar';
import ChatSidebar from './components/ChatSidebar';
import { Library } from './components/Library';
import QuestionGeneratorSidebar from './components/QuestionGeneratorSidebar';
import AskMeSidebar from './components/AskMeSidebar';
import SmartSearchSidebar from './components/SmartSearchSidebar';
import PrayerTimes from './components/PrayerTimes';
import TaskManager from './components/TaskManager';
import UserGuide from './components/UserGuide';
import Calculator from './components/Calculator';
import PurchaseRequest from './components/PurchaseRequest';
import { HomeIcon, WhatsAppIcon, EditIcon, RomanTempleIcon, SummarizeIcon, ChatBubbleIcon, SearchIcon, EggIcon, OliveIcon, SettingsIcon, MailIcon, PrayerTimeIcon, ClipboardListIcon, InfoIcon, ShieldIcon, CalculatorIcon, BookOpenIcon, CheckCircleIcon, BookshelfIcon, GradientBookOpenIcon, MenuIcon } from './components/icons';
import { extractTextPerPage } from './services/pdfService';
import { analyzeDocumentStructure, analyzeChapterForLessons, generateInteractiveLesson, generateInitialQuestions, getFeedbackOnAnswers, generateMoreQuestions, getDeeperExplanation, getAiCorrections } from './services/geminiService';
import { generateTheme } from './services/themeService';
import { saveBook, getBookById, saveActiveBookState, loadActiveBookState, clearAllData, clearActiveBookState } from './services/dbService';
import { InteractiveContent, UserAnswer, FeedbackItem, Chapter, PageText, Lesson, ColorTheme, InteractiveBlock, SavedBook, AppState, ThemeMode } from './types';

type ActiveView = 'main' | 'prayer_times' | 'calculator' | 'library' | 'tasks' | 'user_guide' | 'purchase_request';

const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const QuestionMarkTextIcon: React.FC<{ className?: string }> = ({ className }) => (
    <div className={`${className} flex items-center justify-center font-bold text-2xl`}>?</div>
);

function App() {
  const [appState, setAppState] = useState<AppState>('analyzing'); // Start in analyzing to show spinner while checking db
  const [activeView, setActiveView] = useState<ActiveView>('main');
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Session State
  const [activeBook, setActiveBook] = useState<SavedBook | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [interactiveContent, setInteractiveContent] = useState<InteractiveContent | null>(null);
  const [originalFullContent, setOriginalFullContent] = useState<InteractiveContent | null>(null);

  // Interaction State
  const [feedback, setFeedback] = useState<FeedbackItem[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [isRetryMode, setIsRetryMode] = useState(false);
  
  // Persistence State
  const [hasLastBook, setHasLastBook] = useState(false);
  const isSavingRef = useRef(false);
  
  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<{hue: number, mode: ThemeMode}>({ hue: 35, mode: 'dark' });
  const [activeSidebar, setActiveSidebar] = useState<string | null>(null);
  const [initialChapterForTest, setInitialChapterForTest] = useState<Chapter | null>(null);
  const [chatContext, setChatContext] = useState<string | null>(null);

  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // Load initial state from localStorage/IndexedDB
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        const parsedTheme = JSON.parse(savedTheme);
        setTheme(parsedTheme);
      } catch (e) {
        setTheme({ hue: 35, mode: 'dark' });
        console.error("Failed to parse saved theme", e);
      }
    } else {
        setTheme({ hue: 35, mode: 'dark' });
    }

    const checkLastBook = async () => {
      try {
        const lastState = await loadActiveBookState();
        setHasLastBook(!!lastState);
      } catch (error) {
         console.error("Error checking for last book state:", error);
         setHasLastBook(false);
      }
      setAppState('uploading'); // Done checking, move to upload state
    };
    checkLastBook();
  }, []);

  // Apply theme to DOM
  useEffect(() => {
    const root = document.documentElement;
    const colorTheme = generateTheme(theme.hue, theme.mode);
    for (const [key, value] of Object.entries(colorTheme)) {
        root.style.setProperty(key, value);
    }
    if(theme.mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('appTheme', JSON.stringify(theme));
  }, [theme]);

  // Close settings menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (
            settingsMenuRef.current && 
            !settingsMenuRef.current.contains(event.target as Node) &&
            settingsButtonRef.current &&
            !settingsButtonRef.current.contains(event.target as Node)
        ) {
            setIsSettingsOpen(false);
        }
    };

    if (isSettingsOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSettingsOpen]);
  
  const handleThemeToggle = () => {
    const newMode = theme.mode === 'light' ? 'dark' : 'light';
    setTheme(prev => ({ ...prev, mode: newMode }));
  };
  
  const handleClearData = async () => {
    if (window.confirm("Are you sure you want to permanently delete all your saved data? This action cannot be undone.")) {
        await clearAllData();
        setHasLastBook(false);
        // Full reset of app state
        setAppState('uploading');
        setActiveBook(null);
        setChapters(null);
        setInteractiveContent(null);
        alert("All data has been cleared successfully.");
    }
  };
  
  const handleMenuItemClick = (action: () => void) => {
      action();
      setIsSettingsOpen(false);
  };

  const handleMobileMenuItemClick = (action: () => void) => {
    action();
    setIsMobileMenuOpen(false);
  };

  const handleFileSelect = useCallback(async (file: File) => {
    setAppState('analyzing');
    setErrorMessage('');
    
    try {
      const fileContent = await file.arrayBuffer();
      const pageTexts = await extractTextPerPage(file);
      const chapterData = await analyzeDocumentStructure(pageTexts);

      if (chapterData) {
        const newBook: SavedBook = {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: file.name,
          chapters: chapterData,
          pageTexts,
          fileContent,
        };

        if (!isSavingRef.current) {
          isSavingRef.current = true;
          await saveBook(newBook);
          const activeState = { id: newBook.id, xp: 0, chapters: newBook.chapters };
          await saveActiveBookState(activeState);
          setHasLastBook(true);
          setActiveBook(newBook);
          setChapters(newBook.chapters);
          setAppState('chapter_selection');
          isSavingRef.current = false;
        }

      } else {
        throw new Error('Failed to analyze document structure.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setAppState('error');
    }
  }, []);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
        handleFileSelect(event.target.files[0]);
        event.target.value = ''; // Reset input
    }
  };

  const triggerFileInput = () => {
      fileInputRef.current?.click();
  };
  
  const handleAnalyzeSubstructure = async (chapterIndex: number) => {
    if (!chapters || !activeBook) return;

    let chaptersCopy = JSON.parse(JSON.stringify(chapters));
    chaptersCopy[chapterIndex].isAnalyzing = true;
    setChapters(chaptersCopy);

    const chapter = chaptersCopy[chapterIndex];
    const chapterText = activeBook.pageTexts
        .filter(p => p.pageNumber >= chapter.startPage && p.pageNumber <= chapter.endPage)
        .map(p => p.text)
        .join('\n\n');

    const lessons = await analyzeChapterForLessons(chapterText, chapter);
    
    chaptersCopy = JSON.parse(JSON.stringify(chaptersCopy)); // deep copy again to ensure re-render
    chaptersCopy[chapterIndex].lessons = lessons || [];
    chaptersCopy[chapterIndex].isAnalyzing = false;
    setChapters(chaptersCopy);

    if(activeBook) {
        const updatedBook = {...activeBook, chapters: chaptersCopy};
        await saveBook(updatedBook);
        await saveActiveBookState({id: activeBook.id, xp: 0, chapters: chaptersCopy });
        setActiveBook(updatedBook);
    }
  };

  const handleGenerateInteractiveSession = useCallback(async (lesson: Lesson) => {
    if (!activeBook) return;
    setAppState('generating');
    setErrorMessage('');
    setInteractiveContent(null);
    setOriginalFullContent(null);
    setFeedback(null);
    setIsRetryMode(false);
    
    try {
      const lessonText = activeBook.pageTexts.filter(p => p.pageNumber >= lesson.startPage && p.pageNumber <= lesson.endPage).map(p => p.text).join('\n\n');
      const lessonPages = activeBook.pageTexts.filter(p => p.pageNumber >= lesson.startPage && p.pageNumber <= lesson.endPage);
      const content = await generateInteractiveLesson(lessonText, lessonPages);
      if (content) {
        setInteractiveContent(content);
        setOriginalFullContent(content);
        setAppState('session');
      } else {
        throw new Error('The AI was unable to generate interactive content for this lesson.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setAppState('error');
    }
  }, [activeBook]);
  
  const handleGenerateInitialQuestions = async () => {
    if(!interactiveContent) return;
    setIsGeneratingMore(true);
    const lessonText = interactiveContent.content.filter(b => b.type === 'explanation').map(b => (b as any).text).join('\n');
    const questions = await generateInitialQuestions(lessonText);
    if(questions && questions.length > 0) {
      setInteractiveContent(prev => prev ? ({ ...prev, content: [...prev.content, ...questions] }) : null);
      setOriginalFullContent(prev => prev ? ({ ...prev, content: [...prev.content, ...questions] }) : null);
    } else {
      alert("Failed to generate additional questions. Please try again.");
    }
    setIsGeneratingMore(false);
  };
  
  const handleGenerateMoreQuestions = async () => {
    if (!interactiveContent) return;
    setIsGeneratingMore(true);
    const lessonText = interactiveContent.content.filter(b => b.type === 'explanation').map(b => (b as any).text).join('\n');
    const existingQuestions = interactiveContent.content.filter(b => b.type.endsWith('_question'));
    const newQuestions = await generateMoreQuestions(lessonText, existingQuestions);
    if(newQuestions && newQuestions.length > 0) {
      setInteractiveContent(prev => prev ? ({...prev, content: [...prev.content, ...newQuestions] }) : null);
      setOriginalFullContent(prev => prev ? ({...prev, content: [...prev.content, ...newQuestions] }) : null);
    } else {
      alert("Failed to generate additional questions. Please try again.");
    }
    setIsGeneratingMore(false);
  };

  const handleGetDeeperExplanation = async (text: string) => {
      const explanation = await getDeeperExplanation(text);
      if (explanation && interactiveContent) {
          const newBlock: InteractiveBlock = {
              id: generateUniqueId(),
              type: 'explanation',
              text: `Additional Explanation: ${explanation}`
          };
          
          const contentCopy = [...interactiveContent.content];
          const originalBlockIndex = contentCopy.findIndex(b => b.type === 'explanation' && (b as any).text === text);
          if(originalBlockIndex !== -1){
              contentCopy.splice(originalBlockIndex + 1, 0, newBlock);
              setInteractiveContent({...interactiveContent, content: contentCopy});
          }
      } else {
          alert('Failed to get a deeper explanation.');
      }
  };

  const handleSubmitAnswers = useCallback(async (answers: UserAnswer[]) => {
    if (!interactiveContent) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const feedbackData = await getFeedbackOnAnswers(answers, interactiveContent.content.filter(c => c.type.endsWith('_question')));
      if (feedbackData) {
        setFeedback(feedbackData);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to evaluate answers.');
    } finally {
      setIsSubmitting(false);
    }
  }, [interactiveContent]);
  
  const handleAiCorrectAnswers = async () => {
    if (!feedback || !interactiveContent) return;
    
    const incorrectAnswers = feedback
        .filter(fb => !fb.isCorrect)
        .map(fb => ({
            questionId: fb.questionId,
            question: fb.question || '',
            userAnswer: fb.userAnswer || '',
        }))
        .filter(item => item.question);

    if (incorrectAnswers.length === 0) return;

    setIsCorrecting(true);
    try {
        const corrections = await getAiCorrections(incorrectAnswers);
        if (corrections) {
            const newFeedback = feedback.map(fb => {
                if (fb.isCorrect) return fb;
                const correction = corrections.find(c => c.questionId === fb.questionId);
                return correction ? { ...fb, explanation: correction.correction } : fb;
            });
            setFeedback(newFeedback);
        } else {
           alert("The AI could not provide corrections.");
        }
    } catch (error) {
        console.error("Error getting AI corrections:", error);
        alert("An error occurred while getting corrections.");
    } finally {
        setIsCorrecting(false);
    }
  };
  
  const handleRetryIncorrect = (incorrectQuestionIds: string[]) => {
      if (!originalFullContent) return;
      const incorrectQuestions = originalFullContent.content.filter(
          b => b.type.endsWith('_question') && incorrectQuestionIds.includes(b.id)
      );
      setInteractiveContent({
          ...originalFullContent,
          content: incorrectQuestions
      });
      setFeedback(null);
      setIsRetryMode(true);
  };
  
  const handleTestChapter = (chapter: Chapter) => {
    if (!activeBook) return;
    setInitialChapterForTest(chapter);
    setActiveSidebar('test_me');
  };

  const handleBackToChapters = useCallback(() => {
    setAppState('chapter_selection');
    setInteractiveContent(null);
    setFeedback(null);
    setIsRetryMode(false);
  }, []);
  
  const handleBackToUpload = useCallback(async () => {
    setIsSettingsOpen(false); // Close dropdown when going home.
    await clearActiveBookState();
    setHasLastBook(false);
    setAppState('uploading');
    setActiveBook(null);
    setChapters(null);
    setInteractiveContent(null);
    setFeedback(null);
    setIsRetryMode(false);
  }, []);

  const handleLoadLastBook = useCallback(async () => {
    setAppState('analyzing');
    const lastState = await loadActiveBookState();
    if (lastState && lastState.id) {
        const book = await getBookById(lastState.id);
        if (book) {
            setActiveBook(book);
            setChapters(book.chapters);
            setAppState('chapter_selection');
            return;
        }
    }
    // If anything fails, go back to upload
    setAppState('uploading');
  }, []);

  const onGoHome = () => {
    setActiveSidebar(null);
    setActiveView('main');
  }

  const handleOpenChat = () => {
    if (activeBook && activeBook.pageTexts) {
      const fullText = activeBook.pageTexts.map(p => p.text).join('\n\n');
      setChatContext(fullText);
    } else {
      setChatContext(null);
    }
    setActiveSidebar('chat');
  };

  const renderContent = () => {
    if (appState === 'error') {
      return (
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">{errorMessage}</p>
          <button onClick={handleBackToUpload} style={{backgroundImage: 'linear-gradient(to bottom right, #c09a3e, #856a3d)'}} className="px-6 py-2 text-white font-bold rounded-lg">Go Back</button>
        </div>
      );
    }
    
    if (appState === 'analyzing' || appState === 'generating') {
      const text = appState === 'analyzing' ? 'Analyzing...' : 'Generating Interactive Session...';
      return <LoadingSpinner text={text} />;
    }

    if (appState === 'session' && interactiveContent && activeBook) {
      return <InteractiveSession 
              content={interactiveContent}
              activeBook={activeBook}
              onSubmitAnswers={handleSubmitAnswers} 
              feedback={feedback}
              isSubmitting={isSubmitting}
              onBack={isRetryMode ? () => {
                  setInteractiveContent(originalFullContent);
                  setIsRetryMode(false);
              } : handleBackToChapters}
              backButtonText={isRetryMode ? "Back to Results" : "Back to Chapters"}
              onGenerateInitialQuestions={handleGenerateInitialQuestions}
              onGenerateMoreQuestions={handleGenerateMoreQuestions}
              isGeneratingMore={isGeneratingMore}
              isCorrecting={isCorrecting}
              isRetryMode={isRetryMode}
              onRetryIncorrect={handleRetryIncorrect}
              onGetDeeperExplanation={handleGetDeeperExplanation}
              onAiCorrectAnswers={handleAiCorrectAnswers}
             />;
    }

    if (appState === 'chapter_selection' && chapters && activeBook) {
      return <ChapterSelector 
                chapters={chapters} 
                pageTexts={activeBook.pageTexts}
                onGenerate={handleGenerateInteractiveSession}
                onBack={handleBackToUpload}
                onAnalyzeSubstructure={handleAnalyzeSubstructure}
                onTestChapter={handleTestChapter}
              />;
    }
    
    // Default to uploader
    return (
      <FileUploader 
        onStartInteractiveBook={triggerFileInput}
        onLoadLastBook={handleLoadLastBook}
        hasLastBook={hasLastBook}
        onSmartSearch={() => setActiveSidebar('smart_search')}
      />
    );
  };
  
  const mainContent = () => {
      switch (activeView) {
          case 'library': return <Library onGoHome={onGoHome} />;
          case 'tasks': return <TaskManager onRequestPurchase={() => setActiveView('purchase_request')} onGoHome={onGoHome} />;
          case 'prayer_times': return <PrayerTimes onGoHome={onGoHome} />;
          case 'calculator': return <Calculator />;
          case 'user_guide': return <UserGuide onBack={() => setActiveView('main')} onRequestPurchase={() => setActiveView('purchase_request')}/>;
          case 'purchase_request': return <PurchaseRequest onBack={() => setActiveView('main')}/>;
          case 'main':
          default:
              return renderContent();
      }
  };

  const MenuItem: React.FC<{icon: React.FC<{className?: string}>, text: string, onClick: () => void}> = ({ icon: Icon, text, onClick }) => (
    <button
        onClick={() => handleMenuItemClick(onClick)}
        className="w-full flex items-center justify-start gap-2 p-2 rounded-md text-white hover:opacity-90 transition-opacity"
        style={{
            backgroundImage: 'linear-gradient(to bottom, #a1885b, #4a2c2a)'
        }}
    >
        <Icon className="w-4 h-4 shrink-0 text-white" />
        <span className="font-semibold text-xs leading-tight">{text}</span>
    </button>
  );

  const MobileMenuItem: React.FC<{icon: React.FC<any>, text: string, onClick: () => void}> = ({ icon: Icon, text, onClick }) => (
    <button onClick={onClick} className="flex items-center gap-4 p-3 text-left w-full rounded-md hover:bg-[var(--color-background-tertiary)] transition-colors">
        <Icon className="w-6 h-6 text-[var(--color-accent-primary)]" gradientId={`mobile-menu-icon-${text.replace(/\s+/g, '-')}`} />
        <span className="font-semibold text-[var(--color-text-primary)] text-lg">{text}</span>
    </button>
  );

  return (
    <div className="min-h-screen w-full bg-[var(--color-background-primary)] text-[var(--color-text-primary)] flex flex-col relative" dir="ltr">
      <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            className="sr-only"
            accept=".pdf,.doc,.docx,image/*"
      />
      
      <header className="no-print sticky top-0 z-40 bg-[var(--color-background-primary)]/80 backdrop-blur-sm border-b border-[var(--color-border-primary)] shadow-sm">
        <div className="container mx-auto px-4 py-2 grid grid-cols-3 items-center">
            
             <div className="flex items-center justify-start gap-4">
                <button onClick={handleBackToUpload} title="Home">
                    <RomanTempleIcon className="w-12 h-12" />
                </button>
                <div className="text-left">
                    <div className="text-wavy-dark-gold animate-shimmer font-bold text-2xl" style={{ fontFamily: "'Cinzel Decorative', serif" }}>
                        Book-C
                    </div>
                </div>
            </div>

             <div className="flex items-center justify-center">
                {/* Desktop Buttons */}
                <div className="hidden md:flex items-center justify-center gap-4">
                    <button onClick={() => setActiveSidebar('edit')} title="Edit Text" className="p-2 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors"><EditIcon className="w-5 h-5" /></button>
                    <button onClick={() => setActiveSidebar('summarize')} title="Summaries" className="p-2 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors"><SummarizeIcon className="w-5 h-5" /></button>
                    <button onClick={() => setActiveSidebar('test_me')} title="Test Me" className="p-2 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors"><CheckCircleIcon className="w-5 h-5" /></button>
                    <button onClick={() => setActiveSidebar('ask_me')} title="Ask Me" className="p-2 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors"><span className="font-bold text-lg w-5 h-5 flex items-center justify-center">?</span></button>
                    <button onClick={triggerFileInput} title="Interactive Book" className="p-2 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors"><GradientBookOpenIcon className="w-6 h-6" gradientId="header-book-icon" /></button>
                    <button onClick={handleOpenChat} title="Academic Chat" className="p-2 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors"><ChatBubbleIcon className="w-5 h-5" /></button>
                    <button onClick={() => setActiveSidebar('smart_search')} title="Smart Search" className="p-2 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors"><SearchIcon className="w-5 h-5" /></button>
                </div>
                {/* Mobile Hamburger Menu Button */}
                <div className="md:hidden">
                    <button onClick={() => setIsMobileMenuOpen(prev => !prev)} className="p-2 rounded-full text-[var(--color-text-primary)] hover:bg-[var(--color-background-tertiary)] transition-colors">
                        <MenuIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>
          
            <div className="flex items-center justify-end gap-4">
                <button onClick={handleThemeToggle} title="Toggle Theme" className="p-1 rounded-full hover:bg-[var(--color-background-tertiary)] transition-colors">
                    {theme.mode === 'dark' ? <EggIcon className="w-8 h-8 rotate-180"/> : <OliveIcon className="w-8 h-8 rotate-90"/>}
                </button>
                 <div className="relative">
                <button
                  ref={settingsButtonRef}
                  onClick={() => setIsSettingsOpen(prev => !prev)}
                  className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)] transition-colors"
                  aria-label="Settings"
                >
                  <SettingsIcon className="w-8 h-8 text-wavy-dark-gold animate-shimmer" style={{ backgroundSize: '250% auto' }}/>
                </button>
                {isSettingsOpen && (
                  <div 
                    ref={settingsMenuRef}
                    className="absolute right-0 mt-2 w-[120px] rounded-lg shadow-2xl p-[2px]"
                    style={{
                      backgroundImage: 'linear-gradient(to bottom right, #c09a3e, #856a3d)',
                    }}
                  >
                    <div 
                        className="rounded-md p-2"
                        style={{
                            backgroundImage: 'var(--color-background-container-gradient)',
                        }}
                    >
                        <div className="flex flex-col gap-1">
                            <MenuItem icon={PrayerTimeIcon} text="Prayer" onClick={() => setActiveView('prayer_times')} />
                            <MenuItem icon={BookshelfIcon} text="Library" onClick={() => setActiveView('library')} />
                            <MenuItem icon={ClipboardListIcon} text="Tasks" onClick={() => setActiveView('tasks')} />
                            <MenuItem icon={SearchIcon} text="Web Search" onClick={() => setActiveSidebar('search')} />
                            <MenuItem icon={CalculatorIcon} text="Calculator" onClick={() => setActiveView('calculator')} />
                            <MenuItem icon={InfoIcon} text="Guide" onClick={() => setActiveView('user_guide')} />
                            <MenuItem icon={ShieldIcon} text="Purchase" onClick={() => setActiveView('purchase_request')} />
                        </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

        </div>
      </header>

      {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 right-0 left-0 z-30 bg-[var(--color-background-primary)] shadow-lg border-b border-[var(--color-border-primary)] no-print">
              <nav className="flex flex-col p-2">
                  <MobileMenuItem icon={SearchIcon} text="Smart Search" onClick={() => handleMobileMenuItemClick(() => setActiveSidebar('smart_search'))} />
                  <MobileMenuItem icon={BookOpenIcon} text="Interactive Book" onClick={() => handleMobileMenuItemClick(triggerFileInput)} />
                  <MobileMenuItem icon={EditIcon} text="Edit Text" onClick={() => handleMobileMenuItemClick(() => setActiveSidebar('edit'))} />
                  <MobileMenuItem icon={SummarizeIcon} text="Summaries" onClick={() => handleMobileMenuItemClick(() => setActiveSidebar('summarize'))} />
                  <MobileMenuItem icon={CheckCircleIcon} text="Test Me" onClick={() => handleMobileMenuItemClick(() => setActiveSidebar('test_me'))} />
                  <MobileMenuItem icon={QuestionMarkTextIcon} text="Ask Me" onClick={() => handleMobileMenuItemClick(() => setActiveSidebar('ask_me'))} />
                  <MobileMenuItem icon={ChatBubbleIcon} text="Academic Chat" onClick={() => handleMobileMenuItemClick(handleOpenChat)} />
              </nav>
          </div>
      )}
      
      <main className="flex-grow flex justify-center items-center p-4">
        {mainContent()}
      </main>
      
      <SearchSidebar isOpen={activeSidebar === 'search'} onClose={() => setActiveSidebar(null)} onGoHome={onGoHome} />
      <EditSidebar isOpen={activeSidebar === 'edit'} onClose={() => setActiveSidebar(null)} onGoHome={onGoHome} />
      <SummarizerSidebar isOpen={activeSidebar === 'summarize'} onClose={() => setActiveSidebar(null)} onGoHome={onGoHome} />
      <ChatSidebar isOpen={activeSidebar === 'chat'} onClose={() => setActiveSidebar(null)} onGoHome={onGoHome} context={chatContext} />
      <QuestionGeneratorSidebar isOpen={activeSidebar === 'test_me'} onClose={() => setActiveSidebar(null)} onGoHome={onGoHome} initialChapter={initialChapterForTest} initialPageTexts={activeBook?.pageTexts || null} />
      <AskMeSidebar isOpen={activeSidebar === 'ask_me'} onClose={() => setActiveSidebar(null)} onGoHome={onGoHome} />
      <SmartSearchSidebar isOpen={activeSidebar === 'smart_search'} onClose={() => setActiveSidebar(null)} onGoHome={onGoHome} />

    </div>
  );
}

export default App;