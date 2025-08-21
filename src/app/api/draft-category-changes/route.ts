import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getOdooClient } from '@/lib/odoo-simple'

// Temporary in-memory storage for draft category changes
const globalForDrafts = globalThis as unknown as {
  categoryDraftChanges: Map<string, any> | undefined
}

const categoryDraftChangesStorage = globalForDrafts.categoryDraftChanges ?? new Map()
if (process.env.NODE_ENV !== 'production') globalForDrafts.categoryDraftChanges = categoryDraftChangesStorage

// GET - Get all draft category changes for the session
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const sessionId = session.user.email
    const changes = []

    for (const [key, value] of categoryDraftChangesStorage.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        changes.push(value)
      }
    }

    console.log(`📂 Retrieved ${changes.length} draft category changes for session: ${sessionId}`)

    return NextResponse.json({
      success: true,
      changes
    })

  } catch (error) {
    console.error('❌ Error retrieving draft category changes:', error)
    return NextResponse.json(
      { success: false, error: 'Error retrieving draft changes' },
      { status: 500 }
    )
  }
}

// POST - Save or update a draft category change
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { categoryId, categoryName, newValue } = await request.json()

    if (!categoryId || newValue === undefined || newValue === null) {
      return NextResponse.json(
        { success: false, error: 'categoryId and newValue are required' },
        { status: 400 }
      )
    }

    const sessionId = session.user.email
    
    // Get current category data from Odoo to have baseline
    const odooClient = getOdooClient()
    await odooClient.auth()
    
    const categoryData = await odooClient.searchRead(
      'product.category',
      [['id', '=', categoryId]],
      ['id', 'name'],
      { limit: 1 }
    )

    if (!categoryData || categoryData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Category not found in Odoo' },
        { status: 404 }
      )
    }

    const category = categoryData[0]
    
    // Get all products in this category
    const productsInCategory = await odooClient.searchRead(
      'product.template',
      [['active', '=', true], ['type', '=', 'product'], ['categ_id', '=', categoryId]],
      ['id', 'name', 'standard_price'],
      { limit: 1000, order: 'id asc' }
    )

    console.log(`📂 Found ${productsInCategory.length} products in category ${categoryName} (${categoryId})`)

    const changeId = `${sessionId}:category:${categoryId}`
    
    const change = {
      id: changeId,
      entityType: 'category',
      entityId: categoryId,
      entityName: categoryName || category.name,
      fieldName: 'base_cost',
      newValue: parseFloat(newValue),
      timestamp: new Date().toISOString(),
      sessionId,
      affectedProducts: productsInCategory.map(p => ({
        id: p.id,
        name: p.name,
        currentCost: p.standard_price || 0,
        newCost: parseFloat(newValue)
      }))
    }

    categoryDraftChangesStorage.set(changeId, change)

    console.log(`💾 Saved draft category change: ${categoryName} (${categoryId}) → $${newValue}, affecting ${productsInCategory.length} products`)

    return NextResponse.json({
      success: true,
      change,
      affectedProductsCount: productsInCategory.length
    })

  } catch (error) {
    console.error('❌ Error saving draft category change:', error)
    return NextResponse.json(
      { success: false, error: 'Error saving draft change' },
      { status: 500 }
    )
  }
}

// DELETE - Remove a draft category change or clear all
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')
    const clearAll = searchParams.get('clearAll')

    const sessionId = session.user.email

    if (clearAll === 'true') {
      // Clear all category changes for this session
      let deletedCount = 0
      for (const [key] of categoryDraftChangesStorage.entries()) {
        if (key.startsWith(`${sessionId}:`)) {
          categoryDraftChangesStorage.delete(key)
          deletedCount++
        }
      }

      console.log(`🗑️ Cleared ${deletedCount} draft category changes for session: ${sessionId}`)

      return NextResponse.json({
        success: true,
        deletedCount
      })
    }

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId parameter is required' },
        { status: 400 }
      )
    }

    const changeId = `${sessionId}:category:${categoryId}`

    const deleted = categoryDraftChangesStorage.delete(changeId)

    if (deleted) {
      console.log(`🗑️ Removed draft category change: ${categoryId}`)
    } else {
      console.log(`⚠️ No draft change found for category: ${categoryId}`)
    }

    return NextResponse.json({
      success: true,
      deleted
    })

  } catch (error) {
    console.error('❌ Error removing draft category change:', error)
    return NextResponse.json(
      { success: false, error: 'Error removing draft change' },
      { status: 500 }
    )
  }
}