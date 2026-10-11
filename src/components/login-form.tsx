"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { homeForRole } from "@/lib/roles";
import type { SessionRole } from "@/lib/session";
import { loginSchema } from "@/lib/validations/auth";

export function LoginForm() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setReady(true);
  }, []);

  const dark = ready && resolvedTheme === "dark";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = loginSchema.safeParse({
      email: form.get("email"),
      password: form.get("password"),
    });

    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setError(fields.email?.[0] ?? fields.password?.[0] ?? "Check the form and try again");
      return;
    }

    setError("");
    setPending(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: { user?: { role?: SessionRole } };
      };

      if (!response.ok || !payload.success || !payload.data?.user?.role) {
        setError(payload.error || "Unable to sign in");
        return;
      }

      router.push(homeForRole(payload.data.user.role));
      router.refresh();
    } catch {
      setError("Unable to reach the server");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-full w-full flex-1 grid-cols-1 bg-[#F8FAFC] text-slate-900 lg:grid-cols-12 dark:bg-slate-950 dark:text-slate-100">
      <section className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4338CA] p-8 text-white sm:p-12 lg:col-span-5 lg:p-16">
        <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-indigo-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-purple-500/20 blur-3xl" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-md">
              <svg className="size-6 text-white" viewBox="0 0 24 24" fill="none">
                <path d="M4 7C4 5.34315 5.34315 4 7 4H17C18.6569 4 20 5.34315 20 7V17C20 18.6569 18.6569 20 17 20H7C5.34315 20 4 18.6569 4 17V7Z" stroke="currentColor" strokeWidth="2" />
                <path d="M8 12H16M12 8V16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
                PayTrack
                <span className="rounded border border-indigo-400/30 bg-indigo-400/20 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-indigo-200 uppercase">FX</span>
              </div>
              <p className="text-xs font-medium tracking-wide text-indigo-200/80">Cross-Border Settlement</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur-md sm:inline-flex">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400" />
            USD/BDT Live Desk
          </div>
        </div>

        <div className="relative z-10 my-12 space-y-8 lg:my-0">
          <div>
            <span className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/8 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-200 uppercase backdrop-blur-md">
              Institutional Grade Payouts
            </span>
            <h1 className="text-3xl leading-tight font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              Track every payment.
              <br />
              <span className="bg-gradient-to-r from-indigo-200 via-white to-indigo-300 bg-clip-text text-transparent">Simple.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-indigo-100/80 sm:text-base">
              Automated USD-to-BDT clearing pipelines, real-time Bangladesh Bank interbank rates, and instant MFS disbursements.
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-md pt-4 pb-2">
            <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/8 p-6 shadow-2xl backdrop-blur-md">
              <div className="absolute -top-8 -right-8 size-44 rounded-full bg-indigo-400/30 blur-2xl" />
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <span className="text-xs font-semibold tracking-wider text-indigo-200 uppercase">USD ⇄ BDT Pipeline</span>
                <span className="rounded border border-emerald-500/30 bg-emerald-950/40 px-2 py-0.5 font-mono text-xs font-medium text-emerald-300">
                  1 USD ≈ ৳121.75
                </span>
              </div>
              <svg className="mt-3 h-44 w-full" viewBox="0 0 400 175" fill="none">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818CF8" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#38BDF8" />
                    <stop offset="50%" stopColor="#818CF8" />
                    <stop offset="100%" stopColor="#34D399" />
                  </linearGradient>
                  <radialGradient id="goldCoin" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#FDE68A" />
                    <stop offset="50%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#B45309" />
                  </radialGradient>
                  <radialGradient id="silverCoin" cx="35%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="60%" stopColor="#CBD5E1" />
                    <stop offset="100%" stopColor="#64748B" />
                  </radialGradient>
                </defs>
                <line x1="20" y1="130" x2="380" y2="130" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <line x1="20" y1="90" x2="380" y2="90" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <line x1="20" y1="50" x2="380" y2="50" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <rect x="50" y="85" width="16" height="45" rx="3" fill="#818CF8" fillOpacity="0.25" />
                <rect x="90" y="65" width="16" height="65" rx="3" fill="#818CF8" fillOpacity="0.35" />
                <rect x="130" y="95" width="16" height="35" rx="3" fill="#818CF8" fillOpacity="0.2" />
                <rect x="170" y="55" width="16" height="75" rx="3" fill="#818CF8" fillOpacity="0.4" />
                <rect x="210" y="70" width="16" height="60" rx="3" fill="#818CF8" fillOpacity="0.3" />
                <rect x="250" y="40" width="16" height="90" rx="3" fill="#818CF8" fillOpacity="0.5" />
                <rect x="290" y="60" width="16" height="70" rx="3" fill="#818CF8" fillOpacity="0.35" />
                <rect x="330" y="30" width="16" height="100" rx="3" fill="#34D399" fillOpacity="0.5" />
                <path d="M20 120 Q 80 110, 140 75 T 260 55 T 380 28 L 380 130 L 20 130 Z" fill="url(#chartGradient)" />
                <path d="M20 120 Q 80 110, 140 75 T 260 55 T 380 28" fill="none" stroke="url(#strokeGradient)" strokeWidth="3.5" strokeLinecap="round" />
                <circle cx="260" cy="55" r="9" fill="#34D399" fillOpacity="0.35" />
                <circle cx="260" cy="55" r="5" fill="#34D399" />
                <g transform="translate(65, 30)">
                  <ellipse cx="28" cy="28" rx="26" ry="26" fill="url(#silverCoin)" />
                  <ellipse cx="28" cy="28" rx="22" ry="22" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.8" />
                  <text x="28" y="35" fontSize="20" fontWeight="700" fill="#334155" textAnchor="middle">$</text>
                </g>
                <g transform="translate(295, 48)">
                  <ellipse cx="32" cy="32" rx="30" ry="30" fill="url(#goldCoin)" />
                  <ellipse cx="32" cy="32" rx="26" ry="26" fill="none" stroke="#FEF3C7" strokeWidth="1.5" strokeOpacity="0.9" />
                  <text x="32" y="40" fontSize="24" fontWeight="800" fill="#78350F" textAnchor="middle">৳</text>
                </g>
                <path d="M125 50 C 180 30, 240 35, 295 70" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
              </svg>
              <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-indigo-200">
                <span>BEFTN & RTGS Instant Rails</span>
                <span className="font-semibold text-white">৳17,29,93,357 Dispatched</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-indigo-200/80">
          <span>SOC2 Type II & Bangladesh Bank AML</span>
          <span className="font-mono text-[11px] text-indigo-300/60">v2.4.8 Enterprise</span>
        </div>
      </section>

      <section className="flex flex-col justify-between bg-[#F8FAFC] p-6 sm:p-12 lg:col-span-7 lg:p-16 dark:bg-slate-950">
        <div className="flex w-full items-center justify-end gap-4 text-xs">
          <span className="text-slate-500">Need support?</span>
          <span className="font-medium text-indigo-600">Contact Treasury Desk</span>
          <div className="h-4 w-px bg-slate-200" />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
            onClick={() => setTheme(dark ? "light" : "dark")}
          >
            <span className="text-amber-500">☀</span>
            {dark ? "Dark Mode" : "Light Mode"}
          </button>
        </div>

        <div className="mx-auto my-auto w-full max-w-md py-8">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10 dark:border-slate-700 dark:bg-slate-900 dark:shadow-none">
            <div className="mb-7">
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                <span className="size-1.5 rounded-full bg-indigo-600" />
                Executive & Treasury Portal
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">Welcome back</h2>
              <p className="mt-1.5 text-sm text-slate-500">Enter your credentials to access the payment terminal and disbursement queues.</p>
            </div>

            <form className="space-y-5" onSubmit={onSubmit} noValidate>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold tracking-wider text-slate-700 uppercase dark:text-slate-300">
                  Work Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="block w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-semibold tracking-wider text-slate-700 uppercase dark:text-slate-300">
                    Password
                  </label>
                  <button type="button" className="text-xs font-semibold text-indigo-600" onClick={() => toast.message("Password reset is not available yet")}>
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    aria-invalid={Boolean(error)}
                    className={`block w-full rounded-xl border px-3.5 py-2.5 pr-16 text-sm font-medium text-slate-900 outline-none dark:text-white ${
                      error
                        ? "border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-2 focus:ring-red-500/20"
                        : "border-slate-200 bg-white shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-950"
                    }`}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3.5 text-xs font-semibold text-slate-400"
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 sm:text-sm dark:text-slate-300">
                  <input type="checkbox" name="remember" className="size-4 accent-indigo-600" defaultChecked />
                  Remember this device for 30 days
                </label>
                <span className="text-[11px] font-medium text-slate-400">2FA Enforced</span>
              </div>

              <button
                type="submit"
                disabled={pending}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:bg-indigo-700 disabled:opacity-70"
              >
                {pending ? "Signing in..." : "Sign in to PayTrack"}
                <span aria-hidden>→</span>
              </button>

              <div className="pt-4">
                <div className="flex items-center py-2">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="mx-3 text-xs font-medium tracking-wider text-slate-400 uppercase">or sign in with</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm" onClick={() => toast.message("Google Workspace is not connected")}>
                    Google Workspace
                  </button>
                  <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm" onClick={() => toast.message("Okta / SAML is not connected")}>
                    Okta / SAML SSO
                  </button>
                </div>
              </div>
            </form>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400">
            Protected by hardware token authorization & TLS 1.3 encryption.
          </p>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-200/80 pt-4 text-xs text-slate-400 sm:flex-row">
          <span>© 2024 PayTrack Technologies Ltd. All rights reserved.</span>
          <span className="font-medium text-slate-500">Privacy Policy · Security Audit · BB FX Manual</span>
        </div>
      </section>
    </div>
  );
}
