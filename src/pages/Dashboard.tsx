import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, limit, runTransaction, updateDoc, addDoc } from "firebase/firestore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Wallet, Phone, ArrowUpRight, Activity } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useExchangeRate } from "../lib/useExchangeRate";

function Countdown({ expiresAt }: { expiresAt: number }) {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, expiresAt - Date.now()));
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const m = Math.floor(timeLeft / 60000);
  const s = Math.floor((timeLeft % 60000) / 1000);
  if (timeLeft <= 0) return <span className="text-red-500">Expired</span>;
  return <span>{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}</span>;
}

export function Dashboard() {
  const { formatCentsToNGN } = useExchangeRate();
  const [balance, setBalance] = useState<number>(0);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  const checkStatusLocal = async (session: any) => {
    try {
      if (session.status !== "active") return;
      const statusRes = await fetch(`/api/grizzly?action=getStatus&id=${session.grizzlyId}`);
      const text = await statusRes.text();

      const sessionRef = doc(db, "sessions", session.id);

      if (text.startsWith("STATUS_OK")) {
        const codeParts = text.split(":");
        const rawCode = codeParts.length > 1 ? codeParts[1] : codeParts[0];

        await updateDoc(sessionRef, {
          status: "completed",
          code: rawCode,
          updatedAt: new Date().getTime()
        });

        await addDoc(collection(db, "messages"), {
          userId: auth.currentUser!.uid,
          sessionId: session.id,
          number: session.number,
          service: session.service,
          text: rawCode,
          sender: session.service,
          receivedAt: new Date().getTime()
        });
      } else if (text === "STATUS_CANCEL") {
        // Platform cancelled it. Process refund
        await runTransaction(db, async (t) => {
          const userRef = doc(db, "users", auth.currentUser!.uid);
          const uDoc = await t.get(userRef);
          const sDoc = await t.get(sessionRef);
          if (!sDoc.exists() || sDoc.data().status !== "active") return;

          if (uDoc.exists()) {
             t.update(userRef, { balance: (uDoc.data()?.balance || 0) + session.cost, updatedAt: new Date().getTime() });
          }
          t.update(sessionRef, { status: "cancelled", updatedAt: new Date().getTime() });
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    // Sub to balance changes
    const unsubUser = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
      if (doc.exists()) setBalance(doc.data().balance || 0);
    });

    // Sub to recent sessions (active + completed)
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsubSessions = onSnapshot(q, (snapshot) => {
      const sessions: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActiveSessions(sessions);
    });

    // Poll active sessions on Grizzly every 5 seconds
    let activeInterval: any;
    // Don't setInterval in onSnapshot, just run it once and it uses state
    activeInterval = setInterval(() => {
       setActiveSessions(currSessions => {
         currSessions.forEach(session => {
            if (session.status === "active") {
              checkStatusLocal(session);
            }
         });
         return currSessions;
       });
    }, 5000);

    return () => {
      unsubUser();
      unsubSessions();
      clearInterval(activeInterval);
    };
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1 text-sm">Welcome back. Here's an overview of your account.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col md:flex-row items-start justify-between">
          <div className="w-full">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Current Balance</div>
              <div className="p-1.5 md:p-3 bg-indigo-50 rounded-lg text-indigo-600 md:hidden">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 md:mb-0">{formatCentsToNGN(balance)}</div>
            <Link to="/billing" className={buttonVariants({ size: "sm", variant: "outline", className: "mt-0 md:mt-4 border-slate-200 text-slate-700 w-full font-semibold text-xs py-1 h-8 md:h-9" })}>
              Add Funds
            </Link>
          </div>
          <div className="hidden md:block p-3 bg-indigo-50 rounded-lg text-indigo-600 ml-4">
            <Wallet className="h-6 w-6" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 flex flex-col md:flex-row items-start justify-between">
          <div className="w-full">
            <div className="flex justify-between items-start mb-2">
              <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Active Numbers</div>
              <div className="p-1.5 md:p-3 bg-emerald-50 rounded-lg text-emerald-600 md:hidden">
                <Phone className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 mb-4 md:mb-0">{activeSessions.filter(s => s.status === 'active').length}</div>
            <Link to="/buy" className={buttonVariants({ size: "sm", className: "mt-0 md:mt-4 bg-indigo-600 hover:bg-indigo-700 text-white w-full font-bold text-xs py-1 h-8 md:h-9" })}>
              Rent Number
            </Link>
          </div>
          <div className="hidden md:block p-3 bg-emerald-50 rounded-lg text-emerald-600 ml-4">
            <Phone className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Recent Numbers</h2>
          <Link to="/inbox" className={buttonVariants({ variant: "ghost", className: "text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" })}>
            View All <ArrowUpRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-900 text-sm">Recently Rented</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">{activeSessions.filter(s => s.status === 'active').length} ACTIVE</span>
          </div>
          
          {activeSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white">
              <Phone className="h-10 w-10 text-slate-300 mb-4" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No numbers rented</h3>
              <p className="text-slate-500 text-sm max-w-sm mb-6">
                You haven't rented any numbers yet. Rent a number to start receiving SMS.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase">Number</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase">Service</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase text-right">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {activeSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-900">
                      <div className="flex items-center gap-2">
                        {session.number}
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={() => { navigator.clipboard.writeText(session.number); toast.success("Copied!"); }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                        </Button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{session.service} ({session.country})</td>
                    <td className="px-6 py-4 text-sm">
                      {session.status === 'completed' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SMS Code</span>
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded inline-block w-max">
                            {session.code || 'Received'}
                          </span>
                        </div>
                      ) : session.status === 'active' ? (
                        <span className="flex items-center text-emerald-600 font-medium">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse"></span> Waiting...
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium capitalize">{session.status}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-500 font-mono">
                      <div className="flex items-center justify-end gap-3">
                        {session.status === 'active' ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded">
                            <Countdown expiresAt={session.expiresAt} />
                          </span>
                        ) : session.status === 'completed' ? (
                           <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Done</span>
                        ) : (
                           <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded capitalize">{session.status}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
