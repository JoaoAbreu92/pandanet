import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee, AIMessage } from '../types';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon } from './icons';

interface AIAssistantProps {
    currentUser: Employee;
    isAIEnabled?: boolean;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ currentUser, isAIEnabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Only render if User has an API key AND the Company has AI allowed.
    const hasAIEnabled = isAIEnabled && currentUser.ai_api_key;
    const behavior = currentUser.ai_behavior || 'popup';
    const provider = currentUser.ai_provider || 'gemini';

    useEffect(() => {
        if (hasAIEnabled) {
            fetchMessages();
        }
    }, [hasAIEnabled, currentUser.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isOpen]);

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_messages')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: true });
            
            if (error) throw error;
            if (data) setMessages(data);
        } catch (err) {
            console.error("Error fetching AI messages:", err);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || !hasAIEnabled) return;

        const userText = input.trim();
        setInput('');
        setIsLoading(true);

        // Optimistic update
        const newUserMsg: AIMessage = {
            id: Date.now().toString(),
            user_id: currentUser.id,
            role: 'user',
            content: userText,
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, newUserMsg]);

        try {
            // Save user message to DB
            await supabase.from('ai_messages').insert({
                user_id: currentUser.id,
                role: 'user',
                content: userText
            });

            // Call API
            let aiResponseText = '';
            
            if (provider === 'gemini') {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${currentUser.ai_api_key}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: userText }] }]
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Gemini API error: ${response.status}`);
                }
                const data = await response.json();
                aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua mensagem.";
                
            } else if (provider === 'openai') {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${currentUser.ai_api_key}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [{ role: 'user', content: userText }]
                    })
                });

                if (!response.ok) {
                    throw new Error(`OpenAI API error: ${response.status}`);
                }
                const data = await response.json();
                aiResponseText = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
            }

            // Save AI message to DB
            const { data: insertedAiMsg } = await supabase.from('ai_messages').insert({
                user_id: currentUser.id,
                role: 'assistant',
                content: aiResponseText
            }).select().single();

            if (insertedAiMsg) {
                setMessages(prev => [...prev, insertedAiMsg]);
            } else {
                // Fallback local update
                setMessages(prev => [...prev, {
                    id: (Date.now() + 1).toString(),
                    user_id: currentUser.id,
                    role: 'assistant',
                    content: aiResponseText,
                    created_at: new Date().toISOString()
                }]);
            }

        } catch (err: any) {
            console.error("AI Assistant Error:", err);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                user_id: currentUser.id,
                role: 'assistant',
                content: "Ocorreu um erro ao processar sua mensagem. Verifique se sua API Key é autêntica e possui saldo.",
                created_at: new Date().toISOString()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!hasAIEnabled) return null;

    const toggleOpen = () => setIsOpen(!isOpen);

    const renderChatBox = () => (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 border-l border-t border-slate-200 dark:border-slate-800 shadow-2xl">
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden border-2 border-emerald-500">
                        <img src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdvMnAxaXNid28xb3VyeWh1anZlcmkxdGk0MmxjOHV2dDNlbnIzZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/iU18n02qI9A5qf63fQ/giphy.webp" alt="Panda AI" className="w-8 h-8 object-contain" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">Panda IA</h3>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Online e pronto para ajudar</p>
                    </div>
                </div>
                <button onClick={toggleOpen} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <XMarkIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-slate-500 dark:text-slate-400 mt-10 space-y-3">
                        <SparklesIcon className="w-12 h-12 mx-auto text-emerald-300 dark:text-emerald-600/50" />
                        <p>Olá! Eu sou o Panda IA. Como posso ajudar com seu trabalho hoje?</p>
                    </div>
                )}
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                            msg.role === 'user' 
                                ? 'bg-emerald-600 text-white rounded-br-none' 
                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none shadow-sm'
                        }`}>
                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                            <span className={`text-[10px] mt-2 block ${msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400'}`}>
                                {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex items-center space-x-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex items-end space-x-2"
                >
                    <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Pergunte ao Panda IA..."
                        className="flex-1 max-h-32 min-h-[44px] border border-slate-200 dark:border-slate-600 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-700 dark:text-white resize-none"
                        rows={1}
                    />
                    <button 
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        <PaperAirplaneIcon className="w-5 h-5 -rotate-45" />
                    </button>
                </form>
                <div className="text-center mt-2">
                    <span className="text-[10px] text-slate-400">Panda IA pode cometer erros. Considere verificar as informações.</span>
                </div>
            </div>
        </div>
    );

    // Render Floating Button when closed
    if (!isOpen) {
        return (
            <button 
                onClick={toggleOpen}
                className="fixed bottom-6 right-6 z-50 p-0 rounded-full shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 bg-white border-2 border-emerald-500"
            >
                <img 
                    src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExcDdvMnAxaXNid28xb3VyeWh1anZlcmkxdGk0MmxjOHV2dDNlbnIzZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/iU18n02qI9A5qf63fQ/giphy.webp" 
                    alt="Panda IA" 
                    className="w-16 h-16 object-contain p-1" 
                />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
                </span>
            </button>
        );
    }

    // Render Behavior Specific Open View
    if (behavior === 'sidebar') {
        return (
            <div className="fixed inset-y-0 right-0 w-[calc(100vw-2rem)] sm:w-[400px] md:w-[450px] z-50 animate-slide-in-right">
                {renderChatBox()}
            </div>
        );
    }

    if (behavior === 'tab') {
        // Tab behavior is actually fullscreen overlay in this simplified version to avoid routing setup, 
        // but feels like a "tab/page" to the user.
        return (
            <div className="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 animate-fade-in flex justify-center">
                <div className="w-full max-w-4xl h-full shadow-2xl">
                    {renderChatBox()}
                </div>
            </div>
        );
    }

    // Default to Popup
    return (
        <div className="fixed bottom-6 right-2 sm:right-6 w-[calc(100vw-1rem)] sm:w-[400px] h-[600px] max-h-[80vh] z-50 rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up border border-slate-200 dark:border-slate-700">
            {renderChatBox()}
        </div>
    );
};

export default AIAssistant;
