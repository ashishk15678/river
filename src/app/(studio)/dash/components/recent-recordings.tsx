"use client";

import { FiPlay, FiDownload, FiShare2, FiMoreVertical } from "react-icons/fi";

const recordings = [
  {
    id: 1,
    title: "Tech Talk Episode 1",
    date: "2024-03-15",
    duration: "45:30",
    thumbnail:
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
  },
  {
    id: 2,
    title: "Interview with John Doe",
    date: "2024-03-14",
    duration: "32:15",
    thumbnail:
      "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
  },
  {
    id: 3,
    title: "Weekly Update #12",
    date: "2024-03-13",
    duration: "28:45",
    thumbnail:
      "https://images.unsplash.com/photo-1556761175-b413da4baf72?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3",
  },
];

export function RecentRecordings() {
  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">
            Recent Recordings
          </h2>
          <button className="text-sm text-indigo-600 hover:text-indigo-500">
            View all
          </button>
        </div>

        <div className="mt-6 flow-root">
          <ul className="-my-5 divide-y divide-gray-200">
            {recordings.map((recording) => (
              <li key={recording.id} className="py-5">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0 h-16 w-24">
                    <img
                      className="h-16 w-24 rounded-lg object-cover"
                      src={recording.thumbnail}
                      alt={recording.title}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {recording.title}
                    </p>
                    <div className="flex items-center mt-1">
                      <p className="text-sm text-gray-500">{recording.date}</p>
                      <span className="mx-2 text-gray-300">•</span>
                      <p className="text-sm text-gray-500">
                        {recording.duration}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full">
                      <FiPlay className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full">
                      <FiDownload className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full">
                      <FiShare2 className="h-5 w-5" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-full">
                      <FiMoreVertical className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
