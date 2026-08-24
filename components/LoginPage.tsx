
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Logo from './Logo';
import { useLanguage } from './LanguageContext';

const LoginPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { language, setLanguage, t } = useLanguage();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
            <div className="absolute top-4 right-4 group">
                {/* Language Selector */}
                <div className="relative inline-block text-left">
                    <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as 'pt' | 'en' | 'es')}
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-brand-primary focus:border-brand-primary sm:text-sm rounded-md bg-white text-gray-700 cursor-pointer"
                    >
                        <option value="pt">🇧🇷 PT</option>
                        <option value="en">🇺🇸 EN</option>
                        <option value="es">🇪u0053 ES</option>
                    </select>
                </div>
            </div>

            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-10 rounded-xl shadow-2xl">
                <div className="flex justify-center">
                    <Logo showText={true} />
                </div>
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        {language === 'pt' ? 'Entrar na sua conta' : language === 'en' ? 'Sign in to your account' : 'Iniciar sesión'}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Pixel Intranet
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <input type="hidden" name="remember" value="true" />
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email</label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm"
                                placeholder="Email"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">{language === 'pt' ? 'Senha' : language === 'en' ? 'Password' : 'Contraseña'}</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm"
                                placeholder={language === 'pt' ? 'Senha' : language === 'en' ? 'Password' : 'Contraseña'}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-primary hover:bg-emerald-600'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary transition-colors duration-200`}
                        >
                            {loading
                                ? (language === 'pt' ? 'Entrando...' : language === 'en' ? 'Signing in...' : 'Iniciando...')
                                : (language === 'pt' ? 'Entrar' : language === 'en' ? 'Sign in' : 'Iniciar sesión')}
                        </button>
                    </div>
                </form>
            </div>

            <div className="mt-8 text-center text-xs text-gray-500">
                &copy; 2026 Pixel Intranet. All rights reserved.
            </div>
        </div>
    );
};

export default LoginPage;