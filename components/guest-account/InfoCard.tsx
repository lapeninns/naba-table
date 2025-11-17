import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type InfoCardProps = {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  footer?: ReactNode;
};

export function InfoCard({ title, description, children, className, footer }: InfoCardProps) {
  return (
    <Card className={cn("border-slate-200 shadow-sm", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg font-semibold text-slate-900">{title}</CardTitle>
        {description ? <p className="text-sm text-slate-600">{description}</p> : null}
      </CardHeader>
      {children ? <CardContent className="space-y-3 text-sm text-slate-700">{children}</CardContent> : null}
      {footer ? <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-700">{footer}</div> : null}
    </Card>
  );
}

