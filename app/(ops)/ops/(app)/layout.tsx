import type { ReactNode } from "react";
import { cookies } from "next/headers";

import { OpsAppShell } from "@/components/ops/OpsAppShell";

type OpsAppLayoutProps = {
  children: ReactNode;
};

export default async function OpsAppLayout({ children }: OpsAppLayoutProps) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

  return <OpsAppShell defaultOpen={defaultOpen}>{children}</OpsAppShell>;
}
