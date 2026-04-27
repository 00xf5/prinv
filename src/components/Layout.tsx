import { useState, useEffect, ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Button } from "../../components/ui/button";
import { Phone, LayoutDashboard, Inbox, LogOut, Wallet, Menu, Search, User, Hexagon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "../../components/ui/sheet";
import { useGrizzlyPolling } from "../lib/useGrizzlyPolling";

function PrinevestLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pv-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="100" height="100" rx="24" fill="url(#pv-grad)" />
      
      {/* Abstract 'P' & 'V' interacting */}
      <path d="M30 70 L30 30 C30 30 50 20 65 30 C75 36 75 50 65 56 C50 64 45 60 45 60 L60 80" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"/>
      <path d="M45 50 L30 50" stroke="white" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  useGrizzlyPolling();
  const [user, setUser] = useState(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<number>(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    if (user) {
      const unsubDoc = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
        if (snapshot.exists()) {
          setBalance(snapshot.data().balance);
        }
      });
      return unsubDoc;
    }
  }, [user]);

  const isAuthPage = location.pathname === "/auth" || location.pathname === "/";

  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      navigate("/auth");
    } else if (!loading && user && isAuthPage) {
      navigate("/dashboard");
    }
  }, [user, loading, isAuthPage, navigate]);

  if (loading) return null;

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/auth");
  };

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <header className="border-b bg-white border-slate-200">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 text-xl font-bold tracking-tight text-slate-900">
              <PrinevestLogo />
              Prinevest
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/auth">
                <Button variant="ghost" className="text-slate-600 hover:bg-slate-50">Log in</Button>
              </Link>
              <Link to="/auth">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">Get Started</Button>
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 text-slate-900">{children}</main>
      </div>
    );
  }

  const navLinks = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/buy", icon: Phone, label: "Rent Number" },
    { to: "/inbox", icon: Inbox, label: "SMS History" },
    { to: "/billing", icon: Wallet, label: "Billing" },
  ];

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 flex font-sans overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <PrinevestLogo />
          <h1 className="text-xl font-bold tracking-tight">Prinevest</h1>
        </div>
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                location.pathname === link.to
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <link.icon className="w-5 h-5 mr-3" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wallet Balance</div>
          <div className="text-2xl font-bold text-slate-800">${(balance / 100).toFixed(2)}</div>
          <Link to="/billing">
            <Button className="mt-3 w-full bg-white border border-slate-200 py-1.5 rounded-md text-xs font-semibold shadow-sm text-slate-700 hover:bg-slate-50">
              Add Funds
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2 md:gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden -ml-2">
                  <Menu className="h-5 w-5 text-slate-600" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                  <PrinevestLogo />
                  <h1 className="text-xl font-bold tracking-tight">Prinevest</h1>
                </div>
                <nav className="flex-1 px-4 py-4 space-y-1">
                  {navLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                        location.pathname === link.to
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <link.icon className="w-5 h-5 mr-3" />
                      {link.label}
                    </Link>
                  ))}
                </nav>
                <div className="p-4 border-t border-slate-100 bg-slate-50">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Wallet Balance</div>
                  <div className="text-2xl font-bold text-slate-800">${(balance / 100).toFixed(2)}</div>
                  <Link to="/billing">
                    <Button className="mt-3 w-full bg-white border border-slate-200 py-1.5 rounded-md text-xs font-semibold shadow-sm text-slate-700 hover:bg-slate-50">
                      Add Funds
                    </Button>
                  </Link>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              <span className="text-sm font-medium text-slate-500 hidden sm:inline">Grizzly Node: Active</span>
            </div>
            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>
            <div className="text-sm text-slate-500 font-mono hidden sm:block">API Latency: 142ms</div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-400 hidden sm:flex">
              <Search className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 ml-2">
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-slate-900 border border-slate-200 shadow-sm h-8 hidden sm:flex">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                <User className="h-5 w-5" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 relative">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
