import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Chat } from '@google/genai';
import { createChat, createChatWithContext } from '../services/geminiService';
import { SendIcon, XIcon, RomanTempleIcon, ChatBubbleIcon, HomeIcon, HtmlIcon, PdfIcon, PrintIcon } from './icons';

interface ChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onGoHome: () => void;
    context: string | null;
}

type Message = {
    role: 'user' | 'model';
    text: string;
};

const ChatSidebar: React.FC<ChatSidebarProps> = ({ isOpen, onClose, onGoHome, context }) => {
    const [chat, setChat] = useState<Chat | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const goldenGradient = 'linear-gradient(to bottom right, #FBBF24, #262626)';

    useEffect(() => {
        if (isOpen) {
            if (context) {
                setChat(createChatWithContext(context));
                setMessages([{ role: 'model', text: 'Welcome! I am ready to answer questions about the current document.' }]);
            } else {
                setChat(createChat());
                setMessages([{ role: 'model', text: 'Welcome! I am NagiZ, your intelligent assistant. How can I help you today?' }]);
            }
        } else {
            setChat(null);
            setMessages([]);
            setUserInput('');
        }
    }, [isOpen, context]);
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

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

    const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!userInput.trim() || !chat || isLoading) return;

        const newUserMessage: Message = { role: 'user', text: userInput };
        setMessages(prev => [...prev, newUserMessage, { role: 'model', text: '' }]);
        setUserInput('');
        setIsLoading(true);

        try {
            const stream = await chat.sendMessageStream({ message: userInput });

            for await (const chunk of stream) {
                setMessages(prev => {
                    const lastMessage = prev[prev.length - 1];
                    if (lastMessage.role === 'model') {
                        const updatedMessages = [...prev.slice(0, -1)];
                        updatedMessages.push({ ...lastMessage, text: lastMessage.text + chunk.text });
                        return updatedMessages;
                    }
                    return prev;
                });
            }

        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'model', text: 'Sorry, an error occurred. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    }, [userInput, chat, isLoading]);

    return (
        <aside
            ref={sidebarRef}
            className={`fixed inset-0 bg-[var(--color-background-secondary)]/70 backdrop-blur-lg shadow-2xl transition-transform duration-500 ease-in-out z-50 flex flex-col ${
                isOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            aria-hidden={!isOpen}
        >
            {isOpen && (
                <>
                    <div className="flex-shrink-0 p-4 border-b border-[var(--color-border-primary)] flex justify-between items-center bg-[var(--color-background-primary)] no-print-sidebar">
                        <button onClick={onGoHome} className="p-2 rounded-lg text-white flex items-center gap-2 px-4" aria-label="Home" style={{backgroundImage: goldenGradient}}>
                            <HomeIcon className="w-6 h-6" /> <span className="font-bold">Home</span>
                        </button>
                        <h2 className="text-xl font-bold golden-text flex items-center gap-2">
                            <ChatBubbleIcon className="w-6 h-6 golden-text" /> Academic Chat
                        </h2>
                        <div className="flex items-center gap-2">
                             <button onClick={() => downloadHtml('chat-content', 'Chat Log')} title="Download HTML" className="p-2 text-white rounded-md" style={{backgroundImage: goldenGradient}}><HtmlIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Download PDF / Print" className="p-2 text-white rounded-md" style={{backgroundImage: goldenGradient}}><PdfIcon className="w-4 h-4"/></button>
                             <button onClick={handlePrint} title="Print" className="p-2 text-white rounded-md" style={{backgroundImage: goldenGradient}}><PrintIcon className="w-4 h-4"/></button>
                             <button onClick={onClose} className="p-2 rounded-full text-[var(--color-text-secondary)] hover:bg-[var(--color-background-tertiary)]" aria-label="Close">
                                <XIcon className="w-6 h-6 golden-text" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="flex-grow flex flex-col min-h-0 overflow-hidden printable-content">
                        {/* Messages Area */}
                        <div id="chat-content" className="flex-grow p-4 overflow-y-auto space-y-4" style={{ fontFamily: "'Times New Roman', serif" }}>
                            {messages.map((msg, index) => (
                                <div key={index} className={`flex items-start gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                    <div className={`max-w-xs md:max-w-md p-3 rounded-2xl ${msg.role === 'user' ? 'text-white rounded-br-none' : 'bg-yellow-500/10 text-dark-gold-gradient rounded-bl-none'}`}
                                        style={msg.role === 'user' ? {backgroundImage: goldenGradient} : {}}
                                    >
                                        <div className="flex items-start gap-2">
                                            {msg.role === 'model' && <RomanTempleIcon className="w-5 h-5 golden-text flex-shrink-0 mt-1" />}
                                            <p className="whitespace-pre-wrap">{msg.text}{isLoading && msg.role === 'model' && index === messages.length -1 && <span className="inline-block w-2 h-4 bg-current ml-1 animate-ping"></span>}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="flex-shrink-0 p-4 border-t border-[var(--color-border-primary)] bg-[var(--color-background-primary)] no-print-sidebar">
                            <form onSubmit={handleSendMessage} className="flex gap-2">
                                <input
                                    type="text"
                                    value={userInput}
                                    onChange={(e) => setUserInput(e.target.value)}
                                    placeholder="Type your question here..."
                                    disabled={isLoading}
                                    className="flex-grow p-3 bg-[var(--color-background-tertiary)] rounded-lg border border-yellow-800/30 focus:ring-2 focus:ring-yellow-600 transition text-dark-gold-gradient font-semibold"
                                />
                                <button type="submit" disabled={isLoading || !userInput.trim()} className="p-3 px-4 text-white rounded-lg shadow hover:opacity-90 disabled:opacity-50 flex items-center justify-center" style={{backgroundImage: goldenGradient}}>
                                    {isLoading ? <div className="w-6 h-6 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <SendIcon className="w-6 h-6"/>}
                                </button>
                            </form>
                        </div>
                    </div>
                </>
            )}
        </aside>
    );
};

export default ChatSidebar;