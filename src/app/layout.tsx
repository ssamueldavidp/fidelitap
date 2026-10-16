import type { Metadata } from 'next'
import { DM_Sans, Outfit } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-dm', display: 'swap' })
const outfit = Outfit({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-outfit', display: 'swap' })

export const metadata: Metadata = {
  title: 'FideliTap — Fidelización digital para tu negocio',
  description:
    'Crea tarjetas de sellos digitales para tu negocio. Tus clientes las guardan en Apple o Google Wallet.',
  keywords: ['fidelización', 'tarjetas de sellos', 'loyalty', 'negocio', 'Colombia'],
  authors: [{ name: 'FideliTap' }],
  openGraph: {
    title: 'FideliTap',
    description: 'Fidelización digital para tu negocio',
    type: 'website',
    locale: 'es_CO',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${outfit.variable} font-sans`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
