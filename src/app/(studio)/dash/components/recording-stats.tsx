"use client";

import { FiTrendingUp, FiClock, FiUsers, FiDownload } from "react-icons/fi";

const stats = [
  {
    name: "Total Recordings",
    value: "24",
    change: "+12%",
    icon: FiTrendingUp,
    color: "text-green-500",
  },
  {
    name: "Recording Time",
    value: "48h",
    change: "+8%",
    icon: FiClock,
    color: "text-blue-500",
  },
  {
    name: "Total Guests",
    value: "12",
    change: "+4",
    icon: FiUsers,
    color: "text-purple-500",
  },
  {
    name: "Downloads",
    value: "1.2k",
    change: "+24%",
    icon: FiDownload,
    color: "text-indigo-500",
  },
];

export function RecordingStats() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <h2 className="text-lg font-medium text-gray-900">Recording Stats</h2>
        <div className="mt-6 grid grid-cols-2 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="relative rounded-lg border border-gray-200 p-6"
            >
              <div className="flex items-center">
                <div className={`p-3 rounded-lg bg-gray-50 ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-green-500">
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 ml-2">
                    vs last month
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Simple Chart */}
        <div className="mt-8">
          <div className="h-48 bg-gray-50 rounded-lg p-4">
            <div className="h-full flex items-end space-x-2">
              {[30, 45, 35, 50, 40, 60, 55].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 bg-indigo-500 rounded-t"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500 text-center">
            Recording activity over time
          </div>
        </div>
      </div>
    </div>
  );
}
