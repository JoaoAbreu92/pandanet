import React, { useEffect, useRef } from 'react';
import { ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon, TrashIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
    isOpen: boolean; title: string; message: string; confirmText?: string; cancelText?: string;
    onConfirm: () => void; onCancel: () => void; type?: 'danger' | 'warning' | 'info' | 'success';
}
const styles = {
    danger: { icon: TrashIcon, tone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10', button: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500/25' },
    warning: { icon: ExclamationTriangleIcon, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10', button: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-500/25' },
    info: { icon: InformationCircleIcon, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10', button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/25' },
    success: { icon: CheckCircleIcon, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10', button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/25' }
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm, onCancel, type = 'warning' }) => {
    const cancelRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (!isOpen) return;
        cancelRef.current?.focus();
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', escape);
        return () => window.removeEventListener('keydown', escape);
    }, [isOpen, onCancel]);
    if (!isOpen) return null;

    const config = styles[type];
    const Icon = config.icon;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[3px]" onMouseDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_30px_80px_-24px_rgba(2,6,23,0.55)] dark:border-white/10 dark:bg-[#101d2e] sm:p-6">
                <div className="flex items-start gap-4"><div className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl ${config.tone}`}><Icon className="h-6 w-6" /></div><div className="min-w-0 flex-1"><h3 id="confirm-title" className="text-lg font-semibold text-slate-950 dark:text-white">{title}</h3><p id="confirm-message" className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p></div></div>
                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button ref={cancelRef} type="button" onClick={onCancel} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-4 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10">{cancelText}</button>
                    <button type="button" onClick={onConfirm} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-4 ${config.button}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
