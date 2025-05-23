import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/user/settings
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        rooms: {
          include: { participants: true },
        },
      },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Merge user data with settings
    // const settings = {
    //   id: user.id,
    //   name: user.name,
    //   email: user.email,
    //   image: user.image,
    //   emailNotifications: user.settings?.emailNotifications ?? true,
    //   pushNotifications: user.settings?.pushNotifications ?? true,
    //   theme: user.settings?.theme ?? "system",
    //   language: user.settings?.language ?? "en",
    //   timezone: user.settings?.timezone ?? "UTC",
    //   createdAt: user.createdAt,
    //   updatedAt: user.updatedAt,
    // };

    return NextResponse.json(user);
  } catch (error) {
    console.error("[SETTINGS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

// PATCH /api/user/settings
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      email,
      emailNotifications,
      pushNotifications,
      theme,
      language,
      timezone,
    } = body;

    // Update user and settings
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        name: name,
        email: email,
        settings: {
          upsert: {
            create: {
              emailNotifications,
              pushNotifications,
              theme,
              language,
              timezone,
            },
            update: {
              emailNotifications,
              pushNotifications,
              theme,
              language,
              timezone,
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Return merged settings
    const settings = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
      emailNotifications: updatedUser.settings?.emailNotifications ?? true,
      pushNotifications: updatedUser.settings?.pushNotifications ?? true,
      theme: updatedUser.settings?.theme ?? "system",
      language: updatedUser.settings?.language ?? "en",
      timezone: updatedUser.settings?.timezone ?? "UTC",
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("[SETTINGS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
