import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import type { Employee } from '../types';

interface AICorrectorProps {
    currentUser: Employee;
    isAIEnabled?: boolean;
}

const AICorrector: React.FC<AICorrectorProps> = ({ currentUser, isAIEnabled }) => {
    const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const [textValue, setTextValue] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [resultText, setResultText] = useState('');
    const [error, setError] = useState('');
    const widgetRef = useRef<HTMLDivElement>(null);
    const triggerBtnRef = useRef<HTMLButtonElement>(null);

    const hasAIEnabled = isAIEnabled && currentUser?.ai_api_key;

    // 1. Escutar foco em inputs e textareas do sistema
    useEffect(() => {
        if (!hasAIEnabled) return;

        const handleFocus = (e: FocusEvent) => {
            const target = e.target as HTMLElement;
            if (!target) return;

            const isInput = target.tagName === 'INPUT' && ['text', 'search'].includes((target as HTMLInputElement).type);
            const isTextarea = target.tagName === 'TEXTAREA';
            const isContentEditable = target.contentEditable === 'true';

            if (isInput || isTextarea || isContentEditable) {
                // Ignorar campos de senha, dados de e-mail puros ou de login
                if (target.tagName === 'INPUT') {
                    const inputType = (target as HTMLInputElement).type;
                    if (['password', 'number', 'date', 'time', 'checkbox', 'radio'].includes(inputType)) {
                        return;
                    }
                }
                
                // Evitar grudar no próprio input de busca do corretor se criarmos um
                if (target.id === 'ai-corrector-search') return;

                setActiveElement(target);
                updatePosition(target);
                readTextValue(target);
            }
        };

        const handleBlur = (e: FocusEvent) => {
            // Pequeno delay para permitir o clique no botão do corretor
            setTimeout(() => {
                const active = document.activeElement;
                if (
                    !active || 
                    (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA' && active.contentEditable !== 'true' && 
                     !active.closest('#ai-corrector-widget') && !active.closest('#ai-corrector-trigger'))
                ) {
                    // Só fecha se o novo elemento focado também não for um input válido
                    setActiveElement(null);
                    setIsOpen(false);
                }
            }, 250);
        };

        const handleInput = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target === activeElement) {
                readTextValue(target);
                updatePosition(target);
            }
        };

        document.addEventListener('focusin', handleFocus);
        document.addEventListener('focusout', handleBlur);
        document.addEventListener('input', handleInput);

        return () => {
            document.removeEventListener('focusin', handleFocus);
            document.removeEventListener('focusout', handleBlur);
            document.removeEventListener('input', handleInput);
        };
    }, [hasAIEnabled, activeElement]);

    // 2. Escutar eventos globais de scroll e resize para manter o botão alinhado com o input
    useEffect(() => {
        if (!activeElement) return;

        const handleScrollOrResize = () => {
            updatePosition(activeElement);
        };

        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [activeElement]);

    // Atualiza a posição do botão flutuante baseado nas coordenadas do input
    const updatePosition = (el: HTMLElement) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        
        // Posiciona no canto inferior direito do campo
        const top = rect.bottom - 28;
        const left = rect.right - 28;

        setCoords({ top, left });
    };

    // Lê o valor atual do texto no input ativo
    const readTextValue = (el: HTMLElement) => {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            setTextValue((el as HTMLInputElement).value || '');
        } else {
            setTextValue(el.innerText || '');
        }
    };

    // Aplica a correção de texto no input ativo
    const applyTextCorrection = (corrected: string) => {
        if (!activeElement) return;

        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
            const inputEl = activeElement as HTMLInputElement;
            inputEl.value = corrected;
        } else {
            activeElement.innerText = corrected;
        }

        // Dispara eventos de mudança para atualizar os bindings do React/React Hook Form
        activeElement.dispatchEvent(new Event('input', { bubbles: true }));
        activeElement.dispatchEvent(new Event('change', { bubbles: true }));
        
        setIsOpen(false);
        setActiveElement(null);
    };

    // Executa a chamada do Gemini para corrigir ou melhorar o texto
    const handleAction = async (actionType: 'correct' | 'improve') => {
        if (!textValue.trim()) return;
        setIsLoading(true);
        setError('');
        setResultText('');

        const cleanKey = currentUser.ai_api_key.trim();
        const systemPrompt = actionType === 'correct'
            ? 'Você é um revisor de texto altamente experiente em português do Brasil. Corrija qualquer erro de português, gramática, ortografia, pontuação ou concordância do texto a seguir. Retorne APENAS o texto revisado e corrigido, sem qualquer introdução, explicação ou aspas adicionais. Caso o texto já esteja correto, retorne ele exatamente como foi enviado.'
            : 'Você é um editor de textos profissional. Reescreva o texto a seguir para torná-lo mais profissional, polido, claro, coeso e fluído de ler, mantendo-o natural em português do Brasil. Retorne APENAS o texto melhorado, sem qualquer introdução, explicação ou aspas adicionais.';

        const prompt = `${systemPrompt}\n\nTexto original:\n"${textValue}"`;

        try {
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
                throw new Error(errData?.error?.message || `Erro da API (status ${response.status})`);
            }

            const data = await response.json();
            const output = data.candidates?.[0]?.content?.parts?.[0]?.text;
            
            if (output) {
                // Remover possíveis aspas externas que a IA possa ter colocado
                let cleaned = output.trim();
                if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
                    cleaned = cleaned.substring(1, cleaned.length - 1);
                }
                setResultText(cleaned);
            } else {
                throw new Error('Nenhum resultado recebido do modelo.');
            }
        } catch (err: any) {
            console.error('[AICorrector] API Error:', err);
            setError(err.message || 'Erro ao processar texto com Inteligência Artificial.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!hasAIEnabled || !activeElement || !coords || textValue.trim().length < 3) return null;

    return (
        <>
            {/* 1. Botão Flutuante (Trigger) perto do cursor do Input */}
            <button
                id="ai-corrector-trigger"
                ref={triggerBtnRef}
                style={{
                    position: 'fixed',
                    top: `${coords.top}px`,
                    left: `${coords.left}px`,
                    zIndex: 99998
                }}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                className="w-7 h-7 bg-white dark:bg-slate-800 text-emerald-500 hover:text-emerald-600 rounded-full flex items-center justify-center shadow-lg border border-emerald-100 dark:border-slate-700 transition-all duration-300 hover:scale-110 active:scale-95 group focus:outline-none"
                title="Panda IA - Melhorar ou Corrigir Escrita"
            >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 animate-pulse-slow">
                    <path d="M11.644 1.59a.75.75 0 0 1 .712 0l9.75 5.25a.75.75 0 0 1 0 1.32l-9.75 5.25a.75.75 0 0 1-.712 0l-9.75-5.25a.75.75 0 0 1 0-1.32l9.75-5.25Z" />
                    <path d="m3.265 9.602 8.167 4.4 8.167-4.4c.09.232.14.484.14.748v5.18c0 .264-.05.516-.14.748l-8.167 4.4-8.167-4.4a1.99 1.99 0 0 1-.14-.748V10.35c0-.264.05-.516.14-.748Z" />
                </svg>
            </button>

            {/* 2. Modal/Popup de Ações e Visualização */}
            {isOpen && (
                <div
                    id="ai-corrector-widget"
                    ref={widgetRef}
                    style={{
                        position: 'fixed',
                        top: `${coords.top + 34}px`,
                        left: `${Math.min(coords.left - 240, window.innerWidth - 300)}px`,
                        zIndex: 99999
                    }}
                    className="w-[280px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-700 p-3.5 flex flex-col gap-3.5 animate-fade-in-up font-sans"
                >
                    <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-1.5 text-slate-800 dark:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-emerald-500">
                                <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813A3.75 3.75 0 0 0 7.466 7.89l.813-2.846A.75.75 0 0 1 9 4.5ZM18 1.5a.75.75 0 0 1 .728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 0 1 0 1.456l-1.036.258a2.5 2.5 0 0 0-1.91 1.91l-.258 1.036a.75.75 0 0 1-1.456 0l-.258-1.036a2.5 2.5 0 0 0-1.91-1.91l-1.036-.258a.75.75 0 0 1 0-1.456l1.036-.258a2.5 2.5 0 0 0 1.91-1.91l.258-1.036A.75.75 0 0 1 18 1.5ZM16.5 15a.75.75 0 0 1 .712.513l.29 1.015c.15.529.565.943 1.094 1.094l1.015.29a.75.75 0 0 1 0 1.425l-1.015.29a1.625 1.625 0 0 0-1.094 1.094l-.29 1.015a.75.75 0 0 1-1.425 0l-.29-1.015a1.625 1.625 0 0 0-1.094-1.094l-1.015-.29a.75.75 0 0 1 0-1.425l1.015-.29a1.625 1.625 0 0 0 1.094-1.094l.29-1.015A.75.75 0 0 1 16.5 15Z" clipRule="evenodd" />
                            </svg>
                            <span className="text-xs font-bold uppercase tracking-wider">Escrita Inteligente</span>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                        >
                            Fechar
                        </button>
                    </div>

                    {!resultText && !isLoading && !error && (
                        <div className="flex flex-col gap-2">
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">Escolha como a Inteligência Artificial deve reescrever o texto digitado:</p>
                            <button
                                onClick={() => handleAction('correct')}
                                className="w-full flex items-center gap-2 p-2 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-700/50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold text-left transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900/55"
                            >
                                <span>✍️</span>
                                <div>
                                    <p className="font-bold">Corrigir Gramática</p>
                                    <p className="text-[9px] opacity-75 font-normal">Ajusta ortografia e pontuações do texto.</p>
                                </div>
                            </button>
                            <button
                                onClick={() => handleAction('improve')}
                                className="w-full flex items-center gap-2 p-2 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-700/50 dark:hover:bg-emerald-950/20 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold text-left transition-colors border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900/55"
                            >
                                <span>✨</span>
                                <div>
                                    <p className="font-bold">Melhorar Linguagem</p>
                                    <p className="text-[9px] opacity-75 font-normal">Torna a mensagem mais clara e profissional.</p>
                                </div>
                            </button>
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400">
                            <div className="w-6 h-6 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                            <span className="text-[10px] uppercase font-bold tracking-widest animate-pulse">Panda IA trabalhando...</span>
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col gap-2 text-center py-1">
                            <span className="text-[10px] text-red-500 bg-red-50 dark:bg-red-950/30 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30 leading-snug">
                                {error}
                            </span>
                            <div className="flex justify-end gap-1.5 mt-1.5">
                                <button
                                    onClick={() => { setError(''); setResultText(''); }}
                                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-md hover:bg-slate-200"
                                >
                                    Voltar
                                </button>
                            </div>
                        </div>
                    )}

                    {resultText && (
                        <div className="flex flex-col gap-3">
                            <div className="bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 max-h-[140px] overflow-y-auto custom-scrollbar">
                                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">Sugestão de Cópia:</p>
                                <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{resultText}</p>
                            </div>
                            <div className="flex justify-end gap-1.5">
                                <button
                                    onClick={() => { setResultText(''); }}
                                    className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded-md hover:bg-slate-200"
                                >
                                    Descartar
                                </button>
                                <button
                                    onClick={() => applyTextCorrection(resultText)}
                                    className="px-3 py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-md hover:bg-emerald-600 shadow-sm"
                                >
                                    Aplicar Texto
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default AICorrector;
