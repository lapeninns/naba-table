import { OpsPageHeader } from '@/components/features/ops-shell/patterns/OpsPageHeader';

import { RestaurantSettingsSubnav } from './RestaurantSettingsSubnav';

import type { ReactNode } from 'react';


export function RestaurantSettingsPageShell({
  title,
  description,
  eyebrow = 'Settings',
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[80vw] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <OpsPageHeader
        eyebrow={eyebrow}
        title={title}
        subtitle={description}
        headingLevel="h1"
        titleClassName="text-3xl"
      />

      <RestaurantSettingsSubnav />

      <div className="pb-8">{children}</div>
    </main>
  );
}
