import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { XMarkIcon, RocketLaunchIcon, ArrowDownTrayIcon } from './icons';

const SystemUpdateNotification: React.FC = () => {
    const [latestUpdate, setLatestUpdate] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchLatestUpdate = async () => {
            const { data, error } = await supabase
                .from('system_updates')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!error && data && data.length > 0) {
                const update = data[0];
                const dismissedVersion = localStorage.getItem('dismissed_update_version');
                
                if (dismissedVersion !== update.version) {
                    setLatestUpdate(update);
                    setIsVisible(true);
                }
            }
        };

        fetchLatestUpdate();

        // Realtime subscription for new updates
        const channel = supabase
            .channel('system_updates_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_updates' }, (payload) => {
                setLatestUpdate(payload.new);
                setIsVisible(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const handleDismiss = () => {
        if (latestUpdate) {
            localStorage.setItem('dismissed_update_version', latestUpdate.version);
        }
        setIsVisible(false);
    };

    const handleDownloadPDF = () => {
        // Mock download logic
        const content = `Atualização PandaNet - Versão ${latestUpdate.version}\n\n${latestUpdate.description}`;
        const blob = new Blob([content], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PandaNet_Update_${latestUpdate.version}.txt`; // Forcing txt since we are mocking pdf content string
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (!isVisible || !latestUpdate) return null;

    return (
        <div className="bg-red-600 text-white px-4 py-2 relative z-[100] animate-slide-down shadow-lg flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
                <span className="flex-shrink-0 bg-white/20 p-1 rounded-full">
                    <RocketLaunchIcon className="w-5 h-5" />
                </span>
                <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 overflow-hidden">
                    <p className="text-sm font-bold truncate">NOVA ATUALIZAÇÃO DISPONÍVEL: v{latestUpdate.version}</p>
                    <p className="text-xs opacity-90 truncate max-w-md hidden md:block">{latestUpdate.description.substring(0, 100)}...</p>
                </div>
            </div>
            
            <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                <button 
                    onClick={handleDownloadPDF}
                    className="flex items-center space-x-1 bg-white text-red-600 px-3 py-1 rounded-full text-xs font-bold hover:bg-red-50 transition-colors shadow-sm"
                >
                    <ArrowDownTrayIcon className="w-4 h-4" />
                    <span>BAIXAR PDF</span>
                </button>
                <button onClick={handleDismiss} className="hover:text-red-200 transition-colors">
                    <XMarkIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default SystemUpdateNotification;
