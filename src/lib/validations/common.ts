import { z } from 'zod'

export const emailSchema = z
  .string()
  .email('Email inválido')
  .toLowerCase()
  .trim()

export const uuidSchema = z.string().uuid('ID inválido')

export const businessRegisterSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres').max(100).trim(),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(128, 'Máximo 128 caracteres')
    .regex(/[A-Z]/, 'Debe tener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe tener al menos un número'),
})

export const cardDesignSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color hex inválido'),
  bg_type: z.enum(['solid', 'gradient', 'image']),
  bg_value: z.string().min(1),
  bg_image_url: z.string().url().nullish(),
  stamp_icon: z.string().emoji('Debe ser un emoji').min(1).max(2),
  font: z.enum(['default', 'rounded', 'mono']),
})

export const loyaltyCardSchema = z.object({
  name: z.string().min(2).max(80).trim(),
  stamps_required: z.number().int().min(2).max(50),
  benefit_description: z.string().min(5).max(200).trim(),
  design_config: cardDesignSchema,
})

export const customerRegisterSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: emailSchema,
  phone: z.string().regex(/^\+?[0-9]{7,15}$/).optional(),
  loyalty_card_id: uuidSchema,
})

export const stampSchema = z.object({
  unique_code: z.string().min(10).max(100),
  business_id: uuidSchema,
})
