import React, { useState } from 'react';
import Card from './Card';
import { Button } from './ui/Button';
import { useToast } from './ToastContext';
import { PencilIcon, XCircleIcon } from './icons';
import { supabase, getSignedStorageUrl } from '../supabaseClient';
// FIX: Correcting the import path for types.
import type { CompanySettings } from '../types';

interface GeneralSettingsProps {
    settings: CompanySettings;
    setSettings: (settings: CompanySettings) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, setSettings }) => {
    const { showToast } = useToast();
    const [tempSettings, setTempSettings] = useState<CompanySettings>(settings);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        
        let finalSettings = { ...tempSettings };
        const newFile = (tempSettings as any)._newLogoFile;

        if (newFile) {
            try {
                const fileExt = newFile.name.split('.').pop();
                const fileName = `logo_${Date.now()}.${fileExt}`;
                const filePath = `branding/${fileName}`;

                const { data, error } = await supabase.storage
                    .from('chat-media')
                    .upload(filePath, newFile);

                if (error) {
                    console.error("[GeneralSettings] Erro no upload:", error);
                    throw error;
                }

                const uploadedPath = data?.path || filePath;
                const publicUrl = await getSignedStorageUrl(`https://pandanet.grupopixel.com.br/storage/v1/object/public/chat-media/${uploadedPath}`);
                
                finalSettings.logoUrl = publicUrl;
                delete (finalSettings as any)._newLogoFile;
            } catch (err: any) {
                console.error("[GeneralSettings] Erro ao subir logotipo:", err);
                showToast(
                    'Não foi possível atualizar o logotipo. ' +
                    (err?.message || 'Erro desconhecido.'),
                    'error'
                );
                setIsSaving(false);
                return;
            }
        }

        setSettings(finalSettings);
        showToast('Configurações salvas com sucesso.', 'success');
        setIsSaving(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempSettings({ ...tempSettings, [e.target.name]: e.target.value });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Upload imediato ou no handleSave? 
            // Para melhor UX, vamos fazer no handleSave, mas mostrar preview local
            const previewUrl = URL.createObjectURL(file);
            (file as any).preview = previewUrl; // Hack para guardar a referência
            setTempSettings(prev => ({ ...prev, logoUrl: previewUrl, _newLogoFile: file } as any));
        }
    };

    const handleRemoveLogo = () => {
        setTempSettings(prev => ({ ...prev, logoUrl: undefined }));
    };

    return (
        <Card title="Configurações Gerais">
            <div className="space-y-6">
                <div>
                    <label htmlFor="companyName" className="block text-sm font-medium text-brand-text">
                        Nome da Empresa (na Sidebar)
                    </label>
                    <input
                        type="text"
                        id="companyName"
                        name="companyName"
                        value={tempSettings.companyName}
                        onChange={handleChange}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-brand-primary focus:ring-brand-primary sm:text-sm bg-white text-brand-text"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-brand-text mb-2">
                        Logotipo da Empresa (Canto Inferior Esquerdo)
                    </label>
                    <div className="flex items-center space-x-4">
                        <div className="relative h-16 w-32 border rounded-md flex items-center justify-center bg-gray-50 overflow-hidden group">
                            {tempSettings.logoUrl ? (
                                <img src={tempSettings.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />
                            ) : (
                                <span className="text-xs text-gray-400">Sem Logo</span>
                            )}
                            {tempSettings.logoUrl && (
                                <button
                                    onClick={handleRemoveLogo}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Remover Logo"
                                >
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <div>
                            <label
                                htmlFor="company-logo-upload"
                                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-within:ring-4 focus-within:ring-emerald-500/20 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300"
                            >
                                <PencilIcon className="h-4 w-4" />
                                Alterar logo
                                <input
                                    id="company-logo-upload"
                                    type="file"
                                    className="sr-only"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </label>
                            <p className="mt-1 text-xs text-gray-500">Recomendado: PNG Transparente.</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-2 border-t mt-6">
                    <Button
                        type="button"
                        onClick={handleSave}
                        isLoading={isSaving}
                        loadingText="Salvando..."
                    >
                        Salvar configurações
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default GeneralSettings;