import { useState, useEffect, useRef, useCallback } from "react";
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from "chart.js";
Chart.register(ArcElement, Tooltip, Legend, DoughnutController);

// ─── SplashScreen ─────────────────────────────────────────────────────────────
function SplashScreen({ onDone }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 2600);
    const t2 = setTimeout(() => onDone(), 3100);
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
        <div className="absolute top-1/2 left-1/2 w-32 h-32 rounded-full opacity-10 blur-2xl" style={{ background: "#c4b5fd", transform: "translate(-50%,-50%)" }} />
      </div>

      {/* Floating particles */}
      {[
        { top: "15%", left: "10%", delay: "0s",    size: 6  },
        { top: "25%", left: "85%", delay: "0.4s",  size: 4  },
        { top: "70%", left: "8%",  delay: "0.8s",  size: 5  },
        { top: "75%", left: "88%", delay: "0.2s",  size: 7  },
        { top: "45%", left: "5%",  delay: "1s",    size: 3  },
        { top: "55%", left: "92%", delay: "0.6s",  size: 4  },
      ].map((p, i) => (
        <div key={i} className="absolute rounded-full float-dot" style={{
          top: p.top, left: p.left,
          width: p.size, height: p.size,
          background: "rgba(196,181,253,0.5)",
          animationDelay: p.delay,
        }} />
      ))}

      {/* Main logo + orbit rings */}
      <div className="relative flex items-center justify-center mb-8 splash-logo-in" style={{ width: 120, height: 120 }}>
        {/* Outer orbit ring */}
        <div className="absolute inset-0 rounded-full border border-violet-500/20" />
        {/* Orbit dot 1 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="orbit-dot w-3 h-3 rounded-full" style={{ background: "#a78bfa", boxShadow: "0 0 8px #a78bfa" }} />
        </div>
        {/* Orbit dot 2 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="orbit-dot-rev w-2 h-2 rounded-full" style={{ background: "#c4b5fd", animationDuration: "1.8s", boxShadow: "0 0 6px #c4b5fd" }} />
        </div>

        {/* Center logo */}
        <div className="relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center shadow-2xl"
          style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 0 40px rgba(139,92,246,0.6)" }}>
          <span className="text-white font-bold text-4xl" style={{ fontFamily: "DM Mono, monospace", lineHeight: 1 }}>₹</span>
        </div>
      </div>

      {/* App name */}
      <div className="splash-text-in text-center px-6" style={{ animationDelay: "0.5s" }}>
        <h1 className="text-white font-bold mb-1" style={{ fontSize: "clamp(1.5rem, 5vw, 2rem)", letterSpacing: "-0.02em" }}>
          Expense Tracker
        </h1>
        <p className="text-violet-300 text-sm font-medium mb-1">by Sujan Anandh</p>
        <p className="text-violet-400/70 text-xs">3rd Year CSE · AMET University</p>
      </div>

      {/* Loading bar */}
      <div className="mt-10 w-48 splash-text-in" style={{ animationDelay: "0.7s" }}>
        <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full rounded-full splash-bar" style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #c4b5fd)", animationDuration: "2.2s" }} />
        </div>
        <p className="text-violet-400/50 text-xs text-center mt-2 tracking-widest uppercase" style={{ fontSize: "10px" }}>
          Loading your finances…
        </p>
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

