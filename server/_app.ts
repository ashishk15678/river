import { router } from "./trpc";
import { studioRouter } from "./routers/studio";
import { sessionRouter } from "./routers/session";
import { chatRouter } from "./routers/chat";

export const appRouter = router({
  studio: studioRouter,
  session: sessionRouter,
  chat: chatRouter,
});

export type AppRouter = typeof appRouter;
