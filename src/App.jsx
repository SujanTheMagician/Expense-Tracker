import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Chart, ArcElement, Tooltip, Legend, DoughnutController,
  BarController, BarElement, CategoryScale, LinearScale,
} from "chart.js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";
Chart.register(ArcElement, Tooltip, Legend, DoughnutController, BarController, BarElement, CategoryScale, LinearScale);

const IS_NATIVE = Capacitor.isNativePlatform();

// ─── SplashScreen ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 1200);
    const t2 = setTimeout(() => onDone(), 1650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center select-none ${leaving ? "splash-fade-out" : ""}`}
      style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 65%, #1e1b4b 100%)" }}
    >
      {/* Ambient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full opacity-20 blur-3xl" style={{ background: "#7c3aed" }} />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full opacity-15 blur-3xl" style={{ background: "#a78bfa" }} />
      </div>

      {/* Main logo + orbit rings */}
      <div className="relative flex items-center justify-center mb-8 splash-logo-in" style={{ width: 120, height: 120 }}>
        <div className="absolute inset-0 rounded-full border border-violet-500/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="orbit-dot w-3 h-3 rounded-full" style={{ background: "#a78bfa", boxShadow: "0 0 8px #a78bfa" }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="orbit-dot-rev w-2 h-2 rounded-full" style={{ background: "#c4b5fd", boxShadow: "0 0 6px #c4b5fd" }} />
        </div>
        <div className="relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl"
          style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 0 40px rgba(139,92,246,0.6)" }}>
          <span className="text-white font-bold text-4xl" style={{ fontFamily: "DM Mono, monospace", lineHeight: 1 }}>₹</span>
        </div>
      </div>

      <div className="splash-text-in text-center px-6" style={{ animationDelay: "0.3s" }}>
        <h1 className="text-white font-bold mb-1" style={{ fontSize: "clamp(1.5rem, 5vw, 2rem)", letterSpacing: "-0.02em" }}>
          Expense Tracker
        </h1>
        <p className="text-violet-300 text-sm font-medium">by Sujan Anandh</p>
      </div>

      <div className="mt-10 w-40 splash-text-in" style={{ animationDelay: "0.4s" }}>
        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full splash-bar" style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #c4b5fd)" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: "food",          label: "Food & Drinks",  emoji: "🍔", color: "#f97316" },
  { id: "transport",     label: "Transport",       emoji: "🚌", color: "#3b82f6" },
  { id: "books",         label: "Books & Study",   emoji: "📚", color: "#8b5cf6" },
  { id: "entertainment", label: "Entertainment",   emoji: "🎮", color: "#ec4899" },
  { id: "health",        label: "Health",          emoji: "💊", color: "#10b981" },
  { id: "other",         label: "Other",           emoji: "📦", color: "#6b7280" },
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const DEFAULT_BUDGET = 5000;

const LS = {
  get: (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Dates are stored as local "YYYY-MM-DD" strings (toISOString would give UTC and
// roll back a day in India before 5:30 AM).
const pad2        = (n)     => String(n).padStart(2, "0");
const toDateStr   = (d)     => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr    = ()      => toDateStr(new Date());
const daysAgoStr  = (n)     => { const d = new Date(); d.setDate(d.getDate() - n); return toDateStr(d); };
const parseDate   = (s)     => new Date(s + "T00:00:00");
const monthKey    = (d)     => d.slice(0, 7);
const shiftMonth  = (mk, n) => { const [y, m] = mk.split("-").map(Number); return toDateStr(new Date(y, m - 1 + n, 1)).slice(0, 7); };
const daysInMonth = (mk)    => { const [y, m] = mk.split("-").map(Number); return new Date(y, m, 0).getDate(); };
const monthLabel  = (mk)    => parseDate(mk + "-01").toLocaleString("en-IN", { month: "long", year: "numeric" });
const sumOf       = (list)  => list.reduce((s, e) => s + e.amount, 0);

const friendlyDate = (s) => {
  if (s === todayStr())     return "Today";
  if (s === daysAgoStr(1))  return "Yesterday";
  const d = parseDate(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
};

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const formatINR = (n) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const formatINRShort = (n) => {
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

// Saves a file: shares it via the Android share sheet in the APK, downloads it in the browser.
async function saveFile(filename, content, mime) {
  if (IS_NATIVE) {
    const { uri } = await Filesystem.writeFile({ path: filename, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try { await Share.share({ title: filename, files: [uri] }); }
    catch (err) { if (!/cancel/i.test(String(err?.message))) throw err; }
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a   = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function exportCSV(expenses) {
  const header = "Date,Name,Category,Amount,Note\n";
  const rows = [...expenses].sort((a, b) => a.date.localeCompare(b.date)).map((e) =>
    [e.date, csvCell(e.name), csvCell(CAT_MAP[e.category]?.label ?? e.category), e.amount, csvCell(e.note)].join(",")
  ).join("\n");
  return saveFile(`expenses-${todayStr()}.csv`, header + rows, "text/csv");
}

function exportBackup(expenses, budget) {
  const data = { app: "student-expense-tracker", version: 1, exportedAt: new Date().toISOString(), budget, expenses };
  return saveFile(`expense-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), "application/json");
}

