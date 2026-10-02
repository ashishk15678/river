import { z } from "zod";
import { publicProcedure, router } from "../trpc";

// Live chat delivery happens over Socket.io (see src/server/socket.ts).
// This router only persists/replays history so a late joiner sees what
// they missed — it never sends a message live itself.
export const chatRouter = router({
  history: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.chatMessage.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: "asc" },
        take: 200,
      }),
    ),
});