const LS = {
  get: (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStr  = ()    => new Date().toISOString().slice(0, 10);
const monthKey  = (d)   => d.slice(0, 7);
const formatINR = (n)   => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const formatINRShort = (n) => {
  if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n/1000).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
};

function exportCSV(expenses) {
  const header = "Date,Name,Category,Amount\n";
  const rows = expenses.map((e) =>
    `${e.date},"${e.name}",${CAT_MAP[e.category]?.label ?? e.category},${e.amount}`
  ).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: `expenses-${todayStr()}.csv` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: "bg-emerald-500", error: "bg-red-500", warning: "bg-amber-500", info: "bg-violet-500" };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-2xl text-white text-sm font-medium shadow-2xl animate-fade-in-up ${colors[type] ?? colors.info}`}>
      <span>{message}</span>
      <button onClick={onClose} className="opacity-70 hover:opacity-100 ml-1 text-xs">✕</button>
    </div>
  );
}

function useToast() {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, type = "success") => setToast({ message, type, id: Date.now() }), []);
  return { toast, show, hide: () => setToast(null) };
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel, danger }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in-up">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-gray-700">
        <div className="text-3xl mb-3 text-center">{danger ? "⚠️" : "💬"}</div>
        <h3 className="font-bold text-gray-900 dark:text-gray-100 text-center mb-2">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl text-white text-sm font-medium transition-colors ${danger ? "bg-red-500 hover:bg-red-600" : "bg-violet-600 hover:bg-violet-700"}`}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DoughnutChart ────────────────────────────────────────────────────────────
