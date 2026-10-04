import "dotenv/config";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { readFileSync } from "node:fs";
import next from "next";
import { attachSocketServer } from "./lib/socket";

const port = parseInt(process.env.PORT ?? "3000", 10);
const dev = process.env.NODE_ENV !== "production";

async function main() {
  const app = next({ dev });
  await app.prepare();
  const handle = app.getRequestHandler();

  if (process.env.HTTPS === "true") {
    const { createSelfSignedCertificate } =
      await import("next/dist/lib/mkcert.js");
    const certResult = await createSelfSignedCertificate("localhost");
    if (!certResult) throw new Error("Failed to generate self-signed cert");

    const httpsServer = createHttpsServer(
      {
        key: readFileSync(certResult.key),
        cert: readFileSync(certResult.cert),
      },
      (req, res) => handle(req, res),
    );
    attachSocketServer(httpsServer);
    httpsServer.listen(port, "0.0.0.0", () => {
      console.log(`> Ready on https://localhost:${port} (HTTPS, dev=${dev})`);
      console.log(`> Open on phone: https://<your-LAN-IP>:${port}`);
      console.log(`> Accept the self-signed cert warning on mobile`);
    });
  } else {
    const httpServer = createHttpServer((req, res) => handle(req, res));
    attachSocketServer(httpServer);
    httpServer.listen(port, () => {
      console.log(`> Ready on http://localhost:${port} (dev=${dev})`);
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
