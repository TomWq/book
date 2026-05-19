import { getCurrentUser, loginUser } from "@/lib/projects";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const user = await loginUser({
      email: String(body.email ?? ""),
      password: String(body.password ?? "")
    });

    return Response.json({ user });
  } catch (error) {
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
