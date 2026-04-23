"use client";

// ============================================================
//  KEDAI PINTAR — Login Page
//  Module 4 | src/app/login/page.tsx
//  Auth flow: PIN input → Supabase profiles lookup → localStorage session → redirect
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// ── Shape of the session object we persist to localStorage ──
interface SessionUser {
  profile_id: string;
  store_id:   string;
  role:       "admin" | "staff";
  name:       string;
}

export default function LoginPage() {
  const router = useRouter();

  const [pin, setPin]       = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  // ── PIN input: numeric only, max 6 digits ──────────────────
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
    setPin(val);
    if (error) setError(""); // clear error on new input
  };

  // ── Main auth handler ──────────────────────────────────────
  const handleLogin = async () => {
    // Guard: must have at least 4 digits
    if (pin.length < 4) {
      setError("❌ PIN mestilah sekurang-kurangnya 4 digit.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // ── 1. Query Supabase: match PIN in profiles table ──
      const { data, error: dbError } = await supabase
        .from("profiles")
        .select("id, store_id, role, name")
        .eq("pin", pin)
        .single(); // expect exactly one row

      // ── 2. Handle DB error or no matching record ─────────
      if (dbError || !data) {
        setError("❌ PIN tidak sah atau tiada rekod.");
        setLoading(false);
        return;
      }

      // ── 3. Build session object ──────────────────────────
      const session: SessionUser = {
        profile_id: data.id,
        store_id:   data.store_id,
        role:       data.role as "admin" | "staff",
        name:       data.name,
      };

      // ── 4. Persist session to localStorage ───────────────
      //    ⚠️  Temporary session strategy — will be replaced
      //    with Supabase Auth (Magic Link + JWT) in a future module.
      localStorage.setItem("kedai_pintar_session", JSON.stringify(session));

      // ── 5. Redirect to dashboard ─────────────────────────
      router.push("/dashboard");

    } catch (unexpected) {
      // Catch any unexpected runtime errors gracefully
      console.error("[LoginPage] Unexpected error:", unexpected);
      setError("❌ Ralat tidak dijangka. Sila cuba lagi.");
      setLoading(false);
    }
  };

  // ── Allow Enter key to submit ──────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) handleLogin();
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <Card className="w-full max-w-sm shadow-2xl border-0">

        {/* ── Header ── */}
        <CardHeader className="text-center space-y-2 pt-8 pb-4">
          <div className="text-5xl select-none">☕</div>
          <CardTitle className="text-3xl font-extrabold tracking-tight">
            Kedai Pintar
          </CardTitle>
          <CardDescription className="text-xs uppercase tracking-widest font-medium">
            Sistem Audit Harian
          </CardDescription>
        </CardHeader>

        {/* ── Form Body ── */}
        <CardContent className="space-y-5 pb-8 px-8">

          {/* PIN Input */}
          <div className="space-y-2">
            <Label htmlFor="pin" className="text-sm font-semibold">
              PIN Anda
            </Label>
            <Input
              id="pin"
              type="password"
              inputMode="numeric"
              placeholder="••••••"
              maxLength={6}
              value={pin}
              onChange={handlePinChange}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="text-center text-2xl tracking-[0.6em] font-bold h-14 rounded-xl"
              autoFocus
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-sm font-bold text-red-600 text-center -mt-1 animate-pulse">
              {error}
            </p>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleLogin}
            disabled={pin.length < 4 || loading}
            className="w-full h-12 font-bold text-base rounded-xl"
          >
            {loading ? "Menyemak Bilik Kebal..." : "Log Masuk →"}
          </Button>

          {/* Subtle hint for demo */}
          <p className="text-xs text-muted-foreground text-center pt-1">
            PIN demo: <strong>1234</strong>
          </p>
        </CardContent>
      </Card>
    </main>
  );
  }