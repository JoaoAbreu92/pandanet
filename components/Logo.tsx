import React from 'react';

// The logo is embedded as a static file.
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
                    v1.0.8-beta
                </span>
            )}
        </div>
    );
};

export default Logo;