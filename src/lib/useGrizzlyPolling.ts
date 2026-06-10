import { useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, runTransaction } from "firebase/firestore";
import { toast } from "sonner";

interface GrizzlyActiveSession {
  id: string;
  grizzlyId: string;
  status: string;
  userId: string;
  number?: string;
  service?: string;
  cost?: number;
  expiresAt?: number;
}

export function useGrizzlyPolling() {
  useEffect(() => {
    // Request notification permission if needed
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    if (!auth.currentUser) return;

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", auth.currentUser.uid),
      where("status", "==", "active")
    );

    let intervalId: any;

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeSessions: GrizzlyActiveSession[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any;

      if (intervalId) clearInterval(intervalId);

      const checkSessions = () => {
        activeSessions.forEach(async (session) => {
          try {
            // Check expiry
            if (session.expiresAt && session.expiresAt < Date.now()) {
              try {
                await fetch("/api/cancel-number", { 
                  method: "POST", 
                  headers: { "Content-Type": "application/json" }, 
                  body: JSON.stringify({ grizzlyId: session.grizzlyId }) 
                });
              } catch (apiErr) {
                console.error("Grizzly API cancel error on expiry, rolling back locally anyway:", apiErr);
              }
              await runTransaction(db, async (t) => {
                const userRef = doc(db, "users", auth.currentUser!.uid);
                const sessionRef = doc(db, "sessions", session.id);
                const uDoc = await t.get(userRef);
                const sDoc = await t.get(sessionRef);
                if (!sDoc.exists() || sDoc.data().status !== "active") return;
                if (uDoc.exists()) {
                   t.update(userRef, { balance: (uDoc.data()?.balance || 0) + (session.cost || 0), updatedAt: new Date().getTime() });
                }
                t.update(sessionRef, { status: "refunded", updatedAt: new Date().getTime() });
              });
              toast.info(`Number for ${session.service} expired without SMS. Cost refunded!`);
              return;
            }

            const res = await fetch(`/api/grizzly?action=getStatus&id=${session.grizzlyId}`);
            const data = await res.text();
            
            if (data.startsWith("STATUS_WAIT_CODE")) {
              return;
            }

            if (data.startsWith("STATUS_OK:") || data.startsWith("STATUS_OK")) {
               let code = "";
               if (data.includes(":")) {
                 code = data.split(":")[1];
               } else {
                 code = data.replace("STATUS_OK", "").trim() || "Received";
               }
              
              // Mark session as completed
              await updateDoc(doc(db, "sessions", session.id), {
                status: "completed",
                code: code,
                updatedAt: new Date().getTime()
              });

              // Add the message to inbox
              const msgRef = doc(collection(db, "messages"));
              await setDoc(msgRef, {
                userId: auth.currentUser!.uid,
                sessionId: session.id,
                text: code,
                number: session.number || "",
                service: session.service || "",
                sender: session.service || "Service",
                receivedAt: new Date().getTime()
              });
              
              // Dispatch browser notification
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`SMS Code Received: ${session.service}`, {
                  body: `Your code is ${code} for number ${session.number}`,
                  icon: "/favicon.ico"
                });
              }
              
              // We could also call action=setStatus&status=6 to inform Grizzly we are done.
              await fetch(`/api/grizzly?action=setStatus&status=6&id=${session.grizzlyId}`);
            }

            if (data === "STATUS_CANCEL") {
              try {
                // Platform cancelled it. Process refund
                await runTransaction(db, async (t) => {
                  const userRef = doc(db, "users", auth.currentUser!.uid);
                  const sessionRef = doc(db, "sessions", session.id);
                  const uDoc = await t.get(userRef);
                  const sDoc = await t.get(sessionRef);
                  
                  if (!sDoc.exists() || sDoc.data().status !== "active") return;

                  if (uDoc.exists()) {
                     t.update(userRef, { balance: (uDoc.data()?.balance || 0) + (session.cost || 0), updatedAt: new Date().getTime() });
                  }
                  t.update(sessionRef, { status: "cancelled", updatedAt: new Date().getTime() });
                });
                toast.info(`Number for ${session.service} cancelled by platform. Cost refunded!`);
              } catch (e) {
                console.error("Failed to cancel and refund locally", e);
              }
            }
          } catch (err) {
            console.error("Failed to poll Grizzly for session", session.id, err);
          }
        });
      };

      checkSessions();
      intervalId = setInterval(checkSessions, 5000);
    });

    return () => {
      unsubscribe();
      if (intervalId) clearInterval(intervalId);
    };
  }, []);
}
