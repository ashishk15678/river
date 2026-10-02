import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../trpc";

async function assertHost(
  db: typeof import("@/lib/db").db,
  studioId: string,
  userId: string,
) {
  const studio = await db.studio.findUnique({ where: { id: studioId } });
  if (!studio || studio.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return studio;
}

export const sessionRouter = router({
  history: protectedProcedure
    .input(z.object({ studioId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertHost(ctx.db, input.studioId, ctx.session.user.id);
      return ctx.db.studioSession.findMany({
        where: { studioId: input.studioId },
        orderBy: { startedAt: "desc" },
      });
    }),

  // Host starts a session (goes "live" / opens the green room for guests).
  start: protectedProcedure
    .input(z.object({ studioId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertHost(ctx.db, input.studioId, ctx.session.user.id);
      const open = await ctx.db.studioSession.findFirst({
        where: { studioId: input.studioId, endedAt: null },
      });
      if (open) return open; // already live — idempotent
      return ctx.db.studioSession.create({
        data: { studioId: input.studioId },
      });
    }),

  end: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.studioSession.findUnique({
        where: { id: input.sessionId },
      });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      await assertHost(ctx.db, session.studioId, ctx.session.user.id);
      return ctx.db.studioSession.update({
        where: { id: input.sessionId },
        data: { endedAt: new Date() },
      });
    }),

  // Guests need this to find the live session for a studio without being a
  // member — public by design (that's how invite links work).
  active: publicProcedure
    .input(z.object({ studioId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.studioSession.findFirst({
        where: { studioId: input.studioId, endedAt: null },
      }),
    ),
});
