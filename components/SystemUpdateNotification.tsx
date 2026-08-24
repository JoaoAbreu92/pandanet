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
        const now = new Date();

        try {
            // 1. Obter Logo do PandaNet (System Settings)
            const { data: systemLogo } = await supabase
                .from('system_settings')
                .select('value')
                .eq('key', 'main_logo')
                .maybeSingle();

            let logoUrl = systemLogo?.value || '/logo.png';
            if (logoUrl.startsWith('/')) {
                logoUrl = window.location.origin + logoUrl;
            }

            // 2. Adicionar Logo (se carregada com sucesso)
            try {
                const { data: base64Logo, width, height } = await getBase64ImageFromURL(logoUrl);
                const maxWidth = 35;
                const aspectRatio = height / width;
                const finalHeight = maxWidth * aspectRatio;
                doc.addImage(base64Logo, 'PNG', 20, 20, maxWidth, finalHeight, undefined, 'FAST');
            } catch (e) {
                console.warn('Erro ao carregar logo para o PDF da nota:', e);
            }

            // 3. Cabeçalho da Nota de Atualização
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(20);
            doc.setTextColor(16, 185, 129); // Emerald-500 brand color
            doc.text('Nota de Atualização', 60, 28);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(13);
            doc.setTextColor(31, 41, 55); // Slate-800
            doc.text(`Versão: ${latestUpdate.version}`, 60, 36);

            doc.setFontSize(9.5);
            doc.setTextColor(107, 114, 128); // Slate-500
            doc.text(`Emitido em: ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR')}`, 60, 43);

            // Linha separadora do cabeçalho
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.5);
            doc.line(20, 52, 190, 52);

            // 4. Conteúdo com quebra automática de página
            const cleanDescription = stripEmojis(latestUpdate.description);
            const splitDescription = doc.splitTextToSize(cleanDescription, 170);

            // Calcular total de páginas
            let linesLeft = splitDescription.length;
            let totalPages = 1;
            const linesOnFirstPage = 29;
            const linesOnSubsequentPages = 36;
            if (linesLeft > linesOnFirstPage) {
                linesLeft -= linesOnFirstPage;
                totalPages += Math.ceil(linesLeft / linesOnSubsequentPages);
            }

            const drawPageDecorations = (pageNum: number, total: number) => {
                // Linha verde no topo (marca da empresa)
                doc.setFillColor(16, 185, 129); // Emerald-500
                doc.rect(20, 10, 170, 3, 'F');

                // Linha do rodapé
                doc.setDrawColor(229, 231, 235);
                doc.line(20, 275, 190, 275);

                // Textos do rodapé
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.5);
                doc.setTextColor(156, 163, 175);
                doc.text('© PandaNet - Sistema de Gestão Inteligente', 20, 281);
                doc.text(`Página ${pageNum} de ${total}`, 170, 281);
            };

            let currentY = 62;
            let pageNumber = 1;
            const lineSpacing = 6.5;

            for (let i = 0; i < splitDescription.length; i++) {
                if (currentY > 265) {
                    drawPageDecorations(pageNumber, totalPages);
                    doc.addPage();
                    pageNumber++;
                    currentY = 25; // Começa mais alto nas páginas seguintes
                }

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(11);
                doc.setTextColor(55, 65, 81); // Slate-700
                doc.text(splitDescription[i], 20, currentY);
                currentY += lineSpacing;
            }

            // Decorar a última página
            drawPageDecorations(pageNumber, totalPages);

            // Salvar
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
