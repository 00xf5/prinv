import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, collection, query, where, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Wallet, Phone, ArrowUpRight, Activity } from "lucide-react";
import { format } from "date-fns";

export function Dashboard() {
  const [balance, setBalance] = useState<number>(0);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;

    // Sub to balance changes
    const unsubUser = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc) => {
      if (doc.exists()) setBalance(doc.data().balance || 0);
    });

    // Sub to active sessions changes
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", auth.currentUser.uid),
      where("status", "==", "active")
    );
    const unsubSessions = onSnapshot(q, (snapshot) => {
      setActiveSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Current Balance</div>
            <div className="text-3xl font-bold text-slate-900">${(balance / 100).toFixed(2)}</div>
            <Link to="/billing">
              <Button size="sm" variant="outline" className="mt-4 border-slate-200 text-slate-700 w-full font-semibold">
                Add Funds
              </Button>
            </Link>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <Wallet className="h-6 w-6" />
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Active Numbers</div>
            <div className="text-3xl font-bold text-emerald-600">{activeSessions.length}</div>
            <Link to="/buy">
              <Button size="sm" className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white w-full font-bold">
                Rent Number
              </Button>
            </Link>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <Phone className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase mb-2">Success Rate</div>
            <div className="text-3xl font-bold text-slate-900">98.5%</div>
            <p className="text-xs text-slate-500 mt-2 font-medium">Global delivery success rate</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg text-slate-500">
            <Activity className="h-6 w-6" />
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Active Numbers</h2>
          <Button variant="ghost" className="text-sm text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" asChild>
            <Link to="/inbox">View All <ArrowUpRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="font-bold text-slate-900 text-sm">Recently Rented</h2>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">{activeSessions.length} ACTIVE</span>
          </div>
          
          {activeSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center bg-white">
              <Phone className="h-10 w-10 text-slate-300 mb-4" />
              <h3 className="text-sm font-bold text-slate-900 mb-1">No active numbers</h3>
              <p className="text-slate-500 text-sm max-w-sm mb-6">
                You don't have any active virtual numbers right now. Rent a number to start receiving SMS.
              </p>
            </div>
          ) : (
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
                    <td className="px-6 py-4 font-mono text-sm text-slate-900">{session.number}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{session.service} ({session.country})</td>
                    <td className="px-6 py-4 text-sm">
                      <span className="flex items-center text-emerald-600 font-medium">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2 animate-pulse"></span> Waiting for SMS...
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-slate-500 font-mono">
                      {format(new Date(session.expiresAt), "HH:mm:ss")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
