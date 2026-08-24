import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { XMarkIcon, RocketLaunchIcon, ArrowDownTrayIcon } from './icons';

const SystemUpdateNotification: React.FC = () => {
    const [latestUpdate, setLatestUpdate] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const fetchLatestUpdate = async () => {
            // Fetch configuration
            const { data: configDur } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'update_notification_duration')
                .maybeSingle();

            const { data: configUnit } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'update_notification_unit')
                .maybeSingle();

            const duration = parseInt(configDur?.value || '48');
            const unit = configUnit?.value || 'hours';

            // Calculate duration in milliseconds
            const durationMs = unit === 'days' ? duration * 24 * 60 * 60 * 1000 : duration * 60 * 60 * 1000;

            const { data, error } = await supabase
                .from('system_updates')
                .select('*')
                .eq('active', true)
                .order('created_at', { ascending: false })
                .limit(1);

            if (!error && data && data.length > 0) {
                const update = data[0];
                const updateDate = new Date(update.created_at).getTime();
                const now = new Date().getTime();

                // Only show if within duration
                if (now - updateDate < durationMs) {
                    const dismissedVersion = localStorage.getItem('dismissed_update_version');
                    if (dismissedVersion !== update.version) {
                        setLatestUpdate(update);
                        setIsVisible(true);
                    }
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

    const getBase64ImageFromURL = (url: string): Promise<{ data: string, width: number, height: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.setAttribute('crossOrigin', 'anonymous');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL('image/png');
                resolve({ data: dataURL, width: img.width, height: img.height });
            };
            img.onerror = error => reject(error);
            img.src = url;
        });
    };

    const stripEmojis = (str: string) => {
        return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1F170}-\u{1F251}]/gu, '');
    };

    const handleDownloadNota = async () => {
        const { default: jsPDF } = await import('jspdf');
        const doc = new jsPDF();

        try {
            // 1. Obter Logo do PandaNet (System Settings)
            const { data: systemLogo } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'main_logo')
                .maybeSingle();

            const logoUrl = systemLogo?.value || '/logo.png';

            // 2. Adicionar Logo
            try {
                const { data: base64Logo, width, height } = await getBase64ImageFromURL(logoUrl);
                const maxWidth = 30;
                const aspectRatio = height / width;
                const finalHeight = maxWidth * aspectRatio;
                doc.addImage(base64Logo, 'PNG', 14, 10, maxWidth, finalHeight, undefined, 'FAST');
            } catch (e) {
                console.warn('Erro ao carregar logo para o PDF da nota:', e);
            }

            // 3. Cabeçalho da Nota de Atualização
            doc.setFontSize(22);
            doc.setTextColor(220, 38, 38); // Red-600
            doc.text('Nota de Atualização PandaNet', 45, 22);

            doc.setFontSize(16);
            doc.setTextColor(31, 41, 55);
            doc.text(`Versão: ${latestUpdate.version}`, 45, 32);

            // Linha separadora
            doc.setDrawColor(229, 231, 235);
            doc.line(14, 40, 196, 40);

            // 4. Conteúdo
            doc.setFontSize(12);
            doc.setTextColor(55, 65, 81);
            doc.setFont('helvetica', 'normal');

            const cleanDescription = stripEmojis(latestUpdate.description);
            const splitDescription = doc.splitTextToSize(cleanDescription, 170);
            doc.text(splitDescription, 14, 50);

            // 5. Rodapé
            doc.setFontSize(10);
            doc.setTextColor(156, 163, 175);
            const now = new Date();
            doc.text(`Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, 14, 285);
            doc.text('© PandaNet - Sistema de Gestão Inteligente', 130, 285);

            doc.save(`PandaNet_Nota_Atualizacao_${latestUpdate.version}.pdf`);
        } catch (err) {
            console.error('Erro ao gerar PDF da nota:', err);
            alert('Erro ao gerar PDF da nota de atualização.');
        }
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
                    onClick={handleDownloadNota}
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
