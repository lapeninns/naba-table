export const ONBOARDING_STEPS = [
  { id: 1, label: "Account" },
  { id: 2, label: "Profile" },
  { id: 3, label: "Hours" },
  { id: 4, label: "Services" },
  { id: 5, label: "Zones & Tables" },
  { id: 6, label: "Review & Launch" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
