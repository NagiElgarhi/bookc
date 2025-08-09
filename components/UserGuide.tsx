import React from 'react';
import { 
    ArrowLeftIcon,
    ChatBubbleIcon,
    InfoIcon,
    RomanTempleIcon,
    SearchIcon,
    EditIcon,
} from './icons';

const Sketch: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mt-4 w-full border-t border-dashed border-[var(--color-border-secondary)] pt-4 flex justify-center">
        <div className="p-3 rounded-lg bg-[var(--color-background-secondary)] w-full max-w-md">
            {children}
        </div>
    </div>
);

const FeatureCard: React.FC<{
    icon: React.FC<{className?: string}>;
    title: string;
    description: string;
    sketch: React.ReactNode;
}> = ({ icon: Icon, title, description, sketch }) => (
    <div className="bg-[var(--color-background-primary)] p-6 rounded-2xl shadow-lg border border-[var(--color-border-primary)] flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
            <div className="flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center bg-gradient-to-br from-[#D4AF37]/20 to-[#6d4c11]/20">
                <Icon className="w-10 h-10 golden-text" />
            </div>
            <div className="flex-grow sm:text-left">
                <h3 className="text-2xl font-bold mb-2 golden-text">{title}</h3>
                <p className="text-base" style={{ color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap' }}>{description}</p>
            </div>
        </div>
        {sketch}
    </div>
);


interface UserGuideProps {
    onBack: () => void;
    onRequestPurchase: () => void;
}


const UserGuide: React.FC<UserGuideProps> = ({ onBack, onRequestPurchase }) => {

    return (
        <div className="w-full max-w-5xl mx-auto rounded-2xl p-[2px] bg-gradient-to-br from-[#D4AF37] to-[#6d4c11]">
            <div 
                className="w-full h-full text-center rounded-[calc(1rem-2px)] p-6 sm:p-8 bg-[var(--color-background-secondary)]"
            >
                <div className="flex justify-between items-center mb-8">
                    <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-base font-semibold text-white rounded-lg hover:opacity-90 transition-colors" style={{ backgroundImage: 'linear-gradient(to bottom right, #FBBF24, #262626)' }}>
                        <ArrowLeftIcon className="w-5 h-5"/>
                        <span>Back</span>
                    </button>
                    <h2 className="text-4xl font-bold golden-text flex items-center gap-3">
                        <InfoIcon className="w-10 h-10"/>
                        User Guide
                    </h2>
                    <div className="w-24"></div> {/* Spacer */}
                </div>

                <div className="text-lg text-center p-4 mb-8 bg-[var(--color-background-primary)] rounded-lg border border-[var(--color-border-primary)]">
                    <p className="font-bold text-dark-gold-gradient">Welcome to your comprehensive study assistant!</p>
                    <p className="text-base text-[var(--color-text-secondary)] mt-2">
                        This application is designed to be your smart partner on your educational journey. It doesn't just read documents; it understands them deeply. You can upload any file—whether it's a <b className="text-red-500">PDF</b>, a <b className="text-blue-500">Word</b> document, or even an <b className="text-green-500">image</b> of text—and the app will explain it to you. Have a complex musical score or difficult mathematical equations? No problem, the app can analyze various texts and explain them in a way you've never experienced before. Get ready for a unique educational experience that transforms complex materials into clear, understandable knowledge.
                    </p>
                </div>

                <div className="space-y-8">
                    <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Your Interactive Book"
                        description="Turn passive reading into an active learning experience. Start by uploading any PDF file. Our smart system will automatically analyze its structure, dividing it into logical chapters and lessons. From there, you can choose any lesson to generate a detailed, in-depth explanation of its content, enhanced with illustrative examples when needed. After grasping the explanation, you can create a variety of interactive questions (multiple choice, true/false, open-ended) to test your understanding and solidify the information. This tool is the heart of the application, designed to take you from just reading the text to interacting with it and understanding it on a deeper level, ensuring you're fully prepared for any test or discussion."
                        sketch={
                            <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="space-y-2">
                                    <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)]">Chapter 1: Introduction</div>
                                    <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)] flex justify-between items-center">
                                        <span>Lesson 1.1: History</span>
                                        <div className="px-2 py-1 text-xs bg-blue-500 text-white rounded">Generate Lesson</div>
                                    </div>
                                </div>
                            </Sketch>
                        }
                    />
                     <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Ask Me"
                        description="Imagine having an expert who has read your documents thoroughly and is ready to answer any question. That's the power of the 'Ask Me' tool. Upload any file—a complex PDF report, a Word article, or even an image of a book page—and ask your questions directly. The AI will search only within the content you've provided to give you accurate, context-based answers. No more tedious manual searching or guessing. Whether you need clarification on a point, want to find a specific piece of information, or understand the relationship between two concepts, 'Ask Me' is your fastest way to get reliable answers from your texts."
                        sketch={
                            <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)]">Q: What is the main point on page 5?</div>
                                <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-accent-info)]/10">A: Based on the text, the main point is...</div>
                            </Sketch>
                        }
                    />
                    <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Test Me"
                        description="Turn any PDF document into a powerful assessment tool. This feature is specifically designed to help you prepare for exams by converting study materials into comprehensive tests. Simply upload your file, choose the chapter you want to focus on, and the AI will generate a variety of questions covering all aspects of the content. You'll get multiple-choice, true/false, open-ended questions, and more, ensuring your understanding is tested from different angles. After answering, you'll receive an instant score with detailed AI-powered corrections for incorrect answers. It's the perfect way to gauge your knowledge and identify your weak spots before exam day."
                        sketch={
                            <Sketch>
                                 <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)]">Q: What is the capital of Egypt?</div>
                                <div className="space-y-1 mt-1">
                                    <div className="p-1 border border-[var(--color-border-secondary)] rounded text-left bg-[var(--color-background-primary)]">A) Cairo</div>
                                    <div className="p-1 border border-[var(--color-border-secondary)] rounded text-left bg-[var(--color-background-primary)]">B) Alexandria</div>
                                </div>
                            </Sketch>
                        }
                    />
                    <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Summaries"
                        description="Grasp the core concepts of any chapter in seconds. When you're in a hurry or need a quick review, the Summaries tool allows you to extract the main ideas from any long text. Upload your file, select a chapter, and the AI will read it and provide a precise and focused summary. Not only that, but you can also direct the summarization style—whether you prefer it in bullet points, a coherent paragraph, or an academic tone. All summaries you create are automatically saved to your summary library, allowing you to easily access them anytime, anywhere for a quick review before lectures or exams."
                         sketch={
                            <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)]">
                                    <p className="font-bold">Summary of Chapter 1:</p>
                                    <p className="text-sm">- The first main point...</p>
                                    <p className="text-sm">- The second main point...</p>
                                </div>
                            </Sketch>
                        }
                    />
                     <FeatureCard
                        icon={RomanTempleIcon}
                        title="Smart Search"
                        description="Search inside any uploaded document to find specific information quickly and efficiently. The AI helps you pinpoint exact phrases or concepts within your files."
                        sketch={
                            <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="relative">
                                    <input type="text" value="photosynthesis" readOnly className="w-full p-2 pl-8 bg-[var(--color-background-tertiary)] rounded-md border border-[var(--color-border-primary)]" />
                                    <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" />
                                </div>
                                <div className="mt-2 p-2 border border-dashed rounded-md text-left text-sm">...the process of <b className="bg-yellow-200 text-black px-1 rounded">photosynthesis</b> requires sunlight...</div>
                            </Sketch>
                        }
                    />
                     <FeatureCard
                        icon={RomanTempleIcon}
                        title="Web Search"
                        description="Expand your knowledge beyond the document. Use the Web Search to find relevant articles, studies, and educational videos from across the internet."
                        sketch={
                             <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)]">
                                    <p className="font-bold">Results for "Roman Empire":</p>
                                    <p className="text-sm text-blue-500 underline">- Wikipedia: The Roman Empire</p>
                                    <p className="text-sm text-blue-500 underline">- YouTube: History of Rome in 20 minutes</p>
                                </div>
                            </Sketch>
                        }
                    />
                     <FeatureCard
                        icon={RomanTempleIcon}
                        title="Edit Text"
                        description="Upload a PDF, correct text on any page, and save the updated version. This is perfect for fixing OCR errors or adding your own notes directly into the document."
                        sketch={
                             <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <textarea readOnly className="w-full h-20 p-2 font-mono bg-[var(--color-background-tertiary)] border border-dashed rounded-md">The quick brwon fox jumps ovr the lazy dog.</textarea>
                                <div className="text-center mt-1 text-xl">⬇️</div>
                                <textarea readOnly className="w-full h-20 p-2 font-mono bg-[var(--color-background-tertiary)] border border-solid border-green-500 rounded-md">The quick brown fox jumps over the lazy dog.</textarea>
                            </Sketch>
                        }
                    />
                     <FeatureCard
                        icon={RomanTempleIcon}
                        title="Academic Chat"
                        description="Have a conversation with an academic AI assistant. Ask general questions, brainstorm ideas, or get help with complex topics that aren't specific to a single document."
                        sketch={
                             <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="space-y-2 text-sm text-left">
                                    <div className="p-2 rounded-lg bg-blue-500 text-white self-end ml-10">Can you explain the theory of relativity?</div>
                                    <div className="p-2 rounded-lg bg-[var(--color-border-primary)] self-start mr-10">Certainly! The theory of relativity, developed by Albert Einstein, has two main parts...</div>
                                </div>
                            </Sketch>
                        }
                    />
                     <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Library Management"
                        description="Your smart digital library. Every book you upload and work on is automatically saved in one organized place. No need to worry about losing your work or searching for files. The AI automatically classifies your books into main and sub-categories, making it incredibly easy to browse your collection and access a specific book. You can view all your saved books, delete what you no longer need, and maintain a clean and organized workspace. Your library is the control center for all your study materials, designed to grow with you as your knowledge expands."
                        sketch={
                             <Sketch>
                                 <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="space-y-2">
                                    <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)] font-bold">History</div>
                                    <div className="p-2 border border-[var(--color-border-primary)] rounded-md text-left bg-[var(--color-background-tertiary)] pl-4"> - Ancient Egyptian History Book</div>
                                </div>
                            </Sketch>
                        }
                    />
                     <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Task Management"
                        description="Stay organized and on top of your academic priorities. This task manager is designed to emulate the best productivity apps, giving you a powerful tool to organize all your commitments. You can easily add new tasks, whether it's reading a chapter, solving a homework assignment, or preparing for an exam. Set their priority (high, medium, low), categorize them to focus your energy, and set due dates to ensure you never miss a deadline. Browse your tasks easily by filtering and grouping them intelligently. It's the perfect tool to turn chaos into a clear action plan."
                        sketch={
                             <Sketch>
                                 <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="flex items-center gap-2 p-2 border-l-4 border-red-500 rounded bg-[var(--color-background-tertiary)]">
                                    <input type="checkbox" className="w-4 h-4" />
                                    <span>Review Chapter 3 (High Priority)</span>
                                </div>
                            </Sketch>
                        }
                    />
                    <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Scientific Calculator"
                        description="A powerful tool to perform all your complex mathematical calculations without leaving the app. This calculator is designed to emulate advanced scientific calculators and is fully equipped to handle basic arithmetic, trigonometric functions (sin, cos, tan), logarithms, exponents, roots, and more. It features a professional design and an easy-to-use interface, making it the perfect companion when studying math, physics, or engineering. Whether you need to solve a quick equation or perform a multi-step calculation, this calculator provides the accuracy and power you need."
                        sketch={
                             <Sketch>
                                <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="font-mono p-3 border rounded-md bg-gray-800 text-white text-right">
                                    <div>sin(45) + log(100)</div>
                                    <div className="text-2xl">2.7071</div>
                                </div>
                            </Sketch>
                        }
                    />
                     <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Prayer Times"
                        description="Maintain your spiritual commitments with ease. This feature provides you with accurate prayer times based on your current geographical location, ensuring you never miss a prayer. A full daily schedule is displayed, including Fajr, Sunrise, Dhuhr, Asr, Maghrib, and Isha. To enhance your experience, you can activate the voice alert feature, and the app will automatically play the call to prayer (Adhan) when it's time for each prayer. This tool is designed to help you balance your studies and worship, making spiritual discipline an integral part of your daily routine."
                        sketch={
                             <Sketch>
                                 <div className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2">Illustration:</div>
                                <div className="flex justify-between p-2 border border-[var(--color-border-primary)] rounded-md bg-[var(--color-background-tertiary)]">
                                    <span>Maghrib</span>
                                    <span>07:00 PM</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <span>Enable Adhan</span>
                                    <div className="w-10 h-5 bg-green-500 rounded-full p-1 flex justify-end"><div className="w-3 h-3 bg-white rounded-full"></div></div>
                                </div>
                            </Sketch>
                        }
                    />
                    <FeatureCard 
                        icon={RomanTempleIcon}
                        title="Request Full Version"
                        description="Elevate your study tool into your own private knowledge kingdom. The full version not only frees you from the constraints of API keys but also unlocks an unparalleled learning experience: instant access, superior performance, and direct support to ensure your journey continues without any technical hurdles. This isn't just a purchase; it's a strategic investment in your future, where you get a smart partner that evolves with you, with exclusive updates and upcoming features designed to meet your highest ambitions. You're not just requesting an app; you're claiming the key to your own educational kingdom, where everything is designed to serve one goal: your absolute excellence. With one click, a new success story begins."
                        sketch={
                            <Sketch>
                                <div className="flex flex-col items-center justify-center gap-4">
                                    <button
                                        onClick={onRequestPurchase}
                                        className="mt-4 px-8 py-3 text-lg font-bold text-white rounded-lg shadow-lg bg-dark-gold-gradient animate-shimmer flex items-center justify-center transition-transform transform hover:scale-105"
                                        style={{ backgroundSize: '200% 200%' }}
                                    >
                                        Submit Purchase Request Now
                                    </button>
                                </div>
                            </Sketch>
                        }
                    />
                </div>

            </div>
        </div>
    );
};

export default UserGuide;