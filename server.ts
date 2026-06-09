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
    } else {
      admin.initializeApp({ projectId: "gen-lang-client-0726044280" }); // relies on Application Default Credentials
    }
  }
  db = getFirestore(admin.apps[0], "ai-studio-f8bd9da6-914c-49f9-b6e2-0b3e05d3bd40");
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
    if (!db) return res.status(500).send("Firestore not initialized");
    const { userId, serviceId, grizzlyCountryId, serviceName, countryName, cost } = req.body;
    
    if (!userId || !serviceId || !grizzlyCountryId || !cost) {
      return res.status(400).send("Missing parameters");
    }

    const firestore = db as admin.firestore.Firestore;
    const userRef = firestore.collection("users").doc(userId);

    // 1. Transactionally lock balance in backend to eliminate race conditions
    let hasFunds = false;
    await firestore.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      if (!userDoc.exists) throw new Error("User not found");
      const currentBal = userDoc.data()?.balance || 0;
      if (currentBal >= cost) {
        hasFunds = true;
        t.update(userRef, { balance: currentBal - cost, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    });

    if (!hasFunds) {
      return res.status(400).send("Insufficient balance");
    }

    // 2. Call external Grizzly API securely from backend
    let data = "";
    try {
      const grizzlyUrl = `${GRIZZLY_URL}?api_key=${GRIZZLY_API_KEY}&action=getNumber&service=${serviceId}&country=${grizzlyCountryId}`;
      const apiRes = await fetch(grizzlyUrl);
      data = await apiRes.text();
    } catch (e) {
      console.error("Grizzly fetch error:", e);
    }

    // 3. Rollback if external API failed
    if (!data || data === "NO_NUMBERS" || data === "NO_BALANCE" || !data.startsWith("ACCESS_NUMBER:")) {
       try {
         await firestore.runTransaction(async (t) => {
           const uDoc = await t.get(userRef);
           t.update(userRef, { balance: (uDoc.data()?.balance || 0) + cost, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
         });
       } catch (refundError) {
         console.error("FATAL: Failed to refund user!", refundError);
       }
       return res.status(400).send(data || "External API Error");
    }

    // data format: ACCESS_NUMBER:$id:$number
    const [, grizzlyId, number] = data.split(":");

    // 4. Create Session 
    const sessionRef = firestore.collection("sessions").doc();
    await sessionRef.set({
      userId: userId,
      grizzlyId: grizzlyId,
      number: number,
      service: serviceName,
      country: countryName,
      cost: cost,
      status: "active",
      createdAt: Date.now(),
      expiresAt: Date.now() + 20 * 60 * 1000 // 20 mins
    });

    res.json({ success: true, sessionId: sessionRef.id, number, grizzlyId });
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

// Check Session Status (for codes)
app.post("/api/sessions/check", async (req, res) => {
  try {
    if (!db) return res.status(500).send("Firestore not initialized");
    const { sessionId, userId } = req.body;
    if (!sessionId || !userId) return res.status(400).send("Missing params");

    const firestore = db as admin.firestore.Firestore;
    const sessionRef = firestore.collection("sessions").doc(sessionId);
    const sessionDoc = await sessionRef.get();
    
    if (!sessionDoc.exists) return res.status(404).send("Not found");
    const data = sessionDoc.data();
    if (!data || data.userId !== userId) return res.status(403).send("Forbidden");
    if (data.status !== "active") return res.json({ status: data.status, code: data.code });

    const statusUrl = `${GRIZZLY_URL}?api_key=${GRIZZLY_API_KEY}&action=getStatus&id=${data.grizzlyId}`;
    const apiRes = await fetch(statusUrl);
    const text = await apiRes.text();
    
    if (text.startsWith("STATUS_OK")) {
       const codeParts = text.split(":");
       const rawCode = codeParts.length > 1 ? codeParts[1] : codeParts[0];
       // Some providers return STATUS_OK:code
       
       await sessionRef.update({
         status: "completed",
         code: rawCode,
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
       });
       
       // Add to history messages
       await firestore.collection("messages").add({
         userId: userId,
         sessionId: sessionId,
         number: data.number,
         service: data.service,
         text: rawCode,
         sender: data.service,
         receivedAt: admin.firestore.FieldValue.serverTimestamp()
       });
       return res.json({ status: "completed", code: rawCode });
    } else if (text === "STATUS_CANCEL") {
       await sessionRef.update({ status: "cancelled", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
       // Refund User
       const userRef = firestore.collection("users").doc(userId);
       await firestore.runTransaction(async (t) => {
          const uDoc = await t.get(userRef);
          if (uDoc.exists) {
             t.update(userRef, { balance: (uDoc.data()?.balance || 0) + (data.cost || 0)});
          }
       });
       return res.json({ status: "cancelled" });
    } else {
       return res.json({ status: "active" }); // still waiting (STATUS_WAIT_CODE)
    }
  } catch (e) {
    console.error("Check error:", e);
    res.status(500).send("Error checking session");
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
