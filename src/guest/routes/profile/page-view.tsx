import { HydrationBoundary } from "@tanstack/react-query";
import { Settings, Shield, User } from "lucide-react";

import { ProfileManageForm } from "@/components/profile/ProfileManageForm";
import { GuestServicesProvider } from "@/guest/services/di";

import type { GuestProfileViewModel } from "./view-model";

export function GuestProfilePageView({ viewModel }: { viewModel: GuestProfileViewModel }) {
  return (
    <GuestServicesProvider>
      <HydrationBoundary state={viewModel.dehydratedState}>
        <div className="min-h-screen pb-20 guest-sections">
          {/* Page Header */}
          <header className="mb-8 animate-fade-up">
            <div className="flex items-center gap-4 mb-4">
              <div className="guest-icon-box-lg bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Your Profile</h1>
                <p className="text-sm text-slate-500 sm:text-base">Manage your personal information and preferences</p>
              </div>
            </div>
          </header>

          {/* Stats Cards */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up guest-stagger" style={{ animationDelay: "50ms" }}>
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="guest-icon-box bg-blue-50 text-blue-600">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Account Status</p>
                  <p className="text-base font-semibold text-slate-900">Active</p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="guest-icon-box bg-emerald-50 text-emerald-600">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Email Verified</p>
                  <p className="text-base font-semibold text-slate-900">Yes</p>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Form */}
          <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
            <ProfileManageForm initialProfile={viewModel.profile} />
          </div>
        </div>
      </HydrationBoundary>
    </GuestServicesProvider>
  );
}

