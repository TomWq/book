import { Panel } from "@/components/panel";

export default function LegalPage() {
  return (
    <div className="grid two-col">
      <Panel title="隐私与数据" description="国内推广前必须明确用户数据如何保存、使用和删除。">
        <div className="list">
          <div className="section-card">
            <strong>文本归属</strong>
            <div className="muted">用户上传的原文、章节、分析结果和项目状态只属于对应账号，不会在账号间共享。</div>
          </div>
          <div className="section-card">
            <strong>模型配置</strong>
            <div className="muted">AI 请求地址、Key 和模型名保存在服务端，只在当前用户账号范围内可见和使用。</div>
          </div>
          <div className="section-card">
            <strong>数据使用</strong>
            <div className="muted">产品用于拆书、分析、创作管理和二稿编辑，不会把你的正文直接暴露到前端。</div>
          </div>
        </div>
      </Panel>

      <Panel title="版权边界" description="只做结构学习和模板迁移，不做洗稿和照搬。">
        <div className="list">
          <div className="section-card">
            <strong>允许</strong>
            <div className="muted">分析公开或合法拥有的文本，提取通用结构、节奏和爽点公式。</div>
          </div>
          <div className="section-card">
            <strong>不允许</strong>
            <div className="muted">复刻原文句子、角色名称、专有设定、章节顺序和可被视为洗稿的输出。</div>
          </div>
          <div className="quote-box">
            这个产品的目标是复用商业结构，不复制原作内容。
          </div>
        </div>
      </Panel>

      <Panel title="后续能力" description="这些会在正式上线前继续补齐。">
        <div className="list">
          <div className="section-card">账号数据导出：已提供基础 JSON 导出。</div>
          <div className="section-card">套餐与额度说明</div>
          <div className="section-card">第一次使用的新手引导</div>
        </div>
      </Panel>

      <Panel title="使用原则" description="帮助用户理解产品边界。">
        <div className="list">
          <div className="section-card">你负责最终判断和取舍，AI 负责拆解、整理和辅助生成。</div>
          <div className="section-card">如果要做推广版，还需要补充隐私政策、版权声明和服务条款。</div>
          <div className="section-card">当前页面是产品说明，不是法律意见。</div>
        </div>
      </Panel>
    </div>
  );
}
