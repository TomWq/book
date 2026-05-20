export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    { error: "积分计费已经下线，当前版本只支持一次性授权和用户自带 AI Key。" },
    { status: 410 }
  );
}
