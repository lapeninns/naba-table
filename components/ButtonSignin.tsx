/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import config from "@/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

// A simple button to sign in with our providers (Google & Magic Links).
// It automatically redirects user to callbackUrl (config.auth.callbackUrl) after login, which is normally a private page for users to manage their accounts.
// If the user is already logged in, it will show their profile picture & redirect them to callbackUrl immediately.
const ButtonSignin = ({
  text = "Get started",
  extraStyle,
}: {
  text?: string;
  extraStyle?: string;
}) => {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();

      setUser(data.user);
    };

    getUser();
  }, [supabase]);

  if (user) {
    return (
      <Button asChild className={cn(extraStyle)}>
        <Link href={config.auth.callbackUrl} className="flex items-center gap-2">
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user?.user_metadata?.avatar_url}
              alt={user?.user_metadata?.name || "Account"}
              className="h-6 w-6 shrink-0 rounded-full"
              referrerPolicy="no-referrer"
              width={24}
              height={24}
            />
          ) : (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
              {user?.user_metadata?.name?.charAt(0) || user?.email?.charAt(0)}
            </span>
          )}
          {user?.user_metadata?.name || user?.email || "Account"}
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild className={cn(extraStyle)}>
      <Link href={config.auth.loginUrl}>{text}</Link>
    </Button>
  );
};

export default ButtonSignin;
