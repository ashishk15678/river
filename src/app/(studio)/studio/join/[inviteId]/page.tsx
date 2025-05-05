import { redirect } from "next/navigation";
import JoinRoom from "@/app/(studio)/studio/components/join-room";

interface JoinRoomPageProps {
  params: {
    inviteId: string;
  };
}

export default function JoinRoomPage({ params }: JoinRoomPageProps) {
  const { inviteId } = params;

  if (!inviteId) {
    redirect("/studio");
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <JoinRoom inviteId={inviteId} />
    </div>
  );
}
