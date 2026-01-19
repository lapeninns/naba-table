import React from 'react';

import { cn } from '@shared/lib/cn';

export interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    className?: string;
}

export function FeatureCard({ icon, title, description, className }: FeatureCardProps) {
    return (
        <div
            className={cn(
                'group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-2xl sm:p-7',
                className,
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-primary/10 opacity-0 transition group-hover:opacity-100" aria-hidden />
            <div className="relative space-y-3">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary shadow-sm shadow-primary/20 transition-transform duration-300 group-hover:scale-110">
                    {icon}
                </div>
                <h3 className="text-lg font-semibold text-white sm:text-xl">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-200 sm:text-base">{description}</p>
            </div>
        </div>
    );
}
