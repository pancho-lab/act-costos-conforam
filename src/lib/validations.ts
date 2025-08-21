import { z } from 'zod'

// Cost validation schema
export const costSchema = z.object({
  cost: z.number().positive('El costo debe ser mayor a 0').max(999999.99, 'El costo es demasiado alto'),
  currency: z.string().length(3, 'La moneda debe tener 3 caracteres').default('ARS'),
  companyId: z.number().int().positive('ID de compañía inválido')
})

// Category cost rule schema
export const categoryCostRuleSchema = z.object({
  categoryId: z.number().int().positive('ID de categoría inválido'),
  cost: z.number().positive('El costo debe ser mayor a 0'),
  currency: z.string().length(3).default('ARS'),
  companyId: z.number().int().positive()
})

// Product cost override schema
export const productCostOverrideSchema = z.object({
  productTmplId: z.number().int().positive('ID de producto inválido'),
  cost: z.number().positive('El costo debe ser mayor a 0').nullable(),
  currency: z.string().length(3).default('ARS'),
  companyId: z.number().int().positive()
})

// Sync execution schema
export const syncExecutionSchema = z.object({
  companyId: z.number().int().positive(),
  useAccountingRevaluation: z.boolean().default(false),
  dryRun: z.boolean().default(true)
})

// User schema
export const userSchema = z.object({
  email: z.string().email('Email inválido'),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  role: z.enum(['ADMIN', 'VIEWER']).default('VIEWER'),
  companyId: z.number().int().positive().optional()
})

// Search/Filter schemas
export const productSearchSchema = z.object({
  search: z.string().optional(),
  categoryId: z.number().int().positive().optional(),
  hasOverride: z.boolean().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(50)
})

export const categorySearchSchema = z.object({
  search: z.string().optional(),
  parentId: z.number().int().positive().optional(),
  hasRule: z.boolean().optional()
})

// API Response schema
export const apiResponseSchema = <T>(dataSchema: z.ZodSchema<T>) => z.object({
  data: dataSchema.optional(),
  error: z.string().optional(),
  success: z.boolean()
})

// Environment variables validation
export const envSchema = z.object({
  ODOO_URL: z.string().url('ODOO_URL debe ser una URL válida'),
  ODOO_DB: z.string().min(1, 'ODOO_DB es requerido'),
  ODOO_USER: z.string().min(1, 'ODOO_USER es requerido'),
  ODOO_API_KEY: z.string().min(1, 'ODOO_API_KEY es requerido'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerido'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL debe ser una URL válida'),
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET debe tener al menos 32 caracteres'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID es requerido'),
  GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET es requerido'),
  USE_ACCOUNTING_REVALUATION: z.string().transform(val => val === 'true').default('false')
})

// Utility function to validate environment variables
export function validateEnv() {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.issues.map(issue => issue.path.join('.')).join(', ')
      throw new Error(`Missing or invalid environment variables: ${missingVars}`)
    }
    throw error
  }
}