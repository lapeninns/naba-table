import React from 'react';

import { cn } from '@shared/lib/cn';

export interface PageSectionProps {
    title?: string;
    description?: string;
    children: React.ReactNode;
    className?: string;
    id?: string;
}

export function PageSection({ title, description, children, className, id }: PageSectionProps) {
    return (
        <section id={id} className={cn('px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20', className)}>
            <div className="mx-auto max-w-[80vw]">
                {title || description ? (
                    <div className="mb-12 text-center sm:mb-16">
                        {title ? (
                            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                                {title}
                            </h2>
                        ) : null}
                        {description ? (
                            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
                                {description}
                            </p>
                        ) : null}
                    </div>
                ) : null}
                {children}
            </div>
        </section>
    );
}
