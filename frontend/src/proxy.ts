import { NextResponse, type NextRequest } from "next/server";

// Runs before every page request. No session cookie → go to the login page.
// This is only a fast first check: the API still verifies the cookie on every
// call, and an expired one sends the user back here via a 401.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("crms_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except the signed-out pages (login, forgot/reset password), API calls, Next internals and static files.
  matcher: ["/((?!login|forgot-password|reset-password|api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico)$).*)"],
};
