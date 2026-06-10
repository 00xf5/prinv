import React, { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { Phone, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useExchangeRate } from "../lib/useExchangeRate";

export function History() {
  const { formatCentsToNGN } = useExchangeRate();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("createdAt", "desc")
    );
    
    const unsub = onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => unsub();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
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
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left">
              <thead className="bg-white border-b border-slate-100">
                <tr>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase">Number</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase">Service</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase">Cost</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-xs font-bold text-slate-400 uppercase text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-slate-900">{session.number}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{session.service} ({session.country})</td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-600">{formatCentsToNGN(session.cost)}</td>
                    <td className="px-6 py-4 text-sm">
                       {session.status === 'completed' ? (
                          <span className="flex items-center text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded w-max text-xs">
                             <CheckCircle className="w-3.5 h-3.5 mr-1" /> Completed
                          </span>
                       ) : session.status === 'cancelled' || session.status === 'refunded' ? (
                          <span className="flex items-center text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded w-max text-xs capitalize">
                             <XCircle className="w-3.5 h-3.5 mr-1" /> {session.status}
                          </span>
                       ) : (
                          <span className="flex items-center text-indigo-700 font-bold bg-indigo-50 px-2 py-1 rounded w-max text-xs capitalize">
                             {session.status}
                          </span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-500">
                       {format(new Date(session.createdAt), "MMM d, yyyy HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
