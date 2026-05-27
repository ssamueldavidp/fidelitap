import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
