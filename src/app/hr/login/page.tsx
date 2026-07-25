"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Users, Lock, ScanFace, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHr, type HrRole } from "@/stores/hr";
import { COMPANY, PRODUCT } from "@/lib/company";

const HR_ROLES: HrRole[] = ["HR Manager", "HR Executive", "Manager", "CEO", "Admin"];

/**
 * Dedicated HRMS portal login. HR, managers, the CEO and admins sign in
 * here to reach the people portal.
 */
export default function HrLoginPage() {
  const [name, setName] = useState("R. Anitha");
  const [role, setRole] = useState<HrRole>("HR Manager");
  const login = useHr((s) => s.login);
  const router = useRouter();

  const signIn = () => {
    login({ name: name.trim() || "HR User", role });
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
          <p className="mt-1 text-sm text-muted-foreground">Choose your role to explore the people portal.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Full name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as HrRole)}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {HR_ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">Password</label>
              <Input type="password" defaultValue="hr-demo-pass" />
            </div>

            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" size="lg" onClick={signIn}>
              <Lock className="h-4 w-4" /> Sign in to HRMS Portal
            </Button>

            <div className="flex items-center gap-3 py-1">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={signIn}><ScanFace className="h-4 w-4" /> Face login</Button>
              <Button variant="outline" onClick={signIn}><Fingerprint className="h-4 w-4" /> Biometric</Button>
            </div>
            <p className="pt-1 text-center text-[11px] text-muted-foreground">
              {PRODUCT.name} — {PRODUCT.tagline}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
