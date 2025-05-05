"use client";
import { Suspense } from "react";
import PodcastRoom from "../components/podcast-room";

export default function PodcastPage() {
  return (
    <div className="h-screen bg-gray-900">
      <Suspense fallback={<div>Loading...</div>}>
        <PodcastRoom />
      </Suspense>
    </div>
  );
}
