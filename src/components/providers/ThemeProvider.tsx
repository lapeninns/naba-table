"use client";

import { useEffect } from "react";

export type ThemeVariant = "guest" | "app";

interface ThemeProviderProps {
    theme: ThemeVariant;
    children: React.ReactNode;
}

/**
 * ThemeProvider sets the data-theme attribute on the <html> element.
 * This enables CSS theme switching via [data-theme="guest"] or [data-theme="app"] selectors.
 * 
 * Usage:
 * ```tsx
 * <ThemeProvider theme="guest">
 *   <YourComponent />
 * </ThemeProvider>
 * ```
 * 
 * The theme attribute is set on document.documentElement to enable global CSS variable overrides.
 */
export function ThemeProvider({ theme, children }: ThemeProviderProps) {
    useEffect(() => {
        // Set the data-theme attribute on the <html> element
        document.documentElement.setAttribute("data-theme", theme);

        // Cleanup: remove attribute when component unmounts (optional)
        return () => {
            // We don't remove the attribute on unmount as it may cause flickering
            // between route transitions. The next ThemeProvider will override it.
        };
    }, [theme]);

    return <>{children}</>;
}

/**
 * Hook to get/set the current theme.
 * Can be used for theme toggle functionality.
 */
export function useTheme() {
    const setTheme = (theme: ThemeVariant) => {
        document.documentElement.setAttribute("data-theme", theme);
    };

    const getTheme = (): ThemeVariant => {
        if (typeof document === "undefined") return "guest";
        return (document.documentElement.getAttribute("data-theme") as ThemeVariant) || "guest";
    };

    return { setTheme, getTheme };
}
