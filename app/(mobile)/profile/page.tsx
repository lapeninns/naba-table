import Image from "next/image";
import PrimaryButton from "@/components/mobile/PrimaryButton";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-[393px] px-[var(--screen-margin)] py-4">
      <h1 className="text-screen-title">Profile</h1>
      <div className="mt-4 flex items-center gap-3">
        <Image src="/images/avatar.jpg" alt="Your avatar" width={40} height={40} className="avatar" />
        <div>
          <p className="text-card-title">Guest User</p>
          <p className="text-label">Verified traveler</p>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        <button className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left focus-visible">
          <span className="text-body">Account</span>
          <span aria-hidden className="text-label">›</span>
        </button>
        <button className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left focus-visible">
          <span className="text-body">Payments</span>
          <span aria-hidden className="text-label">›</span>
        </button>
      </div>
      <div className="mt-6">
        <PrimaryButton className="w-full">Edit profile</PrimaryButton>
      </div>
    </main>
  );
}

