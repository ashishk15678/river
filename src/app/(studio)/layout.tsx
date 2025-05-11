"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { BsHouse, BsCamera, BsPerson } from "react-icons/bs";
import { AvatarImage } from "@/components/ui/avatar";
import { AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart2,
  Calendar,
  Folder,
  MessageSquare,
  Menu,
  ChevronLeft,
  LogOut,
  Settings,
  Users,
  Mic,
  Home,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useState } from "react";

const navigation = [
  { name: "Dashboard", href: "/dash", icon: BsHouse },
  { name: "Studio", href: "/studio", icon: BsCamera },
  { name: "Profile", href: "/profile", icon: BsPerson },
];

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  // Debug logging
  console.log("Studio Layout - Session Status:", status);
  console.log("Studio Layout - Session Data:", session);

  // Show loading state while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Redirect to sign in if not authenticated
  if (!session?.user) {
    console.log("Studio Layout - Redirecting to sign in");
    redirect("/auth/signin");
  }

  // Check if username is set
  if (!session.user.hasSetUsername) {
    console.log("Studio Layout - Redirecting to setup username");
    redirect("/setup-username");
  }

  const [isRecording, setIsRecording] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      {/* Sidebar */}
      <div
        className={`dashboard-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}
      >
        <div className="p-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center">
            {!sidebarCollapsed && (
              <h1 className="text-xl font-bold text-gray-900">Relatia</h1>
            )}
            {sidebarCollapsed && <span className="text-xl font-bold">R</span>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="comic-button bg-white p-1"
          >
            {sidebarCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
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
              <a href="#" className="sidebar-link active">
                <Home size={20} className="icon" />
                <span className="text">Dashboard</span>
              </a>
              <a href="#" className="sidebar-link">
                <Mic size={20} className="icon" />
                <span className="text">Studio</span>
              </a>
              <a href="#" className="sidebar-link">
                <Folder size={20} className="icon" />
                <span className="text">Library</span>
              </a>
              <a href="#" className="sidebar-link">
                <Calendar size={20} className="icon" />
                <span className="text">Schedule</span>
              </a>
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
              <a href="#" className="sidebar-link">
                <BarChart2 size={20} className="icon" />
                <span className="text">Statistics</span>
              </a>
              <a href="#" className="sidebar-link">
                <Users size={20} className="icon" />
                <span className="text">Audience</span>
              </a>
              <a href="#" className="sidebar-link">
                <MessageSquare size={20} className="icon" />
                <span className="text">Feedback</span>
              </a>
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
              <a href="#" className="sidebar-link">
                <Settings size={20} className="icon" />
                <span className="text">Settings</span>
              </a>
              <a href="#" className="sidebar-link">
                <HelpCircle size={20} className="icon" />
                <span className="text">Help</span>
              </a>
            </nav>
          </div>
        </div>

        <div className={`sidebar-footer ${sidebarCollapsed ? "p-2" : ""}`}>
          {!sidebarCollapsed && (
            <div className="flex items-center mb-4">
              <Avatar className="h-10 w-10 mr-3">
                <AvatarImage
                  src="/placeholder.svg?height=40&width=40"
                  alt="User"
                />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">Alex Johnson</p>
                <p className="text-xs text-gray-500">alex@example.com</p>
              </div>
            </div>
          )}

          {sidebarCollapsed && (
            <Avatar className="h-10 w-10 mx-auto mb-4">
              <AvatarImage
                src="/placeholder.svg?height=40&width=40"
                alt="User"
              />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          )}

          <Button
            variant="outline"
            size="sm"
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
      <div className="pl-64">
        <main className="">
          <div className=" sm:px-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
