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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        ) : null}
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <RestaurantSettingsSubnav />

      <div className="pb-8">{children}</div>
    </div>
  );
}
