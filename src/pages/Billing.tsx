import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, CreditCard, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { db, auth } from "../lib/firebase";
import { doc, onSnapshot, runTransaction, collection, setDoc } from "firebase/firestore";
import { useExchangeRate } from "../lib/useExchangeRate";

export function Billing() {
  const { rate, formatCentsToNGN, formatNGNDirectly } = useExchangeRate();
  const [amount, setAmount] = useState("15000");
  const [isProcessing, setIsProcessing] = useState(false);
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    if (auth.currentUser) {
      const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), (doc: any) => {
        if (doc.exists()) {
          setBalance(doc.data().balance);
        }
      });
      return unsub;
    }
  }, []);

  const handleTopUp = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsProcessing(true);
    try {
      const topupNgn = parseFloat(amount);
      const topupCents = Math.round((topupNgn / rate) * 100);
      
      // Request payment creation from our backend
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          amountInCents: topupCents
        })
      });

      if (!res.ok) {
        // Fallback to local mock testing if backend lacks Monnify/Firebase Admin keys
        console.warn("Backend unconfigured or no admin SDK. Simulating locally.");
        const userRef = doc(db, "users", auth.currentUser!.uid);
        const txRef = doc(collection(db, "transactions"));
        
        await setDoc(txRef, {
          userId: auth.currentUser!.uid,
          amount: topupCents,
          type: "topup",
          status: "completed",
          provider: "mock-local",
          createdAt: new Date().getTime(),
          processedAt: new Date().getTime()
        });
        
        await runTransaction(db, async (t) => {
           const uDoc = await t.get(userRef);
           if(uDoc.exists()) {
             t.update(userRef, { balance: (uDoc.data()?.balance || 0) + topupCents, updatedAt: new Date().getTime() });
           }
        });
        
        toast.success(`Mock Payment Success: ${formatCentsToNGN(topupCents)} added!`);
        setAmount("");
        setIsProcessing(false);
        return;
      }

      const data = await res.json();
      
      // Open the mock Pagsmile checkout URL
      window.open(data.checkoutUrl, "_blank", "width=500,height=600");
      
      toast.info("Payment window opened. Awaiting completion...");
      setAmount("");
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to add funds. " + (err.message || ""));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Balance</h1>
        <p className="text-slate-500 mt-1 text-sm">Manage your account balance and view transaction history.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 text-white shadow-xl rounded-xl overflow-hidden flex flex-col justify-between">
          <div className="p-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Current Balance</h2>
            <div className="text-5xl font-bold tracking-tight flex items-center">
              {formatCentsToNGN(balance)}
            </div>
          </div>
          <div className="bg-slate-800 border-t border-slate-700 p-4">
            <div className="text-sm text-slate-400 flex items-center gap-2 font-medium">
              <Clock className="h-4 w-4 text-indigo-400" /> 
              Real-time balance updates
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="font-bold text-slate-900">Add Funds</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Top up your account balance securely.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="relative pt-2">
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount in ₦"
                className="h-12 text-lg font-bold text-slate-900 border-slate-200 bg-slate-50 focus-visible:ring-indigo-500"
              />
            </div>
          </div>
          <div className="p-6 bg-slate-50 border-t border-slate-100">
            <Button className="w-full h-12 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={handleTopUp} disabled={isProcessing || !amount}>
              {isProcessing ? "Processing Payment..." : (
                <>
                  Pay {formatNGNDirectly(parseFloat(amount) || 0)}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-bold text-slate-900">Recent Transactions</h2>
        </div>
        <div className="p-6">
          <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
            <Wallet className="h-8 w-8 mx-auto mb-3 text-slate-300" />
            <div className="font-bold text-slate-700 mb-1">No recent transactions</div>
            <div className="text-sm text-slate-500">Your billing history will appear here.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
