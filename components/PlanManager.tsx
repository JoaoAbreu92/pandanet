import React, { useState } from 'react';
import type { Plan } from '../types';
import Card from './Card';
import { CheckCircleIcon, XCircleIcon } from './icons';

interface PlanManagerProps {
    plans: Plan[];
}

const PlanFormModal: React.FC<{
    plan: Plan;
    onClose: () => void;
    onSave: (plan: Plan) => void;
}> = ({ plan, onClose, onSave }) => {
    const [formData, setFormData] = useState<Plan>(plan);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'userLimit' ? Number(value) : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative animate-fade-in-up">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><XCircleIcon className="w-6 h-6" /></button>
                <h3 className="text-xl font-bold text-brand-text mb-4">Editar Plano: {plan.name}</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Nome do Plano</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Limite de Usuários</label>
                        <input type="number" name="userLimit" value={formData.userLimit} onChange={handleChange} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-brand-subtle-text">Limite de Canais WhatsApp</label>
                        <input type="number" name="whatsappLimit" value={formData.whatsappLimit || 1} onChange={(e) => setFormData(prev => ({ ...prev, whatsappLimit: Number(e.target.value) }))} required className="mt-1 w-full border-gray-300 rounded-md sm:text-sm bg-white text-brand-text"/>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 p-2 rounded-md">
                        <label className="block text-sm font-medium text-brand-subtle-text mb-2">Recursos do Plano</label>
                        {Object.keys(formData.features).map((key) => (
                            <label key={key} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-md cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={!!formData.features[key as keyof typeof formData.features]}
                                    onChange={(e) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            features: {
                                                ...prev.features,
                                                [key]: e.target.checked
                                            }
                                        }));
                                    }}
                                    className="rounded text-brand-primary focus:ring-brand-primary border-gray-300"
                                />
                                <span className="text-sm text-gray-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                            </label>
                        ))}
                    </div>


                    <div className="flex justify-end space-x-3 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">Cancelar</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-emerald-600">Salvar Alterações</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PlanManager: React.FC<PlanManagerProps> = ({ plans }) => {
    const [localPlans, setLocalPlans] = useState(plans);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setModalOpen(true);
    };

    const handleSave = (updatedPlan: Plan) => {
        setLocalPlans(localPlans.map(p => p.id === updatedPlan.id ? updatedPlan : p));
    };

    return (
        <>
            <Card title="Gerenciamento de Planos">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {localPlans.map(plan => (
                        <div key={plan.id} className="border rounded-lg p-6 flex flex-col bg-white">
                            <h3 className="text-lg font-bold text-brand-text">{plan.name}</h3>
                            <p className="text-brand-subtle-text text-sm">Limite de {plan.userLimit} usuários</p>
                            <p className="text-brand-subtle-text text-sm mb-4">Limite de {plan.whatsappLimit || 1} canais WhatsApp</p>
                            
                            <div className="border-t pt-4 mb-4">
                                <p className="font-semibold text-brand-text text-sm mb-2">Recursos Ativos:</p>
                                <ul className="space-y-2 text-sm text-brand-subtle-text flex-grow">
                                    {Object.entries(plan.features).map(([key, value]) => value && (
                                        <li key={key} className="flex items-start">
                                            <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                                            <span className="text-brand-text">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <button onClick={() => handleEdit(plan)} className="mt-auto w-full py-2 bg-gray-200 text-gray-700 font-semibold rounded-md hover:bg-gray-300">
                                Editar Plano
                            </button>
                        </div>
                    ))}
                </div>
            </Card>
            {isModalOpen && editingPlan && (
                <PlanFormModal 
                    plan={editingPlan}
                    onClose={() => setModalOpen(false)}
                    onSave={handleSave}
                />
            )}
        </>
    );
};

export default PlanManager;
