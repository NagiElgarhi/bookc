

import { ActiveBookState, SavedBook, SavedSummary, Task, CustomTaskCategory } from '../types';

const DB_NAME = 'LearnWithNagizDB';
const DB_VERSION = 6; // Incremented version for new task categories store
const META_STORE_NAME = 'metaStore';
const BOOKS_STORE_NAME = 'savedBooksStore';
const SUMMARIES_STORE_NAME = 'savedSummariesStore';
const TASKS_STORE_NAME = 'tasksStore';
const TASK_CATEGORIES_STORE_NAME = 'taskCategoriesStore';
const ACTIVE_BOOK_KEY = 'active_book_state';

let db: IDBDatabase | null = null;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Error opening IndexedDB:', request.error);
            reject(new Error('Failed to open the database.'));
        };

        request.onsuccess = (event) => {
            db = (event.target as IDBOpenDBRequest).result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const tempDb = (event.target as IDBOpenDBRequest).result;
            if (tempDb.objectStoreNames.contains('sessionStore')) {
                tempDb.deleteObjectStore('sessionStore');
            }
             if (!tempDb.objectStoreNames.contains(META_STORE_NAME)) {
                tempDb.createObjectStore(META_STORE_NAME);
            }
            if (!tempDb.objectStoreNames.contains(BOOKS_STORE_NAME)) {
                tempDb.createObjectStore(BOOKS_STORE_NAME, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(SUMMARIES_STORE_NAME)) {
                tempDb.createObjectStore(SUMMARIES_STORE_NAME, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(TASKS_STORE_NAME)) {
                tempDb.createObjectStore(TASKS_STORE_NAME, { keyPath: 'id' });
            }
            if (!tempDb.objectStoreNames.contains(TASK_CATEGORIES_STORE_NAME)) {
                tempDb.createObjectStore(TASK_CATEGORIES_STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

// --- Active Book State Management ---

export const saveActiveBookState = async (state: ActiveBookState): Promise<void> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(META_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(META_STORE_NAME);
        store.put(state, ACTIVE_BOOK_KEY);
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Failed to save active book state:', error);
    }
};

export const loadActiveBookState = async (): Promise<ActiveBookState | null> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(META_STORE_NAME, 'readonly');
        const store = transaction.objectStore(META_STORE_NAME);
        const request = store.get(ACTIVE_BOOK_KEY);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Failed to load active book state:', error);
        return null;
    }
};

export const clearActiveBookState = async (): Promise<void> => {
     try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(META_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(META_STORE_NAME);
        store.delete(ACTIVE_BOOK_KEY);
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    } catch (error) {
        console.error('Failed to clear active book state:', error);
    }
};

export const clearAllData = async (): Promise<void> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction([META_STORE_NAME, BOOKS_STORE_NAME, SUMMARIES_STORE_NAME, TASKS_STORE_NAME, TASK_CATEGORIES_STORE_NAME], 'readwrite');
        transaction.objectStore(META_STORE_NAME).clear();
        transaction.objectStore(BOOKS_STORE_NAME).clear();
        transaction.objectStore(SUMMARIES_STORE_NAME).clear();
        transaction.objectStore(TASKS_STORE_NAME).clear();
        transaction.objectStore(TASK_CATEGORIES_STORE_NAME).clear();

         return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                 console.error('Transaction error on clear all data:', transaction.error);
                 reject(transaction.error)
            };
        });
    } catch (error) {
        console.error('Failed to clear all data:', error);
    }
};

// --- Saved Books (Library) Management ---

export const saveBook = async (bookData: SavedBook): Promise<void> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(BOOKS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(BOOKS_STORE_NAME);
        store.put(bookData);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                console.error('Transaction error on save book:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('Failed to save book:', error);
    }
};

export const getBookById = async (bookId: string): Promise<SavedBook | null> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(BOOKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(BOOKS_STORE_NAME);
        const request = store.get(bookId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error(`Failed to get book by id ${bookId}:`, error);
        return null;
    }
};

export const loadAllSavedBooks = async (): Promise<SavedBook[]> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(BOOKS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(BOOKS_STORE_NAME);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result ? (request.result as SavedBook[]) : []);
            };
            request.onerror = () => {
                console.error('Request error on load all books:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to load all books:', error);
        return [];
    }
};

