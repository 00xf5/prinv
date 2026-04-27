import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const GRIZZLY_API_KEY = process.env.GRIZZLY_API_KEY || "7d61414bc5b058d8e5b19caf5c502366";
  const GRIZZLY_URL = "https://api.grizzlysms.com/stubs/handler_api.php";

  // Proxy to Grizzly SMS API
  app.get("/api/grizzly", async (req, res) => {
    try {
      const queryParams = new URLSearchParams(req.query as any);
      queryParams.set("api_key", GRIZZLY_API_KEY);
      
      const url = `${GRIZZLY_URL}?${queryParams.toString()}`;
      const response = await fetch(url);
      const data = await response.text();
      res.send(data);
    } catch (err) {
      console.error("Grizzly API error:", err);
      res.status(500).send("Grizzly API error");
    }
  });

  // Simulated Pagsmile Webhook
  app.post("/api/webhooks/pagsmile", async (req, res) => {
    try {
      // 1. In a real system, you'd verify the webhook signature using your Pagsmile private key
      // const signature = req.headers["x-pagsmile-signature"];
      // if (!verifySignature(req.body, signature)) return res.status(401).send("Unauthorized");

      const { userId, amountInCents, status } = req.body;
      
      if (status === "PAID") {
        // 2. You would use Firebase Admin SDK here to securely update the user's balance
        // admin.firestore().runTransaction(async (t) => { ... })
        console.log(`Webhook received: Added ${amountInCents} cents to user ${userId}`);
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Webhook error");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
