import {
  ArrowRight,
  Bell,
  CalendarCheck,
  Check,
  Flame,
  MapPin,
  Menu,
  Search,
  Star,
  Zap
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { MarketingLayout } from '@/components/layouts/MarketingLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import type { Metadata } from 'next';

const BRAND_NAME = 'Nab a Table';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${BRAND_NAME} - UK's Best Last Minute Reservations`,
  description: 'Skip the weeks of waiting. We monitor top pubs, gastros, and Michelin-star venues across the UK to notify you the second a table opens up.',
  openGraph: {
    title: `${BRAND_NAME} - UK's Best Last Minute Reservations`,
    description: 'The hottest tables in the UK, nabbed instantly.',
    type: 'website',
  },
};

export default function Home() {
  const bookingPath = '/restaurants';

  return (
    <MarketingLayout>
      <div className="min-h-screen">
        {/* Hero Section */}
        <header className="relative pt-12 pb-20 lg:pt-24 lg:pb-32 overflow-hidden">
          {/* Background Elements */}
          <div
            className="absolute inset-0 -z-10 opacity-40"
            style={{
              backgroundImage: 'radial-gradient(hsl(217 91% 60% / 0.1) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
              maskImage: 'linear-gradient(to bottom, white, transparent)',
              WebkitMaskImage: 'linear-gradient(to bottom, white, transparent)',
            }}
            aria-hidden
          />
          <div className="absolute top-0 right-0 -z-10 w-[800px] h-[800px] bg-blue-100/50 rounded-full blur-3xl opacity-50 translate-x-1/3 -translate-y-1/4" aria-hidden />
          <div className="absolute bottom-0 left-0 -z-10 w-[600px] h-[600px] bg-red-100/40 rounded-full blur-3xl opacity-50 -translate-x-1/3 translate-y-1/4" aria-hidden />

          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* Left Content */}
              <div className="space-y-8 animate-fade-up">
                {/* Live Badge */}
                <Badge
                  variant="secondary"
                  className="gap-2 px-3 py-1.5 text-sm animate-pulse-glow rounded-full"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  Instant confirmations
                </Badge>

                <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl text-foreground">
                  Book the perfect table <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">
                    in seconds.
                  </span>
                </h1>

                <p className="text-xl text-muted-foreground max-w-xl">
                  Mobile-first flows, transparent status, and shareable confirmations. Everything a guest needs to feel confident about their reservation.
                </p>

                {/* Search / Action Card */}
                <Card className="max-w-md shadow-xl hover:-translate-y-1 transition-transform duration-300">
                  <CardContent className="p-2 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" aria-hidden />
                      <Input
                        type="text"
                        placeholder="Search restaurants..."
                        className="h-12 pl-10 border-none bg-transparent focus-visible:ring-0"
                      />
                    </div>
                    <Button size="lg" className="h-12 px-8 rounded-xl shrink-0" asChild>
                      <Link href={bookingPath}>
                        <CalendarCheck className="mr-2 h-5 w-5" aria-hidden />
                        Find a table
                      </Link>
                    </Button>
                  </CardContent>
                </Card>

                {/* Secondary CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Button variant="outline" size="lg" className="rounded-full border-blue-200 text-blue-800 hover:bg-blue-50" asChild>
                    <Link href="/auth/signin">Sign in</Link>
                  </Button>
                  <Button variant="ghost" className="text-blue-700 hover:bg-blue-50 rounded-full" asChild>
                    <Link href="/guest/bookings">View my bookings</Link>
                  </Button>
                </div>
              </div>

              {/* Right Visual (Mock App UI) */}
              <div className="relative lg:h-[600px] flex items-center justify-center animate-fade-up" style={{ animationDelay: '200ms' }}>
                {/* Decorative Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent rounded-full opacity-60 blur-2xl transform scale-90" aria-hidden />

                {/* Main App Card Mock */}
                <div className="relative w-[340px] bg-background rounded-[40px] shadow-2xl border-4 border-background overflow-hidden rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
                  {/* Header Mock */}
                  <div className="bg-slate-900 text-white p-6 pb-8">
                    <div className="flex justify-between items-center mb-6">
                      <Menu className="w-6 h-6" aria-hidden />
                      <div className="w-8 h-8 rounded-full bg-slate-700" />
                    </div>
                    <h3 className="text-2xl font-bold">Good Evening,<br />Gourmand.</h3>
                  </div>

                  {/* List Mock */}
                  <div className="p-4 -mt-4 space-y-3 bg-secondary/50 min-h-[300px] rounded-t-3xl">
                    {/* Restaurant Card 1 */}
                    <Card className="p-4 flex gap-4 items-center">
                      <Image
                        src="https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=100&h=100"
                        alt="Restaurant food"
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-bold text-sm">The Devonshire</h4>
                        <p className="text-xs text-muted-foreground">2 seats • Tonight, 8:00 PM</p>
                      </div>
                      <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4" aria-hidden />
                      </div>
                    </Card>

                    {/* Restaurant Card 2 */}
                    <Card className="p-4 flex gap-4 items-center opacity-80">
                      <Image
                        src="https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=100&h=100"
                        alt="Restaurant interior"
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <div className="flex-1">
                        <h4 className="font-bold text-sm">Sketch</h4>
                        <p className="text-xs text-muted-foreground">4 seats • Fri, 7:30 PM</p>
                      </div>
                      <div className="w-8 h-8 bg-secondary text-primary rounded-full flex items-center justify-center">
                        <Bell className="w-4 h-4" aria-hidden />
                      </div>
                    </Card>
                  </div>

                  {/* Notification Toast */}
                  <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 backdrop-blur text-white p-3 rounded-xl flex items-center gap-3 shadow-lg animate-pulse-glow">
                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                    <p className="text-xs font-medium">Table confirmed!</p>
                  </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute top-20 -right-4 bg-card p-3 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce border" style={{ animationDuration: '3s' }}>
                  <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center text-accent">
                    <Flame className="w-5 h-5" aria-hidden />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase">Confirmed</p>
                    <p className="text-sm font-bold text-foreground">Instantly</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* How It Works Section */}
        <section className="py-24 bg-card relative">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <Badge variant="secondary" className="mb-4">
                How it works
              </Badge>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl text-foreground mb-4">
                A guest flow that stays clear
              </h2>
              <p className="text-lg text-muted-foreground">
                From discovery to confirmation, every step is predictable, fast, and accessible on any device.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {steps.map((step) => (
                <Card
                  key={step.title}
                  className="p-6 group cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-secondary text-primary mb-6 group-hover:scale-110 transition-transform duration-300">
                    <step.icon className="w-6 h-6" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-primary mb-2">{step.label}</p>
                  <h3 className="text-xl font-semibold leading-none tracking-tight mb-3">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </Card>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button variant="ghost" className="text-blue-700 hover:bg-blue-50 rounded-full" asChild>
                <Link href={bookingPath}>
                  Explore restaurants <ArrowRight className="ml-2 w-4 h-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 bg-secondary/30 overflow-hidden">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="order-2 lg:order-1 relative">
                <div className="grid grid-cols-2 gap-4">
                  <Image
                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=600"
                    alt="Restaurant interior"
                    width={300}
                    height={200}
                    className="rounded-2xl shadow-lg mt-12 hover:scale-[1.02] transition-transform duration-500"
                  />
                  <Image
                    src="https://images.unsplash.com/photo-1550966871-3ed3c47e2ce2?auto=format&fit=crop&q=80&w=600"
                    alt="Restaurant dining"
                    width={300}
                    height={200}
                    className="rounded-2xl shadow-lg hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>
              </div>

              <div className="order-1 lg:order-2">
                <Badge variant="secondary" className="mb-4">
                  Why guests stay
                </Badge>
                <h2 className="text-3xl font-semibold tracking-tight md:text-4xl mb-6">
                  Clarity at every step
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  We keep states obvious: loading, pending, confirmed, or cancelled. Guests always know what&apos;s next—with inline actions for manage or cancel.
                </p>

                <ul className="space-y-4">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <div className="mt-0.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                      <span className="text-sm text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="bg-primary rounded-[2.5rem] p-8 md:p-16 text-center text-primary-foreground relative overflow-hidden shadow-2xl shadow-primary/20">
              {/* Background Glow */}
              <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary to-blue-700 z-0" aria-hidden />
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" aria-hidden />

              <div className="relative z-10">
                <h2 className="text-3xl font-extrabold tracking-tight lg:text-5xl mb-6">
                  Ready to dine?
                </h2>
                <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto mb-10">
                  Join thousands of guests who book and manage tables in seconds.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-14 px-8 rounded-full text-lg font-bold bg-background text-primary hover:bg-background/90 hover:-translate-y-1 transition-all duration-300 w-full sm:w-auto gap-2"
                    asChild
                  >
                    <Link href={bookingPath}>
                      <CalendarCheck className="w-5 h-5" aria-hidden /> Book now
                    </Link>
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 px-8 rounded-full text-lg font-bold border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 w-full sm:w-auto"
                    asChild
                  >
                    <Link href="/guest/bookings">View my bookings</Link>
                  </Button>
                </div>

                <p className="mt-8 text-sm text-blue-200 opacity-80">No download required • Works on all devices</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}

// Data - Original steps from previous page
const steps = [
  {
    label: 'Step 1',
    icon: MapPin,
    title: 'Pick the vibe',
    description: 'Browse curated restaurants with photos, tags, and live availability—no dead ends or guesswork.',
  },
  {
    label: 'Step 2',
    icon: Zap,
    title: 'Lock the time',
    description: 'See real-time slots with timezone-safe summaries. Inline validation keeps details accurate.',
  },
  {
    label: 'Step 3',
    icon: Star,
    title: 'Get instant proof',
    description: 'Shareable confirmations, calendar add, and manage/cancel in one tap—on any device.',
  },
];

// Features list - Original from previous page
const features = [
  'Shareable confirmations',
  'Calendar-ready receipts',
  'Live status updates',
  'Keyboard & screen-reader friendly',
];
