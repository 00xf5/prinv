import { useState, useEffect } from "react";
import { collection, query, getDocs, addDoc, serverTimestamp, orderBy, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Send, User, MessageSquare, Plus, Clock, InboxIcon, History, HelpCircle, CheckCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export function AdminSendInbox() {
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("ALL");
  const [message, setMessage] = useState("");
  const [title, setTitle] = useState("");
  const [allowReply, setAllowReply] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  
  // Admin Panel Tab Switcher
  const [activeTab, setActiveTab] = useState<'broadcasts' | 'support'>('broadcasts');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Fetch users for dropdown
    const fetchUsers = async () => {
      const uSnap = await getDocs(query(collection(db, "users")));
      setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchUsers();

    // Fetch sent notifications
    const qNotifs = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    const unsubNotifs = onSnapshot(qNotifs, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Fetch user support tickets
    const unsubTickets = onSnapshot(collection(db, "tickets"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort in memory: unread replies from users first, then by updatedAt desc
      list.sort((a: any, b: any) => {
        if (a.hasNewUserReply && !b.hasNewUserReply) return -1;
        if (!a.hasNewUserReply && b.hasNewUserReply) return 1;
        
        const tA = a.updatedAt?.toDate?.()?.getTime() || a.updatedAt || 0;
        const tB = b.updatedAt?.toDate?.()?.getTime() || b.updatedAt || 0;
        return tB - tA;
      });
      setTickets(list);
    });

    return () => {
      unsubNotifs();
      unsubTickets();
    };
  }, []);

  const handleSend = async () => {
    if (!message.trim() || !title.trim()) {
      toast.error("Please provide a title and a message.");
      return;
    }

    setIsSending(true);
    try {
      if (selectedUser === "ALL") {
        const batch = users.map(u => 
          addDoc(collection(db, "notifications"), {
            userId: u.id,
            userEmail: u.email,
            title,
            message,
            read: false,
            canReply: allowReply,
            createdAt: serverTimestamp(),
            replies: []
          })
        );
        await Promise.all(batch);
        toast.success(`Broadcast sent to ${users.length} users.`);
      } else {
        const u = users.find(u => u.id === selectedUser);
        await addDoc(collection(db, "notifications"), {
          userId: selectedUser,
          userEmail: u?.email || "Unknown",
          title,
          message,
          read: false,
          canReply: allowReply,
          createdAt: serverTimestamp(),
          replies: []
        });
        toast.success("Notification sent to specific user.");
      }
      setMessage("");
      setTitle("");
      setAllowReply(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to send message.");
    } finally {
      setIsSending(false);
    }
  };

  const handleAdminReply = async (notificationId: string, text: string) => {
    if (!text.trim()) return;
    try {
      const nRef = doc(db, "notifications", notificationId);
      const notification = notifications.find(n => n.id === notificationId);
      const currentReplies = notification.replies || [];
      await updateDoc(nRef, {
        replies: [...currentReplies, { sender: "admin", text, timestamp: new Date() }],
        read: false, // Mark unread for user
        hasNewUserReply: false // clear flag
      });
      toast.success("Reply sent.");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send reply.");
    }
  };

  // Support Ticket Answering
  const handleAdminTicketReply = async (ticketId: string, text: string) => {
    if (!text.trim()) return;
    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) return;
      
      const currentReplies = ticket.replies || [];
      await updateDoc(doc(db, "tickets", ticketId), {
        replies: [
          ...currentReplies,
          {
            sender: "admin",
            text: text.trim(),
            timestamp: new Date().getTime(),
            senderEmail: auth.currentUser?.email || "Admin Support"
          }
        ],
        status: "answered",
        hasNewAdminReply: true,
        hasNewUserReply: false,
        updatedAt: serverTimestamp()
      });
      const inputEl = document.getElementById(`admin-ticket-reply-${ticketId}`) as HTMLInputElement;
      if (inputEl) inputEl.value = '';
      toast.success("Message sent to customer ticket thread!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send support response.");
    }
  };

  const handleToggleTicketStatus = async (ticketId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "closed" ? "open" : "closed";
      await updateDoc(doc(db, "tickets", ticketId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
      toast.success(`Support Ticket is now ${newStatus.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to alter ticket status.");
    }
  };

  const filteredNotifs = notifications.filter(n =>
    (n.title && n.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (n.userEmail && n.userEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredTickets = tickets.filter(t =>
    (t.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.userEmail && t.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 text-white">
      {/* Page Header with Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Send className="w-6 h-6 text-indigo-400" />
            Communication & Help Desk
          </h1>
          <p className="text-sm text-slate-400 mt-1">Broadcast system alerts or answer client support tickets on this screen.</p>
        </div>
        
        {/* Toggle tabs */}
        <div className="flex bg-slate-900 p-1.5 rounded-lg border border-slate-800 self-start">
          <button 
            onClick={() => { setActiveTab('broadcasts'); setSearchQuery(""); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all ${
              activeTab === 'broadcasts' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Broadcast Alerts
          </button>
          <button 
            onClick={() => { setActiveTab('support'); setSearchQuery(""); }}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'support' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Support Tickets
            {tickets.filter(t => t.hasNewUserReply).length > 0 && (
              <span className="bg-amber-500 text-amber-950 text-[10px] px-2 py-0.5 rounded-full font-black animate-pulse">
                {tickets.filter(t => t.hasNewUserReply).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Live search input */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input 
          placeholder={activeTab === 'broadcasts' ? "Search broadcast logs, recipient email..." : "Search tickets, user email, keywords..."}
          className="pl-9 bg-slate-950 border-slate-800 text-white placeholder-slate-500 h-11"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {activeTab === 'broadcasts' ? (
        /* BROADCAST SYSTEM ALERTS TAB */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start animate-fade-in">
          {/* Compose Panel */}
          <div className="lg:col-span-1 border-slate-800 border bg-slate-900 rounded-xl p-6 space-y-6 block">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-emerald-400" />
              New Message
            </h2>
            
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">Target User</label>
              <select
                value={selectedUser}
                onChange={e => setSelectedUser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="ALL">All Users (Broadcast)</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">Title</label>
              <Input 
                placeholder="e.g. System Update, Payment Received..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="bg-slate-950 border-slate-700 text-white focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-2 tracking-wider">Message</label>
              <textarea
                placeholder="Write your message here..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                className="w-full h-32 bg-slate-950 border border-slate-700 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
              />
            </div>

            <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <input 
                type="checkbox" 
                id="canReply"
                checked={allowReply}
                onChange={e => setAllowReply(e.target.checked)}
                className="w-4 h-4 bg-slate-900 border-slate-700 rounded text-indigo-500 focus:ring-indigo-500" 
              />
              <label htmlFor="canReply" className="text-sm text-slate-300 font-medium cursor-pointer select-none">
                Allow user to reply
              </label>
            </div>

            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 font-bold"
              disabled={isSending}
              onClick={handleSend}
            >
              {isSending ? "Sending..." : "Send Message"}
            </Button>
          </div>

          {/* History */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
              <History className="w-5 h-5 text-indigo-400" />
              Sent Messages & Threads
            </h2>

            <div className="space-y-4">
              {filteredNotifs.length === 0 ? (
                <div className="py-12 text-center border border-slate-800 border-dashed rounded-xl bg-slate-900/50">
                  <InboxIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium tracking-tight text-sm">No messages found matching search.</p>
                </div>
              ) : (
                filteredNotifs.map(n => (
                  <div key={n.id} className={`bg-slate-900 border ${n.hasNewUserReply ? 'border-amber-500/50 bg-amber-500/5' : 'border-slate-800'} rounded-xl p-5 block`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white tracking-tight">{n.title}</h3>
                          {n.hasNewUserReply && <span className="bg-amber-500 text-amber-950 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">New Reply</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <User className="w-3 h-3" /> {n.userEmail || "Unknown"} &middot; <Clock className="w-3 h-3 ml-1" /> {n.createdAt ? format(n.createdAt.toDate(), 'PP p') : 'Just now'}
                        </p>
                      </div>
                      {n.canReply && (
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 flex items-center gap-1 uppercase tracking-wider font-bold rounded">
                          Replies active
                        </span>
                      )}
                    </div>
                    
                    <div className="text-sm text-slate-300 bg-slate-950 p-4 rounded-lg border border-slate-800/50 mb-4 whitespace-pre-wrap">
                      {n.message}
                    </div>

                    {n.replies && n.replies.length > 0 && (
                      <div className="mt-4 space-y-3 bg-slate-950/50 p-4 rounded-lg border border-slate-800">
                        <h4 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Thread History</h4>
                        {n.replies.map((r: any, i: number) => (
                          <div key={i} className={`flex ${r.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${r.sender === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                              {r.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {n.canReply && (
                      <div className="mt-4 flex items-center gap-3">
                        <Input 
                          placeholder="Type a reply to the user..."
                          className="bg-slate-950 border-slate-700 text-white text-sm"
                          id={`reply-${n.id}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value;
                              handleAdminReply(n.id, val);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }}
                        />
                        <Button size="sm" variant="secondary" onClick={() => {
                          const val = (document.getElementById(`reply-${n.id}`) as HTMLInputElement)?.value;
                          if (val) {
                            handleAdminReply(n.id, val);
                            (document.getElementById(`reply-${n.id}`) as HTMLInputElement).value = '';
                          }
                        }}>
                          Reply
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* USER SUPPORT TICKETS TAB */
        <div className="space-y-6 animate-fade-in max-w-4xl">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-indigo-400" />
              Incoming Support Tickets ({filteredTickets.length})
            </h2>
            <p className="text-xs text-slate-400">Tickets requiring attention are automatically bubbled to the top.</p>
          </div>

          <div className="space-y-4">
            {filteredTickets.length === 0 ? (
              <div className="py-16 text-center border border-slate-800 border-dashed rounded-xl bg-slate-900/50">
                <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">No support tickets found</h3>
                <p className="text-slate-500 text-xs mt-1">When users open support tickets, they will display here instantly.</p>
              </div>
            ) : (
              filteredTickets.map(t => {
                const isExpanded = expandedTicketId === t.id;
                const hasUserReplyUnread = t.hasNewUserReply;
                let badgeColor = "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
                if (t.status === "answered") badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                if (t.status === "closed") badgeColor = "bg-slate-800 text-slate-400 border-slate-700";

                return (
                  <div 
                    key={t.id} 
                    className={`bg-slate-900 border rounded-xl overflow-hidden transition-all shadow-sm ${
                      hasUserReplyUnread ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)]' : 'border-slate-800'
                    }`}
                  >
                    {/* Header line click triggers Expand */}
                    <div 
                      className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-950/30"
                      onClick={() => setExpandedTicketId(isExpanded ? null : t.id)}
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold uppercase bg-slate-950 px-2.5 py-0.5 rounded text-indigo-300 border border-slate-800">
                            {t.category}
                          </span>
                          <span className={`text-[10px] font-bold uppercase border px-2.5 py-0.5 rounded ${badgeColor}`}>
                            {t.status}
                          </span>
                          {hasUserReplyUnread && (
                            <span className="text-[10px] font-black uppercase bg-amber-500 text-amber-950 px-2 py-0.5 rounded-full animate-bounce">
                              User Replied!
                            </span>
                          )}
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{t.title}</h3>
                        <p className="text-xs text-slate-400 flex flex-wrap items-center gap-1.5 font-medium">
                          <span>User: <strong className="text-slate-200">{t.userEmail}</strong></span>
                          <span>&middot;</span>
                          <span>Ref ID: #{t.id.slice(0, 8).toUpperCase()}</span>
                          <span>&middot;</span>
                          <span>{t.createdAt ? format(t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt), "PPp") : ""}</span>
                        </p>
                      </div>
                      <div className="text-xs font-semibold px-4 py-1.5 rounded-full bg-slate-950 text-indigo-400 border border-slate-800 whitespace-nowrap self-start sm:self-center">
                        {isExpanded ? "Close Thread View" : "Expand Thread & Reply"}
                      </div>
                    </div>

                    {/* Expandable Chat Log */}
                    {isExpanded && (
                      <div className="border-t border-slate-950 bg-slate-950/40 p-5 sm:p-6 space-y-4">
                        {/* Original description message */}
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 max-w-[85%]">
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-bold text-[10px] flex items-center justify-center">U</div>
                            <span className="text-xs font-bold text-slate-300">Customer (Opening Dispute/Inquiry):</span>
                          </div>
                          <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{t.description}</p>
                        </div>

                        {/* Thread history list */}
                        {t.replies && t.replies.map((r: any, idx: number) => {
                          const isUser = r.sender === "user";
                          return (
                            <div 
                              key={idx} 
                              className={`flex ${isUser ? "justify-start" : "justify-end"}`}
                            >
                              <div className={`max-w-[85%] p-4 rounded-lg border shadow-sm ${
                                isUser 
                                  ? "bg-slate-900 border-slate-800 text-slate-200" 
                                  : "bg-indigo-600 text-white border-indigo-700"
                              }`}>
                                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold opacity-80 uppercase tracking-wider">
                                  <span>{isUser ? `User (${t.userEmail})` : "You (Support Staff)"}</span>
                                  <span>&middot;</span>
                                  <span>{r.timestamp ? format(new Date(r.timestamp), "h:mm a, MMM d") : ""}</span>
                                </div>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.text}</p>
                              </div>
                            </div>
                          );
                        })}

                        {/* Direct input response action field */}
                        <div className="pt-4 border-t border-slate-850 space-y-4">
                          <div className="flex items-center gap-2">
                            <Input 
                              placeholder="Type support answer/solution directly to user..."
                              className="bg-slate-950 border-slate-800 text-white shadow-inner h-11"
                              id={`admin-ticket-reply-${t.id}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleAdminTicketReply(t.id, (e.target as HTMLInputElement).value);
                                }
                              }}
                            />
                            <Button
                              className="bg-indigo-600 hover:bg-indigo-700 font-bold h-11 shrink-0"
                              onClick={() => {
                                const val = (document.getElementById(`admin-ticket-reply-${t.id}`) as HTMLInputElement)?.value;
                                if (val) handleAdminTicketReply(t.id, val);
                              }}
                            >
                              <Send className="w-4 h-4 mr-1.5" />
                              Send Answer
                            </Button>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500">Replying will automatically mark ticket status as "ANSWERED".</span>
                            <Button
                              variant="outline"
                              size="xs"
                              className="bg-slate-950 hover:bg-slate-900 text-xs border-slate-800 text-slate-300 font-bold"
                              onClick={() => handleToggleTicketStatus(t.id, t.status)}
                            >
                              {t.status === "closed" ? "Reopen Ticket as Open" : "Mark as Solved & Close Ticket"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
