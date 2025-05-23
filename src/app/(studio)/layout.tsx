"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  Home,
  Mic,
  Folder,
  Calendar,
  BarChart2,
  Users,
  MessageSquare,
  Settings,
  HelpCircle,
  Menu,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const isActive = (path: string) => pathname === path;

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: 1000 * 60 * 5, // 5 minutes (replaces cacheTime)
        staleTime: 1000 * 60, // 1 minute
      },
    },
  });

  return (
    <div className="dashboard-bg min-h-screen">
      {/* Sidebar */}
      <div
        className={`dashboard-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center">
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">MusicWave</h1>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="comic-button bg-white p-1"
          >
            {sidebarCollapsed ? <Menu size={28} /> : <ChevronLeft size={18} />}
          </Button>
        </div>

        <div className="py-4">
          <div className="mb-6">
            <p
              className={`px-4 text-xs font-semibold text-gray-500 mb-2 ${
                sidebarCollapsed ? "hidden" : ""
              }`}
            >
              MAIN
            </p>
            <nav>
              <Link
                href="/dash"
                className={`sidebar-link ${isActive("/dash") ? "active" : ""}`}
              >
                <Home size={20} className="icon" />
                <span className="text">Dashboard</span>
              </Link>
              <Link
                href="/studio"
                className={`sidebar-link ${
                  isActive("/studio") ? "active" : ""
                }`}
              >
                <Mic size={20} className="icon" />
                <span className="text">Studio</span>
              </Link>
              <Link
                href="/library"
                className={`sidebar-link ${
                  isActive("/library") ? "active" : ""
                }`}
              >
                <Folder size={20} className="icon" />
                <span className="text">Library</span>
              </Link>
              <Link
                href="/schedule"
                className={`sidebar-link ${
                  isActive("/schedule") ? "active" : ""
                }`}
              >
                <Calendar size={20} className="icon" />
                <span className="text">Schedule</span>
              </Link>
            </nav>
          </div>

          <div className="mb-6">
            <p
              className={`px-4 text-xs font-semibold text-gray-500 mb-2 ${
                sidebarCollapsed ? "hidden" : ""
              }`}
            >
              ANALYTICS
            </p>
            <nav>
              <Link
                href="/analytics"
                className={`sidebar-link ${
                  isActive("/analytics") ? "active" : ""
                }`}
              >
                <BarChart2 size={20} className="icon" />
                <span className="text">Statistics</span>
              </Link>
              <Link
                href="/audience"
                className={`sidebar-link ${
                  isActive("/audience") ? "active" : ""
                }`}
              >
                <Users size={20} className="icon" />
                <span className="text">Audience</span>
              </Link>
              <Link
                href="/feedback"
                className={`sidebar-link ${
                  isActive("/feedback") ? "active" : ""
                }`}
              >
                <MessageSquare size={20} className="icon" />
                <span className="text">Feedback</span>
              </Link>
            </nav>
          </div>

          <div>
            <p
              className={`px-4 text-xs font-semibold text-gray-500 mb-2 ${
                sidebarCollapsed ? "hidden" : ""
              }`}
            >
              SETTINGS
            </p>
            <nav>
              <Link
                href="/settings"
                className={`sidebar-link ${
                  isActive("/settings") ? "active" : ""
                }`}
              >
                <Settings size={20} className="icon" />
                <span className="text">Settings</span>
              </Link>
              <Link
                href="/help"
                className={`sidebar-link ${isActive("/help") ? "active" : ""}`}
              >
                <HelpCircle size={20} className="icon" />
                <span className="text">Help</span>
              </Link>
            </nav>
          </div>
        </div>

        <div className={`sidebar-footer ${sidebarCollapsed ? "p-2" : ""}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center mb-4">
              <Avatar className="h-10 w-10 mr-3">
                <AvatarImage
                  src={
                    session?.user?.image ||
                    "/placeholder.svg?height=40&width=40"
                  }
                  alt="User"
                />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{session?.user?.name}</p>
                <p className="text-xs text-gray-500">{session?.user?.email}</p>
              </div>
            </div>
          )}

          {sidebarCollapsed && (
            <Avatar className="h-10 w-10 mx-auto mb-4">
              <AvatarImage
                src={
                  session?.user?.image || "/placeholder.svg?height=40&width=40"
                }
                alt="User"
              />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut()}
            className={`comic-button bg-white ${
              sidebarCollapsed ? "w-full justify-center" : "w-full"
            }`}
          >
            <LogOut size={16} className={sidebarCollapsed ? "" : "mr-2"} />
            {!sidebarCollapsed && <span>Sign Out</span>}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div
        className={`dashboard-content ${
          sidebarCollapsed ? "sidebar-collapsed" : ""
        }`}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </div>
    </div>
  );
}
