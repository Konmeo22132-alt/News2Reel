"use client";

import { useState, useTransition } from "react";
import {
  Cpu,
  Megaphone,
  Target,
  Save,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { updateConfig, type ConfigFormData } from "@/app/actions/config";

// Inline type mirroring Prisma AppConfig model (avoids @prisma/client export mismatch)
type AppConfig = {
  id: number;
  aiProvider: string;
  aiApiKey: string | null;
  aiModel: string | null;
  videoQuality: string;
  dailyVideoLimit: number;
  newsSources: string;
  channelGoal: string;
  tiktokApiKey: string | null;
  tiktokApiSecret: string | null;
  autoPostEnabled: boolean;
  customPrompt: string | null;
  updatedAt: Date;
};

type ToastState = { msg: string; ok: boolean } | null;

function Toast({ state, onClose }: { state: ToastState; onClose: () => void }) {
  if (!state) return null;
  return (
    <div
      className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-xl fade-up"
      style={{
        background: state.ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
        border: `1px solid ${state.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
        backdropFilter: "blur(8px)",
      }}
    >
      {state.ok ? (
        <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
      )}
      <span
        className="text-sm font-medium"
        style={{ color: state.ok ? "#10b981" : "#ef4444" }}
      >
        {state.msg}
      </span>
      <button
        onClick={onClose}
        className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: state.ok ? "#10b981" : "#ef4444" }}
      >
        ✕
      </button>
    </div>
  );
}

type Tab = "ai" | "tiktok" | "strategy";

const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
  { id: "ai", label: "AI & Kết xuất", Icon: Cpu },
  { id: "tiktok", label: "TikTok Auto-Post", Icon: Megaphone },
  { id: "strategy", label: "Chiến lược Kênh", Icon: Target },
];

export default function SettingsForm({ config }: { config: AppConfig }) {
  const [tab, setTab] = useState<Tab>("ai");
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<ToastState>(null);

  // Show-password toggles
  const [showDk, setShowDk] = useState(false);
  const [showTts, setShowTts] = useState(false);

  // Form state
  const [aiProvider, setAiProvider] = useState(config.aiProvider ?? "beeknoee");
  const [aiApiKey, setAiApiKey]     = useState(config.aiApiKey ?? config.ClaudeApiKey ?? "");
  const [aiModel, setAiModel]       = useState(config.aiModel ?? "");
  const [ClaudeApiKey, setClaudeApiKey] = useState(config.ClaudeApiKey ?? "");
  const [videoQuality, setVideoQuality] = useState(config.videoQuality);
  const [dailyVideoLimit, setDailyVideoLimit] = useState(String(config.dailyVideoLimit));
  const [newsSources, setNewsSources] = useState(() => {
    try {
      const arr = JSON.parse(config.newsSources);
      return Array.isArray(arr) ? arr.join("\n") : config.newsSources;
    } catch {
      return "";
    }
  });
  const [autoPostEnabled, setAutoPostEnabled] = useState(config.autoPostEnabled);
  const [tiktokApiKey, setTiktokApiKey] = useState(config.tiktokApiKey ?? "");
  const [tiktokApiSecret, setTiktokApiSecret] = useState(config.tiktokApiSecret ?? "");
  const [channelGoal, setChannelGoal] = useState(config.channelGoal);
  const [customPrompt, setCustomPrompt] = useState(config.customPrompt ?? "");

  const notify = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const save = () => {
    startTransition(async () => {
      const sources = newsSources
        .split("\n")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const data: ConfigFormData = {
        aiProvider,
        aiApiKey: aiApiKey || undefined,
        aiModel: aiModel || undefined,
        ClaudeApiKey: aiApiKey || undefined, // keep legacy in sync
        videoQuality,
        dailyVideoLimit: parseInt(dailyVideoLimit, 10) || 10,
        newsSources: JSON.stringify(sources),
        channelGoal,
        tiktokApiKey: tiktokApiKey || undefined,
        tiktokApiSecret: tiktokApiSecret || undefined,
        autoPostEnabled,
        customPrompt: customPrompt || undefined,
      };

      const result = await updateConfig(data);
      notify(result.message, result.success);
    });
  };

  const labelStyle = {
    display: "block" as const,
    fontSize: 12,
    fontWeight: 500,
    marginBottom: 6,
    color: "var(--text-secondary)",
  };

  return (
    <div>
      {/* Tabs */}
      <div
        className="flex rounded-lg mb-6 p-0.5"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-all duration-150"
            style={{
              background:
                tab === id
                  ? "rgba(99,102,241,0.15)"
                  : "transparent",
              color: tab === id ? "#a5b4fc" : "var(--text-secondary)",
              border: tab === id ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
            }}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab: AI & Rendering */}
      {tab === "ai" && (
        <div className="card p-5 space-y-5 fade-up">

          {/* Provider selector */}
          <div>
            <label style={labelStyle}>Nhà cung cấp AI</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { v: "beeknoee", name: "Beeknoee",  badge: "VN",   color: "#818cf8", desc: "platform.beeknoee.com" },
                { v: "groq",     name: "Groq",       badge: "Free", color: "#f59e0b", desc: "api.groq.com — Nhanh hơn" },
              ] as const).map(({ v, name, badge, color, desc }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setAiProvider(v);
                    // Reset model to provider default if user hasn't customized
                    if (!aiModel) setAiModel("");
                  }}
                  className="p-3.5 rounded-lg text-left transition-all"
                  style={{
                    background: aiProvider === v ? "rgba(99,102,241,0.12)" : "var(--surface-3)",
                    border: aiProvider === v ? "1px solid rgba(99,102,241,0.35)" : "1px solid var(--border)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold" style={{ color: aiProvider === v ? "#c7d2fe" : "var(--text-secondary)" }}>
                      {name}
                    </p>
                    <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: `${color}22`, color }}>
                      {badge}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label style={labelStyle}>
              {aiProvider === "groq" ? "Groq API Key" : "Beeknoee API Key"}
            </label>
            <div className="relative">
              <input
                type={showDk ? "text" : "password"}
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
                placeholder={aiProvider === "groq" ? "gsk_..." : "sk-bee-..."}
                className="input pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowDk(!showDk)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              >
                {showDk ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {aiApiKey && (
              <p className="text-xs mt-1.5" style={{ color: "#10b981" }}>
                ● API Key đã cấu hình
              </p>
            )}
            {aiProvider === "groq" && !aiApiKey && (
              <p className="text-xs mt-1.5" style={{ color: "#f59e0b" }}>
                Lấy API key miễn phí tại{" "}
                <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ color: "#818cf8" }}>
                  console.groq.com
                </a>
              </p>
            )}
          </div>

          {/* Model name */}
          <div>
            <label style={labelStyle}>Model Name (để trống = dùng mặc định)</label>
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder={aiProvider === "groq" ? "llama-3.3-70b-versatile" : "openai/gpt-oss-120b"}
              className="input font-mono text-sm"
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {aiProvider === "groq"
                ? "Groq models: llama-3.3-70b-versatile, llama-3.1-8b-instant, mixtral-8x7b-32768"
                : "Beeknoee models: openai/gpt-oss-120b, anthropic/claude-3-haiku"}
            </p>
          </div>

          <div>
            <label style={labelStyle}>Chất lượng kết xuất video</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "720p", label: "720p — Nhanh", sub: "Phù hợp tạo hàng loạt" },
                { v: "1080p", label: "1080p — Cao cấp", sub: "Chất lượng tốt hơn" },
              ].map(({ v, label, sub }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVideoQuality(v)}
                  className="p-3.5 rounded-lg text-left transition-all"
                  style={{
                    background:
                      videoQuality === v ? "rgba(99,102,241,0.12)" : "var(--surface-3)",
                    border:
                      videoQuality === v
                        ? "1px solid rgba(99,102,241,0.35)"
                        : "1px solid var(--border)",
                  }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{ color: videoQuality === v ? "#c7d2fe" : "var(--text-secondary)" }}
                  >
                    {label}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {sub}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Giới hạn video mỗi ngày</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={dailyVideoLimit}
                onChange={(e) => setDailyVideoLimit(e.target.value)}
                min={1}
                max={100}
                className="input w-24 text-center font-semibold"
              />
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                video / ngày (tối đa 100)
              </span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Nguồn tin tức (News Sources)</label>
            <textarea
              value={newsSources}
              onChange={(e) => setNewsSources(e.target.value)}
              rows={5}
              className="input resize-none font-mono text-sm"
              placeholder={"https://vnexpress.net/kinh-doanh\nhttps://tuoitre.vn/the-gioi"}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {newsSources.split("\n").filter(Boolean).length} nguồn — Mỗi URL trên một dòng
            </p>
          </div>
        </div>
      )}

      {/* Tab: TikTok */}
      {tab === "tiktok" && (
        <div className="card p-5 space-y-5 fade-up">
          <div>
            <label style={labelStyle}>Tự động đăng bài</label>
            <button
              type="button"
              onClick={() => setAutoPostEnabled(!autoPostEnabled)}
              className="w-full flex items-center gap-3 p-4 rounded-lg transition-all"
              style={{
                background: autoPostEnabled ? "rgba(16,185,129,0.08)" : "var(--surface-3)",
                border: `1px solid ${
                  autoPostEnabled ? "rgba(16,185,129,0.2)" : "var(--border)"
                }`,
              }}
            >
              {/* Custom toggle */}
              <div
                className="relative flex-shrink-0 w-10 h-6 rounded-full transition-colors"
                style={{
                  background: autoPostEnabled ? "#10b981" : "var(--surface-3)",
                  border: "1px solid " + (autoPostEnabled ? "#10b981" : "var(--border)"),
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 rounded-full transition-transform"
                  style={{
                    background: "#fff",
                    transform: autoPostEnabled ? "translateX(17px)" : "translateX(1px)",
                  }}
                />
              </div>
              <div className="text-left">
                <p
                  className="text-sm font-medium"
                  style={{ color: autoPostEnabled ? "#10b981" : "var(--text-secondary)" }}
                >
                  {autoPostEnabled ? "Đang bật — Tự động đăng sau khi render" : "Đang tắt"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                  Nhấn để {autoPostEnabled ? "tắt" : "bật"} auto-publishing
                </p>
              </div>
            </button>
          </div>

          <div>
            <label style={labelStyle}>TikTok Developer App Key</label>
            <input
              type="text"
              value={tiktokApiKey}
              onChange={(e) => setTiktokApiKey(e.target.value)}
              placeholder="aw1234567890abcdef"
              className="input font-mono text-sm"
              disabled={!autoPostEnabled}
            />
          </div>

          <div>
            <label style={labelStyle}>TikTok Developer App Secret</label>
            <div className="relative">
              <input
                type={showTts ? "text" : "password"}
                value={tiktokApiSecret}
                onChange={(e) => setTiktokApiSecret(e.target.value)}
                placeholder="••••••••••••••••"
                className="input pr-10 font-mono text-sm"
                disabled={!autoPostEnabled}
              />
              <button
                type="button"
                onClick={() => setShowTts(!showTts)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
                disabled={!autoPostEnabled}
              >
                {showTts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div
            className="p-3.5 rounded-lg text-sm"
            style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              color: "var(--text-secondary)",
            }}
          >
            <p className="font-medium text-yellow-400 mb-1">⚠ Lưu ý</p>
            Tính năng auto-post yêu cầu tài khoản TikTok Developer đã được duyệt quyền.
            Truy cập{" "}
            <a
              href="https://developers.tiktok.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#818cf8" }}
            >
              developers.tiktok.com
            </a>{" "}
            để đăng ký.
          </div>
        </div>
      )}

      {/* Tab: Channel Strategy */}
      {tab === "strategy" && (
        <div className="card p-5 space-y-5 fade-up">
          <div>
            <label style={labelStyle}>Mục tiêu kênh</label>
            <div className="space-y-2">
              {[
                {
                  v: "ads",
                  emoji: "📺",
                  title: "Kiếm tiền Quảng cáo (Ads)",
                  desc: "AI tối ưu retention rate và shock value để tăng watch time",
                },
                {
                  v: "affiliate",
                  emoji: "🛒",
                  title: "Bán hàng / Affiliate Marketing",
                  desc: "AI nổi bật tính năng sản phẩm và tích hợp Call-to-Action rõ ràng",
                },
                {
                  v: "branding",
                  emoji: "🏆",
                  title: "Xây dựng Thương hiệu Cá nhân",
                  desc: "AI sử dụng giọng điệu chuyên nghiệp, xây dựng uy tín",
                },
              ].map(({ v, emoji, title, desc }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setChannelGoal(v)}
                  className="w-full p-4 rounded-lg text-left flex items-start gap-3 transition-all"
                  style={{
                    background:
                      channelGoal === v ? "rgba(99,102,241,0.12)" : "var(--surface-3)",
                    border:
                      channelGoal === v
                        ? "1px solid rgba(99,102,241,0.35)"
                        : "1px solid var(--border)",
                  }}
                >
                  <span className="text-xl flex-shrink-0">{emoji}</span>
                  <div>
                    <p
                      className="text-sm font-medium"
                      style={{ color: channelGoal === v ? "#c7d2fe" : "var(--text-secondary)" }}
                    >
                      {title}
                      {channelGoal === v && (
                        <CheckCircle className="w-4 h-4 inline ml-2 text-indigo-400" />
                      )}
                    </p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Prompt tùy chỉnh</label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={4}
              className="input resize-none text-sm"
              placeholder={"Luôn kết thúc video bằng: 'Theo dõi kênh để không bỏ lỡ nội dung mới nhất'"}
            />
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              {customPrompt.length} / 1000 ký tự
            </p>
          </div>
        </div>
      )}

      {/* Save row */}
      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="btn btn-primary"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {isPending ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
      </div>

      <Toast state={toast} onClose={() => setToast(null)} />
    </div>
  );
}
