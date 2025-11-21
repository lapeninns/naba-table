import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40 bg-gradient-to-b from-slate-50 via-white to-slate-50/50">
       <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.05),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.05),transparent_35%)]" />
        
       <div className="container mx-auto px-4 md:px-6 relative flex flex-col items-center text-center">
          <Badge variant="secondary" className="mb-6 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
              Booking made simple
          </Badge>
          
          <h1 className="max-w-4xl text-balance text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
              Reserve the best tables <br className="hidden sm:block"/> without the back-and-forth.
          </h1>
          
          <p className="mt-6 max-w-2xl text-lg text-slate-600 sm:text-xl leading-relaxed">
              Browse partner restaurants, book in seconds, and manage every reservation from one place - mobile first, keyboard friendly, and instant confirmations included.
          </p>
          
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link href="/restaurants">
               <Button size="lg" className="h-12 px-8 text-base shadow-md hover:shadow-lg transition-shadow">Find a restaurant</Button>
            </Link>
             <Link href="/auth/signin">
               <Button variant="outline" size="lg" className="h-12 px-8 text-base bg-white/80 backdrop-blur-sm hover:bg-slate-50 border-slate-200">
                  Sign in to manage
               </Button>
            </Link>
          </div>
          
           <div className="mt-12 grid grid-cols-1 gap-y-4 gap-x-8 sm:grid-cols-3 text-sm font-medium text-slate-500">
              <div className="flex items-center justify-center gap-2">
                 <span className="flex h-2 w-2 rounded-full bg-green-500" /> Instant confirmation
              </div>
               <div className="flex items-center justify-center gap-2">
                 <span className="flex h-2 w-2 rounded-full bg-blue-500" /> Email reminders
              </div>
               <div className="flex items-center justify-center gap-2">
                 <span className="flex h-2 w-2 rounded-full bg-purple-500" /> Easy changes
              </div>
           </div>
       </div>
    </section>
  );
}