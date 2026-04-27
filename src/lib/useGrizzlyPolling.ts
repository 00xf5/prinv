import { useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc } from "firebase/firestore";

interface GrizzlyActiveSession {
  id: string;
  grizzlyId: string;
  status: string;
  userId: string;
}

export function useGrizzlyPolling() {
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", auth.currentUser.uid),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeSessions: GrizzlyActiveSession[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any;

      activeSessions.forEach(async (session) => {
        try {
          const res = await fetch(`/api/grizzly?action=getStatus&id=${session.grizzlyId}`);
          const data = await res.text();
          
          if (data.startsWith("STATUS_WAIT_CODE")) {
            // Still waiting for SMS
            return;
          }

          if (data.startsWith("STATUS_OK:")) {
            const code = data.split(":")[1];
            
            // Mark session as completed
            await updateDoc(doc(db, "sessions", session.id), {
              status: "completed",
              updatedAt: Date.now()
            });

            // Add the message to inbox
            const msgRef = doc(collection(db, "messages"));
            await setDoc(msgRef, {
              userId: auth.currentUser!.uid,
              sessionId: session.id,
              text: code,
              sender: "Service",
              receivedAt: Date.now()
            });
            
            // We could also call action=setStatus&status=6 to inform Grizzly we are done.
            await fetch(`/api/grizzly?action=setStatus&status=6&id=${session.grizzlyId}`);
          }

          if (data === "STATUS_CANCEL") {
            await updateDoc(doc(db, "sessions", session.id), {
              status: "cancelled",
              updatedAt: Date.now()
            });
          }
        } catch (err) {
          console.error("Failed to poll Grizzly for session", session.id, err);
        }
      });
    });

    return () => unsubscribe();
  }, []);
}
