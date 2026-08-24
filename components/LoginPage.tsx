import React, { useState } from 'react';
import Logo from './Logo';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

interface LoginPageProps {
    onLogin: (email: string, pass: string) => boolean;
    companyName: string;
    onBack: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, companyName, onBack }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = onLogin(email, password);
        if (!success) {
            setError('Credenciais inválidas. Tente novamente.');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md">
                <div className="text-center">
                    <Logo showText={true} className="mx-auto mb-4 w-40" />
                    <h1 className="text-2xl font-bold text-brand-text">Acesse a intranet da {companyName}</h1>
                    <p className="mt-2 text-brand-subtle-text">Bem-vindo de volta!</p>
                </div>
                <form className="space-y-6" onSubmit={handleSubmit}>
                    {error && <div className="p-3 text-sm text-red-700 bg-red-100 rounded-lg">{error}</div>}
                    <Input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        label="Email"
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        placeholder="seu.email@empresa.com"
                    />
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        label="Senha"
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        placeholder="********"
                    />
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 text-brand-primary bg-gray-100 border-gray-300 rounded focus:ring-brand-primary"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                                Lembrar senha
                            </label>
                        </div>

                        <div className="text-sm">
                            <a href="#" className="font-medium text-brand-primary hover:text-emerald-700">
                                Esqueceu a senha?
                            </a>
                        </div>
                    </div>
                    <div>
                        <Button
                            type="submit"
                            className="w-full"
                            variant="primary"
                        >
                            Entrar
                        </Button>
                    </div>
                </form>
                <div className="text-center mt-4 text-sm">
                    <p className="text-brand-subtle-text">
                        Não está na empresa certa?{' '}
                        <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }} className="font-semibold text-brand-primary hover:underline">
                            Voltar
                        </a>
                    </p>
                </div>
            </div>
            <footer className="text-center text-xs text-gray-500 py-4 mt-8">
                © 2024 Grupo Pixel. Todos os direitos reservados.
            </footer>
        </div>
    );
}

export default LoginPage;