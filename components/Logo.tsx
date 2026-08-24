import React from 'react';

// The logo is embedded as a static file.
const logoSrc = '/logo.png';

interface LogoProps {
    showText?: boolean;
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ showText = true, className = '' }) => {
    return (
        <div className={`flex items-center ${className}`}>
            <img src={logoSrc} alt="Pixel Intranet Logo" className="h-12 w-auto" />
        </div>
    );
};

export default Logo;