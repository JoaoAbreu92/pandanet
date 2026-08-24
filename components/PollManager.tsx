import React, { useState, useEffect, useRef } from 'react';
import Card from './Card';
import { PlusIcon, TrashIcon, XCircleIcon } from './icons';
import type { Poll } from '../types';
import { supabase, getCleanImageUrl } from '../supabaseClient';
import { useAuth } from './AuthContext';

const PollFormModal: React.FC<{
    onClose: () => void;
    onSave: () => void;
    isProcessing?: boolean;
}> = ({ onClose, onSave, isProcessing: externalIsProcessing }) => {
    const { currentUser } = useAuth();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState<string[]>(['', '']);
    const [coverUrl, setCoverUrl] = useState<string | null>(null);
    const [showButton, setShowButton] = useState(false);
    const [link, setLink] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [showCanvaBuilder, setShowCanvaBuilder] = useState(false);

    // Canva style builder states
    const [canvasBgType, setCanvasBgType] = useState<'solid' | 'gradient'>('gradient');
    const [canvasBgColor1, setCanvasBgColor1] = useState('#10b981'); // emerald
    const [canvasBgColor2, setCanvasBgColor2] = useState('#3b82f6'); // blue
    const [canvasTextColor, setCanvasTextColor] = useState('#ffffff');
    const [canvasText, setCanvasText] = useState('');
    const [canvasFontSize, setCanvasFontSize] = useState(48);
    const [canvasIsBold, setCanvasIsBold] = useState(true);
    const [canvasIsItalic, setCanvasIsItalic] = useState(false);
    const [canvasEmoji, setCanvasEmoji] = useState('📊');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasPreviewRef = useRef<HTMLCanvasElement>(null);

    const handleOptionChange = (index: number, value: string) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const addOption = () => {
        setOptions([...options, '']);
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            setOptions(options.filter((_, i) => i !== index));
        }
    };

    // Live update Canva preview canvas
    useEffect(() => {
        if (!showCanvaBuilder || !canvasPreviewRef.current) return;
        const canvas = canvasPreviewRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw Background
        if (canvasBgType === 'gradient') {
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            grad.addColorStop(0, canvasBgColor1);
            grad.addColorStop(1, canvasBgColor2);
            ctx.fillStyle = grad;
        } else {
            ctx.fillStyle = canvasBgColor1;
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Abstract Overlays
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.beginPath();
        ctx.arc(80, 80, 160, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(canvas.width - 80, canvas.height - 80, 220, 0, Math.PI * 2);
        ctx.fill();

        // Draw Emoji
        ctx.font = '80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(canvasEmoji, 120, canvas.height / 2);

        // Draw Text
        ctx.fillStyle = canvasTextColor;
        let fontStr = '';
        if (canvasIsItalic) fontStr += 'italic ';
        if (canvasIsBold) fontStr += 'bold ';
        fontStr += `${canvasFontSize}px Outfit, Inter, sans-serif`;
        ctx.font = fontStr;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const textToDraw = canvasText || question || 'Sua Pergunta Aqui';
        const words = textToDraw.split(' ');
        let line = '';
        const lines = [];
        const maxWidth = 550; // Max width for text on canvas
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        const startY = (canvas.height / 2) - ((lines.length - 1) * (canvasFontSize * 1.2)) / 2;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], 220, startY + i * (canvasFontSize * 1.2));
        }
    }, [
        showCanvaBuilder,
        canvasBgType,
        canvasBgColor1,
        canvasBgColor2,
        canvasTextColor,
        canvasText,
        canvasFontSize,
        canvasIsBold,
        canvasIsItalic,
        canvasEmoji,
        question
    ]);

    const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploading(true);

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const filePath = `polls/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('banners')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);
            setCoverUrl(publicUrl);
        } catch (err: any) {
            console.error('Error uploading cover image:', err);
            alert('Erro no upload da imagem: ' + err.message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleGenerateCanvaBanner = () => {
        if (!canvasPreviewRef.current) return;
        setIsUploading(true);
        canvasPreviewRef.current.toBlob(async (blob) => {
            if (!blob) {
                setIsUploading(false);
                return;
            }
            try {
                const file = new File([blob], 'canva_banner.png', { type: 'image/png' });
                const filePath = `polls/canva_${Date.now()}.png`;

                const { error: uploadError } = await supabase.storage
                    .from('banners')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('banners').getPublicUrl(filePath);
                setCoverUrl(publicUrl);
                setShowCanvaBuilder(false);
            } catch (err: any) {
                console.error('Error generating banner from Canva:', err);
                alert('Erro ao gerar banner: ' + err.message);
            } finally {
                setIsUploading(false);
            }
        }, 'image/png');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validOptions = options.filter(opt => opt.trim() !== '');
        if (!question.trim() || validOptions.length < 2) {
            alert("A enquete precisa de uma pergunta e pelo menos duas opções.");
            return;
        }

        if (!currentUser?.company_id) return;

        try {
            // 1. Create Poll
            const { data: poll, error: pollError } = await supabase
                .from('polls')
                .insert([{
                    question,
                    company_id: currentUser.company_id,
                    status: 'active',
                    cover_url: coverUrl,
                    show_button: showButton,
                    link: showButton ? link : null
                }])
                .select()
                .single();

            if (pollError) throw pollError;

            // 2. Create Options
            const optionsToInsert = validOptions.map(text => ({
                poll_id: poll.id,
                option_text: text,
                votes: 0
            }));

            const { error: optionsError } = await supabase
                .from('poll_options')
                .insert(optionsToInsert);

            if (optionsError) throw optionsError;

            onSave();
            onClose();
        } catch (err) {
            console.error('Error creating poll:', err);
            alert('Erro ao criar enquete.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-6 relative animate-fade-in text-slate-800 dark:text-white max-h-[90vh] overflow-y-auto border border-slate-100 dark:border-slate-850">
                <button onClick={onClose} className="absolute top-5 right-5 text-gray-400 hover:text-gray-650" disabled={isUploading || externalIsProcessing}>
                    <XCircleIcon className="w-6 h-6" />
                </button>
                
                <h3 className="text-xl font-extrabold flex items-center gap-2 mb-6">
                    📊 Criar Nova Enquete
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase">Pergunta / Título *</label>
                        <input
                            type="text"
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            required
                            placeholder="Ex: Qual deve ser o tema do treinamento de vendas?"
                            className="mt-1.5 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                        />
                    </div>

                    {/* Capa / Banner */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase block">Imagem de Capa (Opcional)</label>
                        
                        {coverUrl ? (
                          <div className="relative w-full h-32 rounded-xl overflow-hidden border dark:border-slate-800 group">
                            <img src={getCleanImageUrl(coverUrl)} alt="Cover" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setCoverUrl(null)}
                              className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-lg p-1 text-xs font-bold shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Remover
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isUploading}
                              className="flex-1 py-3 px-4 text-xs font-extrabold bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850 border border-dashed border-slate-205 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 transition-colors text-center"
                            >
                              {isUploading ? 'Subindo...' : '📤 Fazer Upload'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                  setCanvasText(question);
                                  setShowCanvaBuilder(true);
                              }}
                              disabled={isUploading}
                              className="flex-1 py-3 px-4 text-xs font-extrabold bg-brand-primary/10 hover:bg-brand-primary/15 border border-dashed border-brand-primary/30 rounded-xl text-brand-primary dark:text-emerald-400 transition-colors text-center"
                            >
                              🎨 Canva Builder (Gerar Banner)
                            </button>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleUploadImage}
                          accept="image/*"
                          hidden
                        />
                    </div>

                    {/* Canva Builder Inline Panel */}
                    {showCanvaBuilder && (
                      <div className="p-4 bg-slate-50 dark:bg-slate-950 border dark:border-slate-850 rounded-2xl space-y-4">
                        <div className="flex justify-between items-center border-b dark:border-slate-800 pb-2">
                          <h4 className="text-xs font-black uppercase text-brand-primary">Gerador Canva Banner (800x266)</h4>
                          <button
                            type="button"
                            onClick={() => setShowCanvaBuilder(false)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Fechar
                          </button>
                        </div>

                        {/* Canvas Element */}
                        <div className="flex justify-center bg-slate-200 dark:bg-slate-900 p-2 rounded-xl">
                          <canvas
                            ref={canvasPreviewRef}
                            width={800}
                            height={266}
                            className="w-full max-w-[400px] border dark:border-slate-800 rounded-lg shadow-sm"
                          />
                        </div>

                        {/* Canva Controls */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <label className="font-bold">Tipo de Fundo</label>
                            <select
                              value={canvasBgType}
                              onChange={(e: any) => setCanvasBgType(e.target.value)}
                              className="mt-1 w-full bg-white dark:bg-slate-900 border rounded-lg p-1.5 focus:outline-none"
                            >
                              <option value="solid">Cor Sólida</option>
                              <option value="gradient">Gradiente</option>
                            </select>
                          </div>

                          <div>
                            <label className="font-bold">Emoji</label>
                            <input
                              type="text"
                              value={canvasEmoji}
                              onChange={(e) => setCanvasEmoji(e.target.value)}
                              placeholder="Ex: 📊"
                              className="mt-1 w-full bg-white dark:bg-slate-900 border rounded-lg p-1.5 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="font-bold">Cor 1 (ou Sólido)</label>
                            <input
                              type="color"
                              value={canvasBgColor1}
                              onChange={(e) => setCanvasBgColor1(e.target.value)}
                              className="mt-1 w-full h-8 rounded-lg cursor-pointer bg-transparent border-0"
                            />
                          </div>

                          {canvasBgType === 'gradient' && (
                            <div>
                              <label className="font-bold">Cor 2 (Gradiente)</label>
                              <input
                                type="color"
                                value={canvasBgColor2}
                                onChange={(e) => setCanvasBgColor2(e.target.value)}
                                className="mt-1 w-full h-8 rounded-lg cursor-pointer bg-transparent border-0"
                              />
                            </div>
                          )}

                          <div className="col-span-2">
                            <label className="font-bold">Frase no Banner</label>
                            <input
                              type="text"
                              value={canvasText}
                              onChange={(e) => setCanvasText(e.target.value)}
                              placeholder="Deixe em branco para usar a pergunta"
                              className="mt-1 w-full bg-white dark:bg-slate-900 border rounded-lg p-1.5 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="font-bold">Cor do Texto</label>
                            <input
                              type="color"
                              value={canvasTextColor}
                              onChange={(e) => setCanvasTextColor(e.target.value)}
                              className="mt-1 w-full h-8 rounded-lg cursor-pointer bg-transparent border-0"
                            />
                          </div>

                          <div>
                            <label className="font-bold">Tamanho da Fonte</label>
                            <input
                              type="number"
                              value={canvasFontSize}
                              onChange={(e) => setCanvasFontSize(Number(e.target.value))}
                              className="mt-1 w-full bg-white dark:bg-slate-900 border rounded-lg p-1.5 focus:outline-none"
                            />
                          </div>

                          <div className="flex gap-4 col-span-2 pt-1 font-bold">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={canvasIsBold}
                                onChange={(e) => setCanvasIsBold(e.target.checked)}
                              />
                              Negrito
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={canvasIsItalic}
                                onChange={(e) => setCanvasIsItalic(e.target.checked)}
                              />
                              Itálico
                            </label>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleGenerateCanvaBanner}
                          className="w-full bg-brand-primary text-white font-extrabold py-2 rounded-xl text-xs shadow-md transition-colors"
                        >
                          Salvar e Aplicar Banner
                        </button>
                      </div>
                    )}

                    {/* Opções */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase mb-2 block">Opções da Enquete *</label>
                        <div className="space-y-2">
                            {options.map((opt, index) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <input
                                        type="text"
                                        value={opt}
                                        onChange={(e) => handleOptionChange(index, e.target.value)}
                                        placeholder={`Opção ${index + 1}`}
                                        required
                                        className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                    />
                                    {options.length > 2 && (
                                        <button type="button" onClick={() => removeOption(index)} className="text-red-500 hover:text-red-700 transition-colors">
                                            <XCircleIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={addOption} className="mt-2 text-xs text-brand-primary font-bold hover:underline flex items-center">
                            <PlusIcon className="w-4 h-4 mr-1" /> Adicionar Opção
                        </button>
                    </div>

                    {/* Toggle Saiba mais */}
                    <div className="space-y-2 pt-2 border-t dark:border-slate-800">
                        <div className="flex items-center justify-between">
                            <label htmlFor="showButton" className="text-xs font-bold text-slate-705 dark:text-slate-300 cursor-pointer select-none">
                                Mostrar botão "Saiba mais"
                            </label>
                            <input
                                type="checkbox"
                                id="showButton"
                                checked={showButton}
                                onChange={(e) => setShowButton(e.target.checked)}
                                className="rounded text-brand-primary focus:ring-brand-primary cursor-pointer h-4 w-4"
                            />
                        </div>
                        
                        {showButton && (
                            <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                                <label className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase">Link de Destino *</label>
                                <input
                                    type="url"
                                    value={link}
                                    onChange={(e) => setLink(e.target.value)}
                                    required={showButton}
                                    placeholder="Ex: https://google.com"
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-primary font-semibold text-slate-805 dark:text-white"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-6 border-t dark:border-slate-800">
                        <button type="button" onClick={onClose} disabled={isUploading || externalIsProcessing} className="px-5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 rounded-xl transition-all">
                            Cancelar
                        </button>
                        <button type="submit" disabled={isUploading || externalIsProcessing} className="px-6 py-2.5 text-xs font-black text-white bg-brand-primary hover:bg-emerald-600 rounded-xl shadow-md shadow-brand-primary/10 transition-all">
                            {externalIsProcessing ? 'Criando...' : 'Criar Enquete'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PollManager: React.FC = () => {
    const { currentUser } = useAuth();
    const [polls, setPolls] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchPolls = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('polls')
                .select('*, poll_options(*)')
                .eq('company_id', currentUser.company_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPolls(data || []);
        } catch (err) {
            console.error('Error fetching polls:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPolls();
    }, [currentUser?.company_id]);

    const handleDelete = async (pollId: string) => {
        if (window.confirm("Tem certeza que deseja excluir esta enquete?")) {
            try {
                const { error } = await supabase
                    .from('polls')
                    .delete()
                    .eq('id', pollId);
                if (error) throw error;
                fetchPolls();
            } catch (err) {
                console.error('Error deleting poll:', err);
                alert('Erro ao excluir enquete.');
            }
        }
    };

    if (loading) return <div className="p-4 text-center text-gray-500">Carregando enquetes...</div>;

    return (
        <>
            <Card title="Gerenciar Enquetes" headerAction={
                <button onClick={() => setModalOpen(true)} className="flex items-center space-x-2 px-3 py-2 text-xs bg-brand-primary text-white rounded-xl hover:bg-emerald-600 transition-colors">
                    <PlusIcon className="w-4 h-4" />
                    <span>Nova Enquete</span>
                </button>
            }>
                <div className="space-y-4">
                    {polls.length === 0 ? (
                        <p className="text-brand-subtle-text text-sm py-4 text-center">Nenhuma enquete ativa no momento.</p>
                    ) : (
                        polls.map(poll => {
                            const totalVotes = poll.poll_options?.reduce((acc: number, curr: any) => acc + (curr.votes || 0), 0);
                            return (
                                <div key={poll.id} className="border rounded-2xl p-4 bg-slate-50 dark:bg-slate-950/40 border-slate-105 dark:border-slate-850 relative group hover:border-brand-primary transition-all">
                                    <button onClick={() => handleDelete(poll.id)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                    
                                    {poll.cover_url && (
                                      <div className="w-full h-24 overflow-hidden rounded-xl border dark:border-slate-800 mb-3 max-w-[200px]">
                                        <img src={getCleanImageUrl(poll.cover_url)} alt="Cover" className="w-full h-full object-cover" />
                                      </div>
                                    )}

                                    <h4 className="font-extrabold text-brand-text mb-2 pr-8">{poll.question}</h4>
                                    <ul className="space-y-1">
                                        {poll.poll_options?.map((opt: any) => (
                                            <li key={opt.id} className="text-xs text-brand-subtle-text flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-850 last:border-0">
                                                <span>{opt.option_text}</span>
                                                <span className="font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800 text-[10px]">{opt.votes || 0} votos</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-150 dark:border-slate-800">
                                        <p className="text-[10px] font-bold text-gray-400">Total de votos: {totalVotes}</p>
                                        <span className={`text-[9px] px-2.5 py-0.5 rounded-full uppercase font-black border ${
                                          poll.status === 'active' 
                                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-450 dark:border-green-800/30' 
                                            : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-750'
                                        }`}>
                                            {poll.status === 'active' ? 'Ativa' : 'Encerrada'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>
            {isModalOpen && <PollFormModal onClose={() => setModalOpen(false)} onSave={fetchPolls} isProcessing={isProcessing} />}
        </>
    );
};

export default PollManager;