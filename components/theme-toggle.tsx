"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme-provider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl bg-secondary hover:bg-muted/10 border border-border/40 text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 active:scale-95 cursor-pointer relative overflow-hidden"
      aria-label="Toggle theme"
    >
      <div className="relative w-5 h-5">
        <Sun
          className={`absolute inset-0 transform transition-transform duration-300 ${
            theme === "dark" ? "rotate-90 scale-0" : "rotate-0 scale-100"
          }`}
          size={20}
        />
        <Moon
          className={`absolute inset-0 transform transition-transform duration-300 ${
            theme === "light" ? "-rotate-90 scale-0" : "rotate-0 scale-100"
          }`}
          size={20}
        />
      </div>
    </button>
  );
}
