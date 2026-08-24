import React from 'react';
import { SYSTEM_VERSION } from '../version';

const logoSrc = '/logo.png';

interface LogoProps {
    showText?: boolean;
    className?: string;
    companyLogo?: string;
}

const Logo: React.FC<LogoProps> = ({ showText = true, className = '', companyLogo }) => {
    return (
        <div className={`flex flex-col items-center ${className}`}>
            <img src={companyLogo || logoSrc} alt="Logo" className="h-12 w-auto object-contain" />
            {showText && (
                <span className="text-[10px] text-gray-400 font-medium tracking-wider -mt-1">
                    v{SYSTEM_VERSION}
                </span>
            )}
        </div>
    );
};

export default Logo;