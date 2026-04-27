import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Globe, Shield, Zap, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)] pb-16">
      <section className="relative pt-24 pb-32 flex flex-col items-center justify-center text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-200/50 via-neutral-50 to-white -z-10" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="container px-4 max-w-4xl max-w-3xl"
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-neutral-900 mb-8 leading-[1.1]">
            Virtual Numbers for <span className="text-neutral-500">Every Service</span>
          </h1>
          <p className="text-lg text-neutral-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Get instant access to virtual numbers from 100+ countries. 
            Receive SMS codes for WhatsApp, Telegram, Google, and more. 
            Real numbers, real fast.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="h-12 px-8 text-base shadow-lg hover:shadow-xl transition-shadow w-full sm:w-auto">
                Get Started
                <CheckCircle2 className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-white w-full sm:w-auto">
                View Pricing
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="py-20 bg-white">
        <div className="container px-4 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                icon: Globe,
                title: "100+ Countries",
                desc: "Numbers available worldwide. Choose the exact region you need for verification."
              },
              {
                icon: Zap,
                title: "Instant Delivery",
                desc: "Real-time SMS reception directly to your dashboard. No waiting around."
              },
              {
                icon: Shield,
                title: "Secure & Private",
                desc: "Your data is safe. We use high-quality non-VoIP numbers for maximum success rate."
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="h-12 w-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-neutral-700" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-neutral-600 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
