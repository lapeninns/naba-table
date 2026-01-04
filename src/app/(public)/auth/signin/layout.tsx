import { EnhancedAuthLayout } from '@/components/layouts/EnhancedAuthLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <EnhancedAuthLayout variant="guest" defaultRedirect="/guest/dashboard">
      {children}
    </EnhancedAuthLayout>
  );
}
