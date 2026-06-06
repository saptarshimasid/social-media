import React from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import Suggestions from "@/components/suggestions";
import BottomNavigation from "@/components/bottom-navigation";
import ChatWindow from "@/components/chat-window";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground transition-all duration-200">
      <Navbar />
      <div className="flex flex-1 w-full max-w-7xl mx-auto">
        <Sidebar />
        <main className="flex-1 w-full min-w-0 px-4 py-6 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
        <Suggestions />
      </div>
      <BottomNavigation />
      <ChatWindow />
    </div>
  );
}
