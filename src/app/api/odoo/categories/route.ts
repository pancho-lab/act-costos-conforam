import { NextRequest, NextResponse } from 'next/server'
import { getOdooClient } from '@/lib/odoo-simple'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const search = searchParams.get('search')
    const priceFilter = searchParams.get('priceFilter') || 'all'
    
    console.log('🔄 API: Loading categories from Odoo...')
    console.log('Filters:', { limit, offset, search, priceFilter })
    
    const odooClient = getOdooClient()
    
    // Build domain for search
    let domain: any[] = []
    if (search && search.trim()) {
      domain.push(['name', 'ilike', search.trim()])
    }
    
    // Determine if we need to load all categories first (for price filtering)
    const needsFullLoad = priceFilter !== 'all'
    let odooCategories: any[] = []
    let totalCount = 0
    
    if (needsFullLoad) {
      // Load ALL categories first for filtering
      console.log('🔍 Loading all categories for price filtering...')
      const allResult = await odooClient.searchRead('product.category', domain, ['id', 'name', 'parent_id'], { limit: 2000, offset: 0, order: 'name asc' })
      
      const allOdooCategories = allResult.map(cat => ({
        id: cat.id,
        name: cat.name,
        parent_id: Array.isArray(cat.parent_id) ? cat.parent_id[0] : cat.parent_id || null,
        parent_name: Array.isArray(cat.parent_id) ? cat.parent_id[1] : null
      }))
      
      // Get ALL saved analysis for filtering
      const companyId = 1
      const allCategoryIds = allOdooCategories.map(cat => cat.id)
      
      const allSavedAnalysis = await prisma.categoryPriceAnalysis.findMany({
        where: {
          categoryId: { in: allCategoryIds },
          companyId: companyId
        }
      })
      
      const allAnalysisMap = new Map(
        allSavedAnalysis.map(analysis => [analysis.categoryId, analysis])
      )
      
      // Add product count and analysis to categories for filtering
      const categoriesWithData = await Promise.all(
        allOdooCategories.map(async (cat) => {
          const productCount = await odooClient.searchCount(
            'product.template',
            [['active', '=', true], ['type', '=', 'product'], ['categ_id', '=', cat.id]]
          )
          
          const analysis = allAnalysisMap.get(cat.id)
          
          return {
            ...cat,
            products_count: productCount,
            price_analysis: analysis ? {
              hasProducts: analysis.hasProducts,
              uniformPrice: analysis.uniformPrice ? Number(analysis.uniformPrice) : null,
              priceConsistency: analysis.priceConsistency,
              message: analysis.message,
              suggestedAction: analysis.suggestedAction,
              productCount: analysis.productsCount,
              analyzedAt: analysis.analyzedAt
            } : null
          }
        })
      )
      
      // Apply price filter
      const filteredCategories = categoriesWithData.filter(category => {
        if (priceFilter === 'with_products') return (category.products_count || 0) > 0
        
        const analysis = category.price_analysis
        if (!analysis) {
          if (priceFilter === 'no_cost') return true
          return false
        }
        
        switch (priceFilter) {
          case 'uniform':
            return analysis.priceConsistency === 'uniform'
          case 'mixed':
            return analysis.priceConsistency === 'mixed'
          case 'no_cost':
            return analysis.priceConsistency === 'all_zero' || analysis.priceConsistency === 'no_products'
          default:
            return true
        }
      })
      
      // Apply pagination to filtered results
      totalCount = filteredCategories.length
      const startIndex = offset
      const endIndex = Math.min(startIndex + limit, filteredCategories.length)
      odooCategories = filteredCategories.slice(startIndex, endIndex)
      
      console.log(`📂 API: Filtered ${filteredCategories.length} categories, showing ${odooCategories.length} (${startIndex + 1}-${endIndex})`)
      
    } else {
      // Normal pagination without filtering
      const result = await odooClient.searchRead('product.category', domain, ['id', 'name', 'parent_id'], { limit, offset, order: 'name asc' })
      
      odooCategories = result.map(cat => ({
        id: cat.id,
        name: cat.name,
        parent_id: Array.isArray(cat.parent_id) ? cat.parent_id[0] : cat.parent_id || null,
        parent_name: Array.isArray(cat.parent_id) ? cat.parent_id[1] : null
      }))
      
      totalCount = await odooClient.searchCount('product.category', domain)
      
      console.log(`📂 API: Loaded ${odooCategories.length} categories of ${totalCount} total`)
    }
    
    // Get saved price analysis from database for current page
    const companyId = 1 // Default company ID
    const categoryIds = odooCategories.map(cat => cat.id)
    
    const savedAnalysis = await prisma.categoryPriceAnalysis.findMany({
      where: {
        categoryId: { in: categoryIds },
        companyId: companyId
      }
    })
    
    // Create a map for quick lookup
    const analysisMap = new Map(
      savedAnalysis.map(analysis => [analysis.categoryId, analysis])
    )
    
    // Convert to final format
    const formattedCategories = await Promise.all(
      odooCategories.map(async (cat) => {
        // For filtered results, we might already have product count
        const productCount = cat.products_count !== undefined 
          ? cat.products_count 
          : await odooClient.searchCount(
              'product.template',
              [['active', '=', true], ['type', '=', 'product'], ['categ_id', '=', cat.id]]
            )
        
        // Get saved analysis for this category (might already be included for filtered results)
        const analysis = cat.price_analysis || (analysisMap.get(cat.id) ? {
          hasProducts: analysisMap.get(cat.id)!.hasProducts,
          uniformPrice: analysisMap.get(cat.id)!.uniformPrice ? Number(analysisMap.get(cat.id)!.uniformPrice) : null,
          priceConsistency: analysisMap.get(cat.id)!.priceConsistency,
          message: analysisMap.get(cat.id)!.message,
          suggestedAction: analysisMap.get(cat.id)!.suggestedAction,
          productCount: analysisMap.get(cat.id)!.productsCount,
          analyzedAt: analysisMap.get(cat.id)!.analyzedAt
        } : null)
        
        const result = {
          id: cat.id,
          name: cat.name,
          parent_name: cat.parent_name,
          current_cost: 0, // Default cost
          products_count: productCount
        }
        
        // Add price analysis if available
        if (analysis) {
          (result as any).price_analysis = analysis
        }
        
        return result
      })
    )
    
    return NextResponse.json({
      success: true,
      categories: formattedCategories,
      total: totalCount
    })
  } catch (error) {
    console.error('❌ API Error loading categories:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error loading categories' 
      },
      { status: 500 }
    )
  }
}