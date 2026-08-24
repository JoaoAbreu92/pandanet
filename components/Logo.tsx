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
    const [systemLogo, setSystemLogo] = useState<string | null>(null);

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
                }
            } catch (err) {
                console.error("Error fetching system logo:", err);
            }
        };
        fetchSystemLogo();
    }, []);

    return (
        <div className={`flex flex-col items-center justify-center ${className}`}>
            <img
                src={(companyLogo && companyLogo !== '/logo.png') ? companyLogo : (systemLogo || defaultLogo)}
                alt="Logo"
                className="max-h-full w-auto object-contain transition-all duration-300"
            />
            {showText && (
                <span className="text-[10px] text-gray-500 font-bold tracking-wider mt-1 uppercase whitespace-nowrap">
                    v{SYSTEM_VERSION}
                </span>
            )}
        </div>
    );
};

export default Logo;