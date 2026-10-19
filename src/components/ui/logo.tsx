/* eslint-disable @next/next/no-img-element */

/** Logo de Fidelitap: versión clara u oscura según el tema (sin parpadeo, vía clases dark:). */
export function Logo({ className = 'h-[46px]' }: { className?: string }) {
  return (
    <>
      <img src="/fidelitap-logo.png" alt="Fidelitap" className={`${className} w-auto dark:hidden`} />
      <img src="/fidelitap-logo-dark.png" alt="Fidelitap" className={`${className} hidden w-auto dark:block`} />
    </>
  )
}
