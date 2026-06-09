import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useExchangeRate } from '../../lib/useExchangeRate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { formatCentsToNGN } = useExchangeRate();

  // For manual user editing
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<string>("");
  const [editRole, setEditRole] = useState<string>("user");

  const loadUsers = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleSave = async (userId: string) => {
    const newBalCents = parseInt(editBalance, 10);
    if (isNaN(newBalCents)) return toast.error("Invalid amount");

    try {
      await updateDoc(doc(db, "users", userId), { balance: newBalCents, role: editRole });
      toast.success("User updated");
      setEditingUserId(null);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update balance");
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Users Management</h1>
        <p className="text-sm text-slate-400 mt-1">Manage users and adjust balances.</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-400">
          <thead className="bg-slate-900/50 border-b border-slate-800 text-xs uppercase font-semibold text-slate-500">
            <tr>
              <th className="px-6 py-4">User ID</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Balance (Cents)</th>
              <th className="px-6 py-4">Balance (NGN)</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4 text-slate-300 font-mono text-xs">{user.id}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-indigo-900/50 text-indigo-300' : 'bg-slate-800 text-slate-300'}`}>
                    {user.role || 'user'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {editingUserId === user.id ? (
                    <Input 
                      type="number" 
                      value={editBalance} 
                      onChange={(e) => setEditBalance(e.target.value)} 
                      className="bg-slate-950 border-slate-700 h-8 text-white w-32" 
                    />
                  ) : (
                    <span className="font-mono">{user.balance || 0}¢</span>
                  )}
                </td>
                <td className="px-6 py-4 text-emerald-400 font-medium">
                  {formatCentsToNGN(user.balance || 0)}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingUserId === user.id ? (
                    <div className="flex justify-end gap-2 items-center">
                      <select 
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="bg-slate-950 border border-slate-700 h-8 rounded text-white text-xs px-2"
                      >
                        <option value="user">USER</option>
                        <option value="admin">ADMIN</option>
                      </select>
                      <Button size="sm" variant="outline" className="h-8 border-slate-700 text-slate-300 hover:text-white" onClick={() => setEditingUserId(null)}>Cancel</Button>
                      <Button size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700" onClick={() => handleSave(user.id)}>Save</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 border-slate-700 text-slate-300 hover:text-white" onClick={() => {
                      setEditingUserId(user.id);
                      setEditBalance((user.balance || 0).toString());
                      setEditRole(user.role || 'user');
                    }}>
                      Edit User
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
