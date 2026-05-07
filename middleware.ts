import { NextRequest, NextResponse } from "next/server";

const requestHistory = new Map<string, number[]>();
const WINDOW_MS = 60_000;

/** API 普通读写 */
const API_LIMIT = 60;
/** AI 生成接口（消耗配额） */
const AI_LIMIT = 10;
/** 分享页面访问 */
const SHARE_LIMIT = 60;

function getKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

function checkLimit(key: string, limit: number): boolean {
  const now = Date.now();
  const history = (requestHistory.get(key) ?? []).filter(
    (t) => now - t < WINDOW_MS
  );
  if (history.length >= limit) return false;
  history.push(now);
  requestHistory.set(key, history);
  return true;
}

// 定期清理过期 key
let lastCleanup = 0;
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60_000) return;
  lastCleanup = now;
  for (const [key, times] of requestHistory) {
    const fresh = times.filter((t) => now - t < WINDOW_MS);
    if (fresh.length === 0) requestHistory.delete(key);
    else requestHistory.set(key, fresh);
  }
}

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  maybeCleanup();

  // 分享页面
  if (path.startsWith("/share/")) {
    const key = getKey(request);
    if (!checkLimit(key, SHARE_LIMIT)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
    return NextResponse.next();
  }

  // API 路由
  if (path.startsWith("/api/")) {
    const key = getKey(request);
    const isAiEndpoint =
      path.includes("/generate") || path.includes("/iterate") || path.includes("/generate-title");
    const limit = isAiEndpoint ? AI_LIMIT : API_LIMIT;
    if (!checkLimit(key, limit)) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/share/:path*", "/api/:path*"],
};
