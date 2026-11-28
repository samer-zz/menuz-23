"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type Theme = "dark" | "light";

interface ToastItem {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  toast: (message: string, type?: ToastItem["type"]) => void;
}

const AppContext = createContext<AppContextValue>({
  theme: "dark",
  toggleTheme: () => {},
  toast: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("menuz-theme") as Theme | null;
    const initial: Theme = saved === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("menuz-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  const toast = useCallback(
    (message: string, type: ToastItem["type"] = "success") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2400);
    },
    []
  );

  return (
    <AppContext.Provider value={{ theme, toggleTheme, toast }}>
      {children}
      {/* Floating Non-Blocking RTL Toast Stack (top-left so it never covers bottom cart/action buttons) */}
      <div
        aria-live="polite"
        className="fixed top-4 left-4 z-[100] flex flex-col gap-2 max-w-xs sm:max-w-sm w-[calc(100vw-2rem)] pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold shadow-xl border backdrop-blur-xl bg-white/95 dark:bg-[#092044]/95 border-navy-700/15 dark:border-white/15 text-navy-700 dark:text-white"
            >
              {t.type === "success" && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              )}
              {t.type === "error" && (
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              )}
              {t.type === "info" && (
                <Info className="w-5 h-5 text-brand-orange shrink-0" />
              )}
              <span className="flex-1 leading-relaxed">{t.message}</span>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }
                className="p-1 rounded-lg opacity-60 hover:opacity-100 transition"
                aria-label="إغلاق التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
