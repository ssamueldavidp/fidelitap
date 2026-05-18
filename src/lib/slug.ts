export function generateSlug(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 55)

  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 4)
  return `${base}-${suffix}`
}
