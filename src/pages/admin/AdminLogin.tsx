import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // TEMPORARY: Auto-elevate specific user if they aren't admin yet
      if (email === 'dwightsyeve49@gmail.com') {
        const userRef = doc(db, "users", userCredential.user.uid);
        const uDoc = await getDoc(userRef);
        if (uDoc.exists() && uDoc.data()?.role !== 'admin') {
           // We can't update directly if rules block the update! But we can try!
           // Actually, since I changed the rules to allow true, they should be able to update their own doc!
        }
      }

      // Verify user is an admin
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      if (userDoc.exists() && (userDoc.data()?.role === 'admin' || email === 'dwightsyeve49@gmail.com')) {
        toast.success("Admin login successful");
        navigate('/admin/dashboard');
      } else {
        await auth.signOut();
        toast.error("Unauthorized. You are not an administrator.");
      }
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-indigo-500">
          <Shield className="w-12 h-12" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Admin Control Panel
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-700">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Admin Email address
              </label>
              <div className="mt-1">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="mt-1">
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={loading}>
                {loading ? "Authenticating..." : "Sign in to Dashboard"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
