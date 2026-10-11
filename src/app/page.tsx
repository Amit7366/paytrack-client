import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const roles = [
  {
    title: "Super admin",
    detail: "Owns the platform, assigns roles, and will govern global payment settings.",
  },
  {
    title: "Admin",
    detail: "Reviews people and operational records. More payment duties can be added later.",
  },
  {
    title: "User",
    detail: "Signs in to their own workspace. New roles can sit beside this one when needed.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-12 px-6 py-16">
        <section className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.22em] text-[#0f6e56]">Payment management</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight">
            Accounts, roles, and payments in one workspace.
          </h1>
          <p className="mt-4 text-lg leading-8 text-[#3d4a43]">
            The client talks to the Express API. Roles start with super admin, admin, and user, and the
            server is structured so more roles can be added without rewriting auth.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/register" className="rounded-full bg-[#0f6e56] px-5 py-3 text-sm font-medium text-white">
              Create account
            </Link>
            <Link href="/login" className="rounded-full border border-black/10 px-5 py-3 text-sm font-medium">
              Sign in
            </Link>
          </div>
        </section>
        <section className="grid gap-4 md:grid-cols-3">
          {roles.map((role) => (
            <article key={role.title} className="rounded-3xl border border-black/10 bg-white p-5">
              <h2 className="text-lg font-semibold">{role.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#5c6b63]">{role.detail}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
