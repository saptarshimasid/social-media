import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Allow API and static assets/routes without interference early on
  const isApiOrStatic =
    request.nextUrl.pathname.startsWith("/api") ||
    request.nextUrl.pathname.includes(".") ||
    request.nextUrl.pathname.startsWith("/_next");

  if (isApiOrStatic) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Re-create the Supabase client passing request cookies
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
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Safely refresh token session
  let user = null;
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch (error) {
    console.error("Supabase auth error in proxy.ts:", error);
  }

  const isAuthPage = request.nextUrl.pathname.startsWith("/login");
  const isOnboardingPage = request.nextUrl.pathname.startsWith("/onboarding");

  // Case 1: Unauthenticated
  if (!user) {
    if (!isAuthPage) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return response;
  }

  // Case 2: Authenticated
  if (isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Fetch user profile status from DB
  let profile = null;
  try {
    const { data: fetchedProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    profile = fetchedProfile;
  } catch (error) {
    console.error("Supabase profile fetch error in proxy.ts:", error);
  }

  if (!profile) {
    // Authenticated but no profile in DB -> redirect to onboarding page
    if (!isOnboardingPage) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
  } else {
    // Authenticated and profile exists -> block onboarding page access
    if (isOnboardingPage) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all routing paths except images, favicon, assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
