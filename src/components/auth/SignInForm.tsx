'use client';

import { Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Button } from '@shared/ui/button';
import { Input } from '@shared/ui/input';
import { Label } from '@shared/ui/label';

export type SignInFormProps = {
    redirectedFrom?: string;
};

export function SignInForm({ redirectedFrom }: SignInFormProps) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            const supabase = getSupabaseBrowserClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                setError(signInError.message);
                setIsLoading(false);
                return;
            }

            // Force session refresh to ensure auth state is immediately available
            await supabase.auth.getSession();

            // Refresh the router to update auth state across all components
            router.refresh();

            // Redirect to intended destination or dashboard
            const destination = redirectedFrom || '/guest/dashboard';
            router.push(destination);
        } catch (err) {
            console.error('[SignInForm] Unexpected error:', err);
            setError('An unexpected error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full space-y-6">
            {/* Email Field */}
            <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2 text-sm font-semibold">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Email</span>
                </Label>
                <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="h-12 text-base"
                    disabled={isLoading}
                />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-2 text-sm font-semibold">
                    <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Password</span>
                </Label>
                <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="h-12 text-base"
                    disabled={isLoading}
                />
            </div>

            {/* Error Message */}
            {error ? (
                <div
                    className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive animate-fade-in"
                    role="alert"
                >
                    {error}
                </div>
            ) : null}

            {/* Submit Button */}
            <Button
                type="submit"
                className="h-12 w-full text-base font-semibold"
                disabled={isLoading || !email || !password}
            >
                {isLoading ? (
                    <>
                        <div
                            className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                            aria-hidden="true"
                        />
                        Signing in...
                    </>
                ) : (
                    'Sign in'
                )}
            </Button>

            {/* Additional Links */}
            <div className="space-y-3 text-center text-sm">
                <p className="text-muted-foreground">
                    <Link
                        href="/auth/forgot-password"
                        className="font-medium text-primary hover:underline"
                    >
                        Forgot your password?
                    </Link>
                </p>
            </div>
        </form>
    );
}
