import { NextRequest, NextResponse } from 'next/server'
import { getOdooClient } from '@/lib/odoo-simple'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100')
    const offset = parseInt(searchParams.get('offset') || '0')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')
    
    console.log('🔄 API: Loading products from Odoo...')
    console.log('Filters:', { limit, offset, categoryId, search })
    
    const odooClient = getOdooClient()
    
    // Build domain based on filters
    let domain: any[] = []
    
    if (categoryId && categoryId !== 'all') {
      domain.push(['categ_id', '=', parseInt(categoryId)])
    }
    
    if (search && search.trim()) {
      domain.push(['name', 'ilike', search.trim()])
    }
    
    const odooProducts = await odooClient.getProducts(domain, limit, offset)
    
    // Get total count for pagination - only storable products
    const baseDomain = [['active', '=', true], ['type', '=', 'product']]
    const totalCount = await odooClient.searchCount('product.template', domain.length > 0 ? [...baseDomain, ...domain] : baseDomain)
    
    console.log(`📦 API: Loaded ${odooProducts.length} products of ${totalCount} total`)
    
    // Convert Odoo products to our interface
    const formattedProducts = odooProducts.map(prod => ({
      id: prod.id,
      name: prod.name,
      default_code: prod.default_code,
      categ_id: prod.categ_id,
      categ_name: prod.categ_name,
      standard_price: prod.standard_price,
      current_cost: prod.standard_price, // Current cost from Odoo
      updated_cost: null, // Will be set when user edits
      has_override: false // Will be checked against local DB later
    }))
    
    return NextResponse.json({
      success: true,
      products: formattedProducts,
      total: totalCount
    })
  } catch (error) {
    console.error('❌ API Error loading products:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error loading products' 
      },
      { status: 500 }
    )
  }
}