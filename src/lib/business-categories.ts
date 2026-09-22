// Mirrors mobile/lib/core/business_categories.dart — kept as a plain array
// (not a DB enum/CHECK constraint) so it's validated app-side, matching how
// other enum-ish fields (card style, bg_mode) already work in this codebase.
export const BUSINESS_CATEGORIES = [
  'Cafetería',
  'Restaurante',
  'Panadería',
  'Belleza y spa',
  'Barbería',
  'Gimnasio',
  'Ropa y moda',
  'Farmacia',
  'Mascotas',
  'Otro',
] as const

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number]
