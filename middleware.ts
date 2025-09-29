import { getMiddlewareSupabaseClient } from "@/server/supabase";
import { NextResponse, type NextRequest } from "next/server";

// The middleware is used to refresh the user's session before loading Server Component routes
export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = getMiddlewareSupabaseClient(req, res);
  await supabase.auth.getSession();
  return res;
}
