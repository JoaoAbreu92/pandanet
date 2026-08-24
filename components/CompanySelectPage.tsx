import React, { useState } from 'react';
import Logo from './Logo';

interface CompanySelectPageProps {
    onCompanySelect: (domain: string) => boolean;
}

const CompanySelectPage: React.FC<CompanySelectPageProps> = ({ onCompanySelect }) => {
    const [domain, setDomain] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = onCompanySelect(domain.toLowerCase());
        if (!success) {
            setError(`Domínio "${domain}" não encontrado.`);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <div className="text-center">
                    <Logo showText={true} className="mx-auto mb-4 w-48" />
                    <p className="mt-2 text-brand-subtle-text">Acesse a intranet da sua empresa</p>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                     {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
                    <div>
                        <label htmlFor="domain" className="text-sm font-medium text-brand-text">Domínio da Empresa</label>
                        <div className="flex items-center mt-1">
                             <input
                                id="domain"
                                name="domain"
                                type="text"
                                required
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                                placeholder="sua-empresa"
                            />
                            <span className="ml-2 text-brand-subtle-text">.intranet.pro</span>
                        </div>
                         <p className="text-xs text-gray-400 mt-2">Dica: Tente 'acme' ou 'globex'. Para o painel de Super Admin, digite 'superadmin' no campo de domínio.</p>
                    </div>
                     <div>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                        >
                            Continuar
                        </button>
                    </div>
                </form>
            </div>
            <footer className="text-center text-xs text-gray-500 py-4 mt-8">
                © 2024 Grupo Pixel. Todos os direitos reservados.
            </footer>
        </div>
    );
};

export default CompanySelectPage;