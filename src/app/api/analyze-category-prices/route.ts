import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getOdooClient } from '@/lib/odoo-simple'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { categoryId } = await request.json()

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId is required' },
        { status: 400 }
      )
    }

    const odooClient = getOdooClient()
    await odooClient.auth()

    // Get all products in this category
    const productsInCategory = await odooClient.searchRead(
      'product.template',
      [['active', '=', true], ['type', '=', 'product'], ['categ_id', '=', categoryId]],
      ['id', 'name', 'standard_price'],
      { limit: 1000, order: 'id asc' }
    )

    console.log(`🔍 Analyzing ${productsInCategory.length} products in category ${categoryId}`)

    if (productsInCategory.length === 0) {
      return NextResponse.json({
        success: true,
        analysis: {
          hasProducts: false,
          uniformPrice: null,
          priceConsistency: 'no_products',
          message: 'No hay productos en esta categoría',
          productCount: 0,
          uniquePrices: []
        }
      })
    }

    // Extract unique prices (filtering out null/undefined/0)
    const validPrices = productsInCategory
      .map(p => p.standard_price)
      .filter(price => price != null && price > 0)

    const uniquePrices = [...new Set(validPrices)]
    
    console.log(`💰 Found ${uniquePrices.length} unique prices in ${productsInCategory.length} products:`, uniquePrices)

    let analysis
    
    if (validPrices.length === 0) {
      // All products have zero or null cost
      analysis = {
        hasProducts: true,
        uniformPrice: null,
        priceConsistency: 'all_zero',
        message: 'Todos los productos tienen costo $0 o nulo',
        productCount: productsInCategory.length,
        uniquePrices: [0],
        suggestedAction: 'set_base_cost'
      }
    } else if (uniquePrices.length === 1) {
      // All products have the same price
      const uniformPrice = uniquePrices[0]
      analysis = {
        hasProducts: true,
        uniformPrice,
        priceConsistency: 'uniform',
        message: `Todos los productos tienen el mismo costo: $${uniformPrice.toFixed(2)}`,
        productCount: productsInCategory.length,
        uniquePrices,
        suggestedAction: 'auto_fill'
      }
    } else {
      // Mixed prices
      const minPrice = Math.min(...validPrices)
      const maxPrice = Math.max(...validPrices)
      analysis = {
        hasProducts: true,
        uniformPrice: null,
        priceConsistency: 'mixed',
        message: `Precios variados: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)} (${uniquePrices.length} precios únicos)`,
        productCount: productsInCategory.length,
        uniquePrices: uniquePrices.sort((a, b) => a - b),
        suggestedAction: 'manual_decision'
      }
    }

    // Save analysis to database
    const companyId = 1 // Default company ID - you might want to get this from session
    
    try {
      await prisma.categoryPriceAnalysis.upsert({
        where: {
          categoryId_companyId: {
            categoryId: categoryId,
            companyId: companyId
          }
        },
        update: {
          hasProducts: analysis.hasProducts,
          productsCount: analysis.productCount,
          uniformPrice: analysis.uniformPrice,
          priceConsistency: analysis.priceConsistency,
          message: analysis.message,
          suggestedAction: analysis.suggestedAction,
          updatedAt: new Date()
        },
        create: {
          categoryId: categoryId,
          companyId: companyId,
          hasProducts: analysis.hasProducts,
          productsCount: analysis.productCount,
          uniformPrice: analysis.uniformPrice,
          priceConsistency: analysis.priceConsistency,
          message: analysis.message,
          suggestedAction: analysis.suggestedAction
        }
      })
      
      console.log(`💾 Saved price analysis for category ${categoryId}: ${analysis.priceConsistency}`)
    } catch (dbError) {
      console.error('❌ Error saving price analysis to database:', dbError)
      // Continue anyway - don't fail the request if DB save fails
    }

    return NextResponse.json({
      success: true,
      analysis
    })

  } catch (error) {
    console.error('❌ Error analyzing category prices:', error)
    return NextResponse.json(
      { success: false, error: 'Error analyzing category prices' },
      { status: 500 }
    )
  }
}