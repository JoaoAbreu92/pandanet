import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { 
    DocumentIcon, 
    CalendarIcon, 
    BanknotesIcon, 
    ChartBarIcon, 
    ArrowDownTrayIcon 
} from '@heroicons/react/24/outline';

const EmployeePortal: React.FC = () => {
    const { profile } = useAuth();
    const [activeSection, setActiveSection] = useState<'documents' | 'vacation' | 'payroll'>('payroll');

    const payslips = [
        { id: 1, month: 'Janeiro 2024', date: '05/02/2024', type: 'Holerite' },
        { id: 2, month: 'Dezembro 2023', date: '05/01/2024', type: 'Holerite' },
        { id: 3, month: 'Novembro 2023', date: '05/12/2023', type: 'Holerite' },
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-8 p-4">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Meu RH</h1>
                    <p className="text-gray-500 mt-2">Gestão de documentos e benefícios de {profile?.name}.</p>
                </div>
                <div className="hidden md:flex space-x-2">
                    <span className="px-4 py-2 bg-brand-primary/10 text-brand-primary rounded-full text-sm font-bold">Saldo Férias: 18 dias</span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Navigation Sidebar */}
                <aside className="lg:col-span-1 space-y-2">
                    <button 
                        onClick={() => setActiveSection('payroll')}
                        className={`w-full flex items-center p-4 rounded-2xl transition-all ${activeSection === 'payroll' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <BanknotesIcon className="w-5 h-5 mr-3" />
                        <span className="font-bold">Holerites</span>
                    </button>
                    <button 
                        onClick={() => setActiveSection('vacation')}
                        className={`w-full flex items-center p-4 rounded-2xl transition-all ${activeSection === 'vacation' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <CalendarIcon className="w-5 h-5 mr-3" />
                        <span className="font-bold">Férias</span>
                    </button>
                    <button 
                        onClick={() => setActiveSection('documents')}
                        className={`w-full flex items-center p-4 rounded-2xl transition-all ${activeSection === 'documents' ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        <DocumentIcon className="w-5 h-5 mr-3" />
                        <span className="font-bold">Documentos</span>
                    </button>
                </aside>

                {/* Main Content Area */}
                <main className="lg:col-span-3">
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden anim-fade-in">
                        {activeSection === 'payroll' && (
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-6">Histórico de Pagamentos</h3>
                                <div className="space-y-4">
                                    {payslips.map(pay => (
                                        <div key={pay.id} className="flex items-center justify-between p-6 bg-gray-50 rounded-2xl border border-gray-100 group hover:border-brand-primary transition-colors">
                                            <div className="flex items-center space-x-4">
                                                <div className="p-3 bg-white rounded-xl shadow-sm">
                                                    <BanknotesIcon className="w-6 h-6 text-brand-primary" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900">{pay.month}</p>
                                                    <p className="text-sm text-gray-500">Disponibilizado em: {pay.date}</p>
                                                </div>
                                            </div>
                                            <button className="p-3 bg-white border border-gray-100 rounded-xl text-brand-primary hover:bg-brand-primary hover:text-white transition-all shadow-sm">
                                                <ArrowDownTrayIcon className="w-5 h-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeSection === 'vacation' && (
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-6">Gestão de Férias</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                    <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <p className="text-emerald-700 font-medium">Dias Disponíveis</p>
                                        <p className="text-4xl font-black text-emerald-800">18</p>
                                    </div>
                                    <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                                        <p className="text-amber-700 font-medium">Dias em Processamento</p>
                                        <p className="text-4xl font-black text-amber-800">0</p>
                                    </div>
                                </div>
                                <button className="w-full py-4 bg-brand-primary text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all">
                                    Solicitar Férias
                                </button>
                            </div>
                        )}

                        {activeSection === 'documents' && (
                            <div className="p-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-6">Documentos Úteis</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {['Contrato de Trabalho', 'Regulamento Interno', 'Benefícios 2024', 'Manual do Colaborador'].map(doc => (
                                        <div key={doc} className="p-4 border border-gray-100 rounded-2xl flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors">
                                            <div className="flex items-center space-x-3">
                                                <DocumentIcon className="w-5 h-5 text-gray-400" />
                                                <span className="font-medium text-gray-700">{doc}</span>
                                            </div>
                                            <ArrowDownTrayIcon className="w-4 h-4 text-gray-400" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default EmployeePortal;
