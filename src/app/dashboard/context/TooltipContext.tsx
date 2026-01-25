'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TooltipContextType {
  tooltipsEnabled: boolean;
  toggleTooltips: () => void;
  setTooltipsEnabled: (enabled: boolean) => void;
}

const TooltipContext = createContext<TooltipContextType>({
  tooltipsEnabled: true,
  toggleTooltips: () => {},
  setTooltipsEnabled: () => {},
});

const STORAGE_KEY = 'ragbox-tooltips-enabled';

export function TooltipProvider({ children }: { children: ReactNode }) {
  const [tooltipsEnabled, setTooltipsEnabledState] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      setTooltipsEnabledState(stored === 'true');
    }
    setIsHydrated(true);
  }, []);

  const toggleTooltips = () => {
    const newValue = !tooltipsEnabled;
    setTooltipsEnabledState(newValue);
    localStorage.setItem(STORAGE_KEY, String(newValue));
  };

  const setTooltipsEnabled = (enabled: boolean) => {
    setTooltipsEnabledState(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  };

  // Prevent flash of wrong state during hydration
  const effectiveEnabled = isHydrated ? tooltipsEnabled : true;

  return (
    <TooltipContext.Provider value={{
      tooltipsEnabled: effectiveEnabled,
      toggleTooltips,
      setTooltipsEnabled
    }}>
      {children}
    </TooltipContext.Provider>
  );
}

export const useTooltips = () => useContext(TooltipContext);

export default TooltipContext;
