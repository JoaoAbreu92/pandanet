import React from 'react';
import { ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon, TrashIcon } from '@heroicons/react/24/outline';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'danger' | 'warning' | 'info' | 'success';
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    onConfirm,
    onCancel,
    type = 'warning'
}) => {
    if (!isOpen) return null;

    const styles = {
        danger: {
            icon: <TrashIcon className="w-10 h-10 text-red-500" />,
            bgId: 'bg-red-50',
            btnConfirm: 'bg-red-600 hover:bg-red-700 text-white',
            btnCancel: 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        },
        warning: {
            icon: <ExclamationTriangleIcon className="w-10 h-10 text-amber-500" />,
            bgId: 'bg-amber-50',
            btnConfirm: 'bg-amber-500 hover:bg-amber-600 text-white',
            btnCancel: 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        },
        info: {
            icon: <InformationCircleIcon className="w-10 h-10 text-blue-500" />,
            bgId: 'bg-blue-50',
            btnConfirm: 'bg-blue-600 hover:bg-blue-700 text-white',
            btnCancel: 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        },
        success: {
            icon: <CheckCircleIcon className="w-10 h-10 text-emerald-500" />,
            bgId: 'bg-emerald-50',
            btnConfirm: 'bg-emerald-600 hover:bg-emerald-700 text-white',
            btnCancel: 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }
    };

    const currentStyle = styles[type];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-scale-in">
                <div className="flex flex-col items-center text-center">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${currentStyle.bgId}`}>
                        {currentStyle.icon}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 font-brand">{title}</h3>
                    <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                        {message}
                    </p>
                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onCancel}
                            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors ${currentStyle.btnCancel}`}
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm ${currentStyle.btnConfirm}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
