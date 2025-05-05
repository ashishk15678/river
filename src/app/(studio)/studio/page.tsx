"use client";
import { StudioLayout } from "./components/studio-layout";
import CreateRoom from "./components/create-room";

export default function StudioPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Podcast Studio</h1>
      <CreateRoom
      // onRoomCreated={(roomId) => {
      // Room created, handle navigation if needed
      // }}
      />
    </div>
  );
}
