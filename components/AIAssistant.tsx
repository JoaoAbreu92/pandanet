import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee, AIMessage } from '../types';
import { XMarkIcon, PaperAirplaneIcon, SparklesIcon, ChevronDownIcon, TrashIcon } from './icons';

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
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [messageLimit, setMessageLimit] = useState(50);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const previousScrollHeight = useRef<number>(0);
    const shouldScrollToBottom = useRef<boolean>(true);
    const [pandaIaIcon, setPandaIaIcon] = useState<string | null>(null);

    // Only render if User has an API key AND the Company has AI allowed.
    const hasAIEnabled = isAIEnabled && currentUser.ai_api_key;
    const behavior = currentUser.ai_behavior || 'popup';
    const provider = currentUser.ai_provider || 'gemini';

    const [agents, setAgents] = useState<any[]>([]);
    const [currentAgent, setCurrentAgent] = useState<any>(null);
    const [showAgentManager, setShowAgentManager] = useState(false);
    const [newAgentName, setNewAgentName] = useState('');
    const [newAgentPrompt, setNewAgentPrompt] = useState('');

    // Tooltip state
    const [showTooltip, setShowTooltip] = useState(false);
    const [tooltipDismissed, setTooltipDismissed] = useState(false);

    useEffect(() => {
        if (hasAIEnabled) {
            fetchMessages();
            fetchAgents();
            fetchSystemSettings();
        }
    }, [hasAIEnabled, currentUser.id]);

    const fetchSystemSettings = async () => {
        const { data } = await supabase.from('system_settings').select('key, value').eq('key', 'panda_ia_icon').single();
        if (data?.value) setPandaIaIcon(data.value);
    };

    useEffect(() => {
        if (!isOpen && !tooltipDismissed) {
            const timer = setInterval(() => {
                setShowTooltip(prev => !prev); // Toggle or re-trigger to catch attention
                setTimeout(() => setShowTooltip(true), 100);
            }, 10000);
            return () => clearInterval(timer);
        }
    }, [isOpen, tooltipDismissed]);

    const fetchAgents = async () => {
        try {
            const { data, error } = await supabase
                .from('ai_agents')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: true });

            if (error) {
                console.error("Supabase Error (fetchAgents):", error);
                throw error;
            }
            if (data) setAgents(data);
        } catch (err: any) {
            console.error("Error fetching AI agents:", err);
        }
    };

    const [isCreating, setIsCreating] = useState(false);

    const createAgent = async () => {
        if (!newAgentName || isCreating) return;
        setIsCreating(true);
        try {
            const { data, error } = await supabase.from('ai_agents').insert({
                user_id: currentUser.id,
                name: newAgentName,
                system_prompt: newAgentPrompt,
                avatar_url: '/logo.png'
            }).select().single();

            if (error) throw error;

            if (data) {
                setAgents(prev => [...prev, data]);
                setNewAgentName('');
                setNewAgentPrompt('');
                setShowAgentManager(false);
                setCurrentAgent(data);
            }
        } catch (err: any) {
            console.error("Error creating AI agent:", err);
            alert("Erro ao criar agente: " + (err.message || "Tente novamente."));
        } finally {
            setIsCreating(false);
        }
    };

    const deleteAgent = async (id: string) => {
        await supabase.from('ai_agents').delete().eq('id', id);
        setAgents(prev => prev.filter(a => a.id !== id));
        if (currentAgent?.id === id) setCurrentAgent(null);
    };

    useEffect(() => {
        if (shouldScrollToBottom.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        } else {
            // Restore scroll position after prepending items
            if (scrollContainerRef.current && previousScrollHeight.current > 0) {
                const heightDiff = scrollContainerRef.current.scrollHeight - previousScrollHeight.current;
                scrollContainerRef.current.scrollTop = heightDiff;
                previousScrollHeight.current = 0; // reset
            }
        }
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen) {
            shouldScrollToBottom.current = true;
            messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
        }
    }, [isOpen]);

    const fetchMessages = async (limit = messageLimit) => {
        try {
            let query = supabase
                .from('ai_messages')
                .select('*')
                .eq('user_id', currentUser.id);

            if (currentAgent) {
                query = query.eq('agent_id', currentAgent.id);
            } else {
                query = query.is('agent_id', null);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(limit + 1);
            
            if (error) {
                console.error("Supabase Error (fetchMessages):", error);
                throw error;
            }
            if (data) {
                const hasMore = data.length > limit;
                setHasMoreMessages(hasMore);
                const messagesToShow = hasMore ? data.slice(0, limit) : data;
                setMessages(messagesToShow.reverse());
            }
        } catch (err: any) {
            console.error("Error fetching AI messages:", err);
        }
    };

    const loadOlderMessages = async () => {
        if (isLoadingOlder || !hasMoreMessages) return;
        setIsLoadingOlder(true);
        shouldScrollToBottom.current = false;
        
        if (scrollContainerRef.current) {
            previousScrollHeight.current = scrollContainerRef.current.scrollHeight;
        }

        const newLimit = messageLimit + 50;
        setMessageLimit(newLimit);
        await fetchMessages(newLimit);
        setIsLoadingOlder(false);
    };

    useEffect(() => {
        if (hasAIEnabled) {
            shouldScrollToBottom.current = true;
            setMessageLimit(50);
            fetchMessages(50);
        }
    }, [currentAgent]);

    const handleSend = async () => {
        if (!input.trim() || !hasAIEnabled) return;

        const userText = input.trim();
        setInput('');
        setIsLoading(true);

        // Optimistic update
        shouldScrollToBottom.current = true;
        
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
            const { error: insertError } = await supabase.from('ai_messages').insert({
                user_id: currentUser.id,
                role: 'user',
                content: userText,
                agent_id: currentAgent?.id || null
            });

            if (insertError) {
                console.error("Supabase Error (saveMessage):", insertError);
            }

            // Call API
            let aiResponseText = '';
            
            if (provider === 'gemini') {
                const cleanKey = currentUser.ai_api_key.trim();

                const systemPrompt = currentAgent?.system_prompt || "Você é o Panda IA, um assistente prestativo da intranet PandaNet.";
                const prompt = `System Instructions: ${systemPrompt}\n\nUser Question: ${userText}`;

                // Using the specific v1beta endpoint structure exactly as documented in Google AI Studio
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${cleanKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: prompt
                            }]
                        }]
                    })
                });
                
                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error("Gemini Error Details:", errData);
                    throw new Error(`Gemini API error: ${response.status} - ${errData?.error?.message || 'Erro desconhecido'}`);
                }
                const data = await response.json();
                aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Desculpe, não consegui processar sua mensagem.";
                
            } else if (provider === 'openai') {
                const cleanKey = currentUser.ai_api_key.trim();
                const systemPrompt = currentAgent?.system_prompt || "Você é o Panda IA, um assistente prestativo da intranet PandaNet.";
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${cleanKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-4o',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userText }
                        ]
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    console.error("OpenAI Error Details:", errData);
                    throw new Error(`OpenAI API error: ${response.status} - ${errData?.error?.message || 'Erro desconhecido'}`);
                }
                const data = await response.json();
                aiResponseText = data.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
            }

            // Save AI message to DB
            const { data: insertedAiMsg } = await supabase.from('ai_messages').insert({
                user_id: currentUser.id,
                role: 'assistant',
                content: aiResponseText,
                agent_id: currentAgent?.id || null
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
                    created_at: new Date().toISOString(),
                    agent_id: currentAgent?.id || null
                }]);
            }

        } catch (err: any) {
            console.error("AI Assistant Error:", err);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                user_id: currentUser.id,
                role: 'assistant',
                content: `Ocorreu um erro ao processar sua mensagem. Detalhe técnico: ${err.message}`,
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
                <div className="flex items-center space-x-3 cursor-pointer group" onClick={() => setShowAgentManager(!showAgentManager)}>
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden border-2 border-emerald-500 group-hover:scale-110 transition-transform">
                        <img src={currentAgent?.avatar_url || pandaIaIcon || "/logo.png"} alt="Panda AI" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                            {currentAgent?.name || "Panda IA"}
                            <ChevronDownIcon className="w-3 h-3 text-slate-400 group-hover:text-emerald-500" />
                        </h3>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Online e pronto para ajudar</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={toggleOpen} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <XMarkIcon className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Agent Manager Overlay */}
            {showAgentManager && (
                <div className="absolute inset-0 z-20 bg-black/40 animate-fade-in flex items-start justify-center pt-16 p-4">
                    <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl p-4 overflow-hidden flex flex-col max-h-[70%]">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold dark:text-white uppercase text-xs tracking-widest text-slate-500">Agentes de IA</h4>
                            <button onClick={() => setShowAgentManager(false)}><XMarkIcon className="w-4 h-4 text-slate-400" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-2 mb-4 custom-scrollbar">
                            <button
                                onClick={() => { setCurrentAgent(null); setShowAgentManager(false); }}
                                className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${!currentAgent ? 'bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'}`}
                            >
                                <img src="/logo.png" className="w-8 h-8 object-contain" />
                                <div className="text-left">
                                    <p className="text-sm font-bold dark:text-white">Panda IA (Padrão)</p>
                                    <p className="text-[10px] text-slate-500">Assistente geral</p>
                                </div>
                            </button>

                            {agents.map(agent => (
                                <div key={agent.id} className="group relative">
                                    <button
                                        onClick={() => { setCurrentAgent(agent); setShowAgentManager(false); }}
                                        className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentAgent?.id === agent.id ? 'bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700' : 'hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'}`}
                                    >
                                        <img src={agent.avatar_url} className="w-8 h-8 rounded-full object-cover bg-slate-100" />
                                        <div className="text-left">
                                            <p className="text-sm font-bold dark:text-white">{agent.name}</p>
                                            <p className="text-[10px] text-slate-500 truncate max-w-[180px]">{agent.system_prompt}</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => deleteAgent(agent.id)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-all"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="border-t dark:border-slate-700 pt-4 space-y-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Criar Novo Agente</p>
                            <input
                                type="text"
                                placeholder="Nome do Agente"
                                value={newAgentName}
                                onChange={e => setNewAgentName(e.target.value)}
                                className="w-full text-xs p-2.5 rounded-lg border dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                            <textarea
                                placeholder="Instruções / Personalidade"
                                value={newAgentPrompt}
                                onChange={e => setNewAgentPrompt(e.target.value)}
                                className="w-full text-xs p-2.5 rounded-lg border dark:border-slate-700 dark:bg-slate-900 dark:text-white resize-none"
                                rows={2}
                            />
                            <button
                                onClick={createAgent}
                                disabled={!newAgentName || isCreating}
                                className="w-full bg-emerald-600 text-white py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isCreating ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Criando...
                                    </>
                                ) : 'Criar Agente'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <div 
                ref={scrollContainerRef}
                onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    if (target.scrollTop === 0 && hasMoreMessages) {
                        loadOlderMessages();
                    }
                }}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
                {isLoadingOlder && (
                    <div className="flex justify-center py-2">
                        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin"></div>
                    </div>
                )}
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
            <div className="fixed z-50 right-6 bottom-6 flex flex-col items-end gap-3">
                {showTooltip && (
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-2xl shadow-2xl border border-emerald-100 dark:border-emerald-900/50 flex items-center gap-2 animate-bounce-slow relative whitespace-nowrap">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Precisa de ajuda?</p>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowTooltip(false); setTooltipDismissed(true); }}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"
                        >
                            <XMarkIcon className="w-3 h-3" />
                        </button>
                        {/* Tooltip Tail */}
                        <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-white dark:bg-slate-800 border-r border-b border-emerald-100 dark:border-emerald-900/50 rotate-45"></div>
                    </div>
                )}
                <button
                    onClick={() => toggleOpen()}
                    className="w-16 h-16 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.4)] hover:scale-110 active:scale-95 transition-all duration-500 bg-white border-4 border-emerald-50/50 overflow-hidden flex items-center justify-center p-0 group cursor-pointer"
                >
                    <div className="w-full h-full flex items-center justify-center bg-white rounded-full overflow-hidden">
                        {(pandaIaIcon?.toLowerCase().endsWith('.mp4') || pandaIaIcon?.toLowerCase().endsWith('.webm') || pandaIaIcon?.toLowerCase().endsWith('.mov')) ? (
                            <video
                                src={pandaIaIcon}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                        ) : (
                            <img
                                src={pandaIaIcon || "/logo.png"}
                                alt="Panda IA" 
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                            />
                        )}
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-sm"></span>
                    </span>
                </button>
            </div>
        );
    }

    // Render Behavior Specific Open View
    if (behavior === 'sidebar') {
        return (
            <div className="fixed inset-y-0 right-0 w-[calc(100vw-2rem)] sm:w-[400px] md:w-[450px] z-[100] animate-slide-in-right">
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
