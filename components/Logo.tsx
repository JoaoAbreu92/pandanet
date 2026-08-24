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
        <div className={`flex items-center ${className}`}>
            <img src={companyLogo || logoSrc} alt="Logo" className="h-12 w-auto object-contain" />
        </div>
    );
};

export default Logo;