import Link from 'next/link'

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="text-xl font-black tracking-tight shrink-0">
          fideli<span className="text-[#00C896]">tap</span>
        </Link>

        {/* Links — ocultos en mobile */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-500">
          <Link href="#como-funciona" className="hover:text-slate-900 transition-colors">
            Cómo funciona
          </Link>
          <Link href="#precios" className="hover:text-slate-900 transition-colors">
            Precios
          </Link>
          <Link href="/register" className="hover:text-slate-900 transition-colors">
            Negocios
          </Link>
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:block text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-2"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="text-sm font-bold bg-slate-900 text-white rounded-lg px-4 py-2 hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            Empezar gratis →
          </Link>
        </div>
      </div>
    </nav>
  )
}
