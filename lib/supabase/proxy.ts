import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Refreshes the Supabase auth session on every request and guards routes.
 * Runs inside `proxy.ts` (the Next.js 16 rename of Middleware).
 *
 * IMPORTANT: always return the `supabaseResponse` object as-is so the
 * refreshed auth cookies are persisted on the browser.
 */
export async function updateSession(request: NextRequest) {
  // Before Supabase is configured, let every request through so the app can
  // render its setup instructions instead of crashing.
  if (!isSupabaseConfigured) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser() — it can cause
  // hard-to-debug session bugs.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // Route handlers carry their own authentication (the cron job presents a
  // secret, not a session cookie). Redirecting them to /login would turn every
  // scheduled run into a 307 that never reaches the handler.
  const isApiRoute = pathname.startsWith("/api/");

  // Unauthenticated users trying to reach the app -> send to /login.
  if (!user && !isAuthRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated users hitting /login -> send to the dashboard.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
