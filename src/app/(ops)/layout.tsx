import type { ReactNode } from "react";

type OpsLayoutProps = {
  children: ReactNode;
};

export default function OpsLayout({ children }: OpsLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {children}
    </div>
  );
}
