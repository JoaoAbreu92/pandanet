import React, { useState, useEffect, useRef } from 'react';
import type { Employee } from '../types';

interface HRCalculatorAIProps {
    currentUser: Employee;
    isAIEnabled?: boolean;
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

const HRCalculatorAI: React.FC<HRCalculatorAIProps> = ({ currentUser, isAIEnabled = true }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const hasAIEnabled = isAIEnabled && currentUser?.ai_api_key;
    const provider = currentUser?.ai_provider || 'gemini';

    const systemPrompt = `Você é o Assistente Especialista em Cálculos de RH e Departamento Pessoal da PandaNet. Seu principal objetivo é ajudar com cálculos trabalhistas brasileiros (CLT), como:
1. Hora Extra (adicionais de 50%, 100% ou outros específicos).
2. Férias Proporcionais e cálculo do terço constitucional.
3. Décimo Terceiro Salário Proporcional.
4. Rescisão CLT (Saldo de salário, aviso prévio indenizado ou trabalhado, décimo terceiro proporcional, férias proporcionais + 1/3, multa do FGTS).
5. Descontos obrigatórios de INSS e IRRF (use alíquotas progressivas oficiais vigentes).
6. Adicionais de Insalubridade, Periculosidade e Adicional Noturno.

Siga estas diretrizes estritas nas respostas:
- Mostre SEMPRE o passo a passo da matemática.
- Apresente as fórmulas de forma clara (ex: "Valor da hora normal = Salário / Horas mensais").
- Formate todos os valores monetários em Real brasileiro (R$).
- Seja extremamente organizado(a), usando tabelas Markdown e listas estruturadas para facilitar a leitura.
- Se faltarem variáveis essenciais para o cálculo (como salário bruto, carga horária, dias trabalhados, etc.), solicite-as educadamente.
- Finalize com uma observação informando que as simulações são de caráter demonstrativo e o usuário deve validar as informações finais com o Departamento de Pessoal (DP).`;

    const suggestions = [
        {
            label: 'Calcular Hora Extra',
            prompt: 'Calcular valor de 5 horas extras com 50% de acréscimo para um salário bruto de R$ 3.000,00 e carga horária de 220h mensais.'
        },
        {
            label: 'Férias Proporcionais',
            prompt: 'Calcular férias proporcionais de 8 meses trabalhados com salário bruto de R$ 2.500,00, incluindo o 1/3 constitucional.'
        },
        {
            label: '13º Proporcional',
            prompt: 'Calcular 13º salário proporcional para 7 meses trabalhados com salário de R$ 4.000,00.'
        },
        {
            label: 'Simular Rescisão CLT',
            prompt: 'Simular rescisão CLT por pedido de demissão. Admissão: 10/01/2025, Afastamento: 15/07/2025. Salário bruto: R$ 3.200,00, sem férias vencidas.'
        },
        {
            label: 'Descontos INSS/IRRF',
            prompt: 'Calcular o desconto aproximado de INSS e IRRF para um salário bruto de R$ 5.000,00.'
        }
    ];

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    role: 'assistant',
                    content: 'Olá! Sou o seu Assistente de Cálculos de RH. Posso simular cálculos de horas extras, rescisões, férias, décimo terceiro, descontos de INSS/IRRF e muito mais. \n\nEscolha uma das sugestões abaixo ou descreva o cálculo que você deseja realizar!',
                    timestamp: new Date()
                }
            ]);
        }
    }, [isOpen]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (textToSend: string) => {
        if (!textToSend.trim()) return;
        if (!hasAIEnabled) {
            setError('Para utilizar a calculadora por IA, adicione sua Chave de API nas configurações do seu Perfil.');
            return;
        }

        setError(null);
        setIsLoading(true);

        const newUserMsg: Message = {
            role: 'user',
            content: textToSend,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, newUserMsg]);
        setInput('');

        try {
            const cleanKey = currentUser.ai_api_key!.trim();
            let aiResponseText = '';

            if (provider === 'gemini') {
                const prompt = `Instruções do Sistema: ${systemPrompt}\n\nPergunta/Solicitação de Cálculo do Usuário: ${textToSend}`;
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${cleanKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{ text: prompt }]
                        }]
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData?.error?.message || `Erro Gemini (status ${response.status})`);
                }

                const data = await response.json();
                aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui calcular. Tente novamente.';
            } else {
                // OpenAI
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
                            { role: 'user', content: textToSend }
                        ]
                    })
                });

                if (!response.ok) {
                    const errData = await response.json().catch(() => ({}));
                    throw new Error(errData?.error?.message || `Erro OpenAI (status ${response.status})`);
                }

                const data = await response.json();
                aiResponseText = data.choices?.[0]?.message?.content || 'Desculpe, não consegui calcular. Tente novamente.';
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: aiResponseText,
                timestamp: new Date()
            }]);

        } catch (err: any) {
            console.error('HR Calculator AI Error:', err);
            setError(`Ocorreu um erro no processamento: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = (text: string, index: number) => {
        navigator.clipboard.writeText(text);
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    const clearChat = () => {
        setMessages([
            {
                role: 'assistant',
                content: 'Chat limpo! Como posso ajudar você com novos cálculos trabalhistas agora?',
                timestamp: new Date()
            }
        ]);
        setError(null);
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 font-bold text-xs uppercase tracking-wider group border border-emerald-400/20"
                title="Assistente de Cálculos de RH por IA"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 animate-bounce group-hover:scale-110">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-3-3.675v3.675m-3-3v3M21.75 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span>Calculadora IA</span>
            </button>

            {/* Sliding Drawer Panel */}
            {isOpen && (
                <div className="fixed inset-0 z-50 overflow-hidden font-sans">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsOpen(false)}
                    />

                    <div className="absolute inset-y-0 right-0 max-w-full flex">
                        <div className="w-screen max-w-md md:max-w-lg bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full transform transition-all duration-300 animate-slide-in-right border-l border-slate-100 dark:border-slate-800">
                            
                            {/* Drawer Header */}
                            <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between shadow-md">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-white/10 rounded-xl">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-emerald-100">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-3-3.675v3.675m-3-3v3M21.75 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h2 className="text-base font-extrabold tracking-wide uppercase">Cálculos Trabalhistas</h2>
                                        <p className="text-[10px] text-emerald-100 font-medium">Assistente de Inteligência Artificial</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={clearChat}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition-colors"
                                        title="Limpar Conversa"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-1.5 hover:bg-white/10 rounded-lg text-emerald-100 hover:text-white transition-colors"
                                        title="Fechar"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 space-y-4 custom-scrollbar">
                                {messages.map((msg, index) => (
                                    <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed relative group ${
                                            msg.role === 'user'
                                                ? 'bg-emerald-600 text-white rounded-tr-none'
                                                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-850 rounded-tl-none'
                                        }`}>
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                            
                                            {/* Copy Button */}
                                            {msg.role === 'assistant' && (
                                                <button
                                                    onClick={() => copyToClipboard(msg.content, index)}
                                                    className="absolute top-2 right-2 p-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-650 rounded border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Copiar resultado"
                                                >
                                                    {copiedIndex === index ? (
                                                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold px-1">Copiado!</span>
                                                    ) : (
                                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-3a2.251 2.251 0 0 0-2.15 1.588M16.25 7.5v10.5a1.5 1.5 0 0 1-1.5 1.5H6.75a1.5 1.5 0 0 1-1.5-1.5V7.5m11 0h-11m11 0a1.125 1.125 0 0 0-1.125-1.125h-8.75c-.621 0-1.125.504-1.125 1.125V7.5" />
                                                        </svg>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                        <span className="text-[9px] text-slate-400 mt-1 px-1">
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-850 w-24">
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></div>
                                    </div>
                                )}

                                {error && (
                                    <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-xl border border-red-150 dark:border-red-900/30 text-xs font-semibold leading-relaxed">
                                        {error}
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>

                            {/* Suggestions list */}
                            {messages.length <= 1 && (
                                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-900">
                                    <p className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider mb-2">Simulações frequentes</p>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.map((sug, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(sug.prompt)}
                                                disabled={isLoading}
                                                className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 text-xs font-bold rounded-lg border border-slate-200/60 dark:border-slate-750 transition-colors shadow-sm disabled:opacity-50"
                                            >
                                                {sug.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Drawer Footer Input */}
                            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-850">
                                <form
                                    onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSend(input);
                                    }}
                                    className="flex gap-2"
                                >
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Perguntar cálculo (ex: hora extra, rescisão...)"
                                        disabled={isLoading}
                                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 dark:text-slate-100 disabled:opacity-60"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !input.trim()}
                                        className="p-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md disabled:opacity-40 transition-colors flex items-center justify-center"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                                        </svg>
                                    </button>
                                </form>
                                <div className="text-center mt-2">
                                    <span className="text-[10px] text-slate-400">
                                        Os valores são aproximados com base nas regras da CLT.
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default HRCalculatorAI;
