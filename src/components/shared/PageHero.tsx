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
                'relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-8',
                size === 'large' && 'lg:py-24',
                gradient && 'bg-gradient-to-br from-primary/5 via-background to-primary/10',
                className,
            )}
        >
            <div className="relative mx-auto max-w-[80vw]">
                <div className="mx-auto max-w-3xl text-center">
                    <h1
                        className={cn(
                            'font-bold tracking-tight text-foreground animate-fade-in',
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
                                'mt-4 leading-relaxed text-muted-foreground sm:mt-6 animate-fade-in',
                                size === 'large' ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
                            )}
                            style={{ animationDelay: '100ms' }}
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
