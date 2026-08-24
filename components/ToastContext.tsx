import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'; // Using same icons as project

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: ToastType = 'success') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000); // 3 seconds
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transform transition-all duration-500 animate-slide-in-right
                            ${toast.type === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-l-4 border-white/30' : ''}
                            ${toast.type === 'error' ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white border-l-4 border-white/30' : ''}
                            ${toast.type === 'info' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-l-4 border-white/30' : ''}
                            ${toast.type === 'warning' ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white border-l-4 border-white/30' : ''}
                        `}
                    >
                        {toast.type === 'success' && <CheckCircleIcon className="w-6 h-6 text-white animate-bounce-short" />}
                        {toast.type === 'error' && <XCircleIcon className="w-6 h-6 text-white" />}
                        {toast.type === 'info' && <InformationCircleIcon className="w-6 h-6 text-white" />}
                        {toast.type === 'warning' && <ExclamationTriangleIcon className="w-6 h-6 text-white" />}

                        <p className="font-bold text-sm tracking-wide shadow-black drop-shadow-sm">{toast.message}</p>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
