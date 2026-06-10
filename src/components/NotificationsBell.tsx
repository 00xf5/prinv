import React, { useState, useEffect } from 'react';
import { Bell, Check, Clock, User, X } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

export function NotificationsBell() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", auth.currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any);
      notifs.sort((a: any, b: any) => {
        const tA = a.createdAt?.toDate?.()?.getTime() || a.createdAt || 0;
        const tB = b.createdAt?.toDate?.()?.getTime() || b.createdAt || 0;
        return tB - tA;
      });
      setNotifications(notifs);
      setUnreadCount(notifs.filter((n: any) => !n.read).length);
    });
    return unsub;
  }, []);

  const markAsRead = async (id: string, currentReadStatus: boolean) => {
    if (currentReadStatus) return; // already read
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  const handleReply = async (id: string, text: string) => {
    if (!text.trim()) return;
    try {
      const n = notifications.find(x => x.id === id);
      const currentReplies = n.replies || [];
      await updateDoc(doc(db, "notifications", id), {
        replies: [...currentReplies, { sender: "user", text, timestamp: new Date() }],
        hasNewUserReply: true
      });
      // clear input
      (document.getElementById(`user-reply-${id}`) as HTMLInputElement).value = '';
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="relative p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80 md:w-96 p-0 mr-4" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-lg">
          <span className="font-bold text-slate-800">Notifications</span>
          {unreadCount > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              No notifications yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map(n => (
                <div 
                  key={n.id} 
                  className={`p-4 transition-colors ${n.read ? 'bg-white' : 'bg-indigo-50/50'}`}
                  onClick={() => markAsRead(n.id, n.read)} // mark read on click anywhere
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className={`text-sm ${n.read ? 'font-medium text-slate-700' : 'font-bold text-slate-900'}`}>
                      {n.title}
                    </h4>
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">
                      {n.createdAt ? format(n.createdAt.toDate(), 'p') : 'New'}
                    </span>
                  </div>
                  <p className={`text-xs ${n.read ? 'text-slate-500' : 'text-slate-700 font-medium'} leading-relaxed mb-3 whitespace-pre-wrap`}>
                    {n.message}
                  </p>

                  {/* Replies history */}
                  {n.replies && n.replies.length > 0 && (
                    <div className="mt-2 mb-3 space-y-2 bg-slate-50 p-2.5 rounded-md border border-slate-100 text-xs shadow-inner">
                      {n.replies.map((r: any, i: number) => (
                        <div key={i} className={`flex ${r.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] rounded-md px-3 py-1.5 ${r.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                            {r.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Input */}
                  {n.canReply && (
                    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                      <Input 
                        id={`user-reply-${n.id}`}
                        placeholder="Reply to admin..."
                        className="h-8 text-xs text-slate-700"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            handleReply(n.id, (e.target as HTMLInputElement).value);
                          }
                        }}
                      />
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-8 px-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                        onClick={() => {
                          const val = (document.getElementById(`user-reply-${n.id}`) as HTMLInputElement)?.value;
                          handleReply(n.id, val);
                        }}
                      >
                        <User className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
