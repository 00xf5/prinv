import express from "express";
import cors from "cors";
import path from "path";
import * as admin from "firebase-admin";

let db: admin.firestore.Firestore | null = null;
try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      admin.initializeApp(); // relies on Application Default Credentials
    }
  }
  db = admin.firestore();
} catch (error) {
  console.warn("Failed to initialize Firebase Admin. Firestore routes will fail.", error);
}

export const app = express();
const PORT = Number(process.env.PORT || 3000);

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

// Proxy Clearbit logo request to bypass iframe CSP/sandbox bounds
app.get("/api/logo/:domain", async (req, res) => {
  try {
    const { domain } = req.params;
    if (!domain) {
      return res.status(400).send("Domain is required");
    }

    // Set a quick timeout of 2 seconds for external fetching
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`https://logo.clearbit.com/${domain}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(404).send("Logo not found");
    }

    const contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=86400"); // Cache for 24 hours
    res.send(buffer);
  } catch (err) {
    // Gracefully return 404 in case of network restrictions, timeouts, DNS errors (EAI_AGAIN), etc.
    // This allows the React client to instantly display the beautiful CSS fallback icon instead of hanging or returning 500.
    res.status(404).send("Logo fallback");
  }
});

// Create Payment Intent (mock Pagsmile)
app.post("/api/payments/create", async (req, res) => {
  try {
    if (!db) return res.status(500).send("Firestore not initialized");
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
    // If running on Vercel, absolute URL might be tricky if we don't know the host, but let's assume we can fetch ourselves
    const host = req.get('host');
    const protocol = req.protocol;
    await fetch(`${protocol}://${host}/api/webhooks/pagsmile`, {
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
    if (!db) return res.status(500).send("Firestore not initialized");
    
    // We expect the external provider to send back our reference (txId)
    const { txId, amountInCents, status } = req.body;
    
    if (status === "PAID" && txId) {
      // 2. Transact safely using Firebase Admin
      await db.runTransaction(async (t) => {
        // Assert db is not null to TS
        const firestore = db as admin.firestore.Firestore;
        const txRef = firestore.collection("transactions").doc(txId);
        const txDoc = await t.get(txRef);
        
        if (!txDoc.exists) throw new Error("Transaction not found");
        if (txDoc.data()?.status !== "pending") throw new Error("Already processed");

        const userRef = firestore.collection("users").doc(txDoc.data()?.userId);
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

// Cancel and Refund Session
app.post("/api/sessions/refund", async (req, res) => {
  try {
    if (!db) return res.status(500).send("Firestore not initialized");
    const { sessionId, userId } = req.body;
    
    if (!sessionId || !userId) return res.status(400).send("Missing params");

    await db.runTransaction(async (t) => {
      const firestore = db as admin.firestore.Firestore;
      const sessionRef = firestore.collection("sessions").doc(sessionId);
      const sessionDoc = await t.get(sessionRef);
      
      if (!sessionDoc.exists) throw new Error("Session not found");
      const sessionData = sessionDoc.data();
      
      if (sessionData?.userId !== userId) throw new Error("Unauthorized");
      if (sessionData?.status === "cancelled" || sessionData?.status === "refunded") {
        return; // Already refunded or cancelled
      }
      
      // Hit Grizzly API to actually cancel if it is still active
      if (sessionData?.status === "active") {
        try {
          const cancelUrl = `${GRIZZLY_URL}?api_key=${GRIZZLY_API_KEY}&action=setStatus&status=8&id=${sessionData.grizzlyId}`;
          await fetch(cancelUrl);
        } catch (e) {
          console.error("Grizzly cancel error:", e);
        }
      }

      const costToRefund = sessionData?.cost || 0;
      const userRef = firestore.collection("users").doc(userId);
      const userDoc = await t.get(userRef);
      const currentBalance = userDoc.exists ? userDoc.data()?.balance || 0 : 0;

      t.update(userRef, { balance: currentBalance + costToRefund, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      t.update(sessionRef, { status: "refunded", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    });

    res.json({ success: true, message: "Refunded successfully" });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).send("Refund error");
  }
});

async function startServer() {
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
