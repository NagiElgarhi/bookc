import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { loadAllSavedBooks, deleteBook, deleteSummariesByBookName } from '../services/dbService';
import { categorizeBooks } from '../services/geminiService';
import { SavedBook, AiBookCategory } from '../types';
import { TrashIcon, BookshelfIcon, DownloadIcon, RefreshIcon, HomeIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface LibraryProps {
    onGoHome: () => void;
}

export const Library: React.FC<LibraryProps> = ({ onGoHome }) => {
    const [books, setBooks] = useState<SavedBook[]>([]);
    const [categories, setCategories] = useState<AiBookCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeCategory, setActiveCategory] = useState<string | null>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';

    const fetchAndCategorizeBooks = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setCategories([]);
        try {
            const savedBooks = await loadAllSavedBooks();
            setBooks(savedBooks);

            if (savedBooks.length > 0) {
                const bookTitles = savedBooks.map(b => ({ id: b.id, name: b.name }));
                const categorizedResult = await categorizeBooks(bookTitles);
                if (categorizedResult) {
                    setCategories(categorizedResult);
                    if (categorizedResult.length > 0) {
                        setActiveCategory(categorizedResult[0].category);
                    }
                } else {
                    // Create a default category if AI fails
                    setCategories([{
                        category: "Uncategorized Books",
                        subCategories: [{ subCategory: "General", books: savedBooks.map(b => b.name) }]
                    }]);
                    setActiveCategory("Uncategorized Books");
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load or categorize the library.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAndCategorizeBooks();
    }, [fetchAndCategorizeBooks]);

    const handleDelete = async (bookName: string) => {
        const bookToDelete = books.find(b => b.name === bookName);
        if (!bookToDelete) return;

        if (window.confirm(`Are you sure you want to delete "${bookName}"? All associated summaries will also be deleted.`)) {
            try {
                await deleteBook(bookToDelete.id);
                await deleteSummariesByBookName(bookToDelete.name);
                // Refresh library view
                fetchAndCategorizeBooks();
            } catch (err) {
                 setError(err instanceof Error ? err.message : "Failed to delete the book.");
            }
        }
    };
    
    const handleDownload = (book: SavedBook) => {
        if (!book) return;

        const title = book.name;
        const htmlString = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; line-height: 1.6; padding: 2rem; margin: auto; max-width: 800px; background-color: #fdfdfd; color: #111; }
                    h1 { font-size: 2rem; font-weight: bold; text-align: center; margin-bottom: 2rem; color: #b8860b; }
                    .page { margin-bottom: 2rem; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; background-color: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
                    .page-header { font-weight: bold; color: #555; border-bottom: 1px solid #eee; margin-bottom: 0.5rem; padding-bottom: 0.5rem;}
                    .page-content { white-space: pre-wrap; }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                ${book.pageTexts.map(page => `
                    <div class="page">
                        <div class="page-header">Page ${page.pageNumber}</div>
                        <p class="page-content">${page.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
                    </div>
                `).join('')}
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

    const booksByName = useMemo(() => {
        return books.reduce((acc, book) => {
            acc[book.name] = book;
            return acc;
        }, {} as Record<string, SavedBook>);
    }, [books]);

    return (
        <div 
            className="w-full max-w-5xl h-full rounded-2xl shadow-2xl flex flex-col"
            style={{ backgroundImage: 'var(--color-background-container-gradient)' }}
        >
            <header className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center">
                <button onClick={onGoHome} className="flex items-center gap-2 px-4 py-2 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{backgroundImage: goldenGradient}}>
                    <HomeIcon className="w-5 h-5"/>
                    <span>Home</span>
                </button>
                <h2 className="text-2xl font-bold golden-text flex items-center gap-3">
                    <BookshelfIcon className="w-7 h-7 golden-text" />
                    Library Management
                </h2>
                 <button 
                    onClick={fetchAndCategorizeBooks} 
                    disabled={isLoading || books.length === 0}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-lg shadow-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' }}
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <RefreshIcon className="w-5 h-5" />
                    )}
                    <span>Re-categorize Books</span>
                </button>
            </header>

            <main className="flex-grow p-1 md:p-2 flex flex-col min-h-0">
                {isLoading ? (
                    <div className="flex-grow flex items-center justify-center">
                        <LoadingSpinner text="Loading and categorizing your library..." />
                    </div>
                ) : error ? (
                    <div className="p-6 text-center text-red-500">{error}</div>
                ) : books.length === 0 ? (
                     <div className="flex-grow flex items-center justify-center text-center text-[var(--color-text-secondary)]">
                        <p className="text-lg">Your library is currently empty. <br/>Start a new journey to save books here.</p>
                    </div>
                ) : (
                   <div className="flex flex-col h-full">
                       {/* Main Category Tabs */}
                       <nav className="flex-shrink-0 border-b-2 border-[var(--color-border-primary)]">
                           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-2">
                            {categories.map(cat => (
                                <button 
                                    key={cat.category}
                                    onClick={() => setActiveCategory(cat.category)}
                                    className={`px-4 py-2 text-sm font-bold rounded-t-lg whitespace-nowrap transition-colors duration-200 ${activeCategory === cat.category ? 'text-white' : 'bg-transparent text-gold-brown hover:bg-[var(--color-background-tertiary)]'}`}
                                    style={activeCategory === cat.category ? { backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' } : {}}
                                >
                                    {cat.category}
                                </button>
                            ))}
                           </div>
                       </nav>

                       {/* Content */}
                       <div className="flex-grow p-4 overflow-y-auto space-y-6">
                           {categories.find(c => c.category === activeCategory)?.subCategories.map(subCat => (
                               <div key={subCat.subCategory}>
                                   <h3 className="text-lg font-bold golden-text border-l-4 border-[var(--color-accent-info)] pl-3 mb-3">
                                       {subCat.subCategory}
                                   </h3>
                                   <ul className="space-y-2">
                                       {subCat.books.map(bookName => (
                                           <li key={bookName} dir="auto" className="flex justify-between items-center p-3 bg-[var(--color-background-primary)] rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                               <span className="font-semibold text-base text-start" style={{color: 'var(--color-text-brown-dark)'}}>{bookName}</span>
                                                <div className="flex items-center gap-2">
                                                    <button 
                                                        onClick={() => handleDownload(booksByName[bookName])} 
                                                        className="p-2 text-white rounded-full transition-opacity hover:opacity-90"
                                                        style={{ backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' }}
                                                        title={`Download ${bookName}`}
                                                    >
                                                        <DownloadIcon className="w-5 h-5"/>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(bookName)}
                                                        className="p-2 text-white rounded-full transition-opacity hover:opacity-90"
                                                        style={{ backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' }}
                                                        title={`Delete ${bookName}`}
                                                    >
                                                        <TrashIcon className="w-5 h-5"/>
                                                    </button>
                                                </div>
                                           </li>
                                       ))}
                                   </ul>
                               </div>
                           ))}
                       </div>
                   </div>
                )}
            </main>
        </div>
    );
};