function parseBackup(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.expenses;
  if (!Array.isArray(list)) throw new Error("No expenses found in file");
  const expenses = list
    .filter((e) => e && e.name && e.date && Number(e.amount) > 0)
    .map((e) => ({
      id: e.id ?? Date.now() + Math.random(),
      name: String(e.name), amount: Number(e.amount), date: String(e.date).slice(0, 10),
      category: CAT_MAP[e.category] ? e.category : "other", note: e.note ? String(e.note) : "",
    }));
  return { expenses, budget: Number(data.budget) > 0 ? Number(data.budget) : null };
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const ICONS = {
  home:     "M3 11.5L12 4l9 7.5M5.5 9.5V20h13V9.5",
  list:     "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  stats:    "M3 20h18M7 16v-5m5 5V6m5 10v-8",
  more:     "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6",
  plus:     "M12 5v14M5 12h14",
  x:        "M6 18L18 6M6 6l12 12",
  search:   "M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z",
  download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  upload:   "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  trash:    "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  left:     "M15 19l-7-7 7-7",
  right:    "M9 5l7 7-7 7",
  edit:     "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  wallet:   "M3 7a2 2 0 012-2h13a1 1 0 011 1v2M3 7v11a2 2 0 002 2h15a1 1 0 001-1v-3M3 7h17a1 1 0 011 1v3m0 0h-4a2 2 0 100 4h4m0-4v4",
  archive:  "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  user:     "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  sort:     "M3 7h13M3 12h9M3 17h5M17 10v10m0 0l-3-3m3 3l3-3",
};

function Icon({ name, className = "w-5 h-5", strokeWidth = 2 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, action, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, action ? 5000 : 3000); return () => clearTimeout(t); }, [onClose, action]);
  const colors = { success: "bg-emerald-600", error: "bg-red-600", warning: "bg-amber-600", info: "bg-gray-900 dark:bg-gray-700" };
  return (
    <div className={`fixed left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 pl-4 pr-2 py-2 rounded-2xl text-white text-sm font-medium shadow-2xl animate-fade-in-up max-w-[calc(100%-2rem)] ${colors[type] ?? colors.info}`}
      style={{ bottom: "calc(6.5rem + env(safe-area-inset-bottom))" }}>
      <span className="py-1">{message}</span>
      {action && (
        <button onClick={() => { action.onClick(); onClose(); }} className="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 font-semibold text-violet-200">
          {action.label}
        </button>
      )}
      <button onClick={onClose} className="opacity-60 hover:opacity-100 p-1.5" aria-label="Dismiss"><Icon name="x" className="w-3.5 h-3.5" /></button>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = "success", action = null) => setToast({ message, type, action, id: Date.now() }), []);
  const hide = useCallback(() => setToast(null), []);
  return { toast, show, hide };
}

// ─── Sheet (bottom drawer) ────────────────────────────────────────────────────
function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="sheet-up w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t border-gray-100 dark:border-gray-700"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 px-5 pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-600 mx-auto mb-3 sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-300" aria-label="Close">
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="px-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel, danger, confirmLabel = "Confirm" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onCancel}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-700 animate-fade-in-up">
        <div className="text-3xl mb-3 text-center">{danger ? "⚠️" : "💬"}</div>
        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl text-white text-sm font-medium transition-colors ${danger ? "bg-red-500 hover:bg-red-600" : "bg-violet-600 hover:bg-violet-700"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card / SectionTitle ──────────────────────────────────────────────────────
function Card({ className = "", children }) {
  return <div className={`bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/70 shadow-sm ${className}`}>{children}</div>;
}

function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{children}</h2>
      {action}
    </div>
  );
}

function EmptyState({ emoji, text, cta, onCta }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-gray-400 dark:text-gray-500 text-center">
      <div className="text-4xl mb-2">{emoji}</div>
      <p className="text-sm">{text}</p>
      {cta && (
        <button onClick={onCta} className="mt-4 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold active:scale-95 transition-transform">
          {cta}
        </button>
      )}
    </div>
  );
}

