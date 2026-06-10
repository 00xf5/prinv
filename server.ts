import express from "express";
import cors from "cors";
import path from "path";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";

let db: FirebaseFirestore.Firestore | null = null;
try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      db = getFirestore(admin.apps[0], "ai-studio-f8bd9da6-914c-49f9-b6e2-0b3e05d3bd40");
    } else {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY is missing. Admin operations disabled.");
    }
  }
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

// Proxy to Grizzly SMS API (SAFE READ-ONLY ACTIONS)
app.get("/api/grizzly", async (req, res) => {
  try {
    const queryParams = new URLSearchParams(req.query as any);
    
    const action = queryParams.get("action");
    // BLOCK DANGEROUS ACTIONS
    if (action === "getNumber" || action === "setStatus") {
      return res.status(403).send("Forbidden Action. Use dedicated endpoints.");
    }

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

app.post("/api/buy-number", async (req, res) => {
  try {
    const { serviceId, grizzlyCountryId } = req.body;
    
    if (!serviceId || !grizzlyCountryId) {
      return res.status(400).send("Missing parameters");
    }

    // Proxy the request securely to Grizzly
    let data = "";
    try {
      const grizzlyUrl = `${GRIZZLY_URL}?api_key=${GRIZZLY_API_KEY}&action=getNumber&service=${serviceId}&country=${grizzlyCountryId}`;
      const apiRes = await fetch(grizzlyUrl);
      data = await apiRes.text();
    } catch (e) {
      console.error("Grizzly fetch error:", e);
      return res.status(500).send("Grizzly Proxy Error");
    }

    if (!data || data === "NO_NUMBERS" || data === "NO_BALANCE" || !data.startsWith("ACCESS_NUMBER:")) {
       return res.status(400).send(data || "External API Error");
    }

    // data format: ACCESS_NUMBER:$grizzlyId:$number
    const [, grizzlyId, number] = data.split(":");

    res.json({ success: true, number, grizzlyId });
  } catch (error) {
    console.error("Buy error:", error);
    res.status(500).send(error instanceof Error ? error.message : "Buy error");
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

// Create Payment Intent (Monnify Init Transaction)
app.post("/api/payments/create", async (req, res) => {
  try {
    if (!db) return res.status(500).send("Firestore not initialized");
    const { userId, amountInCents } = req.body;
    if (!userId || !amountInCents) return res.status(400).send("Missing params");

    // Fetch Monnify credentials from Firestore
    const firestore = db as FirebaseFirestore.Firestore;
    const settingsDoc = await firestore.collection("system").doc("settings").get();
    const settings = settingsDoc.data();
    if (!settings || !settings.monnifyApiKey || !settings.monnifySecretKey || !settings.monnifyContractCode) {
      return res.status(500).send("Monnify credentials not configured in Admin Settings");
    }

    const { monnifyApiKey, monnifySecretKey, monnifyContractCode } = settings;

    // 1. Create a pending transaction in Firestore
    const txRef = firestore.collection("transactions").doc();
    
    // User info for Monnify
    const userDoc = await firestore.collection("users").doc(userId).get();
    const userEmail = userDoc.data()?.email || "user@example.com";
    
    await txRef.set({
      userId,
      amount: amountInCents,
      type: "topup",
      status: "pending",
      provider: "monnify",
      createdAt: Date.now()
    });

    // 2. Authenticate with Monnify Config (using base64 encoded ApiKey:SecretKey)
    const base64Token = Buffer.from(`${monnifyApiKey}:${monnifySecretKey}`).toString('base64');
    const authRes = await fetch("https://api.monnify.com/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${base64Token}`
      }
    });
    const authData = await authRes.json();
    if (!authData.requestSuccessful) {
      console.error("Monnify auth failed:", authData);
      return res.status(500).send("Payment gateway auth failed");
    }
    const token = authData.responseBody.accessToken;

    // 3. Initialize Transaction
    const ngnAmount = amountInCents / 100; // Monnify expects amounts in whole Naira (or decimal)
    const initRes = await fetch("https://api.monnify.com/api/v1/merchant/transactions/init-transaction", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: ngnAmount,
        customerName: "Dashboard User",
        customerEmail: userEmail,
        paymentReference: txRef.id,
        paymentDescription: "Wallet Topup",
        currencyCode: "NGN",
        contractCode: monnifyContractCode,
        paymentMethods: ["CARD", "ACCOUNT_TRANSFER", "USSD", "PHONE_NUMBER"]
      })
    });

    const initData = await initRes.json();
    if (!initData.requestSuccessful) {
      console.error("Monnify init failed:", initData);
      return res.status(500).send("Payment gateway init failed");
    }

    const checkoutUrl = initData.responseBody.checkoutUrl;
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

// Webhook for Monnify
app.post("/api/webhooks/monnify", async (req, res) => {
  try {
    if (!db) return res.status(500).send("Firestore not initialized");
    
    // We expect the external provider to send back our reference (txId)
    // Monnify sends details nested in `eventData`
    const { eventData } = req.body;
    if (!eventData) return res.status(400).send("Invalid hook payload");

    const status = eventData.paymentStatus;
    const txId = eventData.paymentReference;
    const amountPaid = eventData.amountPaid;
    
    const amountInCents = Math.round(Number(amountPaid) * 100);

    if (status === "PAID" && txId) {
      // 2. Transact safely using Firebase Admin
      await db.runTransaction(async (t) => {
        // Assert db is not null to TS
        const firestore = db as FirebaseFirestore.Firestore;
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

// Cancel and Refund Session (Proxy only)
app.post("/api/cancel-number", async (req, res) => {
  try {
    const { grizzlyId } = req.body;
    if (!grizzlyId) return res.status(400).send("Missing grizzlyId");
    
    const cancelUrl = `${GRIZZLY_URL}?api_key=${GRIZZLY_API_KEY}&action=setStatus&status=8&id=${grizzlyId}`;
    await fetch(cancelUrl);
    res.json({ success: true });
  } catch (err) {
    console.error("Cancel proxy error:", err);
    res.status(500).send("Cancel error");
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
