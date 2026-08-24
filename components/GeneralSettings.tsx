import React, { useState } from 'react';
import Card from './Card';
import { PencilIcon, XCircleIcon } from './icons';
// FIX: Correcting the import path for types.
import type { CompanySettings } from '../types';

interface GeneralSettingsProps {
    settings: CompanySettings;
    setSettings: (settings: CompanySettings) => void;
}

const GeneralSettings: React.FC<GeneralSettingsProps> = ({ settings, setSettings }) => {
    const [tempSettings, setTempSettings] = useState<CompanySettings>(settings);

    const handleSave = () => {
        setSettings(tempSettings);
        alert('Configurações salvas!');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTempSettings({ ...tempSettings, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const newUrl = URL.createObjectURL(file);
            setTempSettings(prev => ({ ...prev, logoUrl: newUrl }));
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
                             <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary">
                                <PencilIcon className="w-4 h-4 mr-2" />
                                Alterar Logo
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                            <p className="mt-1 text-xs text-gray-500">Recomendado: PNG Transparente.</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-2 border-t mt-6">
                    <button 
                        onClick={handleSave}
                        className="px-4 py-2 text-sm font-medium text-white bg-brand-primary border border-transparent rounded-md shadow-sm hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                    >
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </Card>
    );
};

export default GeneralSettings;