// ─── DoughnutChart ────────────────────────────────────────────────────────────
function DoughnutChart({ expenses }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const totals = useMemo(() => CATEGORIES.map((c) => ({
    ...c, total: sumOf(expenses.filter((e) => e.category === c.id)),
  })).filter((c) => c.total > 0), [expenses]);

  useEffect(() => {
    if (!canvasRef.current || !totals.length) return;
    const grand = sumOf(totals.map((c) => ({ amount: c.total })));
    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: totals.map((c) => c.label),
        datasets: [{ data: totals.map((c) => c.total), backgroundColor: totals.map((c) => c.color), borderColor: "transparent", hoverOffset: 8 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "72%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ${formatINR(ctx.raw)} (${Math.round(ctx.parsed / grand * 100)}%)` },
            backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#94a3b8", padding: 12, borderColor: "#334155", borderWidth: 1,
          },
        },
        animation: { animateRotate: true, duration: 700 },
      },
    });
    return () => chartRef.current?.destroy();
  }, [totals]);

  if (!totals.length) return <EmptyState emoji="📊" text="No spending this month" />;

  const grandTotal = sumOf(totals.map((c) => ({ amount: c.total })));
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-36 w-36 flex-shrink-0">
        <canvas ref={canvasRef} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">TOTAL</span>
          <span className="font-mono-data text-base font-bold text-gray-900 dark:text-gray-100">{formatINRShort(grandTotal)}</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        {[...totals].sort((a, b) => b.total - a.total).map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-gray-600 dark:text-gray-400 truncate">{c.label}</span>
            <span className="ml-auto font-mono-data text-gray-800 dark:text-gray-200 font-semibold">{Math.round(c.total / grandTotal * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── DailyBarChart ────────────────────────────────────────────────────────────
function DailyBarChart({ expenses, month, dailyBudget, darkMode }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const days = useMemo(() => {
    const out = Array.from({ length: daysInMonth(month) }, () => 0);
    expenses.forEach((e) => { if (monthKey(e.date) === month) out[Number(e.date.slice(8, 10)) - 1] += e.amount; });
    return out;
  }, [expenses, month]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const tick = darkMode ? "#6b7280" : "#9ca3af";
    chartRef.current = new Chart(canvasRef.current, {
      type: "bar",
      data: {
        labels: days.map((_, i) => i + 1),
        datasets: [{
          data: days,
          backgroundColor: days.map((v) => (dailyBudget && v > dailyBudget ? "#f59e0b" : "#8b5cf6")),
          borderRadius: 4, maxBarThickness: 14,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: tick, font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
          y: { grid: { color: darkMode ? "#374151" : "#f3f4f6" }, border: { display: false }, ticks: { color: tick, font: { size: 9 }, maxTicksLimit: 4, callback: (v) => formatINRShort(v) } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { title: (items) => friendlyDate(`${month}-${pad2(items[0].label)}`), label: (ctx) => ` ${formatINR(ctx.raw)}` },
            backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#94a3b8", padding: 10, displayColors: false,
          },
        },
        animation: { duration: 500 },
      },
    });
    return () => chartRef.current?.destroy();
  }, [days, month, dailyBudget, darkMode]);

  return <div className="relative h-40"><canvas ref={canvasRef} /></div>;
}

// ─── BudgetCard ───────────────────────────────────────────────────────────────
function BudgetCard({ spent, budget, onEditBudget }) {
  const pct      = budget > 0 ? (spent / budget) * 100 : 0;
  const barColor = pct < 60 ? "bg-emerald-400" : pct < 85 ? "bg-amber-400" : "bg-red-400";
  const now      = new Date();
  const dim      = daysInMonth(monthKey(todayStr()));
  const daysLeft = dim - now.getDate() + 1;
  const left     = budget - spent;
  const perDay   = Math.max(0, left) / daysLeft;

  return (
    <div className="relative rounded-3xl overflow-hidden p-5 text-white shadow-lg shadow-violet-500/20 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700">
      <div className="absolute inset-0 opacity-25 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 85% 15%, #c4b5fd 0%, transparent 45%)" }} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-200">Spent this month</p>
          <button onClick={onEditBudget} className="flex items-center gap-1 text-xs font-medium text-violet-100 bg-white/15 hover:bg-white/25 rounded-full px-2.5 py-1">
            Budget {formatINRShort(budget)} <Icon name="edit" className="w-3 h-3" />
          </button>
        </div>
        <p className="font-mono-data text-4xl font-bold mt-2 tracking-tight">{formatINR(spent)}</p>

        <div className="h-2.5 bg-white/20 rounded-full overflow-hidden mt-4">
          <div className={`h-full rounded-full progress-bar-fill ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>

        <div className="flex items-end justify-between mt-3 text-sm">
          <div>
            <p className="font-semibold">{left >= 0 ? `${formatINR(left)} left` : `${formatINR(-left)} over budget`}</p>
            <p className="text-xs text-violet-200">{Math.round(pct)}% used · {daysLeft} day{daysLeft !== 1 ? "s" : ""} to go</p>
          </div>
          {left > 0 && (
            <div className="text-right">
              <p className="font-mono-data font-bold">{formatINR(perDay)}</p>
              <p className="text-xs text-violet-200">safe to spend / day</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── BudgetSheet ──────────────────────────────────────────────────────────────
function BudgetSheet({ budget, onSave, onClose }) {
  const [draft, setDraft] = useState(String(budget));
  const valid = Number(draft) > 0;
  const save  = () => { if (valid) onSave(Math.round(Number(draft))); };

  return (
    <Sheet title="Monthly budget" onClose={onClose}>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">How much do you want to spend each month?</p>
      <div className="flex items-center justify-center gap-1 py-2">
        <span className="font-mono-data text-3xl font-bold text-gray-400">₹</span>
        <input autoFocus inputMode="numeric" value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && save()}
          className="font-mono-data text-4xl font-bold bg-transparent text-gray-900 dark:text-gray-100 outline-none w-48 text-center" />
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-3 mb-5">
        {[2000, 3000, 5000, 8000, 10000].map((v) => (
          <button key={v} onClick={() => setDraft(String(v))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${Number(draft) === v ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
            {formatINRShort(v)}
          </button>
        ))}
      </div>
      <button onClick={save} disabled={!valid}
        className="w-full py-3.5 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-40 active:scale-[0.98] text-white shadow-lg shadow-violet-500/25 transition-all">
        Save budget
      </button>
    </Sheet>
  );
}

// ─── ExpenseSheet (add / edit) ────────────────────────────────────────────────
function ExpenseSheet({ initial, expenses, onSave, onDelete, onClose }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(() => initial
    ? { ...initial, amount: String(initial.amount), note: initial.note ?? "" }
    : { name: "", amount: "", category: LS.get("lastCategory", "food"), date: todayStr(), note: "" });
  const [errors, setErrors] = useState({});

  // Past expenses become one-tap shortcuts: picking one fills name, category and (if empty) amount.
  const suggestions = useMemo(() => {
    const byName = {};
    expenses.forEach((e) => {
      const k = e.name.trim().toLowerCase();
      if (!byName[k]) byName[k] = { name: e.name.trim(), category: e.category, amount: e.amount, count: 0, last: e.date };
      byName[k].count++;
      if (e.date > byName[k].last) Object.assign(byName[k], { category: e.category, amount: e.amount, last: e.date });
    });
    const q = form.name.trim().toLowerCase();
    return Object.entries(byName)
      .filter(([k]) => k !== q && (!q || k.includes(q)))
      .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))
      .slice(0, 6)
      .map(([, v]) => v);
  }, [expenses, form.name]);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const pickSuggestion = (s) => {
    setForm((f) => ({ ...f, name: s.name, category: s.category, amount: f.amount || String(s.amount) }));
    setErrors({});
  };

  const submit = () => {
    const e = {};
    if (!form.amount || isNaN(form.amount) || +form.amount <= 0) e.amount = "Enter an amount";
    if (!form.name.trim())                                       e.name   = "What was it for?";
    if (!form.date)                                              e.date   = "Pick a date";
    if (Object.keys(e).length) { setErrors(e); return; }
    LS.set("lastCategory", form.category);
    onSave({ ...form, name: form.name.trim(), note: form.note.trim(), amount: parseFloat(form.amount), id: initial?.id ?? Date.now() });
  };

  const inputCls = (f) =>
    `w-full px-3.5 py-3 rounded-xl text-sm bg-gray-50 dark:bg-gray-700/50 border ${errors[f] ? "border-red-400 ring-2 ring-red-400/20" : "border-gray-200 dark:border-gray-600"} text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all`;
  const chipCls = (active) =>
    `px-3 py-2 rounded-xl text-xs font-medium border transition-all ${active
      ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`;
  const quickDates = [[todayStr(), "Today"], [daysAgoStr(1), "Yesterday"]];
  const customDate = !quickDates.some(([d]) => d === form.date);

  return (
    <Sheet title={isEdit ? "Edit expense" : "New expense"} onClose={onClose}>
      <div className="space-y-4">
        {/* Amount */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <span className="font-mono-data text-3xl font-bold text-gray-400">₹</span>
            <input autoFocus={!isEdit} inputMode="decimal" placeholder="0" value={form.amount}
              onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="font-mono-data text-5xl font-bold bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none w-56 text-center" />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
        </div>

        {/* Name + suggestions */}
        <div>
          <input placeholder="What was it for? e.g. Lunch, Bus pass" className={inputCls("name")} value={form.name}
            onChange={(e) => set("name", e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {errors.name && <p className="text-red-500 text-xs mt-1 ml-1">{errors.name}</p>}
          {!isEdit && suggestions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar mt-2 -mx-1 px-1">
              {suggestions.map((s) => (
                <button key={s.name} onClick={() => pickSuggestion(s)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 active:scale-95 transition-transform">
                  {CAT_MAP[s.category]?.emoji} {s.name} <span className="text-gray-400">· ₹{s.amount}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category */}
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" onClick={() => set("category", c.id)}
              className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-medium border transition-all duration-150 ${
                form.category === c.id
                  ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 scale-[1.03] shadow-sm"
                  : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400"
              }`}
            >
              <span className="text-xl mb-0.5">{c.emoji}</span>
              <span className="text-[10px] leading-none text-center">{c.label.split(" ")[0]}</span>
            </button>
          ))}
        </div>

        {/* Date */}
        <div className="flex items-center gap-2">
          {quickDates.map(([d, label]) => (
            <button key={label} onClick={() => set("date", d)} className={chipCls(form.date === d)}>{label}</button>
          ))}
          <input type="date" value={form.date} max={todayStr()} onChange={(e) => set("date", e.target.value)}
            className={`${chipCls(customDate)} flex-1 min-w-0 bg-transparent outline-none`} />
        </div>
        {errors.date && <p className="text-red-500 text-xs -mt-2 ml-1">{errors.date}</p>}

        <input placeholder="Note (optional)" className={inputCls("note")} value={form.note} onChange={(e) => set("note", e.target.value)} />

        <div className="flex gap-3 pt-1">
          {isEdit && (
            <button onClick={() => onDelete(initial)} aria-label="Delete expense"
              className="px-4 rounded-xl border border-red-200 dark:border-red-900/60 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <Icon name="trash" />
            </button>
          )}
          <button onClick={submit}
            className="flex-1 py-3.5 rounded-xl font-semibold text-sm bg-violet-600 hover:bg-violet-700 active:scale-[0.98] text-white shadow-lg shadow-violet-500/25 transition-all">
            {isEdit ? "Save changes" : "Add expense"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ─── ExpenseRow ───────────────────────────────────────────────────────────────
function ExpenseRow({ expense, onEdit, showDate = true, index = 0 }) {
  const cat = CAT_MAP[expense.category] ?? CAT_MAP.other;
  return (
    <button onClick={() => onEdit(expense)}
      className="expense-row w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
      style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: cat.color + "22" }}>
        {cat.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{expense.name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {showDate ? `${friendlyDate(expense.date)} · ` : ""}{cat.label}
          {expense.note ? <span className="italic"> · {expense.note}</span> : null}
        </p>
      </div>
      <span className="font-mono-data font-semibold text-sm text-gray-800 dark:text-gray-100 flex-shrink-0">
        −{formatINR(expense.amount)}
      </span>
    </button>
  );
}

// ─── HomePage ─────────────────────────────────────────────────────────────────
function HomePage({ expenses, budget, onEditBudget, onEdit, onAdd, onSeeAll }) {
  const today    = todayStr();
  const thisMk   = monthKey(today);
  const thisMonth= expenses.filter((e) => monthKey(e.date) === thisMk);
  const spent    = sumOf(thisMonth);
  const dayNum   = new Date().getDate();
  const avg      = spent / dayNum;
  const weekFrom = daysAgoStr(6);
  const recent   = [...expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 6);

  const stats = [
    { label: "Today",      value: formatINR(sumOf(expenses.filter((e) => e.date === today))), emoji: "☀️" },
    { label: "Last 7 days",value: formatINR(sumOf(expenses.filter((e) => e.date >= weekFrom && e.date <= today))), emoji: "📅" },
    { label: "Daily avg",  value: formatINR(avg), emoji: "📉" },
    { label: "Projected",  value: formatINR(avg * daysInMonth(thisMk)), emoji: "🔮", warn: budget > 0 && avg * daysInMonth(thisMk) > budget },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{greeting()} 👋</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">{monthLabel(thisMk)}</h1>
      </div>

      <BudgetCard spent={spent} budget={budget} onEditBudget={onEditBudget} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="!p-3.5">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1.5"><span>{s.emoji}</span>{s.label}</p>
            <p className={`font-mono-data text-lg font-bold leading-tight mt-1 ${s.warn ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-gray-100"}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <SectionTitle action={expenses.length > 0 && (
          <button onClick={onSeeAll} className="text-xs font-semibold text-violet-600 dark:text-violet-400">See all</button>
        )}>Recent</SectionTitle>
        {recent.length === 0
          ? <EmptyState emoji="💸" text="No expenses yet" cta="Add your first expense" onCta={onAdd} />
          : <div className="-mx-2">{recent.map((e, i) => <ExpenseRow key={e.id} expense={e} onEdit={onEdit} index={i} />)}</div>}
      </Card>
    </div>
  );
}

// ─── HistoryPage ──────────────────────────────────────────────────────────────
function HistoryPage({ expenses, onEdit, onExport }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date"); // date | amount

  const q = search.trim().toLowerCase();
  const filtered = expenses
    .filter((e) => (filter === "all" || e.category === filter) &&
      (!q || e.name.toLowerCase().includes(q) || (e.note ?? "").toLowerCase().includes(q)))
    .sort((a, b) => sortBy === "amount" ? b.amount - a.amount : b.date.localeCompare(a.date) || b.id - a.id);

  // Grouped by month, then by day, when sorted by date
  const groups = useMemo(() => {
    if (sortBy !== "date") return null;
    const months = [];
    filtered.forEach((e) => {
      const mk = monthKey(e.date);
      let m = months[months.length - 1];
      if (!m || m.key !== mk) months.push(m = { key: mk, total: 0, days: [] });
      m.total += e.amount;
      let d = m.days[m.days.length - 1];
      if (!d || d.date !== e.date) m.days.push(d = { date: e.date, total: 0, items: [] });
      d.total += e.amount;
      d.items.push(e);
    });
    return months;
  }, [filtered, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">History</h1>
        {expenses.length > 0 && (
          <button onClick={onExport} className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 dark:text-violet-400 px-3 py-2 rounded-xl bg-violet-50 dark:bg-violet-900/30">
            <Icon name="download" className="w-3.5 h-3.5" /> CSV
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input placeholder="Search name or note…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all" />
        </div>
        <button onClick={() => setSortBy((s) => (s === "date" ? "amount" : "date"))}
          className="flex items-center gap-1.5 px-3 rounded-xl text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300">
          <Icon name="sort" className="w-4 h-4" /> {sortBy === "date" ? "Newest" : "Highest"}
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        {[{ id: "all", label: "All", emoji: "✨" }, ...CATEGORIES].map((c) => (
          <button key={c.id} onClick={() => setFilter(c.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === c.id
              ? "border-violet-500 bg-violet-600 text-white"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300"}`}>
            {c.emoji} {c.label.split(" ")[0]}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {filtered.length} expense{filtered.length !== 1 ? "s" : ""} · {formatINR(sumOf(filtered))} total
        </p>
      )}

      {filtered.length === 0 ? (
        <Card>
          <EmptyState emoji={q || filter !== "all" ? "🔍" : "💸"} text={q || filter !== "all" ? "No expenses match your filter" : "No expenses yet — tap + to add one"} />
        </Card>
      ) : groups ? (
        groups.map((m) => (
          <div key={m.key}>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{monthLabel(m.key)}</p>
              <span className="font-mono-data text-xs font-semibold text-gray-500 dark:text-gray-400">{formatINR(m.total)}</span>
            </div>
            <Card className="!p-2 space-y-1">
              {m.days.map((d) => (
                <div key={d.date}>
                  <div className="flex items-center justify-between px-3 pt-2 pb-1">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{friendlyDate(d.date)}</p>
                    <span className="font-mono-data text-xs text-gray-400">{formatINR(d.total)}</span>
                  </div>
                  {d.items.map((e, i) => <ExpenseRow key={e.id} expense={e} onEdit={onEdit} showDate={false} index={i} />)}
                </div>
              ))}
            </Card>
          </div>
        ))
      ) : (
        <Card className="!p-2">
          {filtered.map((e, i) => <ExpenseRow key={e.id} expense={e} onEdit={onEdit} index={i} />)}
        </Card>
      )}
    </div>
  );
}

