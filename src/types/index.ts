import { Decimal } from 'decimal.js'

// Odoo Types
export interface OdooCategory {
  id: number
  name: string
  parent_id: [number, string] | false
  complete_name?: string
}

export interface OdooProduct {
  id: number
  name: string
  default_code?: string
  categ_id: [number, string]
  active: boolean
  standard_price: number
  cost_method: string
  company_id: number
}

// Cost Calculation Types
export interface CostRule {
  categoryId: number
  cost: Decimal
  companyId: number
}

export interface ProductOverride {
  productTmplId: number
  cost: Decimal | null
  companyId: number
}

export interface EffectiveCost {
  cost: Decimal | null
  source: 'product_override' | 'category_rule' | 'none'
  reason: string
}

export interface CostPreviewItem {
  productId: number
  productName: string
  defaultCode?: string
  categoryName: string
  currentStandardPrice: Decimal
  effectiveCost: Decimal
  willUpdate: boolean
  reason: string
}

// User Types
export type UserRole = 'ADMIN' | 'VIEWER'

// API Response Types
export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
}

// Sync Types
export interface SyncResult {
  snapshotId: string
  itemsUpdated: number
  errors: any[]
  success: any[]
}