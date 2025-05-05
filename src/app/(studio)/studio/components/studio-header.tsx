"use client";

import { FiMenu, FiSettings, FiHelpCircle } from "react-icons/fi";
import { useSession } from "next-auth/react";

interface StudioHeaderProps {
  onMenuClick: () => void;
}

export function StudioHeader({ onMenuClick }: StudioHeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              <FiMenu className="h-6 w-6" />
            </button>
            <div className="ml-4">
              <h1 className="text-xl font-semibold text-gray-900">Studio</h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md">
              <FiHelpCircle className="h-6 w-6" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-md">
              <FiSettings className="h-6 w-6" />
            </button>
            {session?.user?.image && (
              <img
                src={session.user.image}
                alt={session.user.name || "User"}
                className="h-8 w-8 rounded-full"
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
