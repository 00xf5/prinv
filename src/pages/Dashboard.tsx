import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, collection, query, where, onSnapshot, orderBy, limit, runTransaction, updateDoc, addDoc } from "firebase/firestore";
import { Button, buttonVariants } from "@/components/ui/button";
import { Wallet, Phone, ArrowUpRight, Activity } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useExchangeRate } from "../lib/useExchangeRate";
import { ServiceLogo } from "./BuyNumber";

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

function CancelControl({ session, onCancel, isCancelling }: { session: any, onCancel: (session: any) => void, isCancelling: boolean }) {
  const [elapsed, setElapsed] = useState(Date.now() - session.createdAt);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Date.now() - session.createdAt);
    }, 1000);
    return () => clearInterval(timer);
  }, [session.createdAt]);

  if (session.status !== "active" || session.code) return null;

  const threeMinsMs = 3 * 60 * 1000;
  const isCancellable = elapsed >= threeMinsMs;
  const remaining = Math.max(0, threeMinsMs - elapsed);

  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);

  if (!isCancellable) {
    return (
      <div className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-2 py-1 inline-flex items-center">
        Cancel in {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200 text-xs font-bold shadow-sm transition-all rounded-md"
      onClick={() => onCancel(session)}
      disabled={isCancelling}
    >
      {isCancelling ? "Cancelling..." : "Cancel & Refund"}
    </Button>
  );
}

export function Dashboard() {
  const { formatCentsToNGN } = useExchangeRate();
  const [balance, setBalance] = useState<number>(0);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [isCancelling, setIsCancelling] = useState<string | null>(null);

  const handleCancelSession = async (session: any) => {
    if (isCancelling === session.id) return;
    setIsCancelling(session.id);
    const toastId = toast.loading("Processing refund and cancelling number...");
    try {
      // 1. Call secure cancel endpoint
      try {
        await fetch("/api/cancel-number", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ grizzlyId: session.grizzlyId })
        });
      } catch (err) {
        console.warn("API setStatus call failed, performing secure local database refund anyway:", err);
      }

      // 2. Database transaction to refund cost
      await runTransaction(db, async (t) => {
        const userRef = doc(db, "users", auth.currentUser!.uid);
        const sessionRef = doc(db, "sessions", session.id);
        
        const uDoc = await t.get(userRef);
        const sDoc = await t.get(sessionRef);

        if (!sDoc.exists() || sDoc.data().status !== "active") {
          throw new Error("Number is no longer active.");
        }

        if (uDoc.exists()) {
          const currentBal = uDoc.data()?.balance || 0;
          const cost = session.cost || 0;
          t.update(userRef, { 
            balance: currentBal + cost, 
            updatedAt: new Date().getTime() 
          });
        }
        
        t.update(sessionRef, { 
          status: "cancelled", 
          updatedAt: new Date().getTime() 
        });
      });

      toast.success("Number cancelled successfully and balance refunded!", { id: toastId });
    } catch (error: any) {
      console.error("Cancellation failed:", error);
      toast.error(error.message || "Failed to cancel number.", { id: toastId });
    } finally {
      setIsCancelling(null);
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

    return () => {
      unsubUser();
      unsubSessions();
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
            <div className="max-h-[400px] overflow-y-auto w-full">
              {/* Mobile View */}
              <div className="md:hidden divide-y divide-slate-100">
                {activeSessions.map((session) => (
                  <div key={session.id} className="p-4 flex flex-col gap-3 bg-white hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start">
                       <div className="flex items-center gap-3">
                         <ServiceLogo code={session.serviceCode || ""} name={session.service || ""} className="h-9 w-9 text-xs" />
                         <div>
                           <div className="text-sm font-bold text-slate-900">{session.service}</div>
                           <div className="text-xs text-slate-500">{session.country}</div>
                         </div>
                       </div>
                       <div className="text-right">
                        {session.status === 'active' ? (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded text-xs font-mono">
                            <Countdown expiresAt={session.expiresAt} />
                          </span>
                        ) : session.status === 'completed' ? (
                           <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Done</span>
                        ) : (
                           <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded capitalize">{session.status}</span>
                        )}
                       </div>
                    </div>
                    
                    {session.status === 'active' && (
                      <div className="flex items-center justify-end border-b border-dashed border-slate-100 pb-2 mb-2">
                        <CancelControl session={session} onCancel={handleCancelSession} isCancelling={isCancelling === session.id} />
                      </div>
                    )}
                    <div className="flex justify-between items-end">
                       <div>
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Number</div>
                         <div className="flex items-center gap-2 font-mono text-sm text-slate-900 bg-slate-50 px-2 py-1 rounded">
                           {session.number}
                           <button className="text-slate-400 hover:text-indigo-600 focus:outline-none" onClick={() => { navigator.clipboard.writeText(session.number); toast.success("Copied!"); }}>
                             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                           </button>
                         </div>
                       </div>
                       
                       <div className="text-right">
                         {session.status === 'completed' ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SMS Code</span>
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                              {session.code || 'Received'}
                            </span>
                          </div>
                        ) : session.status === 'active' ? (
                          <span className="flex items-center text-emerald-600 font-medium text-xs">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse"></span> Waiting...
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium text-xs capitalize">{session.status}</span>
                        )}
                       </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block w-full overflow-x-auto">
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
                      <tr key={session.id} className="hover:bg-slate-50 transition-colors bg-white">
                        <td className="px-6 py-4 font-mono text-sm text-slate-900">
                          <div className="flex items-center gap-2">
                            {session.number}
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={() => { navigator.clipboard.writeText(session.number); toast.success("Copied!"); }}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            </Button>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">
                          <div className="flex items-center gap-3">
                            <ServiceLogo code={session.serviceCode || ""} name={session.service || ""} className="h-8 w-8 text-[10px]" />
                            <div>
                              <div className="font-bold text-slate-900">{session.service}</div>
                              <div className="text-xs text-slate-400 font-normal">{session.country}</div>
                            </div>
                          </div>
                        </td>
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
                          <div className="flex items-center justify-end gap-3 font-sans">
                            {session.status === 'active' && (
                              <CancelControl session={session} onCancel={handleCancelSession} isCancelling={isCancelling === session.id} />
                            )}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
