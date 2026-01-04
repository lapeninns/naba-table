'use client';

import { Users, Building2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Role = 'guest' | 'owner';

interface RoleCardProps {
  type: Role;
  title: string;
  description: string;
  benefits: string[];
  ctaText: string;
  ctaHref: string;
  icon: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
}

function RoleCard({
  type,
  title,
  description,
  benefits,
  ctaText,
  ctaHref,
  icon,
  isSelected = false,
  onClick,
}: RoleCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const cardContent = (
    <Card
      className={cn(
        'relative h-full transition-all duration-300 ease-out',
        'border-2',
        isSelected
          ? 'border-blue-600 ring-4 ring-blue-100'
          : 'border-slate-200 hover:border-blue-300',
        isHovered ? 'shadow-xl -translate-y-1' : 'shadow-md hover:shadow-lg',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-8 h-full flex flex-col">
        {/* Icon */}
        <div
          className="flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-gradient-to-br transition-all duration-300 ease-out"
          style={{
            background:
              type === 'guest'
                ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                : 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          }}
        >
          <span
            className={cn(
              'transition-colors duration-300',
              type === 'guest' ? 'text-blue-600' : 'text-amber-600',
            )}
            aria-hidden
          >
            {icon}
          </span>
        </div>

        {/* Title & Description */}
        <h2 className="text-2xl font-bold text-slate-900 mb-3">{title}</h2>
        <p className="text-slate-600 mb-6 flex-1">{description}</p>

        {/* Benefits */}
        <ul className="space-y-3 mb-6" aria-label={`Benefits for ${type}`}>
          {benefits.map((benefit, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-slate-700">
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414 1.414L8 12.586l7.293-7.293a1 1 0 011.414-1.414z"
                  clipRule="evenodd"
                  className={type === 'guest' ? 'text-blue-600' : 'text-amber-600'}
                />
              </svg>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Button
          asChild
          size="lg"
          className={cn(
            'w-full group transition-all duration-300 ease-out',
            type === 'guest'
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200'
              : 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-200',
          )}
        >
          <Link href={ctaHref} onClick={onClick}>
            {ctaText}
            <ArrowRight
              className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
              aria-hidden
            />
          </Link>
        </Button>
      </div>
    </Card>
  );

  return cardContent;
}

export function RoleSelectionPage() {
  const [preferredRole, setPreferredRole] = useState<Role | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load saved role preference from localStorage
    const savedRole = localStorage.getItem('preferred-role') as Role | null;
    if (savedRole) {
      setPreferredRole(savedRole);
    }
    setIsLoaded(true);
  }, []);

  const handleRoleSelect = (role: Role, _href: string) => {
    // Save role preference to localStorage (30-day expiry)
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);
    const preference = {
      role,
      expires: expiry.toISOString(),
    };
    localStorage.setItem('preferred-role', JSON.stringify(preference));
    setPreferredRole(role);
  };

  const guestCard: RoleCardProps = {
    type: 'guest',
    title: 'For Guests',
    description: 'Book tables at top restaurants and track your reservations in one place.',
    benefits: [
      'Browse curated restaurants',
      'Instant table reservations',
      'Track all bookings',
      'Calendar-ready receipts',
    ],
    ctaText: 'Sign in as Guest',
    ctaHref: '/auth/signin',
    icon: <Users className="w-8 h-8" />,
    isSelected: preferredRole === 'guest',
    onClick: () => handleRoleSelect('guest', '/auth/signin'),
  };

  const ownerCard: RoleCardProps = {
    type: 'owner',
    title: 'For Restaurant Owners',
    description: 'Manage bookings, fill empty tables, and increase revenue with automation.',
    benefits: [
      'Automated confirmations',
      'No-show prevention',
      'Live availability',
      'Analytics & insights',
    ],
    ctaText: 'Sign in as Owner',
    ctaHref: '/app/auth/signin',
    icon: <Building2 className="w-8 h-8" />,
    isSelected: preferredRole === 'owner',
    onClick: () => handleRoleSelect('owner', '/app/auth/signin'),
  };

  return (
    <div className="w-full max-w-5xl animate-fade-up">
      {/* Header */}
      <div className="mb-10 text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
          Choose your path
        </h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          We help both guests and restaurants. Select the option that matches your needs.
        </p>
      </div>

      {/* Role Cards */}
      <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-8">
        {isLoaded && (
          <>
            <div
              className={cn(
                'motion-safe:reveal-up',
                preferredRole === 'owner' ? 'md:order-last' : '',
              )}
            >
              <RoleCard {...guestCard} />
            </div>
            <div
              className={cn(
                'motion-safe:reveal-up',
                preferredRole === 'guest' ? 'md:order-last' : '',
                'md:delay-100',
              )}
            >
              <RoleCard {...ownerCard} />
            </div>
          </>
        )}
      </div>

      {/* Helper Text */}
      <div className="text-center space-y-2">
        <p className="text-sm text-slate-500">
          Not sure which to choose?{' '}
          <Link
            href="/restaurants"
            className="text-blue-600 hover:text-blue-700 font-medium underline-offset-4 hover:underline transition-colors"
          >
            Start as a guest
          </Link>{' '}
          to browse restaurants first.
        </p>
        <p className="text-xs text-slate-400">
          Your preference is saved for 30 days to make your next visit faster.
        </p>
      </div>
    </div>
  );
}

export default RoleSelectionPage;
