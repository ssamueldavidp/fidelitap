import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Link href="/" className="text-2xl font-black tracking-tight mb-10">
        fideli<span className="text-[#00C896]">tap</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-muted-foreground">
        © 2026 FideliTap · Hecho en Colombia 🇨🇴
      </p>
    </div>
  )
}
