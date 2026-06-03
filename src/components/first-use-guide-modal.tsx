"use client";

import { useEffect, useState } from "react";

const storageKey = "ai-novel-workbench-first-use-guide-v1";
const countdownSeconds = 12;

type FirstUseGuideModalProps = {
  penName?: string;
  assistantName?: string;
};

export function FirstUseGuideModal({ penName, assistantName = "墨澜" }: FirstUseGuideModalProps) {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (!penName) {
      return;
    }

    try {
      setVisible(window.localStorage.getItem(storageKey) !== "read");
    } catch {
      setVisible(true);
    }
  }, [penName]);

  useEffect(() => {
    if (!visible || secondsLeft <= 0) {
      return;
    }

    const timer = window.setTimeout(() => setSecondsLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  function acknowledge() {
    if (secondsLeft > 0) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, "read");
    } catch {
      // localStorage may be unavailable in rare embedded contexts; closing should still work.
    }

    setVisible(false);
  }

  if (!visible || !penName) {
    return null;
  }

  return (
    <div className="first-use-guide-backdrop" role="presentation">
      <section
        className="first-use-guide-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="first-use-guide-title"
      >
        <div className="first-use-guide-hero">
          <span className="first-use-guide-kicker">第一次使用前，请先读完这段说明</span>
          <h2 id="first-use-guide-title">欢迎来到墨澜，{penName}</h2>
          <p>
            {assistantName} 不是“一句话写完整本书”的按钮，而是帮你把一本长篇小说拆成可管理、可检查、可持续推进的创作项目。
          </p>
        </div>

        <div className="first-use-guide-grid" aria-label="核心说明">
          <article>
            <span>01</span>
            <strong>为什么看起来更复杂</strong>
            <p>
              长篇质量靠设计和限制：先定作品方向与规则，再用任务卡控制每章目标，用正文生成完成初稿，用章节台账沉淀长期记忆，用一致性审稿检查跑偏，最后用二稿编辑打磨表达。
            </p>
          </article>
          <article>
            <span>02</span>
            <strong>我们不内置 AI</strong>
            <p>
              你需要在“设置 → AI 设置”里配置自己的服务商 Key。不同厂家的模型效果、速度和价格差异很大，所以我们把选择权和成本控制交给你。
            </p>
          </article>
          <article>
            <span>03</span>
            <strong>数据默认保存在本地</strong>
            <p>
              作品、草稿、设定、人物档案、章节台账和项目状态默认留在你的电脑里。换电脑、重装系统或清理数据前，请先到“账号与数据”导出备份。
            </p>
          </article>
        </div>

        <div className="first-use-guide-path">
          <strong>建议你这样开始</strong>
          <ol>
            <li>先去“设置 → AI 设置”完成模型配置并测试连接。</li>
            <li>打开“使用手册”，快速看一遍创建作品、任务卡、正文、台账、审稿这条主流程。</li>
            <li>从创建第一本书开始，不用一次学完全部功能，先跑通第一章闭环。</li>
          </ol>
        </div>

        <div className="first-use-guide-actions">
          {/* <a className="button" href="/manual" target="_blank" rel="noreferrer">
            先看使用手册
          </a>
          <a className="button" href="/settings/ai">
            去配置 AI
          </a> */}
          <button className="button primary" type="button" onClick={acknowledge} disabled={secondsLeft > 0}>
            {secondsLeft > 0 ? `请先阅读 ${secondsLeft}s` : "我已了解，进入工作台"}
          </button>
        </div>

        <p className="first-use-guide-blessing">
          愿你每一次开新书，都不是被空白页推着走，而是带着清楚的目标、节奏和判断力往前写。
        </p>
      </section>
    </div>
  );
}
