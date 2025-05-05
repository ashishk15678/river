"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  FiHome,
  FiVideo,
  FiUsers,
  FiSettings,
  FiFolder,
  FiShare2,
  FiDownload,
  FiCalendar,
  FiHelpCircle,
} from "react-icons/fi";

const navigation = [
  { name: "Dashboard", href: "/dash", icon: FiHome },
  { name: "Recordings", href: "/studio", icon: FiVideo },
  { name: "Guests", href: "/studio/guests", icon: FiUsers },
  { name: "Calendar", href: "/studio/calendar", icon: FiCalendar },
  { name: "Library", href: "/studio/library", icon: FiFolder },
  { name: "Share", href: "/studio/share", icon: FiShare2 },
  { name: "Downloads", href: "/studio/downloads", icon: FiDownload },
];

const bottomNavigation = [
  { name: "Settings", href: "/studio/settings", icon: FiSettings },
  { name: "Help", href: "/studio/help", icon: FiHelpCircle },
];

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b border-gray-200">
            <Link href="/dash" className="flex items-center">
              <span className="text-xl font-bold text-indigo-600">River</span>
            </Link>
          </div>

          {/* Main Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? "text-indigo-600" : "text-gray-400"
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Bottom Navigation */}
          <div className="px-2 py-4 border-t border-gray-200">
            {bottomNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? "text-indigo-600" : "text-gray-400"
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">{children}</div>
    </div>
  );
}
