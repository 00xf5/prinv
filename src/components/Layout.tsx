import React, { useState, useEffect, ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Button, buttonVariants } from "../../components/ui/button";
import { Phone, LayoutDashboard, Inbox, LogOut, Wallet, Menu, Search, User, Hexagon, History as HistoryIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationsBell } from "./NotificationsBell";
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  const isAuthPage = location.pathname === "/auth" || location.pathname === "/";

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubAuth;
  }, []);

  useEffect(() => {
    // Only show swipe hint on mobile view if user is logged in & hasn't seen it yet
    if (!isAuthPage && user) {
      const hasSeen = localStorage.getItem("has-seen-swipe-hint-v2");
      if (!hasSeen) {
        const timer = setTimeout(() => {
          setShowSwipeHint(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthPage, user]);

  // Touch Swipe Gesture Detection State
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.targetTouches.length !== 1) return;
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.targetTouches.length !== 1) return;
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distanceX = touchEndX - touchStartX;
    const minSwipeDistance = 50; // minimum translation to count as swipe

    if (distanceX > minSwipeDistance && touchStartX < 90) {
      // Swipe Left-to-Right starting from near the left edge (< 90px)
      setIsSidebarOpen(true);
      setShowSwipeHint(false);
      localStorage.setItem("has-seen-swipe-hint-v2", "true");
    } else if (distanceX < -minSwipeDistance && isSidebarOpen) {
      // Swipe Right-to-Left, close sidebar
      setIsSidebarOpen(false);
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  const handleOpenSidebarChange = (open: boolean) => {
    setIsSidebarOpen(open);
    if (open) {
      setShowSwipeHint(false);
      localStorage.setItem("has-seen-swipe-hint-v2", "true");
    }
  };

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
    { to: "/inbox", icon: Inbox, label: "SMS Inbox" },
    { to: "/history", icon: HistoryIcon, label: "Number History" },
    { to: "/billing", icon: Wallet, label: "Billing" },
  ];

  return (
    <div 
      className="h-screen w-full bg-slate-50 text-slate-900 flex font-sans overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
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
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 relative">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Curtain Fold Hamburger Trigger */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden -ml-2"
              onClick={() => handleOpenSidebarChange(!isSidebarOpen)}
            >
              <Menu className="h-5 w-5 text-slate-600" />
            </Button>
          </div>

          {/* Centered Mobile Logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden">
            <Link to="/" className="flex items-center gap-2 group">
               <div className="p-1 rounded-xl bg-white shadow-sm border border-slate-200 group-hover:shadow transition-all">
                  <VverifyLogo className="w-8 h-8 md:w-9 md:h-9" />
               </div>
               <span className="font-bold text-lg tracking-tight text-slate-900 hidden sm:block">Vverify</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-400 hidden sm:flex">
              <Search className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 ml-2">
              <NotificationsBell />
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
          {showSwipeHint && (
            <div 
              onClick={() => {
                setIsSidebarOpen(true);
                setShowSwipeHint(false);
                localStorage.setItem("has-seen-swipe-hint-v2", "true");
              }}
              style={{ top: "45%" }}
              className="fixed left-2 z-40 flex items-center gap-2 bg-indigo-600/95 text-white pl-3 pr-4 py-2.5 rounded-full shadow-2xl cursor-pointer border border-indigo-400/30 animate-bounce md:hidden hover:scale-105 active:scale-95 transition-all"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-100"></span>
              </span>
              <span className="text-xs font-bold tracking-tight select-none">Swipe from left</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          )}
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </main>

      {/* Foldable Mobile Sidebar (Curtain / Book foldable style) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop Layer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-slate-900/60 z-50 md:hidden backdrop-blur-[2px]"
            />

            {/* 3D Perspective Wrapper */}
            <div 
              className="fixed inset-y-0 left-0 z-50 md:hidden w-[280px]"
              style={{ perspective: "1500px", perspectiveOrigin: "left center" }}
            >
              {/* Folding Sidebar Body */}
              <motion.div
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                initial={{ 
                  rotateY: -95, 
                  skewY: -4,
                  originX: 0, 
                  opacity: 0,
                  transformPerspective: 1500
                }}
                animate={{ 
                  rotateY: 0, 
                  skewY: 0,
                  opacity: 1
                }}
                exit={{ 
                  rotateY: -95, 
                  skewY: -3,
                  opacity: 0,
                  transition: { duration: 0.3, ease: "easeInOut" }
                }}
                transition={{ 
                  type: "spring", 
                  stiffness: 120, 
                  damping: 17,
                  mass: 0.8
                }}
                className="w-full h-full bg-white shadow-[15px_0_35px_-5px_rgba(0,0,0,0.2)] flex flex-col relative border-r border-slate-200 overflow-hidden"
              >
                {/* Visual hinge fold shadow crease on the left */}
                <div className="absolute top-0 bottom-0 left-0 w-8 pointer-events-none bg-gradient-to-r from-slate-200/25 to-transparent z-40" />

                {/* Shifting shadow overlay that lightens up as the drawer swings open */}
                <motion.div 
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0.7 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent pointer-events-none z-30"
                />

                {/* Sidebar Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
                  <VverifyLogo className="w-11 h-11" />
                  {/* Close icon button */}
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Close menu"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>

                {/* Navigation Scroll container */}
                <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto z-10">
                  {navLinks.map((link) => {
                    const isActive = location.pathname === link.to;
                    return (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
                          isActive
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15 scale-[1.02]"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <link.icon className={`w-5 h-5 mr-3 transition-transform ${isActive ? "scale-110" : "opacity-80"}`} />
                        {link.label}
                      </Link>
                    );
                  })}
                </nav>

                {/* Bottom Wallet Balance & Footer panel */}
                <div className="p-4 border-t border-slate-150 bg-slate-50/80 backdrop-blur-xs z-10 flex flex-col gap-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">Wallet Balance</div>
                  <div className="text-2xl font-black text-slate-800 tracking-tight pl-1">{formatCentsToNGN(balance)}</div>
                  <Link 
                    to="/billing" 
                    onClick={() => setIsSidebarOpen(false)}
                    className={buttonVariants({ className: "w-full bg-white border border-slate-200 py-2.5 rounded-xl text-xs font-bold shadow-sm text-slate-700 hover:bg-slate-50 justify-center flex" })}
                  >
                    Add Funds
                  </Link>
                  <Button 
                    variant="ghost" 
                    className="w-full flex items-center justify-start text-slate-500 hover:text-slate-900 border border-slate-200 bg-white/50 rounded-xl py-2 mt-1" 
                    onClick={async () => {
                      setIsSidebarOpen(false);
                      await handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
