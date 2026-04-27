import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, MapPin, MessageSquare, CreditCard, Shield, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { auth, db } from "../lib/firebase";
import { doc, runTransaction, collection, getDoc } from "firebase/firestore";

interface Country {
  grizzlyId: string;
  name: string;
}

interface Service {
  id: string;
  name: string;
  icon: string;
  grizzlyCost: number;
  count: number;
}

const KNOWN_SERVICES: Record<string, {name: string, icon: string}> = {
  wa: { name: "WhatsApp", icon: "💬" },
  tg: { name: "Telegram", icon: "✈️" },
  vi: { name: "Viber", icon: "🟣" },
  ig: { name: "Instagram", icon: "📷" },
  fb: { name: "Facebook", icon: "f" },
  tw: { name: "Twitter", icon: "🐦" },
  go: { name: "Google", icon: "G" },
  ya: { name: "Yandex", icon: "Y" },
  vk: { name: "VKontakte", icon: "V" },
  ok: { name: "Odnoklassniki", icon: "O" },
  av: { name: "Avito", icon: "🛍️" },
  nf: { name: "Netflix", icon: "N" },
  tg_premium: { name: "Telegram Premium", icon: "⭐️" }
};

export function BuyNumber() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  
  const [searchCountry, setSearchCountry] = useState("");
  const [searchService, setSearchService] = useState("");
  
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  
  const [visibleCountryCount, setVisibleCountryCount] = useState(30);
  const [visibleServiceCount, setVisibleServiceCount] = useState(30);
  
  const navigate = useNavigate();

  useEffect(() => {
    setVisibleCountryCount(30);
  }, [searchCountry]);

  useEffect(() => {
    setVisibleServiceCount(30);
  }, [searchService]);

  useEffect(() => {
    async function loadCountries() {
      try {
        const res = await fetch("/api/grizzly?action=getCountries");
        const data = await res.json();
        
        const cList = Object.keys(data).map(key => ({
          grizzlyId: key,
          name: data[key].eng || data[key].rus || "Unknown"
        })).sort((a, b) => a.name.localeCompare(b.name));

        setCountries(cList);
        if (cList.length > 0) setSelectedCountry(cList[0]);
      } catch (err) {
        console.error("Failed to load countries", err);
        toast.error("Failed to load countries");
      } finally {
        setIsLoadingCountries(false);
      }
    }
    loadCountries();
  }, []);

  useEffect(() => {
    if (!selectedCountry) return;
    
    async function loadServices() {
      setIsLoadingServices(true);
      setServices([]);
      setSelectedService(null);
      try {
        const res = await fetch(`/api/grizzly?action=getPrices&country=${selectedCountry!.grizzlyId}`);
        const data = await res.json();
        const countryData = data[selectedCountry!.grizzlyId];
        
        if (countryData) {
          const sList = Object.keys(countryData).map(key => {
            const known = KNOWN_SERVICES[key] || { name: key.toUpperCase(), icon: "📱" };
            return {
              id: key,
              name: known.name,
              icon: known.icon,
              grizzlyCost: countryData[key].cost,
              count: countryData[key].count
            };
          }).filter(s => s.count > 0).sort((a, b) => a.name.localeCompare(b.name));

          setServices(sList);
          if (sList.length > 0) setSelectedService(sList[0]);
        }
      } catch (err) {
        console.error("Failed to load services", err);
      } finally {
        setIsLoadingServices(false);
      }
    }
    loadServices();
  }, [selectedCountry]);

  // Our price is 1.5x Grizzly's price, converted to cents
  const calculatePrice = (cost: number) => {
    return Math.max(10, Math.ceil(cost * 1.5 * 100));
  };

  const currentPrice = selectedService ? calculatePrice(selectedService.grizzlyCost) : 0;

  const handleBuy = async () => {
    if (!auth.currentUser) {
      toast.error("Please login first");
      return;
    }
    if (!selectedCountry || !selectedService) return;

    setIsBuying(true);
    const cost = currentPrice;

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

  const filteredCountries = countries.filter(c => c.name.toLowerCase().includes(searchCountry.toLowerCase()));
  const filteredServices = services.filter(s => s.name.toLowerCase().includes(searchService.toLowerCase()));

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
                {isLoadingCountries ? (
                  <div className="col-span-full flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-indigo-600" /></div>
                ) : (
                  <>
                    {filteredCountries.slice(0, visibleCountryCount).map(country => (
                      <button
                        key={country.grizzlyId}
                        onClick={() => setSelectedCountry(country)}
                        className={`flex items-center gap-2 p-3 rounded-md border text-left transition-colors ${
                          selectedCountry?.grizzlyId === country.grizzlyId
                            ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm font-bold truncate text-slate-800">{country.name}</span>
                      </button>
                    ))}
                    {filteredCountries.length > visibleCountryCount && (
                      <div className="col-span-full pt-2">
                        <Button
                          variant="outline"
                          className="w-full border-dashed text-slate-500 hover:text-slate-700"
                          onClick={() => setVisibleCountryCount(prev => prev + 30)}
                        >
                          Load more countries
                        </Button>
                      </div>
                    )}
                  </>
                )}
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
                {isLoadingServices ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-8">
                     <Loader2 className="animate-spin h-6 w-6 text-indigo-600 mb-2" />
                     <span className="text-xs text-slate-500">Fetching prices...</span>
                  </div>
                ) : (
                  <>
                    {filteredServices.slice(0, visibleServiceCount).map(service => (
                      <button
                        key={service.id}
                        onClick={() => setSelectedService(service)}
                        className={`flex flex-col gap-2 p-3 rounded-md border text-left transition-colors ${
                          selectedService?.id === service.id
                            ? "border-indigo-600 bg-indigo-50 text-indigo-900 shadow-sm"
                            : "border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{service.icon}</span>
                          <span className="text-sm font-bold text-slate-800 truncate">{service.name}</span>
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <span className={`text-xs font-semibold ${selectedService?.id === service.id ? "text-indigo-600" : "text-slate-500"}`}>
                            {(calculatePrice(service.grizzlyCost) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 rounded-full px-1.5 py-0.5">{service.count}</span>
                        </div>
                      </button>
                    ))}
                    {filteredServices.length > visibleServiceCount && (
                      <div className="col-span-full pt-2">
                        <Button
                          variant="outline"
                          className="w-full border-dashed text-slate-500 hover:text-slate-700"
                          onClick={() => setVisibleServiceCount(prev => prev + 30)}
                        >
                          Load more services
                        </Button>
                      </div>
                    )}
                  </>
                )}
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
                  {selectedCountry?.name}
                </div>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Service</div>
                <div className="font-medium flex items-center gap-2 text-slate-900">{selectedService?.icon} {selectedService?.name}</div>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-dashed border-slate-200">
                <div className="text-slate-500 text-sm font-bold uppercase">Rental Period</div>
                <div className="font-medium text-slate-900">20 mins</div>
              </div>
              
              <div className="flex justify-between items-end pt-2">
                <div className="text-sm font-bold uppercase text-slate-500">Total</div>
                <div className="text-3xl font-bold tracking-tight text-slate-900">{(currentPrice / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 bg-slate-50/80 p-6 border-t border-slate-100">
              <Button className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm" onClick={handleBuy} disabled={isBuying || !selectedCountry || !selectedService}>
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
