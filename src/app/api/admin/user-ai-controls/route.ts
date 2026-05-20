export const runtime = "nodejs";

export async function POST() {
  return Response.json(
    { error: "平台模型档位和积分策略已经下线，当前版本由客户端用户自行配置 AI 服务。" },
    { status: 410 }
  );
}
