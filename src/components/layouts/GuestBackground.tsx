/**
 * Shared premium gradient background for all guest-facing layouts.
 * Ensures visual consistency across marketing, auth, and guest portal pages.
 */
export function GuestBackground() {
    return (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
            {/* Top-left gradient orb */}
            <div
                className="absolute -left-[15%] -top-[10%] h-[500px] w-[500px] rounded-full opacity-40"
                style={{
                    background: 'radial-gradient(circle, hsl(217 91% 60% / 0.15) 0%, transparent 70%)',
                }}
            />
            {/* Top-right accent orb */}
            <div
                className="absolute -right-[10%] top-[5%] h-[400px] w-[400px] rounded-full opacity-30"
                style={{
                    background: 'radial-gradient(circle, hsl(38 92% 50% / 0.12) 0%, transparent 70%)',
                }}
            />
            {/* Bottom gradient */}
            <div
                className="absolute -bottom-[20%] left-[20%] h-[600px] w-[600px] rounded-full opacity-25"
                style={{
                    background: 'radial-gradient(circle, hsl(217 91% 60% / 0.12) 0%, transparent 70%)',
                }}
            />
            {/* Subtle grid pattern */}
            <div
                className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
            />
        </div>
    );
}
