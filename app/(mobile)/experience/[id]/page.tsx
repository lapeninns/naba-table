"use client";
import { useState } from "react";
import Image from "next/image";
import PrimaryButton from "@/components/mobile/PrimaryButton";

export default function ExperienceDetails(_props: any) {
  const [open, setOpen] = useState(false);
  return (
    <main className="screen-transition">
      <div className="relative">
        <Image src="/images/sample-1.jpg" alt="Experience hero" width={1200} height={900} className="w-full object-cover aspect-[4/3]" />
      </div>
      <section className="mx-auto max-w-[393px] px-[var(--screen-margin)] py-4">
        <h1 className="text-screen-title">Cozy apartment in Paris</h1>
        <p className="mt-2 text-label">Paris, France • 2 guests • 1 bedroom</p>
        <p className="mt-4 text-body">
          Enjoy a stylish experience at this centrally-located place. Close to cafes, museums, and public transport.
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-[83px] z-40 mx-auto max-w-[393px] px-[var(--screen-margin)] pb-3">
        <PrimaryButton aria-label="Reserve" onClick={() => setOpen(true)} className="w-full">
          Reserve
        </PrimaryButton>
      </div>

      {open && (
        <div role="dialog" aria-modal className="modal-enter">
          <div className="modal-overlay" onClick={() => setOpen(false)} />
          <div className="modal-content p-4 shadow-modal">
            <div className="mx-auto max-w-[393px]">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-300/80" aria-hidden />
              <h2 className="mt-4 text-section-header">Confirm your trip</h2>
              <p className="mt-2 text-body">Dates, guests, and price breakdown appear here.</p>
              <div className="mt-4 grid gap-3">
                <PrimaryButton className="w-full" onClick={() => alert("Reserved!")}>Pay now</PrimaryButton>
                <button className="w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-3 text-button" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <div className="h-6" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
