import React, { useState, useEffect } from 'react';
import Card from './Card';
import { PlusIcon, XCircleIcon, PencilIcon, TrashIcon } from './icons';
import type { Benefit } from '../types';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';

const BenefitFormModal: React.FC<{
    benefit: Partial<Benefit> | null;
    onClose: () => void;
    onSave: (benefit: Omit<Benefit, 'id'> | Benefit) => void;
}> = ({ benefit, onClose, onSave }) => {
    const [formData, setFormData] = useState({
        title: benefit?.title || '',
        description: benefit?.description || '',
        features: benefit?.features?.join('\n') || '',
        link: benefit?.link || '#',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const finalData = { ...formData, features: formData.features.split('\n').filter(f => f.trim() !== '') };
        onSave(benefit?.id ? { ...benefit, ...finalData } as Benefit : finalData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">{benefit?.id ? 'Editar Benefício' : 'Adicionar Novo Benefício'}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Título</label><input type="text" name="title" value={formData.title} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Descrição</label><textarea name="description" value={formData.description} onChange={handleChange} rows={3} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Principais Características (um por linha)</label><textarea name="features" value={formData.features} onChange={handleChange} rows={4} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div><label className="block text-sm font-medium text-brand-subtle-text">Link (Saiba Mais)</label><input type="url" name="link" value={formData.link} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text" /></div>
                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Salvar Benefício</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const BeneficiosPage: React.FC = () => {
    const { profile: currentUser } = useAuth();
    const [benefits, setBenefits] = useState<Benefit[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingBenefit, setEditingBenefit] = useState<Benefit | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchBenefits = async () => {
        if (!currentUser?.company_id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('benefits')
                .select('*')
                .eq('company_id', currentUser.company_id);

            if (error) throw error;
            if (data) setBenefits(data);
        } catch (error) {
            console.error('Error fetching benefits:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBenefits();
    }, [currentUser?.company_id]);

    const handleSave = async (benefitData: Omit<Benefit, 'id'> | Benefit) => {
        if (!currentUser?.company_id) return;

        try {
            if ('id' in benefitData) {
                // Update
                const { error } = await supabase
                    .from('benefits')
                    .update({
                        title: benefitData.title,
                        description: benefitData.description,
                        features: benefitData.features,
                        link: benefitData.link
                    })
                    .eq('id', benefitData.id);

                if (error) throw error;
                setBenefits(benefits.map(b => b.id === benefitData.id ? benefitData : b));
            } else {
                // Create
                const { data, error } = await supabase
                    .from('benefits')
                    .insert([{
                        company_id: currentUser.company_id,
                        title: benefitData.title,
                        description: benefitData.description,
                        features: benefitData.features,
                        link: benefitData.link
                    }])
                    .select();

                if (error) throw error;
                if (data) setBenefits([data[0], ...benefits]);
            }
            setModalOpen(false);
            setEditingBenefit(null);
        } catch (error) {
            console.error('Error saving benefit:', error);
            alert('Erro ao salvar benefício.');
        }
    };

    const handleEdit = (benefit: Benefit) => {
        setEditingBenefit(benefit);
        setModalOpen(true);
    };

    const handleDelete = async (benefitId: string) => {
        if (window.confirm("Tem certeza que deseja apagar este benefício?")) {
            try {
                const { error } = await supabase
                    .from('benefits')
                    .delete()
                    .eq('id', benefitId);

                if (error) throw error;
                setBenefits(benefits.filter(b => b.id !== benefitId));
            } catch (error) {
                console.error('Error deleting benefit:', error);
                alert('Erro ao apagar benefício.');
            }
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Carregando benefícios...</div>;

    return (
        <>
            <div className="space-y-8 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div className="text-center md:text-left mb-4 md:mb-0">
                        <h1 className="text-3xl font-bold text-brand-text">Portal de Benefícios</h1>
                        <p className="mt-2 text-lg text-brand-subtle-text">Conheça os benefícios que a empresa oferece para cuidar de você.</p>
                    </div>
                    {currentUser?.isAdmin && (
                        <button onClick={() => { setEditingBenefit(null); setModalOpen(true); }} className="flex items-center space-x-2 px-4 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-emerald-600 w-full md:w-auto">
                            <PlusIcon className="w-4 h-4" />
                            <span>Adicionar Benefício</span>
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {benefits.map(benefit => (
                        <Card key={benefit.id} title={benefit.title} className="hover:shadow-lg transition-shadow relative group">
                            {currentUser?.isAdmin && (
                                <div className="absolute top-4 right-4 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(benefit)} className="p-1.5 bg-gray-200 rounded-full text-gray-600 hover:bg-gray-300"><PencilIcon className="w-4 h-4" /></button>
                                    <button onClick={() => handleDelete(benefit.id)} className="p-1.5 bg-gray-200 rounded-full text-gray-600 hover:bg-red-200 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            )}
                            <div className="space-y-3">
                                <p className="text-brand-subtle-text">{benefit.description}</p>
                                <div>
                                    <h4 className="font-semibold text-brand-text">Principais Coberturas:</h4>
                                    <ul className="list-disc list-inside text-brand-subtle-text text-sm space-y-1 mt-2">
                                        {benefit.features.map((feature, index) => <li key={index}>{feature}</li>)}
                                    </ul>
                                </div>
                                <a href={benefit.link} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-primary hover:underline">Saiba mais</a>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
            {isModalOpen && <BenefitFormModal benefit={editingBenefit} onClose={() => setModalOpen(false)} onSave={handleSave} />}
        </>
    );
};

export default BeneficiosPage;