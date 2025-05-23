import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  console.log(query);

  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 });
  }

  const user = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: query } },
        { username: { startsWith: query } },
      ],
    },
  });

  return NextResponse.json(user);
}
