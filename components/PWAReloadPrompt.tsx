import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { ArrowPathIcon, XMarkIcon } from './icons';

const PWAReloadPrompt: React.FC = () => {
    // Check if the service worker registration is successful and an update is available
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegisteredSW(swUrl, r) {
            if (r) {
                // Verificar atualizações a cada 15 minutos em background (ideal para APKs/WebViews)
                setInterval(() => {
                    r.update().catch(err => console.log('Erro ao checar atualização do SW:', err));
                }, 15 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    if (!needRefresh) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 pr-12 border border-gray-100 dark:border-slate-700 relative flex items-center gap-4 w-80">
                <button 
                    onClick={() => setNeedRefresh(false)} 
                    className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full transition-colors"
                >
                    <XMarkIcon className="w-5 h-5" />
                </button>

                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-full shrink-0">
                    <ArrowPathIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white mb-1">
                        Nova Atualização!
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        O PandaNet foi atualizado, clique para recarregar a versão mais recente.
                    </p>
                    <button 
                        onClick={() => updateServiceWorker(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition-colors shadow-md"
                    >
                        Atualizar Agora
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWAReloadPrompt;
