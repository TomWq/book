import { accessPolicyToResult, getAccessPolicyFromStore } from "@/lib/license-service";
import { readStore } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readStore();
  const accessPolicy = accessPolicyToResult(getAccessPolicyFromStore(store));

  return Response.json({ accessPolicy });
}
