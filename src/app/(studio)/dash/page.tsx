import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "./components/dashboard-header";
import { RecordingStats } from "./components/recording-stats";
import { RecentRecordings } from "./components/recent-recordings";
import { QuickActions } from "./components/quick-actions";

export default async function DashboardPage() {
  const session = await getServerSession();

  if (!session) {
    redirect("/auth/signin");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <main className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <QuickActions />
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecordingStats />
            <RecentRecordings />
          </div>
        </div>
      </main>
    </div>
  );
}
