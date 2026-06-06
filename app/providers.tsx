"use client";

import React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { NotificationProvider } from "@/components/notification-provider";
import { ChatProvider } from "@/components/chat-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <NotificationProvider>
            {children}
          </NotificationProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
