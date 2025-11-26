import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

interface SettingsSectionHeaderProps {
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export function SettingsSectionHeader({
    title,
    description,
    action,
    className,
}: SettingsSectionHeaderProps) {
    return (
        <div className={cn('flex flex-col gap-1 pb-4', className)}>
            <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-medium leading-none tracking-tight">{title}</h3>
                {action}
            </div>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
    );
}
