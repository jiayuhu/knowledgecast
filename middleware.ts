import { NextRequest, NextResponse } from "next/server";
import { shouldAllowRequest } from "@/server/rate-limit";

const requestHistory = new Map<string, number[]>();
const REQUEST_LIMIT = 60;
const REQUEST_WINDOW_MS = 60_000;

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/share/")) {
    return NextResponse.next();
  }

  const key = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown";
  const now = Date.now();
  const history = (requestHistory.get(key) ?? []).filter(
    (timestamp) => now - timestamp < REQUEST_WINDOW_MS
  );

  const result = shouldAllowRequest({
    key,
    now,
    history,
    limit: REQUEST_LIMIT
  });

  if (!result.allowed) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  history.push(now);
  requestHistory.set(key, history);
  return NextResponse.next();
}

export const config = {
  matcher: ["/share/:path*"]
};
