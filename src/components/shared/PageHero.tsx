import React from 'react';

import { cn } from '@shared/lib/cn';

export interface PageHeroProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
    className?: string;
    size?: 'default' | 'large';
    gradient?: boolean;
}

export function PageHero({
    title,
    description,
    children,
    className,
    size = 'default',
    gradient = true,
}: PageHeroProps) {
    return (
        <section
            className={cn(
                'relative overflow-hidden px-4 py-14 sm:px-6 sm:py-18 lg:px-8',
                size === 'large' && 'lg:py-24',
                gradient && 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white',
                className,
            )}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute left-[-5%] top-[-20%] h-64 w-64 rounded-full bg-primary/30 blur-3xl" aria-hidden />
                <div className="absolute right-[5%] top-[10%] h-80 w-80 rounded-full bg-amber-200/25 blur-3xl" aria-hidden />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.06),transparent_30%)]" aria-hidden />
            </div>

            <div className="relative mx-auto w-full max-w-6xl">
                <div className="mx-auto max-w-4xl rounded-3xl bg-white/5 p-8 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur">
                    <div className="inline-flex items-center justify-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                        Guest Experience
                    </div>
                    <h1
                        className={cn(
                            'mt-4 font-bold leading-tight tracking-tight animate-fade-in text-white',
                            size === 'large'
                                ? 'text-4xl sm:text-5xl lg:text-6xl'
                                : 'text-3xl sm:text-4xl lg:text-5xl',
                        )}
                    >
                        {title}
                    </h1>
                    {description ? (
                        <p
                            className={cn(
                                'mt-4 leading-relaxed text-slate-200 sm:mt-6 animate-fade-in',
                                size === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
                            )}
                            style={{ animationDelay: '120ms' }}
                        >
                            {description}
                        </p>
                    ) : null}
                    {children ? (
                        <div
                            className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6 animate-fade-in"
                            style={{ animationDelay: '200ms' }}
                        >
                            {children}
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
