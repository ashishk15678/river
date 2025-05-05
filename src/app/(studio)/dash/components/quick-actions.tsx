"use client";

import Link from "next/link";
import {
  FiVideo,
  FiUsers,
  FiShare2,
  FiDownload,
  FiCalendar,
  FiSettings,
} from "react-icons/fi";

const actions = [
  {
    name: "Start Recording",
    description: "Record a new podcast or video",
    icon: FiVideo,
    href: "/studio",
    color: "bg-indigo-500",
    stats: "24 recordings",
  },
  {
    name: "Schedule Recording",
    description: "Plan your next recording session",
    icon: FiCalendar,
    href: "/studio/calendar",
    color: "bg-green-500",
    stats: "3 upcoming",
  },
  {
    name: "Manage Guests",
    description: "Invite and manage your guests",
    icon: FiUsers,
    href: "/studio/guests",
    color: "bg-blue-500",
    stats: "12 guests",
  },
  {
    name: "Share Content",
    description: "Share your recordings with others",
    icon: FiShare2,
    href: "/studio/share",
    color: "bg-purple-500",
    stats: "1.2k shares",
  },
  {
    name: "Download Files",
    description: "Download your recordings",
    icon: FiDownload,
    href: "/studio/downloads",
    color: "bg-pink-500",
    stats: "48 files",
  },
  {
    name: "Settings",
    description: "Configure your recording settings",
    icon: FiSettings,
    href: "/studio/settings",
    color: "bg-gray-500",
    stats: "Last updated 2h ago",
  },
];

export function QuickActions() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
          <button className="text-sm text-indigo-600 hover:text-indigo-500">
            View all
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.name}
              href={action.href}
              className="group relative rounded-lg border border-gray-200 p-6 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className={`inline-flex p-3 rounded-lg ${action.color} text-white`}
                  >
                    <action.icon className="h-6 w-6" />
                  </span>
                </div>
                <span className="text-sm text-gray-500">{action.stats}</span>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-900 group-hover:text-indigo-600">
                  {action.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {action.description}
                </p>
              </div>
              <div className="absolute inset-0 rounded-lg ring-2 ring-transparent group-hover:ring-indigo-500 transition-all duration-200" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
