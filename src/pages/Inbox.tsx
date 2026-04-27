import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Inbox as InboxIcon, Filter, Copy, RefreshCcw } from "lucide-react";
import { format } from "date-fns";
import { db, auth } from "../lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { toast } from "sonner";

export function Inbox() {
  const [messages, setMessages] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "messages"),
      where("userId", "==", auth.currentUser.uid),
      orderBy("receivedAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, []);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  const filtered = messages.filter(m => 
    (m.text || "").toLowerCase().includes(search.toLowerCase()) || 
    (m.service && m.service.toLowerCase().includes(search.toLowerCase())) ||
    (m.number && m.number.includes(search))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">SMS History</h1>
          <p className="text-slate-500 mt-1 text-sm">All received SMS messages across your numbers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-slate-200 text-slate-700 bg-white shadow-sm font-semibold">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="border-slate-200 text-slate-700 bg-white shadow-sm font-semibold">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input 
          placeholder="Search messages, numbers, or services..." 
          className="pl-9 h-12 bg-slate-50 border-slate-200 text-slate-900" 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-xl border border-dashed border-slate-300">
            <InboxIcon className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No messages yet</h3>
            <p className="text-slate-500">When you rent a number, SMS codes will appear here instantly.</p>
          </div>
        ) : (
          filtered.map(msg => (
            <div key={msg.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row">
                <div className="bg-slate-50 px-6 py-4 md:w-64 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center">
                  <div className="text-[10px] font-bold uppercase text-slate-500 mb-1 tracking-wider">
                    {msg.service || "Any Service"}
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
        )}
      </div>
    </div>
  );
}
