import React, { useState } from 'react';

interface SuperAdminLoginPageProps {
    onLogin: (password: string) => boolean;
    onBack: () => void;
}

const SuperAdminLoginPage: React.FC<SuperAdminLoginPageProps> = ({ onLogin, onBack }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = onLogin(password);
        if (!success) {
            setError('Senha de super admin incorreta.');
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[125vh] bg-gray-100">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-brand-primary">Super Admin</h1>
                    <p className="mt-2 text-brand-subtle-text">Painel de Gerenciamento da Plataforma</p>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
                    <div>
                        <label htmlFor="password" className="text-sm font-medium text-brand-text">Senha</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-primary focus:border-brand-primary"
                            placeholder="********"
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-primary hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                        >
                            Acessar
                        </button>
                    </div>
                </form>
                 <div className="text-center mt-4 text-sm">
                    <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} className="font-semibold text-brand-primary hover:underline">
                        Acessar intranet de uma empresa
                    </a>
                </div>
            </div>
        </div>
    );
};

export default SuperAdminLoginPage;