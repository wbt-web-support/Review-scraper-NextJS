import { createContext, useState, ReactNode, useEffect, useContext, useMemo, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeProviderContextState { 
  theme: Theme;
  resolvedTheme: "light" | "dark"; 
  setTheme: (theme: Theme) => void;
  isMounted: boolean;
}

const initialContextState: ThemeProviderContextState  = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {
    console.warn("ThemeProvider 'setTheme' called before context is fully initialized.");
  },
  isMounted: false,
};

const ThemeProviderContext = createContext<ThemeProviderContextState>(initialContextState);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}
export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "review-hub-theme",
}: ThemeProviderProps) {
  const [themePreference, setThemePreference] = useState<Theme>(defaultTheme); 
   const [actualAppliedTheme, setActualAppliedTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined" && defaultTheme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return defaultTheme === "dark" ? "dark" : "light";
  });
  const [isClientMounted, setIsClientMounted] = useState(false);

 useEffect(() => {
    setIsClientMounted(true);
    const storedTheme = localStorage.getItem(storageKey) as Theme | null;
    let effectiveInitialPreference = defaultTheme;
    if (storedTheme && ["light", "dark", "system"].includes(storedTheme)) {
      effectiveInitialPreference = storedTheme;
    }
    setThemePreference(effectiveInitialPreference);
  }, [storageKey, defaultTheme]);

useEffect(() => {
    if (!isClientMounted) {
      return;
    }
    const root = window.document.documentElement;
    let newResolvedTheme: "light" | "dark";
    if (themePreference === "system") {
      newResolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      newResolvedTheme = themePreference; 
    }
    root.classList.remove("light", "dark");
    root.classList.add(newResolvedTheme);
    setActualAppliedTheme(newResolvedTheme);
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = (e: MediaQueryListEvent) => {
      if (themePreference === "system") {
        const systemResolved = e.matches ? "dark" : "light";
        root.classList.remove("light", "dark");
        root.classList.add(systemResolved);
        setActualAppliedTheme(systemResolved);
      }
    };
    mediaQuery.addEventListener("change", handleSystemChange);
    return () => mediaQuery.removeEventListener("change", handleSystemChange);
  }, [themePreference, isClientMounted]);

  const handleSetTheme = useCallback((newTheme: Theme) => {
    if (!isClientMounted) {
      console.warn("Attempted to set theme before client hydration completed.");
      return;
    }
    localStorage.setItem(storageKey, newTheme);
    setThemePreference(newTheme); 
  }, [storageKey, isClientMounted]);
  const contextValue = useMemo(() => ({
    theme: themePreference,
    resolvedTheme: actualAppliedTheme,
    setTheme: handleSetTheme,
    isMounted: isClientMounted,
  }), [themePreference, actualAppliedTheme, handleSetTheme, isClientMounted]);
  return (
    <ThemeProviderContext.Provider value={contextValue}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = (): ThemeProviderContextState => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};