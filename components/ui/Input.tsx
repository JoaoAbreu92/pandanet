import React, { InputHTMLAttributes, forwardRef, useId } from 'react';
interface InputProps extends InputHTMLAttributes<HTMLInputElement> { label?: string; error?: string; hint?: string; leadingIcon?: React.ReactNode; trailingElement?: React.ReactNode; wrapperClassName?: string; }

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, leadingIcon, trailingElement, wrapperClassName = '', className = '', id, required, disabled, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;
    const descriptionId = error || hint ? `${inputId}-description` : undefined;
    return <div className={`w-full ${wrapperClassName}`}>
        {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}{required && <span className="ml-1 text-rose-500" aria-hidden="true">*</span>}</label>}
        <div className="relative">
            {leadingIcon && <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400" aria-hidden="true">{leadingIcon}</span>}
            <input ref={ref} id={inputId} required={required} disabled={disabled} aria-invalid={!!error} aria-describedby={descriptionId} className={`min-h-10 w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:bg-slate-950/40 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-white/5 ${leadingIcon ? 'pl-10' : ''} ${trailingElement ? 'pr-10' : ''} ${error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/15' : 'border-slate-200 dark:border-white/10'} ${className}`} {...props} />
            {trailingElement && <span className="absolute inset-y-0 right-3 flex items-center">{trailingElement}</span>}
        </div>
        {(error || hint) && <p id={descriptionId} className={`mt-1.5 text-xs ${error ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>{error || hint}</p>}
    </div>;
});
Input.displayName = 'Input';
