import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team management · Nab a Table",
  description: "This route has moved to restaurant settings.",
};

export default function TeamManagementPage() {
  redirect("/settings/restaurant/team");
}
