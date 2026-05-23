'use client';

import { LogOut, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { useOpsUnsavedChanges } from '@/contexts/ops-unsaved-changes';
import { signOutFromSupabase } from '@/lib/supabase/signOut';

import { OPS_SUPPORT_ITEM } from './navigation';

export function OpsSidebarFooter() {
  return (
    <>
      <OpsAccountActions />
      <SidebarSeparator />
      <OpsSupportLink />
    </>
  );
}

function OpsAccountActions() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { confirmNavigation } = useOpsUnsavedChanges();

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return;
    if (
      !confirmNavigation('You have unsaved changes in this workspace. Log out and discard them?')
    ) {
      return;
    }
    try {
      setIsSigningOut(true);
      await signOutFromSupabase();
      window.location.href = '/auth/signin';
    } catch (error) {
      console.error('[ops-sidebar] sign out failed', error);
      setIsSigningOut(false);
    }
  }, [confirmNavigation, isSigningOut]);

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>Account</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              type="button"
              tooltip="Sign out of operations"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <LogOut className="size-4" aria-hidden />
              )}
              <span className="truncate">{isSigningOut ? 'Signing out…' : 'Log out'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function OpsSupportLink() {
  const SupportIcon = OPS_SUPPORT_ITEM.icon;

  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel>Need help?</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Contact Nab a Table support">
              <a href={OPS_SUPPORT_ITEM.href}>
                <SupportIcon aria-hidden />
                <span className="truncate">{OPS_SUPPORT_ITEM.title}</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
