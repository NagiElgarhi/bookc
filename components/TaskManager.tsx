import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Task, CustomTaskCategory, TaskCategory } from '../types';
import { loadAllTasks, saveTask, deleteTask, loadAllTaskCategories, saveTaskCategory, deleteTaskCategory, ensureDefaultCategories } from '../services/dbService';
import { XIcon, ClipboardListIcon, TrashIcon, EditIcon, InboxIcon, CalendarIcon, CheckCircleIcon, HomeIcon } from './icons';
import LoadingSpinner from './LoadingSpinner';

interface TaskManagerProps {
    onRequestPurchase: () => void;
    onGoHome: () => void;
}

const priorityMap: Record<Task['priority'], { label: string; color: string }> = {
    high: { label: 'عالية', color: 'border-red-500' },
    medium: { label: 'متوسطة', color: 'border-yellow-500' },
    low: { label: 'منخفضة', color: 'border-green-500' },
};

const defaultCategories: CustomTaskCategory[] = [
    { id: 'study', name: 'دراسة' },
    { id: 'homework', name: 'واجب' },
    { id: 'review', name: 'مراجعة' },
    { id: 'exam', name: 'امتحان' },
    { id: 'personal', name: 'شخصي' },
];

const TaskManager: React.FC<TaskManagerProps> = ({ onRequestPurchase, onGoHome }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';

    // Filters & Categories
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [customCategories, setCustomCategories] = useState<CustomTaskCategory[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');

    const allCategories = useMemo(() => {
        const defaultIds = new Set(defaultCategories.map(c => c.id));
        const uniqueCustomCategories = customCategories.filter(c => !defaultIds.has(c.id));
        return [...defaultCategories, ...uniqueCustomCategories];
    }, [customCategories]);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        try {
            await ensureDefaultCategories();
            const [loadedTasks, loadedCategories] = await Promise.all([
                loadAllTasks(),
                loadAllTaskCategories(),
            ]);
            setTasks(loadedTasks);
            setCustomCategories(loadedCategories);
        } catch (err) {
            setError("فشل تحميل البيانات.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (taskToEdit !== null && dialog && !dialog.open) {
            dialog.showModal();
        } else if (taskToEdit === null && dialog && dialog.open) {
            dialog.close();
        }
    }, [taskToEdit]);
    
    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim() || allCategories.find(c => c.name === newCategoryName.trim())) return;
        const newCat: CustomTaskCategory = { id: newCategoryName.trim().toLowerCase().replace(/\s+/g, '-'), name: newCategoryName.trim() };
        await saveTaskCategory(newCat);
        setNewCategoryName('');
        await fetchAllData();
    };

    const handleDeleteCategory = async (categoryId: string) => {
        if (defaultCategories.some(c => c.id === categoryId)) {
            alert("لا يمكن حذف الفئات الافتراضية.");
            return;
        }
        if (window.confirm("هل أنت متأكد من حذف هذه الفئة؟")) {
            await deleteTaskCategory(categoryId);
            setCategoryFilter('all'); // Reset filter if active category is deleted
            await fetchAllData();
        }
    };

    const handleAddTask = () => setTaskToEdit({} as Task);
    const handleEditTask = (task: Task) => setTaskToEdit(task);

    const handleDeleteTask = async (id: string) => {
        if (window.confirm("هل أنت متأكد من حذف هذه المهمة؟")) {
            await deleteTask(id);
            await fetchAllData();
        }
    };

    const handleToggleComplete = async (task: Task) => {
        await saveTask({ ...task, completed: !task.completed });
        await fetchAllData();
    };

    const handleFormSave = async (taskData: Omit<Task, 'id' | 'createdAt' | 'completed'>) => {
        const taskToSave: Task = taskToEdit?.id
            ? { ...taskToEdit, ...taskData }
            : { id: `${Date.now()}`, createdAt: Date.now(), completed: false, ...taskData };
        await saveTask(taskToSave);
        await fetchAllData();
        setTaskToEdit(null);
    };

    const groupedTasks = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const soonStart = new Date(tomorrowStart);
        soonStart.setDate(soonStart.getDate() + 1);
        const laterStart = new Date(soonStart);
        laterStart.setDate(laterStart.getDate() + 7);

        const filtered = tasks.filter(task => 
            (statusFilter === 'all' || (statusFilter === 'pending' && !task.completed) || (statusFilter === 'completed' && task.completed)) &&
            (categoryFilter === 'all' || task.category === categoryFilter)
        );

        const groups: Record<string, Task[]> = { 'متأخرة': [], 'اليوم': [], 'غداً': [], 'قريباً': [], 'لاحقاً': [], 'مكتملة': [] };

        filtered.forEach(task => {
            if (task.completed) {
                groups['مكتملة'].push(task);
                return;
            }
            const dueDate = new Date(task.dueDate + 'T00:00:00'); // Ensure we compare dates only
            if (dueDate < todayStart) groups['متأخرة'].push(task);
            else if (dueDate.getTime() === todayStart.getTime()) groups['اليوم'].push(task);
            else if (dueDate.getTime() === tomorrowStart.getTime()) groups['غداً'].push(task);
            else if (dueDate < laterStart) groups['قريباً'].push(task);
            else groups['لاحقاً'].push(task);
        });
        
        if (statusFilter === 'pending') delete groups['مكتملة'];
        if (statusFilter === 'completed') {
            const completedOnly = { 'مكتملة': groups['مكتملة'] };
            Object.keys(groups).forEach(key => key !== 'مكتملة' && delete groups[key]);
            return completedOnly;
        }

        Object.keys(groups).forEach(key => groups[key].length === 0 && delete groups[key]);
        return groups;
    }, [tasks, statusFilter, categoryFilter]);

    return (
        <div className="w-full max-w-7xl h-full rounded-2xl shadow-2xl flex flex-col">
            <div className="bg-[var(--color-background-primary)] w-full h-full rounded-2xl shadow-2xl flex flex-col">
                <header className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center">
                    <button onClick={onGoHome} className="flex items-center gap-2 px-4 py-2 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{backgroundImage: goldenGradient}}>
                        <HomeIcon className="w-5 h-5"/>
                        <span>الرئيسية</span>
                    </button>
                    <h2 className="text-2xl font-bold golden-text flex items-center gap-3">
                        <ClipboardListIcon className="w-7 h-7" /> إدارة المهام
                    </h2>
                    <div className="w-32"></div> {/* Spacer to keep title centered */}
                </header>
                <div className="flex-grow flex flex-row min-h-0">
                    <nav className="w-64 border-l border-[var(--color-border-primary)] p-4 flex-shrink-0 flex flex-col gap-4 bg-[var(--color-background-secondary)]">
                        <button onClick={handleAddTask} className="w-full px-4 py-3 text-white font-bold rounded-lg shadow-md hover:opacity-90 transition-opacity" style={{ backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' }}>+ مهمة جديدة</button>
                        <SidebarSection title="الحالة">
                            <SidebarButton icon={InboxIcon} text="كل المهام" isActive={statusFilter === 'all'} onClick={() => setStatusFilter('all')} count={tasks.length} />
                            <SidebarButton icon={CalendarIcon} text="قيد التنفيذ" isActive={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')} count={tasks.filter(t => !t.completed).length} />
                            <SidebarButton icon={CheckCircleIcon} text="مكتملة" isActive={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} count={tasks.filter(t => t.completed).length} />
                        </SidebarSection>
                        <SidebarSection title="الفئات">
                            <CategoryButton text="كل الفئات" isActive={categoryFilter === 'all'} onClick={() => setCategoryFilter('all')} />
                            {allCategories.map(cat => (
                                <CategoryButton key={cat.id} text={cat.name} isActive={categoryFilter === cat.id} onClick={() => setCategoryFilter(cat.id)} count={tasks.filter(t => t.category === cat.id).length} onDelete={!defaultCategories.some(c => c.id === cat.id) ? () => handleDeleteCategory(cat.id) : undefined}/>
                            ))}
                            <form onSubmit={handleAddCategory} className="flex gap-1 mt-2">
                                <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="فئة جديدة..." className="flex-grow p-1 text-sm bg-[var(--color-background-tertiary)] border border-[var(--color-border-secondary)] rounded-md"/>
                                <button type="submit" className="p-1 px-2 text-xs text-white bg-green-600 rounded-md">+</button>
                            </form>
                        </SidebarSection>
                    </nav>
                    <main className="flex-grow p-4 flex flex-col min-h-0">
                        {isLoading ? <div className="flex-grow flex items-center justify-center"><LoadingSpinner text="تحميل المهام..." /></div>
                         : error ? <div className="p-6 text-center text-red-500">{error}</div>
                         : (
                            <>
                                <div className="flex-grow overflow-y-auto space-y-6 pr-2">
                                    {Object.keys(groupedTasks).length > 0 ? Object.entries(groupedTasks).map(([groupName, groupTasks]) => (
                                        <div key={groupName}>
                                            <h3 className="font-bold text-xl mb-2 text-dark-gold-gradient">{groupName} ({groupTasks.length})</h3>
                                            <div className="space-y-2">
                                                {groupTasks.map(task => (
                                                    <div key={task.id} className={`bg-[var(--color-background-primary)] rounded-lg flex items-center gap-3 transition-all duration-300 border-r-4 ${priorityMap[task.priority].color} ${task.completed ? 'opacity-60' : 'shadow'}`}>
                                                        <div className="p-4"><input type="checkbox" checked={task.completed} onChange={() => handleToggleComplete(task)} className="w-6 h-6 text-green-600 bg-gray-100 border-gray-300 rounded-full focus:ring-green-500" /></div>
                                                        <div className="flex-grow py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8c6d1f] animate-shimmer" style={{ backgroundSize: '200% 200%' }}></div>
                                                                <p className={`font-bold text-lg text-dark-gold-gradient ${task.completed ? 'line-through' : ''}`}>{task.title}</p>
                                                            </div>
                                                            <p className="text-sm text-gold-brown ml-4">{task.description}</p>
                                                            <p className="text-xs text-gold-brown font-semibold mt-1 ml-4">الاستحقاق: {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                                        </div>
                                                        <div className="flex-shrink-0 flex items-center gap-1 p-3">
                                                            <button onClick={() => handleEditTask(task)} className="p-2 text-[var(--color-text-secondary)] hover:text-blue-500 transition-colors rounded-full hover:bg-blue-500/10"><EditIcon className="w-5 h-5"/></button>
                                                            <button onClick={() => handleDeleteTask(task.id)} className="p-2 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10"><TrashIcon className="w-5 h-5"/></button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )) : <p className="text-center text-lg text-gold-brown pt-16">لا توجد مهام تطابق الفلتر الحالي. <br/> أضف مهمة جديدة للبدء!</p>}
                                </div>
                                <div className="flex-shrink-0 mt-8 pt-6 border-t border-dashed border-[var(--color-border-primary)] text-center">
                                    <h4 className="text-xl font-bold golden-text">الترقية إلى النسخة الكاملة</h4>
                                    <p className="text-gold-brown mt-2 max-w-lg mx-auto">
                                        للحصول على تجربة متكاملة بدون الحاجة لإدارة مفتاح API الخاص بك، يمكنك طلب شراء النسخة الكاملة عبر صفحة الشراء المخصصة.
                                    </p>
                                    <button
                                        onClick={onRequestPurchase}
                                        className="mt-4 px-6 py-2 text-white font-bold rounded-lg shadow-md bg-dark-gold-gradient animate-shimmer flex items-center justify-center transition-transform transform hover:scale-105"
                                        style={{ backgroundSize: '200% 200%' }}
                                    >
                                        الانتقال إلى صفحة الشراء
                                    </button>
                                </div>
                            </>
                        )}
                    </main>
                </div>
            </div>
            <TaskFormDialog ref={dialogRef} task={taskToEdit} categories={allCategories} onSave={handleFormSave} onClose={() => setTaskToEdit(null)} />
        </div>
    );
};

const SidebarSection: React.FC<{title: string, children: React.ReactNode}> = ({title, children}) => (
    <div className="space-y-1">
        <h3 className="px-3 pt-2 text-xs font-semibold text-gold-brown uppercase tracking-wider">{title}</h3>
        {children}
    </div>
);

const SidebarButton: React.FC<{icon: React.FC<{className?: string}>, text: string, count: number, isActive: boolean, onClick: () => void}> = ({ icon: Icon, text, count, isActive, onClick }) => (
    <button onClick={onClick} className={`w-full flex justify-between items-center p-3 rounded-lg text-base font-semibold transition-colors ${isActive ? 'bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]' : 'hover:bg-[var(--color-border-primary)]/50'}`}>
        <div className="flex items-center gap-3 text-dark-gold-gradient"><Icon className="w-5 h-5" /><span>{text}</span></div>
        <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? 'bg-[var(--color-accent-primary)] text-white' : 'bg-[var(--color-border-primary)]'}`}>{count}</span>
    </button>
);

const CategoryButton: React.FC<{ text: string, count?: number, isActive: boolean, onClick: () => void, onDelete?: () => void }> = ({ text, count, isActive, onClick, onDelete }) => (
    <button onClick={onClick} className={`group w-full flex justify-between items-center p-3 rounded-lg text-base font-semibold transition-colors ${isActive ? 'bg-[var(--color-accent-primary)]/10 text-[var(--color-accent-primary)]' : 'hover:bg-[var(--color-border-primary)]/50'}`}>
        <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#8c6d1f] animate-shimmer" style={{ backgroundSize: '200% 200%' }}></div>
            <span className="text-dark-gold-gradient">{text}</span>
        </div>
        <div className="flex items-center gap-2">
            {onDelete && <TrashIcon onClick={(e) => { e.stopPropagation(); onDelete(); }} className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500" />}
            {typeof count !== 'undefined' && <span className="text-xs text-gold-brown">{count}</span>}
        </div>
    </button>
);


const TaskFormDialog = React.forwardRef<HTMLDialogElement, {task: Task | null, categories: CustomTaskCategory[], onSave: (task: Omit<Task, 'id' | 'createdAt' | 'completed'>) => void, onClose: () => void}>(({ task, categories, onSave, onClose }, ref) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<Task['priority']>('medium');
    const [category, setCategory] = useState<TaskCategory>('study');
    const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (task) {
            setTitle(task.title || '');
            setDescription(task.description || '');
            setPriority(task.priority || 'medium');
            setCategory(task.category || 'study');
            setDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        }
    }, [task]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        onSave({ title, description, priority, category, dueDate });
    };
    
    useEffect(() => {
        const dialog = (ref as React.RefObject<HTMLDialogElement>)?.current;
        const handler = (event: Event) => event.preventDefault();
        dialog?.addEventListener('cancel', handler);
        return () => dialog?.removeEventListener('cancel', handler);
    }, [ref]);

    if (!task) return null;

    return (
        <dialog ref={ref} className="bg-transparent p-0 rounded-lg shadow-xl backdrop:bg-black/40">
             <div className="bg-[var(--color-background-primary)] rounded-lg w-full max-w-lg">
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <h3 className="text-xl font-bold mb-4 text-dark-gold-gradient">{task.id ? 'تعديل المهمة' : 'مهمة جديدة'}</h3>
                    <input type="text" placeholder="عنوان المهمة" value={title} onChange={e => setTitle(e.target.value)} required className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-md border border-[var(--color-border-primary)]" />
                    <textarea placeholder="وصف المهمة (اختياري)" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-md border border-[var(--color-border-primary)]" rows={3}></textarea>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-semibold mb-1 text-gold-brown">الأولوية</label>
                            <select value={priority} onChange={e => setPriority(e.target.value as any)} className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-md border border-[var(--color-border-primary)]">
                                {Object.entries(priorityMap).map(([key, {label}]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                        </div>
                         <div>
                            <label className="text-sm font-semibold mb-1 text-gold-brown">الفئة</label>
                            <select value={category} onChange={e => setCategory(e.target.value as any)} className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-md border border-[var(--color-border-primary)]">
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-semibold mb-1 text-gold-brown">تاريخ الاستحقاق</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required className="w-full p-2 bg-[var(--color-background-tertiary)] rounded-md border border-[var(--color-border-primary)]"/>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border-primary)] mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-black rounded-md">إلغاء</button>
                        <button type="submit" className="px-6 py-2 text-white rounded-md" style={{ backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' }}>{task.id ? 'حفظ' : 'إضافة'}</button>
                    </div>
                </form>
             </div>
        </dialog>
    );
});

export default TaskManager;