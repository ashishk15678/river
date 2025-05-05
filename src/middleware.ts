import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { NextRequestWithAuth } from "next-auth/middleware";

export default async function middleware(req: NextRequestWithAuth) {
  const token = await getToken({ req });
  const isAuth = !!token;
  const isAuthPage =
    req.nextUrl.pathname.startsWith("/signin") ||
    req.nextUrl.pathname.startsWith("/signup");
  const isStudioPage = req.nextUrl.pathname.startsWith("/studio");
  const isSetupUsernamePage =
    req.nextUrl.pathname.startsWith("/setup-username");

  // Allow access to studio page without authentication
  // if (isStudioPage) {
  //   return NextResponse.next();
  // }

  // Redirect authenticated users away from auth pages
  // if (isAuthPage) {
  //   if (isAuth) {
  //     // If user hasn't set username, redirect to setup
  //     if (!token.hasSetUsername) {
  //       return NextResponse.redirect(new URL("/setup-username", req.url));
  //     }
  //     return NextResponse.redirect(new URL("/dash", req.url));
  //   }
  //   return NextResponse.next();
  // }

  // Redirect unauthenticated users to sign in
  // if (!isAuth) {
  //   let from = req.nextUrl.pathname;
  //   if (req.nextUrl.search) {
  //     from += req.nextUrl.search;
  //   }

  //   return NextResponse.redirect(
  //     new URL(`/auth/signin?from=${encodeURIComponent(from)}`, req.url)
  //   );
  // }

  // If user hasn't set username and isn't on setup page, redirect to setup
  // if (!token.hasSetUsername && !isSetupUsernamePage) {
  //   return NextResponse.redirect(new URL("/setup-username", req.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dash/:path*",
    // "/studio/:path*",
    "/auth/signin",
    "/auth/signup",
    "/auth/setup-username",
  ],
};
