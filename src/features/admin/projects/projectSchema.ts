import { z } from 'zod'

export const projectSchema = z.object({
  name: z
    .string()
    .min(2, 'Mínimo 2 caracteres')
    .max(120, 'Máximo 120 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  status: z.enum(['active', 'inactive']),
  requires_approval: z.boolean(),
})

export type ProjectFormValues = z.infer<typeof projectSchema>
