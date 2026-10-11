import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="flex items-center justify-between border-b border-black/10 px-6 py-4">
      <Link href="/" className="text-sm font-semibold tracking-[0.18em] uppercase">
        Ledger
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link href="/login" className="px-3 py-2 text-[#3d4a43] hover:text-[#14221b]">
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-[#0f6e56] px-4 py-2 font-medium text-white hover:bg-[#0c5a47]"
        >
          Create account
        </Link>
      </nav>
    </header>
  );
}
