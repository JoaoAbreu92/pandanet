import React, { createContext, useContext, useRef, useState, ReactNode } from 'react';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; message: string; type: ToastType; }
interface ToastContextType { showToast: (message: string, type?: ToastType) => void; }
const ToastContext = createContext<ToastContextType | undefined>(undefined);

const appearance: Record<ToastType, { icon: React.FC<any>; accent: string; label: string }> = {
    success: { icon: CheckCircleIcon, accent: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10', label: 'Sucesso' },
    error: { icon: XCircleIcon, accent: 'text-rose-500 bg-rose-50 dark:bg-rose-500/10', label: 'Erro' },
    info: { icon: InformationCircleIcon, accent: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10', label: 'Informação' },
    warning: { icon: ExclamationTriangleIcon, accent: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10', label: 'Atenção' }
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);
    const dismiss = (id: number) => setToasts(current => current.filter(toast => toast.id !== id));

    const showToast = (message: string, type: ToastType = 'success') => {
        const id = ++nextId.current;
        setToasts(current => [...current.slice(-3), { id, message, type }]);
        window.setTimeout(() => dismiss(id), 4500);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="pointer-events-none fixed inset-x-3 top-3 z-[9999] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:top-5 sm:w-[min(24rem,calc(100vw-2.5rem))]" aria-live="polite" aria-atomic="false">
                {toasts.map(toast => {
                    const config = appearance[toast.type];
                    const Icon = config.icon;
                    return (
                        <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#101d2e]">
                            <div className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl ${config.accent}`}><Icon className="h-5 w-5" /></div>
                            <div className="min-w-0 flex-1 pt-0.5"><p className="text-xs font-bold text-slate-900 dark:text-white">{config.label}</p><p className="mt-0.5 text-sm leading-5 text-slate-600 dark:text-slate-300">{toast.message}</p></div>
                            <button type="button" onClick={() => dismiss(toast.id)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white" aria-label="Fechar aviso">✕</button>
                        </div>
                    );
                })}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) throw new Error('useToast must be used within a ToastProvider');
    return context;
};
