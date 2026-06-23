import { EnhancedAuthLayout } from '@/components/layouts/EnhancedAuthLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <EnhancedAuthLayout variant="restaurant" defaultRedirect="/dashboard">
      {children}
    </EnhancedAuthLayout>
  );
}
