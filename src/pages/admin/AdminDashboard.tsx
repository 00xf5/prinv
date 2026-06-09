import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { Users, Banknote, History, ArrowUpRight } from 'lucide-react';
import { useExchangeRate } from '../../lib/useExchangeRate';

export function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalBalance: 0,
    activeSessions: 0,
    recentPurchases: [] as any[]
  });
  const [loading, setLoading] = useState(true);
  const { formatCentsToNGN } = useExchangeRate();

  useEffect(() => {
    async function loadStats() {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        let tBal = 0;
        let tUsers = 0;
        usersSnap.forEach(doc => {
          tUsers++;
          tBal += (doc.data().balance || 0);
        });

        const activeSessionsQuery = query(collection(db, "sessions"), where("status", "==", "active"));
        const activeSnap = await getDocs(activeSessionsQuery);

        const recentSessionsQuery = query(collection(db, "sessions"), orderBy("createdAt", "desc"), limit(10));
        const recentSnap = await getDocs(recentSessionsQuery);
        const recentPurchases = recentSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        setStats({
          totalUsers: tUsers,
          totalBalance: tBal,
          activeSessions: activeSnap.size,
          recentPurchases
        });
      } catch (err) {
        console.error("Failed to load admin stats", err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard Overview</h1>
        <p className="text-sm text-slate-400 mt-1">System status and key metrics.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Total Users</h3>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{stats.totalUsers}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Total User Balances</h3>
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{formatCentsToNGN(stats.totalBalance)}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Active Rentals</h3>
            <Activity className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-3xl font-bold text-white">{stats.activeSessions}</div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
          <h2 className="text-sm font-semibold text-white">Recent Transactions</h2>
        </div>
        <div className="divide-y divide-slate-800">
          {stats.recentPurchases.map(session => (
            <div key={session.id} className="p-6 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-800 flex items-center justify-center">
                  <History className="h-5 w-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{session.service} ({session.country})</p>
                  <p className="text-xs text-slate-400 mt-1">Number: {session.number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-white">{formatCentsToNGN(session.cost)}</p>
                <p className={`text-xs mt-1 capitalize ${session.status === 'active' ? 'text-emerald-400' : session.status === 'canceled' ? 'text-rose-400' : 'text-slate-500'}`}>
                  {session.status}
                </p>
              </div>
            </div>
          ))}
          {stats.recentPurchases.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">No recent transactions</div>
          )}
        </div>
      </div>
    </div>
  );
}

// Just importing Activity here to fix the undeclared variable
import { Activity } from 'lucide-react';
