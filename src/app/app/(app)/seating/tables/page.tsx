import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Table Inventory | Operations",
  description: "Table settings have moved to /settings/tables",
};

export default function LegacyTablesPage() {
  redirect('/settings/tables');
}
