import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, MapPin, MessageSquare, CreditCard, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth, db } from "../lib/firebase";
import { doc, runTransaction, collection, getDoc } from "firebase/firestore";

const COUNTRIES = [
  { id: "us", grizzlyId: 12, name: "United States", code: "+1", flag: "🇺🇸", priceModifier: 2.5 },
  { id: "uk", grizzlyId: 16, name: "United Kingdom", code: "+44", flag: "🇬🇧", priceModifier: 2.0 },
  { id: "ca", grizzlyId: 36, name: "Canada", code: "+1", flag: "🇨🇦", priceModifier: 2.0 },
  { id: "in", grizzlyId: 22, name: "India", code: "+91", flag: "🇮🇳", priceModifier: 1.0 },
  { id: "ru", grizzlyId: 0, name: "Russia", code: "+7", flag: "🇷🇺", priceModifier: 0.8 },
  { id: "id", grizzlyId: 6, name: "Indonesia", code: "+62", flag: "🇮🇩", priceModifier: 0.9 },
  { id: "br", grizzlyId: 73, name: "Brazil", code: "+55", flag: "🇧🇷", priceModifier: 1.2 },
];

const SERVICES = [
  { id: "wa", name: "WhatsApp", icon: "💬", basePrice: 50 },
  { id: "tg", name: "Telegram", icon: "✈️", basePrice: 40 },
  { id: "go", name: "Google", icon: "G", basePrice: 30 },
  { id: "ig", name: "Instagram", icon: "📷", basePrice: 20 },
  { id: "fb", name: "Facebook", icon: "f", basePrice: 20 },
  { id: "tw", name: "Twitter", icon: "🐦", basePrice: 25 },
  { id: "ot", name: "Any Other", icon: "🌐", basePrice: 15 },
];

export function BuyNumber() {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [selectedService, setSelectedService] = useState(SERVICES[0]);
  const [searchCountry, setSearchCountry] = useState("");
  const [searchService, setSearchService] = useState("");
  const [isBuying, setIsBuying] = useState(false);
  const navigate = useNavigate();

  const calculatePrice = () => {
    return Math.round(selectedService.basePrice * selectedCountry.priceModifier);
  };

  const handleBuy = async () => {
    if (!auth.currentUser) {
      toast.error("Please login first");
      return;
    }

    setIsBuying(true);
    const cost = calculatePrice();

    try {
      // 1. Check user balance in Firestore
      const userRef = doc(db, "users", auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists() || (userDoc.data().balance || 0) < cost) {
        toast.error("Insufficient balance. Please add funds.");
        setIsBuying(false);
        return;
      }

      // 2. Make Grizzly API Call
      const res = await fetch(`/api/grizzly?action=getNumber&service=${selectedService.id}&country=${selectedCountry.grizzlyId}`);
      const data = await res.text();

      if (data === "NO_NUMBERS") {
        toast.error("No numbers available for this country/service currently.");
        setIsBuying(false);
        return;
      }
      if (data === "NO_BALANCE") {
        toast.error("System error: Provider out of balance.");
        setIsBuying(false);
        return;
      }
      if (!data.startsWith("ACCESS_NUMBER:")) {
        toast.error(`Provider error: ${data}`);
        setIsBuying(false);
        return;
      }

      // data format: ACCESS_NUMBER:$id:$number
      const [, grizzlyId, number] = data.split(":");

      // 3. Deduct balance and create session transactionally
      await runTransaction(db, async (transaction) => {
        const uDoc = await transaction.get(userRef);
        const newBalance = (uDoc.data()?.balance || 0) - cost;
        
        transaction.update(userRef, { balance: newBalance, updatedAt: Date.now() });

        const sessionRef = doc(collection(db, "sessions"));
        transaction.set(sessionRef, {
          userId: auth.currentUser!.uid,
          grizzlyId: grizzlyId,
          number: number,
          service: selectedService.name,
          country: selectedCountry.name,
          cost: cost,
          status: "active",
          createdAt: Date.now(),
          expiresAt: Date.now() + 20 * 60 * 1000 // 20 mins
        });
      });

      toast.success("Number rented successfully!");
      navigate("/dashboard");

    } catch (err: any) {
      console.error(err);
      toast.error("Failed to rent number: " + (err.message || ""));
    } finally {
      setIsBuying(false);
    }
  };

  const filteredCountries = COUNTRIES.filter(c => c.name.toLowerCase().includes(searchCountry.toLowerCase()));
  const filteredServices = SERVICES.filter(s => s.name.toLowerCase().includes(searchService.toLowerCase()));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Rent a Number</h1>
        <p className="text-slate-500 mt-1 text-sm">Select a country and service to instantly rent a number.</p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
              <MapPin className="h-5 w-5 text-indigo-600" /> 1. Select Country
            </h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search countries..."
                className="pl-9 border-slate-200 rounded-lg text-sm bg-slate-50"
                value={searchCountry}
                onChange={e => setSearchCountry(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[200px] border border-slate-200 bg-white rounded-lg p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredCountries.map(country => (
                  <button
                    key={country.id}
                    onClick={() => setSelectedCountry(country)}
                    className={`flex items-center gap-3 p-3 rounded-md border text-left transition-colors ${
                      selectedCountry.id === country.id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm"
                        : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-xl">{country.flag}</span>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold truncate text-slate-800">{country.name}</span>
                      <span className={`text-xs ${selectedCountry.id === country.id ? "text-indigo-600 font-semibold" : "text-slate-500"}`}>
                        {country.code}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-900">
              <MessageSquare className="h-5 w-5 text-indigo-600" /> 2. Select Service
            </h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search services..."
                className="pl-9 border-slate-200 rounded-lg text-sm bg-slate-50"
                value={searchService}
                onChange={e => setSearchService(e.target.value)}
              />
            </div>
            <ScrollArea className="h-[240px] border border-slate-200 bg-white rounded-lg p-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredServices.map(service => (
                  <button
                    key={service.id}
                    onClick={() => setSelectedService(service)}
                    className={`flex flex-col items-center justify-center gap-2 p-4 rounded-md border transition-colors ${
                      selectedService.id === service.id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm"
                        : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-2xl">{service.icon}</span>
                    <span className="text-sm font-bold text-slate-800">{service.name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 sticky top-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Order Summary</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Country</div>
                <div className="font-medium flex items-center gap-2 text-slate-900">
                  {selectedCountry.flag} {selectedCountry.name}
                </div>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Service</div>
                <div className="font-medium text-slate-900">{selectedService.name}</div>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Rental Period</div>
                <div className="font-medium text-slate-900">20 mins</div>
              </div>
              
              <div className="flex justify-between items-end pt-2">
                <div className="text-sm font-bold uppercase text-slate-500">Total</div>
                <div className="text-3xl font-bold tracking-tight text-slate-900">${(calculatePrice() / 100).toFixed(2)}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 bg-slate-50/80 p-6 border-t border-slate-100">
              <Button className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={handleBuy} disabled={isBuying}>
                {isBuying ? "Processing..." : "Get Number"}
                {!isBuying && <CreditCard className="ml-2 h-4 w-4" />}
              </Button>
              <div className="text-xs text-center text-slate-500 flex items-center justify-center gap-1 font-medium mt-1">
                <Shield className="h-3 w-3 text-emerald-500" /> Secure transaction via balance
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
