"use client";
import { useSession } from "next-auth/react";
import { SignInForm } from "./signin-form";
import { redirect } from "next/navigation";
export default function SignInPage() {
  const { data } = useSession();

  if (data?.user) {
    redirect("/dash");
  }

  console.log(data);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
