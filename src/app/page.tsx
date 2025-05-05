import { getServerSession } from "next-auth";
import { SignOutButton } from "./components/sign-out-button";

export default async function Home() {
  const session = await getServerSession();

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Welcome to River</h1>

        {session ? (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center space-x-4 mb-4">
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name || "User"}
                  className="w-12 h-12 rounded-full"
                />
              )}
              <div>
                <h2 className="text-xl font-semibold">{session.user?.name}</h2>
                <p className="text-gray-600">{session.user?.email}</p>
              </div>
            </div>
            <SignOutButton />
          </div>
        ) : (
          <p className="text-lg">Please sign in to continue.</p>
        )}
      </div>
    </main>
  );
}
