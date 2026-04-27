import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp(); // relies on Application Default Credentials in Cloud Run
}

const db = admin.firestore();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();
const PORT = process.env.PORT || 3000;

async function startServer() {
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

  // Create Payment Intent (mock Pagsmile)
  app.post("/api/payments/create", async (req, res) => {
    try {
      const { userId, amountInCents } = req.body;
      if (!userId || !amountInCents) return res.status(400).send("Missing params");

      // 1. Create a pending transaction in Firestore
      const txRef = db.collection("transactions").doc();
      await txRef.set({
        userId,
        amount: amountInCents,
        type: "topup",
        status: "pending",
        provider: "pagsmile",
        createdAt: Date.now()
      });

      // 2. Return a mock checkout URL and the tx id to poll
      const checkoutUrl = `/api/payments/test-pay?txId=${txRef.id}&amount=${amountInCents}`;
      res.json({ txId: txRef.id, checkoutUrl });
    } catch (err) {
      console.error("Create payment error:", err);
      res.status(500).send("Create payment error");
    }
  });

  // Simulated Pagsmile checkout flow - just for testing!
  app.get("/api/payments/test-pay", async (req, res) => {
    const { txId, amount } = req.query;
    
    // Simulate what Pagsmile would do: successfully charge the user and hit our webhook
    try {
      await fetch(`http://localhost:${PORT}/api/webhooks/pagsmile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txId,
          amountInCents: Number(amount),
          status: "PAID"
        })
      });
      res.send("<h1>Simulated Pagsmile Payment Successful</h1><p>You can close this window now.</p><script>setTimeout(() => window.close(), 2000)</script>");
    } catch(e) {
      res.send("Error simulating payment");
    }
  });

  // Webhook for Pagsmile
  app.post("/api/webhooks/pagsmile", async (req, res) => {
    try {
      // 1. Verify Signature (Simulated)
      // const signature = req.headers["x-pagsmile-signature"];
      // if (!verifySignature(req.body, signature)) return res.status(401).send("Unauthorized");

      // We expect the external provider to send back our reference (txId)
      const { txId, amountInCents, status } = req.body;
      
      if (status === "PAID" && txId) {
        // 2. Transact safely using Firebase Admin
        await db.runTransaction(async (t) => {
          const txRef = db.collection("transactions").doc(txId);
          const txDoc = await t.get(txRef);
          
          if (!txDoc.exists) throw new Error("Transaction not found");
          if (txDoc.data()?.status !== "pending") throw new Error("Already processed");

          const userRef = db.collection("users").doc(txDoc.data()?.userId);
          const userDoc = await t.get(userRef);

          const currentBalance = userDoc.exists ? userDoc.data()?.balance || 0 : 0;
          const newBalance = currentBalance + amountInCents;

          t.update(userRef, { balance: newBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          t.update(txRef, { status: "completed", processedAt: admin.firestore.FieldValue.serverTimestamp() });
        });
        
        console.log(`Webhook processed: Added ${amountInCents} cents to tx ${txId}`);
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).send("Webhook error");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
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

  // Only listen if not running in a Vercel serverless environment
  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
