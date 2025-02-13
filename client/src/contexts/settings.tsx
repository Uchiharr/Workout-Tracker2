import { createContext, useContext, useState, useEffect } from "react";
import { hexToHSL } from "@/lib/utils";

type WeightUnit = "kg" | "lb";
type ThemeMode = "light" | "dark";

interface SettingsContextType {
  weightUnit: WeightUnit;
  setWeightUnit: (unit: WeightUnit) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem("weightUnit");
      return (stored === "kg" || stored === "lb") ? stored : "kg";
    }
    return "kg";
  });

  const [accentColor, setAccentColor] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("accentColor") || "#3b82f6";
    }
    return "#3b82f6";
  });

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem("themeMode") as ThemeMode) || "dark";
    }
    return "dark";
  });

  const handleSetWeightUnit = (unit: WeightUnit) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("weightUnit", unit);
    }
    setWeightUnit(unit);
  };

  const handleSetAccentColor = (color: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("accentColor", color);
    }
    setAccentColor(color);

    // Convert hex to HSL and apply to CSS variables
    const hsl = hexToHSL(color);
    const root = document.documentElement;
    root.style.setProperty('--primary', hsl);
    root.style.setProperty('--primary-foreground', '0 0% 100%');

    // Apply to interactive elements
    root.style.setProperty('--ring', hsl);
    root.style.setProperty('--input', hsl);
    root.style.setProperty('--border', hsl);

    // Set accent colors
    root.style.setProperty('--accent', hsl);
    root.style.setProperty('--accent-foreground', '0 0% 100%');
  };

  const handleSetThemeMode = (mode: ThemeMode) => {
    localStorage.setItem("themeMode", mode);
    setThemeMode(mode);
    document.documentElement.classList.toggle("dark", mode === "dark");
  };

  // Initialize theme and colors on mount
  useEffect(() => {
    handleSetThemeMode(themeMode);
    handleSetAccentColor(accentColor);
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      weightUnit, 
      setWeightUnit: handleSetWeightUnit,
      accentColor,
      setAccentColor: handleSetAccentColor,
      themeMode,
      setThemeMode: handleSetThemeMode
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}