'use client';

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";

const ReserveRouter = dynamic(() => import("@reserve/app/router").then((mod) => mod.ReserveRouter), {
  ssr: false,
});

type ReserveAppProps = {
  initialPath?: string;
};

const normalizePath = (value: string | undefined): string => {
  if (!value) return "/";
  if (value.startsWith("/")) return value;
  return `/${value}`;
};

export default function ReserveApp({ initialPath = "/" }: ReserveAppProps) {
  const normalizedPath = useMemo(() => normalizePath(initialPath), [initialPath]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const expected = normalizedPath === "/" ? "/reserve" : `/reserve${normalizedPath}`;
    if (window.location.pathname !== expected) {
      window.history.replaceState(window.history.state, "", expected + window.location.search + window.location.hash);
    }
  }, [normalizedPath]);

  return <ReserveRouter key={normalizedPath} />;
}
