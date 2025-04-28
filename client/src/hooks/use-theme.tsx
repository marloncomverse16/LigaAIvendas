import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "./use-toast";
import { Settings } from "@shared/schema";

type ThemeContextType = {
  theme: 'light' | 'dark';
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string | null;
  isLoading: boolean;
  toggleTheme: () => void;
  updateColors: (colors: { primaryColor?: string; secondaryColor?: string }) => void;
  updateLogo: (logoUrl: string) => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [primaryColor, setPrimaryColor] = useState("#047857");
  const [secondaryColor, setSecondaryColor] = useState("#4f46e5");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    onSuccess: (data) => {
      if (data) {
        setTheme(data.darkMode ? 'dark' : 'light');
        setPrimaryColor(data.primaryColor || "#047857");
        setSecondaryColor(data.secondaryColor || "#4f46e5");
        setLogoUrl(data.logoUrl);
      }
    },
    // Error is not handled here since the API requires authentication
    // and the auth provider will handle the redirect if needed
  });
  
  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<Settings>) => {
      const res = await apiRequest("PUT", "/api/settings", settings);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/settings"], data);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar configurações",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    updateSettingsMutation.mutate({ darkMode: newTheme === 'dark' });
  };
  
  const updateColors = ({ primaryColor, secondaryColor }: { primaryColor?: string; secondaryColor?: string }) => {
    if (primaryColor) setPrimaryColor(primaryColor);
    if (secondaryColor) setSecondaryColor(secondaryColor);
    
    const updates: Partial<Settings> = {};
    if (primaryColor) updates.primaryColor = primaryColor;
    if (secondaryColor) updates.secondaryColor = secondaryColor;
    
    updateSettingsMutation.mutate(updates);
  };
  
  const updateLogo = (newLogoUrl: string) => {
    setLogoUrl(newLogoUrl);
    updateSettingsMutation.mutate({ logoUrl: newLogoUrl });
  };
  
  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Update CSS variables for colors
    document.documentElement.style.setProperty('--primary', convertHexToHsl(primaryColor));
    document.documentElement.style.setProperty('--secondary', convertHexToHsl(secondaryColor));
    
  }, [theme, primaryColor, secondaryColor]);
  
  return (
    <ThemeContext.Provider value={{
      theme,
      primaryColor,
      secondaryColor,
      logoUrl,
      isLoading,
      toggleTheme,
      updateColors,
      updateLogo
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Utility function to convert hex to HSL for CSS variables
function convertHexToHsl(hex: string): string {
  // Remove the # if present
  hex = hex.replace('#', '');
  
  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Find min and max values
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  
  // Calculate luminance
  let l = (max + min) / 2;
  
  // If min and max are the same, the color is grayscale
  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }
  
  // Calculate saturation
  let s = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  
  // Calculate hue
  let h;
  if (max === r) {
    h = (g - b) / (max - min) + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / (max - min) + 2;
  } else {
    h = (r - g) / (max - min) + 4;
  }
  h *= 60;
  
  // Return as HSL string for CSS
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
