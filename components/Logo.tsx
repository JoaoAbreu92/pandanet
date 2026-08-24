import React, { useState, useEffect } from 'react';
import { SYSTEM_VERSION } from '../version';
import { supabase } from '../supabaseClient';

const defaultLogo = '/logo.png';

interface LogoProps {
    showText?: boolean;
    className?: string;
    companyLogo?: string;
}

const Logo: React.FC<LogoProps> = ({ showText = true, className = '', companyLogo }) => {
    const [systemLogo, setSystemLogo] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('system_logo') || null;
        }
        return null;
    });
    const [loading, setLoading] = useState(!systemLogo);

    useEffect(() => {
        const fetchSystemLogo = async () => {
            try {
                const { data, error } = await supabase
                    .from('system_settings')
                    .select('value')
                    .eq('key', 'main_logo')
                    .maybeSingle();

                if (!error && data?.value) {
                    setSystemLogo(data.value);
                    localStorage.setItem('system_logo', data.value);
                }
            } catch (err) {
                console.error("Error fetching system logo:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSystemLogo();
    }, []);

    const logoSrc = (companyLogo && companyLogo !== '/logo.png') ? companyLogo : (systemLogo || defaultLogo);

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            {loading && !companyLogo ? (
                <div className="w-32 h-10 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
            ) : (
                <img
                    src={logoSrc}
                    alt="Logo"
                    className="max-h-full w-auto object-contain transition-all duration-300 dark:brightness-110 dark:contrast-105 dark:drop-shadow-[0_0_3px_rgba(255,255,255,0.45)]"
                />
            )}
            {showText && (
                <span className="text-[10px] text-gray-500 font-semibold tracking-wider mt-1 uppercase whitespace-nowrap">
                    v{SYSTEM_VERSION}
                </span>
            )}
        </div>
    );
};

export default Logo;