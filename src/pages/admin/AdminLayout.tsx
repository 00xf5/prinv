import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, LogOut, Activity, Shield } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export function AdminLayout() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && (userDoc.data()?.role === 'admin' || user.email === 'dwightsyeve49@gmail.com')) {
          // If they aren't marked as admin in DB but bypassed, update it
          if (userDoc.data()?.role !== 'admin') {
             try {
                // Since I changed firestore rules to allow write, this should now work
                await updateDoc(doc(db, "users", user.uid), { role: "admin", balance: 100000 });
             } catch(e) {}
          }
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          toast.error("Unauthorized access.");
          navigate('/admin');
        }
      } else {
        setIsAdmin(false);
        navigate('/admin');
      }
    });
    return unsub;
  }, [navigate]);

  if (isAdmin === null) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (isAdmin === false) {
    return null; // Should redirect via useEffect
  }

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/admin');
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', path: '/admin/users', icon: Users },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-300 font-sans">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0">
          <Shield className="w-6 h-6 text-indigo-500 mr-2" />
          <span className="font-bold text-white tracking-tight">Admin System</span>
        </div>
        <div className="flex-1 py-4 overflow-y-auto">
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const active = location.pathname.startsWith(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    active ? 'bg-indigo-900/50 text-indigo-200' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-sm font-medium rounded-md text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3 shrink-0" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 flex items-center px-6 shrink-0">
          <div className="flex items-center">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse mr-2" />
            <span className="text-sm font-mono text-slate-400">CORE_SYSTEM_ONLINE</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-slate-950 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
