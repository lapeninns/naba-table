import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

import type { ReactNode } from 'react';

interface SettingsCardProps {
    title: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    className?: string;
    headerAction?: ReactNode;
}

export function SettingsCard({
    title,
    description,
    children,
    footer,
    className,
    headerAction,
}: SettingsCardProps) {
    return (
        <Card className={cn('w-full', className)}>
            <CardHeader>
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle>{title}</CardTitle>
                        {description && <CardDescription>{description}</CardDescription>}
                    </div>
                    {headerAction && <div>{headerAction}</div>}
                </div>
            </CardHeader>
            <CardContent>{children}</CardContent>
            {footer && <CardFooter className="border-t bg-muted/50 px-6 py-4">{footer}</CardFooter>}
        </Card>
    );
}
