import { GuestLayout } from "@/components/layouts/GuestLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <GuestLayout>{children}</GuestLayout>;
}
