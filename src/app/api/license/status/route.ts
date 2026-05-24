import { getSubscriptionActivationStatus } from "@/lib/desktop-license-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getSubscriptionActivationStatus();
  return Response.json(status);
}
