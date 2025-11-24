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
                'group relative rounded-2xl border border-border bg-card p-6 shadow-md transition-all duration-300 hover:shadow-lg hover:border-primary/30 sm:p-8',
                className,
            )}
        >
            {/* Icon */}
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                {icon}
            </div>

            {/* Title */}
            <h3 className="mb-2 text-lg font-semibold text-foreground sm:text-xl">{title}</h3>

            {/* Description */}
            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p>
        </div>
    );
}