export const deleteBook = async (bookId: string): Promise<void> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(BOOKS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(BOOKS_STORE_NAME);
        store.delete(bookId);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                console.error('Transaction error on delete book:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('Failed to delete book:', error);
    }
};


// --- Saved Summaries (Library) Management ---

export const saveSummary = async (summaryData: SavedSummary): Promise<void> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(SUMMARIES_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SUMMARIES_STORE_NAME);
        store.put(summaryData);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                console.error('Transaction error on save summary:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('Failed to save summary:', error);
    }
};

export const loadAllSavedSummaries = async (): Promise<SavedSummary[]> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(SUMMARIES_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SUMMARIES_STORE_NAME);
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result ? (request.result as SavedSummary[]) : []);
            };
            request.onerror = () => {
                console.error('Request error on load all summaries:', request.error);
                reject(request.error);
            };
        });
    } catch (error) {
        console.error('Failed to load all summaries:', error);
        return [];
    }
};

export const deleteSummary = async (summaryId: string): Promise<void> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(SUMMARIES_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SUMMARIES_STORE_NAME);
        store.delete(summaryId);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                console.error('Transaction error on delete summary:', transaction.error);
                reject(transaction.error);
            };
        });
    } catch (error) {
        console.error('Failed to delete summary:', error);
    }
};

export const deleteSummariesByBookName = async (bookName: string): Promise<void> => {
    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(SUMMARIES_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SUMMARIES_STORE_NAME);
        const request = store.openCursor();
        
        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                if (cursor.value.bookName === bookName) {
                    cursor.delete();
                }
                cursor.continue();
            }
        };

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => {
                console.error(`Transaction error on deleting summaries for book "${bookName}":`, transaction.error);
                reject(transaction.error);
            };
        });

    } catch (error) {
        console.error(`Failed to delete summaries for book "${bookName}":`, error);
    }
};

// --- Task Management ---

export const saveTask = async (task: Task): Promise<void> => {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(TASKS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TASKS_STORE_NAME);
    store.put(task);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const loadAllTasks = async (): Promise<Task[]> => {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(TASKS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(TASKS_STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.createdAt - a.createdAt));
        request.onerror = () => reject(request.error);
    });
};

export const deleteTask = async (taskId: string): Promise<void> => {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(TASKS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TASKS_STORE_NAME);
    store.delete(taskId);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

// --- Task Category Management ---

export const loadAllTaskCategories = async (): Promise<CustomTaskCategory[]> => {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(TASK_CATEGORIES_STORE_NAME, 'readonly');
    const store = transaction.objectStore(TASK_CATEGORIES_STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
};

export const saveTaskCategory = async (category: CustomTaskCategory): Promise<void> => {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(TASK_CATEGORIES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TASK_CATEGORIES_STORE_NAME);
    store.put(category);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const deleteTaskCategory = async (categoryId: string): Promise<void> => {
    const dbInstance = await openDB();
    const transaction = dbInstance.transaction(TASK_CATEGORIES_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(TASK_CATEGORIES_STORE_NAME);
    store.delete(categoryId);
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const ensureDefaultCategories = async (): Promise<void> => {
    const defaultCategories: CustomTaskCategory[] = [
        { id: 'study', name: 'Study' },
        { id: 'homework', name: 'Homework' },
        { id: 'review', name: 'Review' },
        { id: 'exam', name: 'Exam' },
        { id: 'personal', name: 'Personal' },
    ];

    try {
        const dbInstance = await openDB();
        const transaction = dbInstance.transaction(TASK_CATEGORIES_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(TASK_CATEGORIES_STORE_NAME);

        const promises = defaultCategories.map(cat => {
            return new Promise<void>((resolve, reject) => {
                const getRequest = store.get(cat.id);
                getRequest.onsuccess = () => {
                    if (!getRequest.result) { // Only add if it doesn't exist
                        const addRequest = store.add(cat);
                        addRequest.onsuccess = () => resolve();
                        addRequest.onerror = () => reject(addRequest.error);
                    } else {
                        resolve();
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        });
        await Promise.all(promises);

    } catch (error) {
        console.error("Failed to ensure default categories:", error);
    }
};