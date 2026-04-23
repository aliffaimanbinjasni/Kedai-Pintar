"use client";

// ============================================================
//  KEDAI PINTAR — Unified Dashboard (Staff + Boss View)
//  Module 6 | src/app/dashboard/page.tsx
//
//  Replaces the M5 file entirely.
//  - role === 'staff'  → Staff mobile UI (M5)
//  - role === 'admin'  → Boss Dashboard with Audit Engine (M6)
// ============================================================

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sun, ShoppingCart, Moon, LogOut, Loader2,
  CheckCircle2, AlertCircle, RefreshCw,
  TrendingDown, TrendingUp, Minus, Receipt,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────
interface SessionUser {
  profile_id: string;
  store_id:   string;
  role:       "admin" | "staff";
  name:       string;
}

interface DailySession {
  id:              string;
  opening_balance: number;
  closing_balance: number | null;
  status:          "open" | "closed";
  opened_at:       string;
  closed_at:       string | null;
  opened_by:       string;
  closed_by:       string | null;
  profiles:        { name: string } | null; // joined
}

interface PettyCash {
  id:          string;
  session_id:  string;
  amount:      number;
  type:        "in" | "out";
  description: string;
  created_at:  string;
  profiles:    { name: string } | null; // joined
}

type ShopState   = "loading" | "closed" | "open";
type ActiveForm  = null | "buka" | "petty" | "tutup";

// ── Helpers ──────────────────────────────────────────────────
function fmt(n: number) { return `RM ${n.toFixed(2)}`; }
function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" });
}
function todayISO() {
  const d = new Date(); d.setHours(0,0,0,0); return d.toISOString();
}

