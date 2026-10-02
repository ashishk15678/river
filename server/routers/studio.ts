import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const slugify = (name: string) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);

export const studioRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.studio.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { sessions: true } } },
    }),
  ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const studio = await ctx.db.studio.findUnique({
        where: { slug: input.slug },
      });
      if (!studio) throw new TRPCError({ code: "NOT_FOUND" });
      return studio;
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const base = slugify(input.name) || "studio";
      let slug = base;
      // Small collision loop — studio creation is rare/manual, so an
      // unbounded-looking `for` here is fine; capped at 20 tries.
      for (let i = 0; i < 20; i++) {
        const clash = await ctx.db.studio.findUnique({ where: { slug } });
        if (!clash) break;
        slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
      }
      return ctx.db.studio.create({
        data: {
          name: input.name,
          slug,
          ownerId: ctx.session.user.id,
          members: { create: { userId: ctx.session.user.id, role: "HOST" } },
        },
      });
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const studio = await ctx.db.studio.findUnique({
        where: { id: input.id },
      });
      if (!studio || studio.ownerId !== ctx.session.user.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db.studio.delete({ where: { id: input.id } });
      return { ok: true };
    }),
});