function DoughnutChart({ expenses }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);
  const totals = CATEGORIES.map((c) => ({
    ...c, total: expenses.filter((e) => e.category === c.id).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();
    if (!totals.length) return;
    chartRef.current = new Chart(canvasRef.current, {
      type: "doughnut",
      data: {
        labels: totals.map((c) => c.label),
        datasets: [{ data: totals.map((c) => c.total), backgroundColor: totals.map((c) => c.color), borderColor: "transparent", hoverOffset: 10 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: "70%",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: (ctx) => ` ${formatINR(ctx.raw)} (${Math.round(ctx.parsed / totals.reduce((s,c)=>s+c.total,0)*100)}%)` },
            backgroundColor: "#1e293b", titleColor: "#f1f5f9", bodyColor: "#94a3b8", padding: 12, borderColor: "#334155", borderWidth: 1,
          },
        },
        animation: { animateRotate: true, duration: 800 },
      },
    });
    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [JSON.stringify(totals.map(t=>t.total))]);

  if (!totals.length) return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-gray-500">
      <div className="text-4xl mb-2">📊</div>
      <p className="text-sm">Add expenses to see breakdown</p>
    </div>
  );

  const grandTotal = totals.reduce((s, c) => s + c.total, 0);
  return (
    <div>
      <div className="relative h-48 mx-auto w-48">
        <canvas ref={canvasRef} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide">TOTAL</span>
          <span className="font-mono-data text-lg font-bold text-gray-900 dark:text-gray-100">{formatINRShort(grandTotal)}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {totals.map((c) => (
          <div key={c.id} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-gray-600 dark:text-gray-400 truncate">{c.label}</span>
            <span className="ml-auto font-mono-data text-gray-800 dark:text-gray-200 font-semibold">{formatINRShort(c.total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BudgetBar ────────────────────────────────────────────────────────────────
function BudgetBar({ spent, budget, onBudgetChange }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(String(budget));
  const pct      = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const barColor = pct < 60 ? "bg-emerald-500" : pct < 85 ? "bg-amber-500" : "bg-red-500";
  const textColor= pct < 60 ? "text-emerald-600 dark:text-emerald-400" : pct < 85 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
  const save = () => { onBudgetChange(Math.max(1, Number(draft) || budget)); setEditing(false); };

  return (
    <div>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Monthly Budget</p>
          <div className="flex items-baseline gap-1 flex-wrap">
            <span className="font-mono-data text-2xl font-bold text-gray-900 dark:text-gray-100">{formatINR(spent)}</span>
            <span className="text-gray-400 text-sm">of</span>
            {editing ? (
              <input
                className="font-mono-data text-sm border-b-2 border-violet-500 bg-transparent text-gray-800 dark:text-gray-100 w-28 outline-none px-1"
                value={draft} autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
              />
            ) : (
              <button onClick={() => { setDraft(String(budget)); setEditing(true); }} className={`font-mono-data text-sm font-semibold ${textColor} hover:underline flex items-center gap-1`}>
                {formatINR(budget)}
                <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
            )}
          </div>
        </div>
        <div className={`text-right ${textColor}`}>
          <p className="font-mono-data text-3xl font-bold">{Math.round(pct)}%</p>
          <p className="text-xs font-medium">{budget - spent >= 0 ? `${formatINR(budget - spent)} left` : `${formatINR(spent - budget)} over`}</p>
        </div>
      </div>
      <div className="h-3 bg-gray-100 dark:bg-gray-700/60 rounded-full overflow-hidden">
        <div className={`h-full rounded-full progress-bar-fill ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 85 && (
        <p className="text-xs text-red-500 mt-2 font-medium animate-pulse">⚠️ You're close to your budget limit!</p>
      )}
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">
        Click the amount to edit · {new Date().toLocaleString("default", { month: "long", year: "numeric" })}
      </p>
    </div>
  );
}

// ─── AddExpenseForm ───────────────────────────────────────────────────────────
function AddExpenseForm({ onAdd, onToast }) {
  const [form,    setForm]    = useState({ name: "", amount: "", category: "food", date: todayStr(), note: "" });
  const [errors,  setErrors]  = useState({});
  const [success, setSuccess] = useState(false);
  const nameRef = useRef(null);

  const validate = () => {
    const e = {};
    if (!form.name.trim())                              e.name   = "Required";
    if (!form.amount || isNaN(form.amount) || +form.amount <= 0) e.amount = "Enter valid amount";
    if (!form.date)                                     e.date   = "Required";
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onAdd({ ...form, amount: parseFloat(form.amount), id: Date.now() });
    setForm({ name: "", amount: "", category: "food", date: todayStr(), note: "" });
    setErrors({});
    setSuccess(true);
    onToast(`₹${form.amount} added for "${form.name}"`, "success");
    setTimeout(() => { setSuccess(false); nameRef.current?.focus(); }, 1800);
  };

  const set = (k) => (ev) => {
    setForm((f) => ({ ...f, [k]: ev.target.value }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const inputCls = (f) =>
    `w-full px-3.5 py-2.5 rounded-xl text-sm bg-gray-50 dark:bg-gray-700/50 border ${errors[f] ? "border-red-400 ring-2 ring-red-400/20" : "border-gray-200 dark:border-gray-600"} text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all`;

  return (
    <div className="space-y-3">
      <div>
        <input ref={nameRef} placeholder="e.g. Burger King, Bus Pass…" className={inputCls("name")} value={form.name} onChange={set("name")}
          onKeyDown={(e) => e.key === "Enter" && submit()} />
        {errors.name && <p className="text-red-500 text-xs mt-1 ml-1">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-mono-data font-bold">₹</span>
            <input placeholder="0" type="number" className={`${inputCls("amount")} pl-7`} value={form.amount} onChange={set("amount")} min="0" step="any"
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1 ml-1">{errors.amount}</p>}
        </div>
        <div>
          <input type="date" className={inputCls("date")} value={form.date} onChange={set("date")} max={todayStr()} />
          {errors.date && <p className="text-red-500 text-xs mt-1 ml-1">{errors.date}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button"
            onClick={() => setForm((f) => ({ ...f, category: c.id }))}
            className={`flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-medium border transition-all duration-150 ${
              form.category === c.id
                ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 scale-[1.04] shadow-sm"
                : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/30"
            }`}
          >
            <span className="text-lg mb-0.5">{c.emoji}</span>
            <span style={{ fontSize: "10px" }} className="leading-none text-center">{c.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <input placeholder="Optional note…" className={inputCls("note")} value={form.note} onChange={set("note")} />

      <button type="button" onClick={submit}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
          success
            ? "bg-emerald-500 text-white scale-[0.98]"
            : "bg-violet-600 hover:bg-violet-700 active:scale-95 text-white shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
        }`}
      >
        {success ? "✓ Added!" : "Add Expense"}
      </button>
    </div>
  );
}

// ─── ExpenseList ──────────────────────────────────────────────────────────────
function ExpenseList({ expenses, onDelete, onToast }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date"); // date | amount

  const filtered = expenses
    .filter((e) => (filter === "all" || e.category === filter) && (!search || e.name.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => sortBy === "amount" ? b.amount - a.amount : b.date.localeCompare(a.date));

  const grouped = filtered.reduce((acc, e) => {
    const m = e.date.slice(0, 7);
    if (!acc[m]) acc[m] = [];
    acc[m].push(e);
    return acc;
  }, {});

  const handleDelete = (id, name) => {
    onDelete(id);
    onToast(`"${name}" removed`, "info");
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>
          <input placeholder="Search expenses…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-violet-500 transition-all"
          value={filter} onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>)}
        </select>
        <select
          className="px-3 py-2 rounded-xl text-sm bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-violet-500 transition-all"
          value={sortBy} onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="date">Newest first</option>
          <option value="amount">Highest amount</option>
        </select>
      </div>

      {/* Count */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">{filtered.length} expense{filtered.length !== 1 ? "s" : ""} · {formatINR(filtered.reduce((s,e)=>s+e.amount,0))} total</p>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          <div className="text-4xl mb-2">{search || filter !== "all" ? "🔍" : "💸"}</div>
          <p className="text-sm">{search || filter !== "all" ? "No expenses match your filter" : "No expenses yet — add your first one!"}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([month, items]) => (
            <div key={month}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {new Date(month + "-15").toLocaleString("default", { month: "long", year: "numeric" })}
                </p>
                <span className="font-mono-data text-xs font-semibold text-gray-500 dark:text-gray-400">
                  {formatINR(items.reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((expense, i) => {
                  const cat = CAT_MAP[expense.category];
                  return (
                    <div key={expense.id}
                      className="expense-row flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/40 hover:bg-gray-100 dark:hover:bg-gray-700/70 group transition-all duration-150"
                      style={{ animationDelay: `${Math.min(i, 5) * 40}ms` }}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ background: cat?.color + "22" }}>
                        {cat?.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{expense.name}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {expense.date} · {cat?.label}
                          {expense.note ? <span className="italic"> · {expense.note}</span> : null}
                        </p>
                      </div>
                      <span className="font-mono-data font-semibold text-sm text-gray-800 dark:text-gray-100 flex-shrink-0">
                        {formatINR(expense.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(expense.id, expense.name)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all ml-1 text-xs flex-shrink-0"
                        title="Delete expense"
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── QuickStats ───────────────────────────────────────────────────────────────
function QuickStats({ expenses, budget }) {
  const thisMonth    = expenses.filter((e) => monthKey(e.date) === monthKey(todayStr()));
  const monthlySpent = thisMonth.reduce((s, e) => s + e.amount, 0);
  const totalAllTime = expenses.reduce((s, e) => s + e.amount, 0);
  const avgPerDay    = (() => {
    if (!thisMonth.length) return 0;
    const day = new Date().getDate();
    return monthlySpent / day;
  })();
  const projectedEnd = avgPerDay * new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).getDate();

  const stats = [
    { label: "This Month",  value: formatINR(monthlySpent),  emoji: "📅", sub: `${thisMonth.length} expense${thisMonth.length!==1?"s":""}` },
    { label: "Budget Left", value: formatINR(Math.max(0, budget - monthlySpent)), emoji: "💰", sub: budget > 0 ? `${Math.round(Math.max(0,(1-monthlySpent/budget)*100))}% remaining` : "No budget set" },
    { label: "All Time",    value: formatINR(totalAllTime),  emoji: "📈", sub: `${expenses.length} total expenses` },
    { label: "Projected",   value: formatINR(projectedEnd),  emoji: "🔮", sub: "end-of-month estimate" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map((s) => (
        <div key={s.label} className="card-hover bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm">
          <p className="text-lg mb-1">{s.emoji}</p>
          <p className="font-mono-data text-base font-bold text-gray-900 dark:text-gray-100 leading-tight">{s.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">{s.label}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{s.sub}</p>
        </div>
      ))}
    </div>
  );
}

// ─── AboutPage ────────────────────────────────────────────────────────────────
function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto animate-fade-in-up px-4 py-8">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 p-8 mb-6 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #a78bfa 0%, transparent 50%), radial-gradient(circle at 80% 20%, #818cf8 0%, transparent 50%)" }} />
        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-white/40 shadow-lg flex-shrink-0">
            <img src="./sujan.jpg" alt="Sujan Anandh" className="w-full h-full object-cover object-top"
              onError={(e) => { e.target.style.display="none"; e.target.parentNode.innerHTML='<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:700;background:rgba(255,255,255,0.2)">SA</div>'; }}
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">Sujan Anandh</h1>
            <p className="text-violet-200 text-sm mb-3">3rd Year B.Tech CSE · AMET University · Intern @ ATIUM Sports</p>
            <div className="flex flex-wrap gap-2">
              {["React", "Tailwind CSS", "JavaScript", "Node.js", "Python"].map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-lg bg-white/15 text-xs font-medium border border-white/20">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div className="card-hover rounded-2xl p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-2xl mb-2">🎓</div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Education</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">B.Tech Computer Science & Engineering</p>
          <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-1">AMET University</p>
          <p className="text-xs text-gray-400 mt-1">3rd Year · Expected 2026</p>
        </div>
        <div className="card-hover rounded-2xl p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="text-2xl mb-2">💼</div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Experience</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Software Development Intern</p>
          <p className="text-sm font-medium text-violet-600 dark:text-violet-400 mt-1">ATIUM Sports</p>
          <p className="text-xs text-gray-400 mt-1">Building sports tech solutions</p>
        </div>
      </div>

      <div className="rounded-2xl p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm mb-4">
        <div className="text-2xl mb-2">📬</div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Contact</h3>
        <div className="space-y-2">
          <a href="mailto:sujananandhsi@gmail.com" className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            sujananandhsi@gmail.com
          </a>
          <a href="tel:+918438339737" className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            +91 84383 39737
          </a>
        </div>
      </div>

      <div className="rounded-2xl p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm mb-6">
        <div className="text-2xl mb-2">🛠️</div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">About This App</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Student Expense Tracker is a personal finance tool built to help students manage monthly budgets.
          Real-time category breakdowns, animated budget progress bar, dark mode, CSV export, and end-of-month projections — all stored privately in your browser.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {["React 19", "Vite", "Tailwind CSS v4", "Chart.js", "localStorage"].map((t) => (
            <span key={t} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">{t}</span>
          ))}
        </div>
      </div>

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

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [showSplash,  setShowSplash]  = useState(true);
  const [darkMode,    setDarkMode]    = useState(() => {
    const saved = LS.get("darkMode", false);
    // Apply immediately on mount to avoid flash
    if (saved) document.documentElement.classList.add("dark");
    return saved;
  });
  const [page,        setPage]        = useState("tracker");
  const [expenses,    setExpenses]    = useState(() => LS.get("expenses", []));
  const [budget,      setBudget]      = useState(() => LS.get("budget", 5000));
  const [mobileMenu,  setMobileMenu]  = useState(false);
  const [confirmReset,setConfirmReset]= useState(false);
  const { toast, show: showToast, hide: hideToast } = useToast();

  const handleSplashDone = useCallback(() => setShowSplash(false), []);

  useEffect(() => { LS.set("expenses", expenses); }, [expenses]);
  useEffect(() => { LS.set("budget",   budget);   }, [budget]);
  useEffect(() => { LS.set("darkMode", darkMode); }, [darkMode]);

  const addExpense    = useCallback((e) => setExpenses((p) => [e, ...p]), []);
  const deleteExpense = useCallback((id) => setExpenses((p) => p.filter((e) => e.id !== id)), []);

  const handleReset = () => {
    localStorage.clear();
    setExpenses([]);
    setBudget(5000);
    setConfirmReset(false);
    showToast("All data cleared successfully", "info");
  };

  const thisMonth    = expenses.filter((e) => monthKey(e.date) === monthKey(todayStr()));
  const monthlySpent = thisMonth.reduce((s, e) => s + e.amount, 0);

  // Apply dark class to <html> so Tailwind v4 dark: variants work globally
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <div>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">

        {/* Nav */}
        <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold shadow-sm">₹</div>
              <span className="font-bold text-gray-900 dark:text-gray-100 text-sm tracking-tight">ExpenseTracker</span>
            </div>
            {/* Desktop */}
            <div className="hidden sm:flex items-center gap-5">
              {[["tracker","💸 Tracker"],["about","👤 About Me"]].map(([p, label]) => (
                <button key={p} onClick={() => setPage(p)}
                  className={`nav-link text-sm font-medium transition-colors ${page===p ? "text-violet-600 dark:text-violet-400 active" : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"}`}>
                  {label}
                </button>
              ))}
              <button onClick={() => setDarkMode((d) => !d)}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-base hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Toggle dark mode">
                {darkMode ? "☀️" : "🌙"}
              </button>
            </div>
            {/* Mobile */}
            <div className="flex sm:hidden items-center gap-2">
              <button onClick={() => setDarkMode((d) => !d)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-sm">
                {darkMode ? "☀️" : "🌙"}
              </button>
              <button onClick={() => setMobileMenu((m) => !m)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  {mobileMenu ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/> : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>}
                </svg>
              </button>
            </div>
          </div>
          {mobileMenu && (
            <div className="sm:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 space-y-1 animate-fade-in-up">
              {[["tracker","💸 Tracker"],["about","👤 About Me"]].map(([p,label]) => (
                <button key={p} onClick={() => { setPage(p); setMobileMenu(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${page===p ? "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
        </nav>

        {/* Pages */}
        {page === "about" ? <AboutPage /> : (
          <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in-up">

            <QuickStats expenses={expenses} budget={budget} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Left */}
              <div className="space-y-5">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <BudgetBar spent={monthlySpent} budget={budget} onBudgetChange={setBudget} />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Add Expense</h2>
                  <AddExpenseForm onAdd={addExpense} onToast={showToast} />
                </div>
              </div>

              {/* Right */}
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Category Breakdown</h2>
                    <span className="text-xs text-gray-400">All time</span>
                  </div>
                  <DoughnutChart expenses={expenses} />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Expenses</h2>
                    <div className="flex items-center gap-3">
                      {expenses.length > 0 && (
                        <button onClick={() => { exportCSV(expenses); showToast("CSV downloaded!", "success"); }}
                          className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                          Export CSV
                        </button>
                      )}
                    </div>
                  </div>
                  <ExpenseList expenses={expenses} onDelete={deleteExpense} onToast={showToast} />
                </div>
              </div>
            </div>

            {/* Footer with Reset */}
            <div className="flex flex-col items-center gap-2 mt-8 mb-2">
              <button onClick={() => setConfirmReset(true)}
                className="text-xs text-gray-300 dark:text-gray-600 hover:text-red-400 dark:hover:text-red-500 transition-colors flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                Reset all data
              </button>
              <p className="text-xs text-gray-300 dark:text-gray-600">
                Built by Sujan Anandh · AMET University · Data stored locally in your browser
              </p>
            </div>
          </div>
        )}

        {/* Confirm Reset Modal */}
        {confirmReset && (
          <ConfirmModal
            title="Reset all data?"
            message="This will permanently delete all your expenses and reset your budget to ₹5,000. This cannot be undone."
            danger
            onConfirm={handleReset}
            onCancel={() => setConfirmReset(false)}
          />
        )}

        {/* Toast */}
        {toast && <Toast key={toast.id} message={toast.message} type={toast.type} onClose={hideToast} />}
      </div>
    </div>
  );
}