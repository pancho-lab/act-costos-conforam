import { NextRequest, NextResponse } from 'next/server'
import { getOdooClient } from '@/lib/odoo-simple'

export async function POST(request: NextRequest) {
  try {
    const { productId, cost } = await request.json()
    
    if (!productId || cost === undefined) {
      return NextResponse.json(
        { success: false, error: 'Product ID and cost are required' },
        { status: 400 }
      )
    }
    
    console.log(`🔄 API: Updating cost for product ${productId} to $${cost}`)
    
    const odooClient = getOdooClient()
    
    // Update the standard_price in Odoo
    const result = await odooClient.updateProduct(productId, {
      standard_price: parseFloat(cost)
    })
    
    if (result) {
      console.log(`✅ API: Successfully updated product ${productId} cost to $${cost}`)
      return NextResponse.json({
        success: true,
        message: `Product cost updated successfully`
      })
    } else {
      throw new Error('Failed to update product in Odoo')
    }
    
  } catch (error) {
    console.error('❌ API Error updating product cost:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error updating product cost' 
      },
      { status: 500 }
    )
  }
}