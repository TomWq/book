import { getCurrentUser, loginUser } from "@/lib/projects";
import { readRequestBody } from "@/lib/request-body";
import { getAdminLoginPath } from "@/lib/admin-login-path";

export const runtime = "nodejs";

function isBrowserFormPost(request: Request) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const accept = request.headers.get("accept")?.toLowerCase() ?? "";
  const fetchMode = request.headers.get("sec-fetch-mode")?.toLowerCase() ?? "";

  return contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data") ||
    fetchMode === "navigate" ||
    accept.includes("text/html");
}

function safeNextPath(value: unknown) {
  const path = String(value ?? "").trim();

  return path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

export async function POST(request: Request) {
  const body = await readRequestBody(request);
  const formPost = isBrowserFormPost(request);

  try {
    const user = await loginUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? "")
    });

    if (formPost) {
      const nextPath = user.role === "admin" ? "/admin" : safeNextPath(body.next);

      return Response.redirect(new URL(nextPath, request.url), 303);
    }

    return Response.json({ user });
  } catch (error) {
    if (formPost) {
      const url = new URL(getAdminLoginPath(), request.url);
      const message = error instanceof Error ? error.message : "登录失败";

      url.searchParams.set("error", message);
      return Response.redirect(url, 303);
    }

    return Response.json(
      { error: error instanceof Error ? error.message : "登录失败" },
      { status: 400 }
    );
  }
}

export async function GET() {
  const user = await getCurrentUser();
  return Response.json({ user });
}
