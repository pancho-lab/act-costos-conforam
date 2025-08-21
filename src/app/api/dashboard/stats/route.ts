import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getOdooClient } from '@/lib/odoo-simple'

export async function GET() {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    console.log('🔄 Loading dashboard statistics...')
    
    const odooClient = getOdooClient()
    await odooClient.auth()

    // Get total storable products count
    const totalProducts = await odooClient.searchCount('product.template', [
      ['active', '=', true], 
      ['type', '=', 'product']
    ])

    // Get categories count
    const totalCategories = await odooClient.searchCount('product.category', [])

    // Get draft changes count
    const globalForDrafts = globalThis as unknown as {
      draftChanges: Map<string, any> | undefined
    }
    const draftChangesStorage = globalForDrafts.draftChanges ?? new Map()
    
    const sessionId = session.user.email
    let pendingChanges = 0
    for (const [key] of draftChangesStorage.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        pendingChanges++
      }
    }

    // Get products with lowest costs (top 10)
    const lowCostProducts = await odooClient.searchRead(
      'product.template',
      [['active', '=', true], ['type', '=', 'product'], ['standard_price', '>', 0]],
      ['id', 'name', 'standard_price'],
      { limit: 10, order: 'standard_price asc' }
    )

    // Get products with highest costs (top 10)
    const highCostProducts = await odooClient.searchRead(
      'product.template', 
      [['active', '=', true], ['type', '=', 'product']],
      ['id', 'name', 'standard_price'],
      { limit: 10, order: 'standard_price desc' }
    )

    // Get products with zero cost
    const zeroCostCount = await odooClient.searchCount('product.template', [
      ['active', '=', true],
      ['type', '=', 'product'], 
      ['standard_price', '=', 0]
    ])

    console.log(`📊 Dashboard stats: ${totalProducts} productos, ${totalCategories} categorías, ${pendingChanges} cambios pendientes`)

    return NextResponse.json({
      success: true,
      stats: {
        totalProducts,
        totalCategories,
        pendingChanges,
        zeroCostCount,
        lowCostProducts: lowCostProducts.map(p => ({
          id: p.id,
          name: p.name,
          cost: p.standard_price || 0
        })),
        highCostProducts: highCostProducts.map(p => ({
          id: p.id, 
          name: p.name,
          cost: p.standard_price || 0
        }))
      }
    })

  } catch (error) {
    console.error('❌ Error loading dashboard stats:', error)
    return NextResponse.json(
      { success: false, error: 'Error loading dashboard statistics' },
      { status: 500 }
    )
  }
}