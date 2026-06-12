import React, { useState, useEffect, ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Button, buttonVariants } from "../../components/ui/button";
import { Phone, LayoutDashboard, Inbox, LogOut, Wallet, Menu, Search, User, Hexagon, History as HistoryIcon, ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationsBell } from "./NotificationsBell";
import { useGrizzlyPolling } from "../lib/useGrizzlyPolling";
import { useExchangeRate } from "../lib/useExchangeRate";

function VverifyLogo({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={`select-none shrink-0 ${className}`}>
      <defs>
        <linearGradient id="vbrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" /> {/* Indigo 500 */}
          <stop offset="100%" stopColor="#3730A3" /> {/* Indigo 800 */}
        </linearGradient>
      </defs>
      
      {/* Message / Call Bubble Body */}
      <path d="M 50 5 C 25 5 5 25 5 50 C 5 62 10 73 18 80 L 10 95 L 30 88 C 36 92 43 95 50 95 C 75 95 95 75 95 50 C 95 25 75 5 50 5 Z" fill="url(#vbrandGrad)" />
      
      {/* Bold Modern "V" / Checkmark */}
      <path d="M 32 50 L 46 66 C 47.5 68 50.5 68 52 66 L 72 36" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Call Waves (Signal theme) */}
      <path d="M 60 22 A 20 20 0 0 1 82 42" stroke="#A5B4FC" strokeWidth="6" strokeLinecap="round" />
      <path d="M 70 12 A 32 32 0 0 1 94 36" stroke="#A5B4FC" strokeWidth="6" strokeLinecap="round" opacity="0.5" />
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

  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const persisted = localStorage.getItem("grizzly-sidebar-collapsed");
      if (persisted !== null) {
        return persisted === "true";
      }
      return window.innerWidth < 1024;
    } catch (e) {
      return false;
    }
  });

  const [isFullyClosed, setIsFullyClosed] = useState(() => {
    try {
      const persisted = localStorage.getItem("grizzly-sidebar-fully-closed");
      return persisted === "true";
    } catch (e) {
      return false;
    }
  });

  const setSidebarFullyClosed = (closed: boolean) => {
    setIsFullyClosed(closed);
    try {
      localStorage.setItem("grizzly-sidebar-fully-closed", String(closed));
    } catch (e) {}
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("grizzly-sidebar-collapsed", String(next));
      } catch (e) {}
      return next;
    });
  };

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

  // Disabled swipe gesture for now
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
    const minSwipeDistance = 50;

    if (distanceX > minSwipeDistance && touchStartX < 90) {
      if (isFullyClosed) {
        setSidebarFullyClosed(false);
      } else {
        setIsCollapsed(false);
      }
      setShowSwipeHint(false);
      localStorage.setItem("has-seen-swipe-hint-v2", "true");
    } else if (distanceX < -minSwipeDistance && !isCollapsed) {
      setIsCollapsed(true);
    }

    setTouchStartX(null);
    setTouchEndX(null);
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
      className={`h-[100dvh] w-full bg-slate-100 text-slate-900 flex font-sans overflow-hidden p-1 sm:p-2 relative ${isFullyClosed ? "gap-0" : "gap-1 sm:gap-2"}`}
    >
      {/* Backdrop for Mobile Sidebar expanded overlay */}
      <AnimatePresence>
        {isMobile && !isCollapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsCollapsed(true)}
            className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-45 md:hidden"
          />
        )}
      </AnimatePresence>
 
      {/* Floating Collapsible Workspace Sidebar */}
      <motion.aside 
        animate={{ 
          width: isMobile ? (isCollapsed ? 0 : 256) : (isFullyClosed ? 0 : (isCollapsed ? 64 : 220)),
          opacity: isMobile ? (isCollapsed ? 0 : 1) : (isFullyClosed ? 0 : 1)
        }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={`flex flex-col h-full bg-white border border-slate-200/50 rounded-2xl sm:rounded-3xl shadow-[0_4px_30px_rgba(0,0,0,0.02)] shrink-0 z-50 ${
          isMobile && !isCollapsed ? "absolute left-1 top-1 bottom-1 h-[calc(100dvh-0.5rem)] shadow-2xl" : "relative"
        } ${(isMobile && isCollapsed) || isFullyClosed ? "border-none p-0 overflow-hidden pointer-events-none" : "overflow-visible"}`}
      >
        {/* Floating Expand/Collapse Circular Toggle on the right border line */}
        {!isFullyClosed && (
          <button 
            onClick={toggleCollapse}
            className="absolute top-6 -right-3 h-[22px] w-[22px] rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:scale-110 active:scale-95 transition-all z-50 focus:outline-none cursor-pointer"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {/* Brand Logo Header area */}
        <div className={`p-4 border-b border-slate-50 flex items-center ${isCollapsed ? "justify-center" : "px-5 justify-between"}`}>
          {!isCollapsed ? (
            <Link to="/" className="flex items-center gap-3">
              <VverifyLogo className="w-9 h-9 shrink-0" />
              <div className="flex flex-col">
                <span className="font-bold text-xs tracking-tight text-slate-800">Vverify Workspace</span>
                <span className="text-[9px] text-slate-400 font-medium tracking-wide">Standard Plan</span>
              </div>
            </Link>
          ) : (
            <Link to="/">
              <VverifyLogo className="w-8 h-8" />
            </Link>
          )}
        </div>

        {/* Interactive Keyboard-driven Search Field (Jump to) */}
        {!isCollapsed && (
          <div className="px-3 mt-4 mb-1">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200/40 rounded-xl cursor-default select-none group/search hover:bg-slate-100/55 transition-colors">
              <div className="flex items-center gap-2 text-slate-450 text-slate-400 group-hover/search:text-indigo-600 transition-colors">
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover/search:text-indigo-505 group-hover/search:text-indigo-500 transition-transform group-hover/search:scale-105" />
                <span className="text-[11px] font-medium leading-none">Jump to...</span>
              </div>
              <span className="text-[9px] font-bold text-slate-300 bg-white border border-slate-200/50 px-1.5 py-0.5 rounded leading-none shadow-sm group-hover/search:text-slate-500">⌘K</span>
            </div>
          </div>
        )}

        {/* Sidebar Navigation Items */}
        <nav className={`flex-1 px-3 ${isCollapsed ? "py-4" : "py-3"} space-y-1 overflow-y-auto`}>
          {!isCollapsed && (
            <div className="px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-3 mt-1 select-none">
              Services
            </div>
          )}

          {navLinks.map((link, index) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center px-3 py-2.5 text-xs font-semibold rounded-xl relative group transition-all duration-150 ${
                  isActive
                    ? "bg-slate-900 text-white shadow-md font-bold"
                    : "text-slate-600 hover:bg-slate-100/60 hover:text-slate-900 font-medium"
                } ${isCollapsed ? "justify-center" : "justify-between"}`}
              >
                <div className="flex items-center min-w-0">
                  <link.icon className={`h-[18px] w-[18px] shrink-0 ${isCollapsed ? "m-0 rotate-0" : "mr-3"} ${isActive && !isCollapsed ? "text-indigo-300" : ""}`} />
                  {!isCollapsed && (
                    <span className="truncate pr-2 group-hover:text-slate-950 transition-colors">
                      {link.label}
                    </span>
                  )}
                </div>

                {/* Keyboard Shortcut label when expanded */}
                {!isCollapsed && (
                  <span className="text-[9px] font-semibold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap ml-2">
                    ⌘{index + 1}
                  </span>
                )}

                {/* Micro-animated dark floating tooltip shown when collapsed hover */}
                {isCollapsed && (
                  <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-[11px] font-bold text-white rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 pointer-events-none transition-all duration-200 shadow-xl z-50 flex items-center justify-center">
                    {link.label}
                    {/* Tooltip triangle indicator */}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                  </div>
                )}
              </Link>
            );
          })}

          {isCollapsed && (
            <div className="pt-2 flex justify-center border-t border-slate-100/50 mt-1">
              <button
                onClick={() => setSidebarFullyClosed(true)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50/50 relative group transition-all duration-150 border border-transparent hover:border-red-200/40 shadow-xs cursor-pointer focus:outline-none"
                title="Hide Sidebar"
                id="hide-sidebar-btn"
              >
                <EyeOff className="w-[18px] h-[18px]" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-[11px] font-bold text-white rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 pointer-events-none transition-all duration-200 shadow-xl z-50 flex items-center justify-center">
                  Hide Sidebar
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                </div>
              </button>
            </div>
          )}
        </nav>

        {/* Elegant Footer area with Wallet & Accounts metadata */}
        <div className={`p-3 border-t border-slate-50 bg-slate-50/25 flex flex-col gap-1.5 ${isCollapsed ? "items-center" : ""}`}>
          {!isCollapsed ? (
            <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col gap-1 w-full">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Wallet Balance</span>
              <span className="text-xl font-black text-slate-800 tracking-tight leading-none my-0.5">{formatCentsToNGN(balance)}</span>
              <Link to="/billing" className="w-full bg-white border border-slate-200/80 py-1.5 rounded-xl text-[10px] font-bold shadow-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors justify-center flex items-center gap-1.5 mt-1">
                <Wallet className="w-3.5 h-3.5" />
                Add Funds
              </Link>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center text-slate-500 hover:text-red-650 hover:text-red-600 rounded-xl py-1 mt-0.5 text-[10px] font-semibold hover:bg-red-50/40 transition-colors cursor-pointer"
              >
                <LogOut className="h-3 w-3 mr-1.5" />
                Logout Account
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {/* Wallet Balance icon trigger with detailed balance inside tooltip */}
              <Link 
                to="/billing"
                className="p-2.5 rounded-xl bg-white border border-slate-150 text-slate-600 hover:text-indigo-600 hover:bg-slate-50 hover:scale-105 active:scale-95 shadow-sm relative group flex items-center justify-center transition-all duration-150"
              >
                <Wallet className="w-[18px] h-[18px]" />
                <div className="absolute left-full ml-4 px-3 py-2 bg-slate-900 text-[11px] font-bold text-white rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 pointer-events-none transition-all duration-200 shadow-xl z-50 flex flex-col items-start gap-1">
                  <span className="text-[9px] text-slate-400 font-normal uppercase tracking-widest leading-none">Wallet balance</span>
                  <span className="text-sm font-black leading-none text-indigo-300">{formatCentsToNGN(balance)}</span>
                  <span className="text-[9px] text-slate-300 font-semibold underline mt-0.5">Click to top up</span>
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                </div>
              </Link>

              {/* Logout button */}
              <button 
                onClick={handleLogout}
                className="p-2.5 rounded-xl text-slate-400 hover:text-red-650 hover:text-red-600 hover:bg-red-50/60 hover:scale-105 active:scale-95 relative group flex items-center justify-center transition-all duration-150 mt-1 cursor-pointer"
              >
                <LogOut className="w-[18px] h-[18px]" />
                <div className="absolute left-full ml-4 px-3 py-1.5 bg-slate-900 text-[11px] font-bold text-white rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 pointer-events-none transition-all duration-200 shadow-xl z-50 flex items-center justify-center">
                  Logout
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-900" />
                </div>
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main floating Panel Area */}
      <div className="flex-1 flex flex-col h-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/50 shadow-[0_4px_30px_rgba(0,0,0,0.02)] overflow-hidden relative transition-all duration-300 ml-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-150 flex items-center justify-between px-4 sm:px-6 md:px-8 relative shrink-0 select-none">
          <div className="flex items-center gap-2 md:gap-4">
            {isFullyClosed ? (
              <Button 
                variant="ghost" 
                size="sm" 
                className="-ml-2 hover:bg-slate-100 flex items-center gap-2 border border-slate-200/80 shadow-sm rounded-xl px-3 h-9 bg-white text-slate-700 hover:text-indigo-600 font-bold transition-all"
                onClick={() => setSidebarFullyClosed(false)}
                id="sidebar-restore-btn"
              >
                <Menu className="h-4.5 w-4.5 text-slate-600" />
                <span className="text-xs hidden sm:inline">Show Sidebar</span>
              </Button>
            ) : (
              isMobile && isCollapsed && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="-ml-2 hover:bg-slate-100"
                  onClick={() => setIsCollapsed(false)}
                >
                  <Menu className="h-5 w-5 text-slate-600" />
                </Button>
              )
            )}
          </div>

          {/* Centered Mobile Logo */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 md:hidden">
            <Link to="/" className="flex items-center gap-2 group">
               <div className="p-1 rounded-xl bg-white shadow-sm border border-slate-150 group-hover:shadow-md transition-all">
                  <VverifyLogo className="w-8 h-8" />
               </div>
               <span className="font-extrabold text-base tracking-tight text-slate-900 hidden sm:block">Vverify</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600 hidden sm:flex">
              <Search className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 ml-1">
              <NotificationsBell />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-500 hover:text-slate-900 border border-slate-200/80 shadow-sm h-8 hidden sm:flex font-bold rounded-xl px-3.5">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/60 flex items-center justify-center text-slate-500 shadow-sm">
                <User className="h-4.5 w-4.5 text-slate-600" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area within main card panel */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 relative">
          {showSwipeHint && isMobile && (
            <div 
              onClick={() => {
                setIsCollapsed(false);
                setShowSwipeHint(false);
                localStorage.setItem("has-seen-swipe-hint-v2", "true");
              }}
              style={{ top: "45%" }}
              className="fixed left-2 z-40 flex items-center gap-2 bg-indigo-600/95 text-white pl-3 pr-4 py-2.5 rounded-full shadow-2xl cursor-pointer border border-indigo-400/30 animate-bounce hover:scale-105 active:scale-95 transition-all"
            >
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-100"></span>
              </span>
              <span className="text-xs font-bold tracking-tight select-none">Swipe left to close</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-pulse"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          )}
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