// ─── StatsPage ────────────────────────────────────────────────────────────────
function StatsPage({ expenses, budget, darkMode }) {
  const current = monthKey(todayStr());
  const [month, setMonth] = useState(current);
  const monthExp = useMemo(() => expenses.filter((e) => monthKey(e.date) === month), [expenses, month]);
  const total    = sumOf(monthExp);
  const prev     = sumOf(expenses.filter((e) => monthKey(e.date) === shiftMonth(month, -1)));
  const delta    = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;
  const top      = [...monthExp].sort((a, b) => b.amount - a.amount)[0];
  const byCat    = CATEGORIES.map((c) => ({ ...c, total: sumOf(monthExp.filter((e) => e.category === c.id)), count: monthExp.filter((e) => e.category === c.id).length }))
    .filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  const earliest = expenses.reduce((m, e) => (monthKey(e.date) < m ? monthKey(e.date) : m), current);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Insights</h1>

      {/* Month switcher */}
      <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl p-1.5 border border-gray-100 dark:border-gray-700/70 shadow-sm">
        <button onClick={() => setMonth((m) => shiftMonth(m, -1))} disabled={month <= earliest}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" aria-label="Previous month">
          <Icon name="left" />
        </button>
        <p className="font-semibold text-gray-900 dark:text-gray-100">{monthLabel(month)}</p>
        <button onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= current}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30" aria-label="Next month">
          <Icon name="right" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total spent</p>
          <p className="font-mono-data text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatINR(total)}</p>
          {delta !== null && (
            <p className={`text-xs font-medium mt-0.5 ${delta > 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
              {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}% vs last month
            </p>
          )}
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Budget used</p>
          <p className={`font-mono-data text-xl font-bold mt-1 ${total > budget ? "text-red-500" : "text-gray-900 dark:text-gray-100"}`}>
            {budget > 0 ? `${Math.round((total / budget) * 100)}%` : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">of {formatINR(budget)}</p>
        </Card>
      </div>

      <Card>
        <SectionTitle>By category</SectionTitle>
        <DoughnutChart expenses={monthExp} />
      </Card>

      <Card>
        <SectionTitle action={<span className="text-[10px] text-gray-400 flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-500" />over daily budget</span>}>
          Daily spending
        </SectionTitle>
        <DailyBarChart expenses={expenses} month={month} dailyBudget={budget / daysInMonth(month)} darkMode={darkMode} />
      </Card>

      {byCat.length > 0 && (
        <Card>
          <SectionTitle>Where it went</SectionTitle>
          <div className="space-y-3">
            {byCat.map((c) => (
              <div key={c.id}>
                <div className="flex items-center gap-2 text-sm mb-1.5">
                  <span>{c.emoji}</span>
                  <span className="text-gray-700 dark:text-gray-200 font-medium">{c.label}</span>
                  <span className="text-xs text-gray-400">{c.count}×</span>
                  <span className="ml-auto font-mono-data font-semibold text-gray-900 dark:text-gray-100">{formatINR(c.total)}</span>
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full progress-bar-fill" style={{ width: `${(c.total / byCat[0].total) * 100}%`, background: c.color }} />
                </div>
              </div>
            ))}
          </div>
          {top && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
              Biggest expense: <span className="font-semibold text-gray-700 dark:text-gray-200">{top.name}</span> · {formatINR(top.amount)} on {friendlyDate(top.date)}
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── MorePage (settings) ──────────────────────────────────────────────────────
function SettingsRow({ icon, label, sub, onClick, danger, right }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 active:bg-gray-100 dark:active:bg-gray-700 transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? "bg-red-50 dark:bg-red-900/20 text-red-500" : "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"}`}>
        {typeof icon === "string" && ICONS[icon] ? <Icon name={icon} className="w-[18px] h-[18px]" /> : icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${danger ? "text-red-500" : "text-gray-800 dark:text-gray-100"}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
      </div>
      {right ?? <Icon name="right" className="w-4 h-4 text-gray-300 dark:text-gray-600" />}
    </button>
  );
}

function MorePage({ expenses, budget, darkMode, onToggleDark, onEditBudget, onExportCSV, onBackup, onRestore, onReset, onAbout }) {
  const fileRef = useRef(null);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Settings</h1>

      <Card className="!p-0 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/70">
        <SettingsRow icon="wallet" label="Monthly budget" sub={formatINR(budget)} onClick={onEditBudget} />
        <SettingsRow icon={<span className="text-base">{darkMode ? "🌙" : "☀️"}</span>} label="Dark mode" onClick={onToggleDark}
          right={
            <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${darkMode ? "bg-violet-600" : "bg-gray-300"}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-5" : ""}`} />
            </span>
          } />
      </Card>

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2 px-1">Your data</p>
        <Card className="!p-0 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700/70">
          <SettingsRow icon="download" label="Export to CSV" sub="Open in Excel or Google Sheets" onClick={onExportCSV} />
          <SettingsRow icon="archive" label="Back up data" sub={`Save all ${expenses.length} expenses to a file`} onClick={onBackup} />
          <SettingsRow icon="upload" label="Restore from backup" sub="Merge expenses from a backup file" onClick={() => fileRef.current?.click()} />
          <SettingsRow icon="trash" label="Reset all data" sub="Delete every expense" onClick={onReset} danger />
        </Card>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onRestore(f); e.target.value = ""; }} />
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 px-1">
          Everything is stored only on this device. Back up now and then so you don't lose it if you uninstall the app.
        </p>
      </div>

      <Card className="!p-0 overflow-hidden">
        <SettingsRow icon="user" label="About" sub="Sujan Anandh · AMET University" onClick={onAbout} />
      </Card>
    </div>
  );
}