function Feedback({ msg, type }: { msg: string; type: "error" | "success" }) {
  return (
    <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold
      ${type === "error" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
      {type === "error"
        ? <AlertCircle size={15} className="shrink-0" />
        : <CheckCircle2 size={15} className="shrink-0" />}
      {msg}
    </div>
  );
}

// ============================================================
//  BOSS DASHBOARD COMPONENT
// ============================================================
function BossDashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [sessions, setSessions]   = useState<DailySession[]>([]);
  const [petty,    setPetty]      = useState<PettyCash[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState("");

  // ── Fetch today's sessions + petty cash ─────────────────
  const fetchData = useCallback(async () => {
    setLoading(true); setError("");
    const today = todayISO();

    // Fetch sessions with opener name
    const { data: sData, error: sErr } = await supabase
      .from("daily_sessions")
      .select("*, profiles:opened_by(name)")
      .eq("store_id", user.store_id)
      .gte("opened_at", today)
      .order("opened_at", { ascending: false });

    if (sErr) { setError("Gagal muatkan sesi."); setLoading(false); return; }
    setSessions((sData as DailySession[]) ?? []);

    if (!sData || sData.length === 0) { setLoading(false); return; }

    // Fetch all petty cash for today's sessions with staff name
    const sessionIds = sData.map(s => s.id);
    const { data: pData, error: pErr } = await supabase
      .from("petty_cash")
      .select("*, profiles:profile_id(name)")
      .in("session_id", sessionIds)
      .order("created_at", { ascending: false });

    if (pErr) { setError("Gagal muatkan duit keluar."); }
    else setPetty((pData as PettyCash[]) ?? []);

    setLoading(false);
  }, [user.store_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Audit Engine ─────────────────────────────────────────
  function auditSession(s: DailySession) {
    const pettyOut = petty
      .filter(p => p.session_id === s.id && p.type === "out")
      .reduce((sum, p) => sum + p.amount, 0);
    const pettyIn = petty
      .filter(p => p.session_id === s.id && p.type === "in")
      .reduce((sum, p) => sum + p.amount, 0);
    const expected = s.opening_balance - pettyOut + pettyIn;
    const actual   = s.closing_balance ?? null;
    const diff     = actual !== null ? actual - expected : null;
    return { pettyOut, pettyIn, expected, actual, diff };
  }

  // ── Today totals (across all sessions) ──────────────────
  const totalPettyOut = petty.filter(p => p.type === "out").reduce((s,p) => s+p.amount, 0);
  const totalPettyIn  = petty.filter(p => p.type === "in").reduce((s,p) => s+p.amount, 0);
  const activeSession = sessions.find(s => s.status === "open");

  // ── Discrepancy badge ────────────────────────────────────
  function DiscBadge({ diff }: { diff: number | null }) {
    if (diff === null)
      return <Badge variant="secondary" className="text-xs">Sesi Aktif</Badge>;
    if (Math.abs(diff) < 0.01)
      return <Badge className="bg-green-600 hover:bg-green-600 text-xs">✅ Tally</Badge>;
    if (diff < 0)
      return <Badge className="bg-red-600 hover:bg-red-600 text-xs">❌ Kurang {fmt(Math.abs(diff))}</Badge>;
    return <Badge className="bg-amber-500 hover:bg-amber-500 text-xs">⚠️ Lebih {fmt(diff)}</Badge>;
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      {/* ── Header ── */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">☕ Kedai Pintar</p>
          <h1 className="text-lg font-extrabold">Boss Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData}
            className="text-muted-foreground hover:text-slate-800 transition-colors">
            <RefreshCw size={18} />
          </button>
          <Badge className="bg-violet-600 hover:bg-violet-600 text-xs px-3">👑 Admin</Badge>
          <Button variant="ghost" size="sm" onClick={onLogout}
            className="text-muted-foreground hover:text-red-600 hover:bg-red-50 gap-1.5">
            <LogOut size={14} /> Log Keluar
          </Button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">

        {error && <Feedback msg={error} type="error" />}

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin text-slate-400" size={32} /></div>
        ) : (
          <>
            {/* ── KPI Row ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Sesi Hari Ini",   value: String(sessions.length),        icon: <Receipt size={18} />,      color: "text-slate-700" },
                { label: "Status Kedai",     value: activeSession ? "Buka 🟢" : "Tutup 🔴", icon: <Sun size={18} />, color: activeSession ? "text-green-600" : "text-red-500" },
                { label: "Jumlah Duit Keluar", value: fmt(totalPettyOut),           icon: <TrendingDown size={18} />, color: "text-red-600"   },
                { label: "Jumlah Duit Masuk",  value: fmt(totalPettyIn),            icon: <TrendingUp size={18} />,  color: "text-green-600" },
              ].map(k => (
                <Card key={k.label} className="rounded-2xl border-0 shadow-sm">
                  <CardContent className="px-5 py-4">
                    <div className="flex items-center justify-between text-muted-foreground mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wider">{k.label}</p>
                      {k.icon}
                    </div>
                    <p className={`text-xl font-extrabold ${k.color}`}>{k.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {sessions.length === 0 ? (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="font-semibold">Tiada sesi hari ini.</p>
                  <p className="text-sm mt-1">Staf belum buka kedai lagi.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* ── Per-Session Audit Cards ── */}
                {sessions.map((s, idx) => {
                  const { pettyOut, pettyIn, expected, actual, diff } = auditSession(s);
                  const sessionPetty = petty.filter(p => p.session_id === s.id);

                  return (
                    <Card key={s.id} className="rounded-2xl border-0 shadow-sm overflow-hidden">
                      {/* Session Header */}
                      <CardHeader className="bg-white px-6 py-4 border-b flex flex-row items-center justify-between gap-4 flex-wrap">
                        <div>
                          <CardTitle className="text-base font-extrabold">
                            Sesi #{sessions.length - idx}
                            <span className="text-muted-foreground font-normal text-sm ml-2">
                              {timeStr(s.opened_at)}{s.closed_at ? ` – ${timeStr(s.closed_at)}` : " (aktif)"}
                            </span>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Dibuka oleh: <strong>{s.profiles?.name ?? "—"}</strong>
                          </p>
                        </div>
                        <DiscBadge diff={diff} />
                      </CardHeader>

                      <CardContent className="px-6 py-5 space-y-5">
                        {/* ── Audit Engine Table ── */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          {[
                            { label: "Float Pagi",       value: fmt(s.opening_balance), color: "" },
                            { label: "Jumlah Keluar",    value: `- ${fmt(pettyOut)}`,   color: "text-red-600" },
                            { label: "Dijangka Dalam Laci", value: fmt(expected),       color: "text-slate-700 font-bold" },
                            { label: "Sebenar Dalam Laci",
                              value: actual !== null ? fmt(actual) : "Belum tutup",
                              color: diff === null ? "text-muted-foreground"
                                   : Math.abs(diff) < 0.01 ? "text-green-600 font-bold"
                                   : diff < 0 ? "text-red-600 font-bold"
                                   : "text-amber-600 font-bold"
                            },
                          ].map(cell => (
                            <div key={cell.label} className="bg-slate-50 rounded-xl px-4 py-3">
                              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">{cell.label}</p>
                              <p className={`text-base font-extrabold ${cell.color}`}>{cell.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* ── Discrepancy Highlight ── */}
                        {diff !== null && (
                          <div className={`flex items-center justify-between rounded-xl px-5 py-4 border-2
                            ${Math.abs(diff) < 0.01
                              ? "border-green-400 bg-green-50"
                              : diff < 0
                              ? "border-red-400 bg-red-50"
                              : "border-amber-400 bg-amber-50"}`}>
                            <div className="flex items-center gap-3">
                              {Math.abs(diff) < 0.01
                                ? <CheckCircle2 size={22} className="text-green-600" />
                                : diff < 0
                                ? <TrendingDown size={22} className="text-red-600" />
                                : <TrendingUp size={22} className="text-amber-600" />}
                              <div>
                                <p className="font-extrabold text-sm">
                                  {Math.abs(diff) < 0.01
                                    ? "Wang tally — tiada discrepancy."
                                    : diff < 0
                                    ? `Wang kurang sebanyak ${fmt(Math.abs(diff))}`
                                    : `Wang lebih sebanyak ${fmt(diff)}`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Dijangka {fmt(expected)} · Sebenar {fmt(actual!)}
                                </p>
                              </div>
                            </div>
                            <p className={`text-2xl font-black
                              ${Math.abs(diff) < 0.01 ? "text-green-600"
                              : diff < 0 ? "text-red-600" : "text-amber-600"}`}>
                              {diff >= 0 ? "+" : ""}{fmt(diff)}
                            </p>
                          </div>
                        )}

                        {/* ── Live Petty Cash Feed ── */}
                        {sessionPetty.length > 0 && (
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Live Feed — Duit Keluar/Masuk
                            </p>
                            <div className="rounded-xl overflow-hidden border">
                              <table className="w-full text-sm">
                                <thead className="bg-slate-100 text-muted-foreground">
                                  <tr>
                                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Masa</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Staf</th>
                                    <th className="text-left px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Keterangan</th>
                                    <th className="text-right px-4 py-2.5 text-xs font-bold uppercase tracking-wider">Jumlah</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sessionPetty.map((p, i) => (
                                    <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                      <td className="px-4 py-3 text-muted-foreground">{timeStr(p.created_at)}</td>
                                      <td className="px-4 py-3 font-medium">{p.profiles?.name ?? "—"}</td>
                                      <td className="px-4 py-3">{p.description}</td>
                                      <td className={`px-4 py-3 text-right font-bold
                                        ${p.type === "out" ? "text-red-600" : "text-green-600"}`}>
                                        {p.type === "out" ? "−" : "+"}{fmt(p.amount)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* ══════════════════════════════════════════
                    END DAY REPORT — screenshot-ready card
                ══════════════════════════════════════════ */}
                {sessions.some(s => s.status === "closed") && (
                  <Card className="rounded-2xl border-2 border-slate-800 shadow-lg" id="end-day-report">
                    <CardHeader className="bg-slate-800 text-white px-6 py-5 rounded-t-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Kedai Pintar</p>
                          <CardTitle className="text-xl font-extrabold mt-0.5">📋 Laporan Akhir Hari</CardTitle>
                        </div>
                        <p className="text-sm text-slate-400 text-right">
                          {new Date().toLocaleDateString("ms-MY", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                    </CardHeader>
                    <CardContent className="px-6 py-6 space-y-4">
                      {sessions.filter(s => s.status === "closed").map((s, idx) => {
                        const { pettyOut, expected, actual, diff } = auditSession(s);
                        return (
                          <div key={s.id} className="space-y-3">
                            {idx > 0 && <div className="border-t pt-4" />}
                            <div className="grid grid-cols-3 gap-3 text-sm">
                              <ReportRow label="Float Pagi"     value={fmt(s.opening_balance)} />
                              <ReportRow label="Duit Keluar"    value={fmt(pettyOut)} valueColor="text-red-600" />
                              <ReportRow label="Dijangka"       value={fmt(expected)} />
                              <ReportRow label="Sebenar"        value={actual !== null ? fmt(actual) : "—"} />
                              <ReportRow label="Perbezaan"
                                value={diff !== null
                                  ? `${diff >= 0 ? "+" : ""}${fmt(diff)}`
                                  : "—"}
                                valueColor={
                                  diff === null ? "" :
                                  Math.abs(diff) < 0.01 ? "text-green-600" :
                                  diff < 0 ? "text-red-600 font-black" : "text-amber-600"
                                }
                              />
                              <ReportRow label="Status"
                                value={
                                  diff === null ? "—" :
                                  Math.abs(diff) < 0.01 ? "✅ Tally" :
                                  diff < 0 ? "❌ Kurang" : "⚠️ Lebih"
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="border-t pt-4 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Dijana oleh Kedai Pintar · {user.name}</span>
                        <span>{new Date().toLocaleTimeString("ms-MY")}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ── Small helper for report rows ────────────────────────────
function ReportRow({ label, value, valueColor = "" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-slate-50 rounded-xl px-4 py-3">
      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-0.5">{label}</p>
      <p className={`font-extrabold text-sm ${valueColor}`}>{value}</p>
    </div>
  );
}

// ============================================================
//  STAFF DASHBOARD COMPONENT (M5 — unchanged logic)
// ============================================================
function StaffDashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const [shopState,    setShopState]    = useState<ShopState>("loading");
  const [openSession,  setOpenSession]  = useState<{ id: string; opening_balance: number; opened_at: string } | null>(null);
  const [activeForm,   setActiveForm]   = useState<ActiveForm>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingStock,   setOpeningStock]   = useState("");
  const [pettyAmount,  setPettyAmount]  = useState("");
  const [pettyDesc,    setPettyDesc]    = useState("");
  const [pettyList,    setPettyList]    = useState<{ amount: number; description: string }[]>([]);
  const [closingBalance, setClosingBalance] = useState("");
  const [closingStock,   setClosingStock]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [feedback,     setFeedback]     = useState<{ msg: string; type: "error" | "success" } | null>(null);

  const flash = (msg: string, type: "error" | "success") => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const checkOpenSession = useCallback(async () => {
    setShopState("loading");
    const { data, error } = await supabase
      .from("daily_sessions")
      .select("id, opening_balance, opened_at")
      .eq("store_id", user.store_id)
      .eq("status", "open")
      .maybeSingle();
    if (error) { flash("❌ Gagal semak status kedai.", "error"); setShopState("closed"); return; }
    if (data) { setOpenSession(data); setShopState("open"); }
    else      { setOpenSession(null); setShopState("closed"); }
  }, [user.store_id]);

  useEffect(() => { checkOpenSession(); }, [checkOpenSession]);

  const handleBukaKedai = async () => {
    if (!openingBalance) { flash("Sila masukkan baki laci pagi.", "error"); return; }
    setSubmitting(true);
    const { data, error } = await supabase
      .from("daily_sessions")
      .insert({ store_id: user.store_id, opened_by: user.profile_id, opening_balance: parseFloat(openingBalance), status: "open", opened_at: new Date().toISOString() })
      .select("id, opening_balance, opened_at").single();
    setSubmitting(false);
    if (error || !data) { flash("❌ Gagal buka kedai.", "error"); return; }
    setOpenSession(data); setShopState("open"); setActiveForm(null);
    setOpeningBalance(""); setOpeningStock("");
    flash(`✅ Kedai dibuka! Float: ${fmt(parseFloat(openingBalance))}`, "success");
  };

  const handleAddPetty = () => {
    if (!pettyAmount || !pettyDesc) { flash("Sila isi jumlah dan keterangan.", "error"); return; }
    setPettyList(p => [...p, { amount: parseFloat(pettyAmount), description: pettyDesc }]);
    setPettyAmount(""); setPettyDesc("");
  };

  const handleSavePetty = async () => {
    if (!pettyList.length) { flash("Tiada item untuk disimpan.", "error"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("petty_cash").insert(
      pettyList.map(p => ({ session_id: openSession!.id, profile_id: user.profile_id, amount: p.amount, type: "out", description: p.description }))
    );
    setSubmitting(false);
    if (error) { flash("❌ Gagal simpan duit keluar.", "error"); return; }
    setPettyList([]); setActiveForm(null);
    flash(`✅ ${pettyList.length} item disimpan.`, "success");
  };

  const handleTutupKedai = async () => {
    if (!closingBalance) { flash("Sila masukkan baki laci malam.", "error"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("daily_sessions")
      .update({ closed_by: user.profile_id, closing_balance: parseFloat(closingBalance), status: "closed", closed_at: new Date().toISOString() })
      .eq("id", openSession!.id);
    setSubmitting(false);
    if (error) { flash("❌ Gagal tutup kedai.", "error"); return; }
    setOpenSession(null); setShopState("closed"); setActiveForm(null);
    setClosingBalance(""); setClosingStock("");
    flash("✅ Kedai ditutup. Laporan dihantar ke Boss!", "success");
  };

  const totalPetty = pettyList.reduce((s, p) => s + p.amount, 0);

  if (shopState === "loading") {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-slate-400" size={36} /></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-white shadow-sm px-5 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">☕ Kedai Pintar</p>
          <h1 className="text-base font-extrabold">Selamat Datang, {user.name}! 👋</h1>
        </div>
        <Badge variant={shopState === "open" ? "default" : "secondary"}
          className={`text-xs font-bold px-3 py-1 ${shopState === "open" ? "bg-green-600 hover:bg-green-600" : ""}`}>
          {shopState === "open" ? "🟢 Buka" : "🔴 Tutup"}
        </Badge>
      </header>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {feedback && <Feedback msg={feedback.msg} type={feedback.type} />}

        {shopState === "open" && openSession && (
          <div className="bg-white rounded-2xl px-5 py-4 shadow-sm border text-sm space-y-1">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Sesi Aktif</p>
            <p className="font-bold text-base">Float Pagi: <span className="text-green-600">{fmt(openSession.opening_balance)}</span></p>
            <p className="text-muted-foreground text-xs">Dibuka: {timeStr(openSession.opened_at)}</p>
          </div>
        )}

        <Card className="rounded-2xl shadow-sm border-0">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Tindakan</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-3">

            {/* SCENARIO A: Closed */}
            {shopState === "closed" && (<>
              <ActionBtn icon={<Sun size={26}/>} label="Buka Kedai" sub="Rekod float & stok pagi"
                color="bg-amber-500 hover:bg-amber-600" active={activeForm==="buka"} onClick={() => setActiveForm(f => f==="buka"?null:"buka")} />
              {activeForm === "buka" && (
                <FormBox color="amber">
                  <Field id="ob" label="Duit Laci Pagi (RM)" type="number" placeholder="50.00" value={openingBalance} onChange={setOpeningBalance} />
                  <Field id="os" label="Stok Susu Pagi (unit)" type="number" placeholder="24" value={openingStock} onChange={setOpeningStock} />
                  <SubmitBtn loading={submitting} onClick={handleBukaKedai} label="✅ Confirm Buka Kedai" color="bg-amber-500 hover:bg-amber-600" />
                </FormBox>
              )}
            </>)}

            {/* SCENARIO B: Open */}
            {shopState === "open" && (<>
              <ActionBtn icon={<ShoppingCart size={26}/>} label="Duit Keluar" sub="Rekod perbelanjaan operasi"
                color="bg-blue-600 hover:bg-blue-700" active={activeForm==="petty"} badge={pettyList.length || undefined}
                onClick={() => setActiveForm(f => f==="petty"?null:"petty")} />
              {activeForm === "petty" && (
                <FormBox color="blue">
                  <Field id="pd" label="Keterangan" placeholder="Gula, Gas, Plastik..." value={pettyDesc} onChange={setPettyDesc} />
                  <Field id="pa" label="Jumlah (RM)" type="number" placeholder="12.50" value={pettyAmount} onChange={setPettyAmount} />
                  <Button variant="outline" onClick={handleAddPetty} className="w-full h-11 font-bold rounded-xl border-blue-300 text-blue-700">+ Tambah Item</Button>
                  {pettyList.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Item Belum Simpan</p>
                      {pettyList.map((p, i) => (
                        <div key={i} className="flex justify-between items-center text-sm bg-white rounded-xl px-4 py-2.5 border">
                          <span>{p.description}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-red-600">- {fmt(p.amount)}</span>
                            <button onClick={() => setPettyList(prev => prev.filter((_,idx)=>idx!==i))} className="text-muted-foreground hover:text-red-500 text-xs">✕</button>
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between font-extrabold text-sm px-1 pt-1">
                        <span>Jumlah</span><span className="text-red-600">- {fmt(totalPetty)}</span>
                      </div>
                      <SubmitBtn loading={submitting} onClick={handleSavePetty} label={`💾 Simpan ${pettyList.length} Item`} color="bg-blue-600 hover:bg-blue-700" />
                    </div>
                  )}
                </FormBox>
              )}

              <ActionBtn icon={<Moon size={26}/>} label="Tutup Kedai" sub="Rekod baki laci & stok malam"
                color="bg-slate-800 hover:bg-slate-900" active={activeForm==="tutup"}
                onClick={() => setActiveForm(f => f==="tutup"?null:"tutup")} />
              {activeForm === "tutup" && (
                <FormBox color="slate">
                  <Field id="cb" label="Baki Laci Malam (RM)" type="number" placeholder="38.00" value={closingBalance} onChange={setClosingBalance} />
                  <Field id="cs" label="Baki Stok Susu Malam (unit)" type="number" placeholder="20" value={closingStock} onChange={setClosingStock} />
                  <SubmitBtn loading={submitting} onClick={handleTutupKedai} label="🌙 Confirm Tutup Kedai" color="bg-slate-800 hover:bg-slate-900" />
                </FormBox>
              )}
            </>)}
          </CardContent>
        </Card>

        <Button variant="ghost" onClick={onLogout}
          className="w-full h-12 font-semibold text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-2xl">
          <LogOut size={16} className="mr-2" /> Log Keluar
        </Button>
      </div>
    </main>
  );
}

// ── Tiny reusable sub-components for StaffDashboard ─────────
function ActionBtn({ icon, label, sub, color, active, badge, onClick }:
  { icon: React.ReactNode; label: string; sub: string; color: string; active: boolean; badge?: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-4 ${color} active:scale-[.98] text-white rounded-2xl px-5 py-5 transition-all shadow-md ${active ? "opacity-90" : ""}`}>
      <span className="shrink-0">{icon}</span>
      <div className="text-left flex-1">
        <p className="font-extrabold text-lg leading-tight">{label}</p>
        <p className="text-xs text-white/70 mt-0.5">{sub}</p>
      </div>
      {badge ? <span className="bg-white text-blue-700 text-xs font-black rounded-full w-6 h-6 flex items-center justify-center">{badge}</span> : null}
    </button>
  );
}
function FormBox({ children, color }: { children: React.ReactNode; color: string }) {
  const bg: Record<string,string> = { amber: "bg-amber-50 border-amber-200", blue: "bg-blue-50 border-blue-200", slate: "bg-slate-50 border-slate-200" };
  return <div className={`${bg[color] ?? ""} border rounded-2xl px-5 py-4 space-y-4`}>{children}</div>;
}
function Field({ id, label, type="text", placeholder, value, onChange }:
  { id: string; label: string; type?: string; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      <Input id={id} type={type} inputMode={type==="number"?"decimal":undefined} placeholder={placeholder}
        value={value} onChange={e => onChange(e.target.value)} className="h-12 text-base font-bold rounded-xl" />
    </div>
  );
}
function SubmitBtn({ loading, onClick, label, color }:
  { loading: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <Button onClick={onClick} disabled={loading} className={`w-full h-12 font-bold rounded-xl ${color}`}>
      {loading ? <Loader2 className="animate-spin" size={18} /> : label}
    </Button>
  );
}

// ============================================================
//  ROOT DASHBOARD — reads session, routes to correct view
// ============================================================
export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("kedai_pintar_session");
    if (!raw) { router.replace("/login"); return; }
    try { setUser(JSON.parse(raw)); }
    catch { router.replace("/login"); }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("kedai_pintar_session");
    router.replace("/login");
  };

  if (!user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100"><Loader2 className="animate-spin text-slate-400" size={36} /></main>;
  }

  // ── Role gate ────────────────────────────────────────────
  return user.role === "admin"
    ? <BossDashboard user={user} onLogout={handleLogout} />
    : <StaffDashboard user={user} onLogout={handleLogout} />;
}