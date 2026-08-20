"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Users, Lock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHr, authenticateHrUser } from "@/stores/hr";
import { COMPANY, PRODUCT } from "@/lib/company";
import { dbFetchState } from "@/lib/db-client";

/**
 * Dedicated HRMS portal login. Each HR staff member, manager, the CEO and
 * admins sign in with their own login ID — not a free-typed name — so every
 * change they make in the portal is attributed to their account in the
 * Audit Log. Accounts are managed from Users & Access (CEO/Admin only).
 */
export default function HrLoginPage() {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hrUsers = useHr((s) => s.hrUsers);
  const login = useHr((s) => s.login);
  const router = useRouter();

  // Pull the latest account list from the database before validating, so an
  // account another Admin just created (from a different browser) works
  // here even though this browser has never logged in to hydrate from the DB.
  useEffect(() => {
    dbFetchState()
      .then((s) => { if (s.hrUsers?.length) useHr.setState({ hrUsers: s.hrUsers }); })
      .catch(() => { /* offline — fall back to the accounts already in this browser */ });
  }, []);

  const signIn = () => {
    setBusy(true);
    const result = authenticateHrUser(hrUsers, loginId, password);
    setBusy(false);
    if (!result.ok) { setError(result.error); return; }
    const { account } = result;
    login({ name: account.name, role: account.role, loginId: account.loginId });
    router.push("/hr");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a1120] p-4">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full bg-emerald-600/25 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px] rounded-full bg-sky-500/20 blur-[120px]" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl md:grid-cols-2">
        <div className="hidden flex-col justify-between border-r border-white/10 p-10 md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg">
              <Users className="h-5 w-5" />
            </div>
            <div className="leading-tight text-white">
              <p className="font-bold tracking-tight">{PRODUCT.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-white/50">HRMS Portal</p>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold leading-tight text-white">
              Workforce, wages
              <br />
              <span className="text-emerald-300">& production.</span>
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              {PRODUCT.blurb}
            </p>
          </div>
          <p className="text-[11px] text-white/40">{COMPANY.name} · {COMPANY.industry} · {COMPANY.location}</p>
        </div>

        <div className="bg-card p-8 sm:p-10">
          <h2 className="text-xl font-bold tracking-tight">HRMS Portal — Sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Sign in with your HR login — every change is recorded against it.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Login ID</label>
              <Input
                value={loginId}
                onChange={(e) => { setLoginId(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && signIn()}
                placeholder="e.g. anitha.hr"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && signIn()}
              />
            </div>

            {error && (
              <p className="flex items-center gap-1.5 rounded-md bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
              </p>
            )}

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={signIn} disabled={busy || !loginId || !password}>
              <Lock className="h-4 w-4" /> Sign in to HRMS Portal
            </Button>

            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              No login yet? Ask your Admin to add one from Users &amp; Access.
            </p>
            <p className="text-center text-[11px] text-muted-foreground">
              {PRODUCT.name} — {PRODUCT.tagline}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
