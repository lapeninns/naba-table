import { redirect } from "next/navigation";

export const metadata = {
  title: "Browse restaurants · SajiloReserveX",
  description: "This page has moved. Please visit our restaurant partner experience.",
};

export const dynamic = "force-dynamic";

export default function BrowseRedirectPage() {
  redirect("/");
}