// ─── AboutPage ────────────────────────────────────────────────────────────────
function AboutPage({ onBack }) {
  return (
    <div className="animate-fade-in-up">
      <button onClick={onBack} className="flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400 mb-4 -ml-1">
        <Icon name="left" className="w-4 h-4" /> Settings
      </button>

      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 p-6 mb-4 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #a78bfa 0%, transparent 50%), radial-gradient(circle at 80% 20%, #818cf8 0%, transparent 50%)" }} />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-white/40 shadow-lg flex-shrink-0">
            <img src="./sujan.jpg" alt="Sujan Anandh" className="w-full h-full object-cover object-top"
              onError={(e) => { e.target.style.display="none"; e.target.parentNode.innerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.25rem;font-weight:700;background:rgba(255,255,255,0.2)">SA</div>'; }}
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sujan Anandh</h1>
            <p className="text-violet-200 text-xs">3rd Year B.Tech CSE · AMET University · Intern @ ATIUM Sports</p>
          </div>
        </div>
        <div className="relative z-10 flex flex-wrap gap-2 mt-4">
          {["React", "Tailwind CSS", "JavaScript", "Node.js", "Python"].map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-medium border border-white/20">{t}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Card>
          <div className="text-2xl mb-2">🎓</div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Education</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">B.Tech Computer Science & Engineering</p>
          <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-1">AMET University</p>
        </Card>
        <Card>
          <div className="text-2xl mb-2">💼</div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Experience</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Software Development Intern</p>
          <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-1">ATIUM Sports</p>
        </Card>
      </div>

      <Card className="mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">About this app</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          A personal finance tool to help students stay on budget — quick entry, monthly insights,
          daily spending limits and backups. All data stays on your device.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {["React 19", "Vite", "Tailwind CSS v4", "Chart.js", "Capacitor"].map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">{t}</span>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a href="https://github.com/SujanTheMagician" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 dark:bg-gray-700 text-white text-sm font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub
        </a>
        <a href="mailto:sujananandhsi@gmail.com"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          Email Me
        </a>
        <a href="https://www.linkedin.com/in/sujan-anandh-227253212" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          LinkedIn
        </a>
      </div>
    </div>
  );
}

// ─── BottomNav ────────────────────────────────────────────────────────────────
const TABS = [["home", "Home"], ["history", "History"], ["stats", "Insights"], ["more", "Settings"]];
const TAB_ICONS = { home: "home", history: "list", stats: "stats", more: "more" };

function BottomNav({ tab, onTab, onAdd }) {
  const active = tab === "about" ? "more" : tab;
  const item = ([id, label]) => (
    <button key={id} onClick={() => onTab(id)}
      className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${active === id ? "text-violet-600 dark:text-violet-400" : "text-gray-400 dark:text-gray-500"}`}>
      <Icon name={TAB_ICONS[id]} className="w-[22px] h-[22px]" strokeWidth={active === id ? 2.4 : 1.8} />
      {label}
    </button>
  );
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-t border-gray-100 dark:border-gray-800 select-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="max-w-2xl mx-auto flex items-center px-2">
        {TABS.slice(0, 2).map(item)}
        <div className="flex-1 flex justify-center">
          <button onClick={onAdd} aria-label="Add expense"
            className="-mt-7 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-white flex items-center justify-center shadow-lg shadow-violet-500/40 active:scale-90 transition-transform">
            <Icon name="plus" className="w-7 h-7" strokeWidth={2.5} />
          </button>
        </div>
        {TABS.slice(2).map(item)}
      </div>
    </nav>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [darkMode,   setDarkMode]   = useState(() => LS.get("darkMode", window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false));
  const [tab,        setTab]        = useState("home");
  const [expenses,   setExpenses]   = useState(() => LS.get("expenses", []));
  const [budget,     setBudget]     = useState(() => LS.get("budget", DEFAULT_BUDGET));
  const [overlay,    setOverlay]    = useState(null); // { type: "expense", expense? } | { type: "budget" } | { type: "reset" }
  const { toast, show: showToast, hide: hideToast } = useToast();

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  useEffect(() => { LS.set("expenses", expenses); }, [expenses]);
  useEffect(() => { LS.set("budget",   budget);   }, [budget]);
  useEffect(() => { LS.set("darkMode", darkMode); }, [darkMode]);

  // Apply dark class to <html> so Tailwind v4 dark: variants work globally, and match the Android status bar
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", darkMode ? "#111827" : "#f9fafb");
    if (IS_NATIVE) {
      StatusBar.setStyle({ style: darkMode ? Style.Dark : Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: darkMode ? "#111827" : "#f9fafb" }).catch(() => {});
    }
  }, [darkMode]);

  // Scroll to top when switching tabs
  useEffect(() => { window.scrollTo(0, 0); }, [tab]);

  // Android hardware back button: close overlay → go back a page → exit
  const navRef = useRef({ overlay, tab });
  useEffect(() => { navRef.current = { overlay, tab }; }, [overlay, tab]);
  useEffect(() => {
    if (!IS_NATIVE) return;
    const handle = CapApp.addListener("backButton", () => {
      const { overlay, tab } = navRef.current;
      if (overlay)              setOverlay(null);
      else if (tab === "about") setTab("more");
      else if (tab !== "home")  setTab("home");
      else                      CapApp.exitApp();
    });
    return () => { handle.then((h) => h.remove()); };
  }, []);

  const openAdd  = useCallback(() => setOverlay({ type: "expense" }), []);
  const openEdit = useCallback((expense) => setOverlay({ type: "expense", expense }), []);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  const saveExpense = (e) => {
    const isEdit = expenses.some((x) => x.id === e.id);
    setExpenses((p) => (isEdit ? p.map((x) => (x.id === e.id ? e : x)) : [e, ...p]));
    setOverlay(null);
    showToast(isEdit ? "Expense updated" : `${formatINR(e.amount)} added for "${e.name}"`, "success");
  };

  const deleteExpense = (e) => {
    setExpenses((p) => p.filter((x) => x.id !== e.id));
    setOverlay(null);
    showToast(`"${e.name}" deleted`, "info", {
      label: "Undo",
      onClick: () => setExpenses((p) => (p.some((x) => x.id === e.id) ? p : [e, ...p])),
    });
  };

  const run = (promise, okMsg) => promise
    .then(() => okMsg && showToast(okMsg, "success"))
    .catch((err) => showToast(`Couldn't save file: ${err.message ?? err}`, "error"));

  const handleExportCSV = () => {
    if (!expenses.length) { showToast("Nothing to export yet", "warning"); return; }
    run(exportCSV(expenses), IS_NATIVE ? null : "CSV downloaded!");
  };
  const handleBackup = () => run(exportBackup(expenses, budget), IS_NATIVE ? null : "Backup downloaded!");

  const handleRestore = async (file) => {
    try {
      const { expenses: incoming, budget: b } = parseBackup(await file.text());
      const known = new Set(expenses.map((e) => e.id));
      const fresh = incoming.filter((e) => !known.has(e.id));
      setExpenses((p) => [...fresh, ...p]);
      if (b) setBudget(b);
      showToast(fresh.length ? `Restored ${fresh.length} expense${fresh.length !== 1 ? "s" : ""}` : "Everything in that backup is already here", fresh.length ? "success" : "info");
    } catch (err) {
      showToast(`Invalid backup file: ${err.message}`, "error");
    }
  };

  const handleReset = () => {
    setExpenses([]);
    setBudget(DEFAULT_BUDGET);
    setOverlay(null);
    showToast("All data cleared", "info");
  };

  const thisMonthSpent = sumOf(expenses.filter((e) => monthKey(e.date) === monthKey(todayStr())));

  return (
    <div>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
        <main key={tab} className="max-w-2xl mx-auto px-4 animate-fade-in-up"
          style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
          {tab === "home" && (
            <HomePage expenses={expenses} budget={budget} onEdit={openEdit} onAdd={openAdd}
              onEditBudget={() => setOverlay({ type: "budget" })} onSeeAll={() => setTab("history")} />
          )}
          {tab === "history" && <HistoryPage expenses={expenses} onEdit={openEdit} onExport={handleExportCSV} />}
          {tab === "stats"   && <StatsPage expenses={expenses} budget={budget} darkMode={darkMode} />}
          {tab === "more" && (
            <MorePage expenses={expenses} budget={budget} darkMode={darkMode}
              onToggleDark={() => setDarkMode((d) => !d)}
              onEditBudget={() => setOverlay({ type: "budget" })}
              onExportCSV={handleExportCSV} onBackup={handleBackup} onRestore={handleRestore}
              onReset={() => setOverlay({ type: "reset" })} onAbout={() => setTab("about")} />
          )}
          {tab === "about" && <AboutPage onBack={() => setTab("more")} />}
        </main>

        <BottomNav tab={tab} onTab={setTab} onAdd={openAdd} />

        {overlay?.type === "expense" && (
          <ExpenseSheet initial={overlay.expense} expenses={expenses} onSave={saveExpense} onDelete={deleteExpense} onClose={closeOverlay} />
        )}
        {overlay?.type === "budget" && (
          <BudgetSheet budget={budget} onClose={closeOverlay}
            onSave={(b) => { setBudget(b); setOverlay(null); showToast(`Budget set to ${formatINR(b)}${thisMonthSpent > b ? " — you're already over it" : ""}`, thisMonthSpent > b ? "warning" : "success"); }} />
        )}
        {overlay?.type === "reset" && (
          <ConfirmModal
            title="Reset all data?"
            message={`This permanently deletes all ${expenses.length} expenses and resets your budget to ${formatINR(DEFAULT_BUDGET)}. Consider backing up first.`}
            danger confirmLabel="Delete all"
            onConfirm={handleReset}
            onCancel={closeOverlay}
          />
        )}

        {toast && <Toast key={toast.id} message={toast.message} type={toast.type} action={toast.action} onClose={hideToast} />}
      </div>
    </div>
  );
}
