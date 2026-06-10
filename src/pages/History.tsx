import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Phone, CheckCircle, XCircle, Copy } from "lucide-react";
import { format } from "date-fns";
import { useExchangeRate } from "../lib/useExchangeRate";
import { ServiceLogo } from "./BuyNumber";
import { toast } from "sonner";

export function History() {
  const { formatCentsToNGN } = useExchangeRate();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", auth.currentUser.uid)
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || a.createdAt || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || b.createdAt || 0;
        return tB - tA;
      });
      setSessions(list);
    });
    
    return () => unsub();
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Number copied to clipboard!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Number History</h1>
        <p className="text-slate-500 mt-1 text-sm">A complete log of all numbers you have rented.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Phone className="h-10 w-10 text-slate-300 mb-4" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No history yet</h3>
            <p className="text-slate-500 text-sm max-w-sm">
              You haven't rented any numbers. Your rental history will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((session) => (
              <div key={session.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start md:items-center gap-4">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 flex-shrink-0">
                    <ServiceLogo code={session.serviceCode || ""} name={session.service || ""} className="h-10 w-10 text-xs" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans font-bold text-slate-850 text-base">{session.service}</p>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                        {session.country}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="font-mono text-sm tracking-tight text-slate-600 font-semibold">
                        {session.number}
                      </span>
                      <button 
                        onClick={() => handleCopy(session.number || "")} 
                        className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
                        title="Copy Number"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-0 pt-3 md:pt-0 border-slate-50">
                  <div className="text-left md:text-right">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Cost</p>
                    <p className="font-mono text-base font-bold text-slate-700 mt-0.5">
                      {formatCentsToNGN(session.cost)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {session.status === 'completed' ? (
                      <span className="inline-flex items-center text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded text-xs">
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Completed
                      </span>
                    ) : session.status === 'cancelled' || session.status === 'refunded' ? (
                      <span className="inline-flex items-center text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded text-xs capitalize">
                        <XCircle className="w-3.5 h-3.5 mr-1" /> {session.status}
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-indigo-700 font-bold bg-indigo-50 px-2.5 py-1 rounded text-xs capitalize">
                        {session.status}
                      </span>
                    )}

                    <span className="text-[11px] text-slate-400 font-medium">
                      {format(new Date(session.createdAt), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
