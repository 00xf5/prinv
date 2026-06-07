import { useState, useEffect, ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Button, buttonVariants } from "../../components/ui/button";
import { Phone, LayoutDashboard, Inbox, LogOut, Wallet, Menu, Search, User, Hexagon } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "../../components/ui/sheet";
import { useGrizzlyPolling } from "../lib/useGrizzlyPolling";
import { useExchangeRate } from "../lib/useExchangeRate";

function VverifyLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`select-none ${className}`}>
      {/* Dark Hexagon Base for high contrast */}
      <path d="M50 4 L88 24 L88 66 C88 84 50 96 50 96 C50 96 12 84 12 66 L12 24 L50 4 Z" fill="#0F172A" />
      {/* Inner Accent layer (Indigo) */}
      <path d="M50 14 L80 30 L80 63 C80 77 50 86 50 86 C50 86 20 77 20 63 L20 30 L50 14 Z" fill="#4F46E5" />
      {/* Big bold distinct V's */}
      {/* Back check/slash */}
      <path d="M30 45 L45 60 L78 28" stroke="#A5B4FC" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      {/* Main overlapping V */}
      <path d="M40 68 L50 78 L80 48" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M35 52 L50 67 L65 42" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  useGrizzlyPolling();
  const { formatCentsToNGN } = useExchangeRate();
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
            <Link to="/" className="flex items-center gap-3">
              <VverifyLogo className="w-10 h-10" />
            </Link>
            <nav className="flex items-center gap-4">
              <Link to="/auth" className={buttonVariants({ variant: "ghost", className: "text-slate-600 hover:bg-slate-50" })}>Log in</Link>
              <Link to="/auth" className={buttonVariants({ className: "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold" })}>Get Started</Link>
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
        <div className="p-6 border-b border-slate-100 flex items-center justify-center">
          <Link to="/">
            <VverifyLogo className="w-12 h-12" />
          </Link>
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
          <div className="text-2xl font-bold text-slate-800">{formatCentsToNGN(balance)}</div>
          <Link to="/billing" className={buttonVariants({ className: "mt-3 w-full bg-white border border-slate-200 py-1.5 rounded-md text-xs font-semibold shadow-sm text-slate-700 hover:bg-slate-50" })}>
            Add Funds
          </Link>
          <Button variant="ghost" className="mt-4 w-full flex items-center justify-start text-slate-500 hover:text-slate-900 border border-slate-200" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-2 md:gap-4">
            <Sheet>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden -ml-2" />}>
                <Menu className="h-5 w-5 text-slate-600" />
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 flex flex-col">
                <div className="p-6 border-b border-slate-100 flex items-center justify-center">
                  <VverifyLogo className="w-12 h-12" />
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
                  <div className="text-2xl font-bold text-slate-800">{formatCentsToNGN(balance)}</div>
                  <Link to="/billing" className={buttonVariants({ className: "mt-3 w-full bg-white border border-slate-200 py-1.5 rounded-md text-xs font-semibold shadow-sm text-slate-700 hover:bg-slate-50" })}>
                    Add Funds
                  </Link>
                  <Button variant="ghost" className="mt-4 w-full flex items-center justify-start text-slate-500 hover:text-slate-900 border border-slate-200" onClick={handleLogout}>
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-2 md:hidden">
               <Link to="/">
                  <VverifyLogo className="w-9 h-9" />
               </Link>
            </div>
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
