import React, { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: ButtonVariant; size?: ButtonSize; isLoading?: boolean; loadingText?: string; leftIcon?: React.ReactNode; rightIcon?: React.ReactNode; fullWidth?: boolean; }

const variants: Record<ButtonVariant, string> = {
    primary: 'border-emerald-500 bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20 hover:border-emerald-400 hover:bg-emerald-400 focus-visible:ring-emerald-500/30',
    secondary: 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-slate-400/25 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-400/10 dark:hover:text-emerald-300',
    outline: 'border-emerald-500/60 bg-transparent text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-500/25 dark:text-emerald-300 dark:hover:bg-emerald-400/10',
    ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-slate-400/25 dark:text-slate-300 dark:hover:bg-white/[0.07] dark:hover:text-white',
    danger: 'border-rose-600 bg-rose-600 text-white shadow-sm shadow-rose-600/15 hover:border-rose-500 hover:bg-rose-500 focus-visible:ring-rose-500/30'
};
const sizes: Record<ButtonSize, string> = { sm: 'min-h-8 gap-1.5 rounded-lg px-3 py-1.5 text-xs', md: 'min-h-10 gap-2 rounded-xl px-4 py-2 text-sm', lg: 'min-h-12 gap-2.5 rounded-xl px-5 py-3 text-base', icon: 'h-10 w-10 rounded-xl p-0' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className = '', variant = 'primary', size = 'md', isLoading = false, loadingText = 'Carregando...', leftIcon, rightIcon, fullWidth = false, children, type = 'button', disabled, ...props }, ref) => (
    <button ref={ref} type={type} disabled={disabled || isLoading} aria-busy={isLoading || undefined} className={`inline-flex select-none items-center justify-center border font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`} {...props}>
        {isLoading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : leftIcon}
        {isLoading ? loadingText : children}
        {!isLoading && rightIcon}
    </button>
));
Button.displayName = 'Button';
