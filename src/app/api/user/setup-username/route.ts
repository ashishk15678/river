import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { username } = await req.json();

    // Validate username
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { message: "Username is required" },
        { status: 400 }
      );
    }

    // Check username format
    if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
      return NextResponse.json(
        {
          message:
            "Username must be 3-20 characters long and can only contain letters, numbers, underscores, and hyphens",
        },
        { status: 400 }
      );
    }

    // Check if username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Username is already taken" },
        { status: 400 }
      );
    }

    // Update user with username
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        username,
        hasSetUsername: true,
      },
    });

    return NextResponse.json({ message: "Username set successfully" });
  } catch (error) {
    console.error("Error setting username:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
