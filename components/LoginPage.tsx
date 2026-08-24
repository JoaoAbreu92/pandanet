

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import Logo from './Logo';
import { useLanguage } from './LanguageContext';

const LoginPage: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [domain, setDomain] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const { language, setLanguage } = useLanguage();

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        if (isSignUp) {
            if (password !== confirmPassword) {
                setError(language === 'pt' ? 'Senhas não conferem.' : language === 'en' ? 'Passwords do not match.' : 'Las contraseñas no coinciden.');
                setLoading(false);
                return;
            }
            // Sign Up Logic
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                    }
                }
            });

            if (signUpError) {
                setError(signUpError.message);
            } else if (authData.user) {
                // Try to find company by domain
                const { data: companyData } = await supabase
                    .from('companies')
                    .select('id')
                    .ilike('domain', domain.trim())
                    .single();

                // Profile is usually created by a database trigger on auth.users insert.
                // We will try to update it here with the company_id and status pending
                setTimeout(async () => {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .update({
                            company_id: companyData?.id || null,
                            status: 'pending'
                        })
                        .eq('id', authData.user!.id);

                    if (updateError) console.error("Error updating profile with company:", updateError);
                }, 1000); // Small delay to let trigger finish

                setMessage(language === 'pt'
                    ? 'Cadastro realizado! Verifique seu email para confirmar. Sua conta passará por aprovação.'
                    : language === 'en'
                        ? 'Sign up successful! Please check your email to confirm. Your account will undergo approval.'
                        : '¡Registro exitoso! Verifique su correo para confirmar. Su cuenta pasará por aprobación.');
                setIsSignUp(false); // Switch back to login for UX
            }
        } else {
            // Login Logic
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message);
            }
        }
        setLoading(false);
    };

    const toggleMode = () => {
        setIsSignUp(!isSignUp);
        setError(null);
        setMessage(null);
        setPassword('');
        setConfirmPassword('');
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
                        <option value="pt">🇧🇷 Brasil</option>
                        <option value="en">🇺🇸 USA</option>
                        <option value="es">🇪🇸 España</option>
                    </select>
                </div>
            </div>

            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-10 rounded-xl shadow-2xl">
                <div className="flex justify-center">
                    <Logo showText={true} />
                </div>
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        {isSignUp
                            ? (language === 'pt' ? 'Crie sua conta' : language === 'en' ? 'Create your account' : 'Crea tu cuenta')
                            : (language === 'pt' ? 'Entrar na sua conta' : language === 'en' ? 'Sign in to your account' : 'Iniciar sesión')
                        }
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Pixel Intranet
                    </p>
                </div>

                {message && (
                    <div className="text-green-600 text-sm text-center bg-green-50 p-2 rounded border border-green-200">
                        {message}
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleAuth}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        {isSignUp && (
                            <div>
                                <label htmlFor="name" className="sr-only">Nome Completo</label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    required={isSignUp}
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm"
                                    placeholder={language === 'pt' ? 'Nome Completo' : language === 'en' ? 'Full Name' : 'Nombre Completo'}
                                />
                            </div>
                        )}
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
                                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${!isSignUp ? 'rounded-t-md' : ''} focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm`}
                                placeholder="Email"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">{language === 'pt' ? 'Senha' : language === 'en' ? 'Password' : 'Contraseña'}</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete={isSignUp ? "new-password" : "current-password"}
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 ${!isSignUp ? 'rounded-b-md' : ''} focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm`}
                                placeholder={language === 'pt' ? 'Senha' : language === 'en' ? 'Password' : 'Contraseña'}
                            />
                        </div>
                        {isSignUp && (
                            <div>
                                <label htmlFor="confirm-password" className="sr-only">{language === 'pt' ? 'Confirmar Senha' : language === 'en' ? 'Confirm Password' : 'Confirmar Contraseña'}</label>
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type="password"
                                    required={isSignUp}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm"
                                    placeholder={language === 'pt' ? 'Confirmar Senha' : language === 'en' ? 'Confirm Password' : 'Confirmar Contraseña'}
                                />
                            </div>
                        )}
                        {isSignUp && (
                            <div>
                                <label htmlFor="domain" className="sr-only">Domínio da Empresa</label>
                                <input
                                    id="domain"
                                    name="domain"
                                    type="text"
                                    required={isSignUp}
                                    value={domain}
                                    onChange={(e) => setDomain(e.target.value)}
                                    className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-brand-primary focus:border-brand-primary focus:z-10 sm:text-sm"
                                    placeholder={language === 'pt' ? 'Domínio da Empresa (ex: empresa.com)' : language === 'en' ? 'Company Domain (ex: company.com)' : 'Dominio de la Empresa'}
                                />
                            </div>
                        )}
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
                                ? (language === 'pt' ? 'Processando...' : language === 'en' ? 'Processing...' : 'Procesando...')
                                : (isSignUp
                                    ? (language === 'pt' ? 'Cadastrar' : language === 'en' ? 'Sign Up' : 'Registrarse')
                                    : (language === 'pt' ? 'Entrar' : language === 'en' ? 'Sign in' : 'Iniciar sesión'))
                            }
                        </button>
                    </div>

                    <div className="flex items-center justify-center">
                        <button
                            type="button"
                            onClick={toggleMode}
                            className="text-sm font-medium text-brand-primary hover:text-brand-secondary focus:outline-none underline"
                        >
                            {isSignUp
                                ? (language === 'pt' ? 'Já tem uma conta? Entre aqui' : language === 'en' ? 'Already have an account? Sign in' : '¿Ya tienes cuenta? Inicia sesión')
                                : (language === 'pt' ? 'Não tem acesso? Cadastre-se' : language === 'en' ? 'No access? Sign up' : '¿No tienes acceso? Regístrate')
                            }
                        </button>
                    </div>
                </form>
            </div>


            <div className="mt-8 text-center space-y-2">
                <p className="text-xs text-gray-500">
                    &copy; 2026 Pixel Intranet. All rights reserved.
                </p>
                <a
                    href="https://grupopixel.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex flex-col items-center gap-1 group transition-all"
                >
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold group-hover:text-brand-primary">Sistema criado por</span>
                    <span className="text-xs font-black text-gray-600 dark:text-gray-400 group-hover:text-brand-primary flex items-center gap-1">
                        Grupo Pixel
                        <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </span>
                </a>
            </div>
        </div>
    );
};

export default LoginPage;