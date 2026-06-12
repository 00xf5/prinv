import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Inbox as InboxIcon, Filter, Copy, RefreshCcw, Bell, User, HelpCircle, Plus, Send, CheckCircle, MessageSquare, X } from "lucide-react";
import { format } from "date-fns";
import { ServiceLogo } from "./BuyNumber";
import { db, auth } from "../lib/firebase";
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore";
import { toast } from "sonner";

export function Inbox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'sms'|'system'|'support'>('sms');
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // Create ticket form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("Numbers & Rental");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    const unsubSms = onSnapshot(query(
      collection(db, "messages"),
      where("userId", "==", auth.currentUser.uid)
    ), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => {
        const tA = a.receivedAt?.toDate?.()?.getTime() || a.receivedAt || 0;
        const tB = b.receivedAt?.toDate?.()?.getTime() || b.receivedAt || 0;
        return tB - tA;
      });
      setMessages(list);
    });

    const unsubNotifs = onSnapshot(query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid)
    ), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || a.createdAt || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || b.createdAt || 0;
        return tB - tA;
      });
      setNotifications(list);
    });

    // In-memory sort to prevent composite index errors in Firestore
    const unsubTickets = onSnapshot(query(
      collection(db, "tickets"),
      where("userId", "==", auth.currentUser.uid)
    ), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || a.createdAt || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || b.createdAt || 0;
        return tB - tA; // descending Order
      });
      setTickets(list);
    });

    return () => { 
      unsubSms(); 
      unsubNotifs(); 
      unsubTickets(); 
    };
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const markAsRead = async (id: string, currentReadStatus: boolean) => {
    if (currentReadStatus) return;
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (e) {
      console.error("Mark read error:", e);
    }
  };

  const handleReply = async (id: string, text: string) => {
    if (!text.trim()) return;
    try {
      const n = notifications.find(x => x.id === id);
      if (!n) return;
      const currentReplies = n.replies || [];
      await updateDoc(doc(db, "notifications", id), {
        replies: [...currentReplies, { sender: "user", text, timestamp: new Date() }],
        hasNewUserReply: true
      });
      const inputEl = document.getElementById(`inbox-reply-${id}`) as HTMLInputElement;
      if (inputEl) inputEl.value = '';
      toast.success("Reply sent!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to send reply");
    }
  };

  // Support Ticketing handlers
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    if (!newTitle.trim() || !newDescription.trim()) {
      toast.error("Please fill in all ticket details.");
      return;
    }
    setIsSubmittingTicket(true);
    try {
      await addDoc(collection(db, "tickets"), {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || "No email",
        title: newTitle.trim(),
        category: newCategory,
        description: newDescription.trim(),
        status: "open",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        replies: [],
        hasNewUserReply: true,
        hasNewAdminReply: false
      });
      setNewTitle("");
      setNewDescription("");
      setShowCreateForm(false);
      toast.success("Your support ticket has been opened! An admin will review it shortly.");
    } catch (err) {
      console.error("Create ticket error:", err);
      toast.error("Failed to create support ticket.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSendTicketReply = async (ticketId: string, text: string) => {
    if (!text.trim()) return;
    try {
      const ticket = tickets.find(x => x.id === ticketId);
      if (!ticket) return;
      const currentReplies = ticket.replies || [];
      await updateDoc(doc(db, "tickets", ticketId), {
        replies: [
          ...currentReplies,
          {
            sender: "user",
            text: text.trim(),
            timestamp: new Date().getTime(),
            senderEmail: auth.currentUser?.email || ""
          }
        ],
        hasNewUserReply: true,
        hasNewAdminReply: false,
        updatedAt: serverTimestamp()
      });
      const inputEl = document.getElementById(`ticket-reply-${ticketId}`) as HTMLInputElement;
      if (inputEl) inputEl.value = '';
      toast.success("Replied to support thread!");
    } catch (err) {
      console.error("Reply ticket error:", err);
      toast.error("Failed to send reply");
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    try {
      await updateDoc(doc(db, "tickets", ticketId), {
        status: "closed",
        updatedAt: serverTimestamp()
      });
      toast.success("Ticket closed and marked as resolved.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update ticket.");
    }
  };

  const filteredMsgs = messages.filter(m => 
    (m.text || "").toLowerCase().includes(search.toLowerCase()) || 
    (m.service && m.service.toLowerCase().includes(search.toLowerCase())) ||
    (m.number && m.number.includes(search))
  );

  const filteredNotifs = notifications.filter(n =>
    (n.title && n.title.toLowerCase().includes(search.toLowerCase())) ||
    (n.message && n.message.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredTickets = tickets.filter(t =>
    (t.title && t.title.toLowerCase().includes(search.toLowerCase())) ||
    (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
    (t.category && t.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inbox</h1>
          <p className="text-slate-500 mt-1 text-sm">View your received SMS, system alerts, or chat with support.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setActiveTab('sms')} variant={activeTab === 'sms' ? "default" : "outline"} size="sm" className="shadow-sm font-semibold">
            <InboxIcon className="h-4 w-4 mr-2" />
            SMS Codes
          </Button>
          <Button onClick={() => setActiveTab('system')} variant={activeTab === 'system' ? "default" : "outline"} size="sm" className="shadow-sm font-semibold">
            <Bell className="h-4 w-4 mr-2" />
            System 
            {notifications.filter(n => !n.read).length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 rounded-full">{notifications.filter(n => !n.read).length}</span>
            )}
          </Button>
          <Button onClick={() => setActiveTab('support')} variant={activeTab === 'support' ? "default" : "outline"} size="sm" className="shadow-sm font-semibold">
            <HelpCircle className="h-4 w-4 mr-2" />
            Support
            {tickets.filter(t => t.hasNewAdminReply).length > 0 && (
              <span className="ml-1.5 bg-indigo-600 text-white text-[10px] px-1.5 rounded-full">
                {tickets.filter(t => t.hasNewAdminReply).length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Search */}
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input 
          placeholder={`Search ${activeTab === 'sms' ? "messages, numbers..." : activeTab === 'system' ? "notifications..." : "support tickets..."}`}
          className="pl-9 h-12 bg-slate-50 border-slate-200 text-slate-900 text-base" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tab Switcher Area */}
      <div className="space-y-4">
        {/* SMS Codes Tab */}
        {activeTab === 'sms' && (
          filteredMsgs.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-xl border border-dashed border-slate-300">
              <InboxIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No messages yet</h3>
              <p className="text-slate-500">When you rent a number, SMS codes will appear here instantly.</p>
            </div>
          ) : (
            filteredMsgs.map(msg => (
              <div key={msg.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row">
                  <div className="bg-slate-50 px-6 py-4 md:w-64 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <ServiceLogo code={msg.serviceCode || ""} name={msg.service || ""} className="h-5 w-5 text-[8px]" />
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                        {msg.service || "Any Service"}
                      </span>
                    </div>
                    <div className="font-mono font-medium text-lg tracking-tight text-slate-900">
                      {msg.number || "Hidden"}
                    </div>
                    <div className="text-xs text-slate-500 mt-2 font-medium">
                      {format(msg.receivedAt, "MMM d, h:mm a")}
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col justify-center">
                    <div className="text-xs font-bold uppercase mb-2 text-slate-400 tracking-wider">From: {msg.sender || "System"}</div>
                    <p className="text-indigo-800 font-medium leading-relaxed font-mono bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 break-all">
                      {msg.text}
                    </p>
                    <div className="mt-4 flex justify-end">
                      <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-900 font-medium" onClick={() => handleCopy(msg.text)}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy Text
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )
        )}

        {/* System Notifications Tab */}
        {activeTab === 'system' && (
          filteredNotifs.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-xl border border-dashed border-slate-300">
              <Bell className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No system notifications</h3>
              <p className="text-slate-500">Updates and alerts from admins will appear here.</p>
            </div>
          ) : (
            filteredNotifs.map(n => (
              <div 
                key={n.id} 
                className={`bg-white rounded-xl shadow-sm border ${n.read ? 'border-slate-200' : 'border-indigo-300 bg-indigo-50/30'} p-6 transition-colors`}
                onClick={() => markAsRead(n.id, n.read)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className={`text-lg ${n.read ? 'text-slate-800 font-medium' : 'text-indigo-900 font-bold'}`}>{n.title}</h3>
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap ml-4">
                    {(() => {
                      if (!n.createdAt) return 'New';
                      try {
                        const date = n.createdAt.toDate ? n.createdAt.toDate() : new Date(n.createdAt);
                        return format(date, 'PP p');
                      } catch (err) {
                        return 'New';
                      }
                    })()}
                  </span>
                </div>
                <p className="text-slate-600 text-sm whitespace-pre-wrap mb-4">{n.message}</p>
                
                {n.replies && n.replies.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-3 mb-4">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Thread History</h4>
                    {n.replies.map((r: any, i: number) => (
                      <div key={i} className={`flex ${r.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${r.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700 shadow-sm'}`}>
                          {r.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {n.canReply && !n.replies?.some((r: any) => r.sender === 'user') && (
                  <div className="mt-4 flex items-center gap-3 pt-4 border-t border-slate-100" onClick={e => e.stopPropagation()}>
                    <Input 
                      placeholder="Type your reply to the admin here..."
                      className="bg-slate-50 border-slate-200"
                      id={`inbox-reply-${n.id}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleReply(n.id, (e.target as HTMLInputElement).value);
                        }
                      }}
                    />
                    <Button variant="secondary" onClick={() => {
                        const val = (document.getElementById(`inbox-reply-${n.id}`) as HTMLInputElement)?.value;
                        if (val) handleReply(n.id, val);
                    }}>
                      <User className="h-4 w-4 mr-2" />
                      Reply
                    </Button>
                  </div>
                )}
                {n.canReply && n.replies?.some((r: any) => r.sender === 'user') && (
                  <div className="text-[10px] text-slate-400 mt-2 text-center italic bg-slate-50 border border-slate-100 rounded p-1.5 w-full">
                     Feedback sent. For more help, please open a support ticket.
                  </div>
                )}
              </div>
            ))
          )
        )}

        {/* Support Tickets Tab */}
        {activeTab === 'support' && (
          <div className="space-y-6">
            {/* Top action block */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600" />
                Customer Support Center
              </h2>
              <Button onClick={() => setShowCreateForm(!showCreateForm)} size="sm" className="font-semibold shadow-sm">
                {showCreateForm ? (
                  <>
                    <X className="w-4 h-4 mr-1.5" /> Close Form
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-1.5" /> Open New Ticket
                  </>
                )}
              </Button>
            </div>

            {/* Create Ticket Form */}
            {showCreateForm && (
              <form onSubmit={handleCreateTicket} className="bg-gradient-to-r from-indigo-50 to-blue-50/50 p-6 rounded-xl border border-indigo-100 space-y-4">
                <h3 className="text-sm font-bold uppercase text-indigo-900 tracking-wider">Submit a Support Ticket</h3>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Subject / Problem Title</label>
                  <Input 
                    placeholder="e.g., Cannot receive SMS code for WhatsApp or Payment failed"
                    className="bg-white border-slate-200 text-slate-900"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Category</label>
                  <select 
                    className="w-full rounded-md border border-slate-200 bg-white text-slate-900 h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                  >
                    <option value="Numbers & Rental">Numbers & Rental (SMS issues, active numbers)</option>
                    <option value="Payments & Credits">Payments & Credits (failed funding, balance error)</option>
                    <option value="General Refund">General Refund Request</option>
                    <option value="Technical Bug">Technical System Bug</option>
                    <option value="Other support">Other General Questions</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Describe your problem in detail</label>
                  <textarea 
                    rows={4}
                    placeholder="Provide specific details e.g. transaction reference ID, number rented, times tried, etc. so that support agents can solve it immediately."
                    className="w-full rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreateForm(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={isSubmittingTicket} className="bg-indigo-600 hover:bg-indigo-700 font-semibold shadow">
                    {isSubmittingTicket ? "Submitting..." : "Submit Support Request"}
                  </Button>
                </div>
              </form>
            )}

            {/* Support Tickets List */}
            {filteredTickets.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
                <HelpCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-slate-900">No support tickets</h3>
                <p className="text-slate-500 max-w-sm mx-auto mt-1">If you have any issue, click "Open New Ticket" in the upper right. We generally resolve all tickets inside 15-30 minutes.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredTickets.map(t => {
                  const isExpanded = expandedTicketId === t.id;
                  const hasUnread = t.hasNewAdminReply;
                  let badgeColor = "bg-yellow-50 text-yellow-700 border-yellow-200";
                  if (t.status === "answered") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse";
                  if (t.status === "closed") badgeColor = "bg-slate-100 text-slate-600 border-slate-200";

                  return (
                    <div 
                      key={t.id}
                      className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md ${hasUnread ? "border-l-4 border-l-indigo-600" : ""}`}
                    >
                      {/* Ticket Header Bar */}
                      <div 
                        className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50"
                        onClick={async () => {
                          setExpandedTicketId(isExpanded ? null : t.id);
                          // Clear unread flag when user views the ticket
                          if (hasUnread) {
                            try {
                              await updateDoc(doc(db, "tickets", t.id), { hasNewAdminReply: false });
                            } catch(err){}
                          }
                        }}
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-bold tracking-wider uppercase bg-slate-100 px-2 py-0.5 rounded text-slate-500 border border-slate-200">
                              {t.category}
                            </span>
                            <span className={`text-[10px] font-bold tracking-wider uppercase border px-2 py-0.5 rounded ${badgeColor}`}>
                              {t.status}
                            </span>
                            {hasUnread && (
                              <span className="text-[10px] font-bold tracking-wider uppercase bg-indigo-600 text-white px-2 py-0.5 rounded">
                                New Reply!
                              </span>
                            )}
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{t.title}</h3>
                          <p className="text-xs text-slate-400 font-medium">
                            Opened Ref: #{t.id.slice(0, 8).toUpperCase()} • {t.createdAt ? format(t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt), "PPp") : "Just now"}
                          </p>
                        </div>
                        <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full whitespace-nowrap self-start sm:self-center">
                          {isExpanded ? "Hide Chat Thread" : "View Chat Thread"}
                        </div>
                      </div>

                      {/* Expanded Ticket Thread Content */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 bg-slate-50/50 p-5 sm:p-6 space-y-4">
                          {/* Original description message */}
                          <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-sm max-w-[85%]">
                            <div className="flex items-center gap-1.5 mb-2">
                              <div className="w-5 h-5 rounded-full bg-slate-200 font-bold text-[10px] text-slate-700 flex items-center justify-center">U</div>
                              <span className="text-xs font-bold text-slate-700">You (Original Message)</span>
                            </div>
                            <p className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">{t.description}</p>
                          </div>

                          {/* Replies Thread */}
                          {t.replies && t.replies.map((r: any, index: number) => {
                            const isUser = r.sender === "user";
                            return (
                              <div 
                                key={index} 
                                className={`flex ${isUser ? "justify-end" : "justify-start animate-fade-in"}`}
                              >
                                <div className={`max-w-[85%] p-4 rounded-lg border shadow-sm ${
                                  isUser 
                                    ? "bg-indigo-600 text-white border-indigo-700" 
                                    : "bg-white text-slate-800 border-slate-200"
                                }`}>
                                  <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold opacity-80 uppercase tracking-widest">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>{isUser ? "You" : "Support Agent (Admin)"}</span>
                                    <span>•</span>
                                    <span>{r.timestamp ? format(new Date(r.timestamp), "h:mm a, MMM d") : ""}</span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.text}</p>
                                </div>
                              </div>
                            );
                          })}

                          {/* Chat Response Action Input */}
                          {t.status !== "closed" ? (
                            <div className="pt-4 border-t border-slate-200 space-y-3">
                              <div className="flex gap-2 items-center">
                                <Input 
                                  placeholder="Type message response to support agents..."
                                  id={`ticket-reply-${t.id}`}
                                  className="bg-white border-slate-200 shadow-inner h-11 text-slate-800 text-sm"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleSendTicketReply(t.id, (e.target as HTMLInputElement).value);
                                    }
                                  }}
                                />
                                <Button 
                                  variant="default"
                                  className="bg-indigo-600 hover:bg-indigo-700 h-11 px-4 shadow font-bold text-sm shrink-0"
                                  onClick={() => {
                                    const val = (document.getElementById(`ticket-reply-${t.id}`) as HTMLInputElement)?.value;
                                    if (val) handleSendTicketReply(t.id, val);
                                  }}
                                >
                                  <Send className="w-4 h-4 mr-1.5" />
                                  Send
                                </Button>
                              </div>

                              <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                                <span>Support is active. Responses are instant in most hours.</span>
                                <Button 
                                  variant="ghost" 
                                  size="xs" 
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold underline"
                                  onClick={() => handleCloseTicket(t.id)}
                                >
                                  Close Support Ticket as Solved
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-4 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-100 rounded border border-dashed border-slate-200">
                              This Ticket is Closed & Resolved. You cannot reply.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
