import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getOdooClient } from '@/lib/odoo-simple'

// Temporary in-memory storage for draft changes
const globalForDrafts = globalThis as unknown as {
  draftChanges: Map<string, any> | undefined
  categoryDraftChanges: Map<string, any> | undefined
}

const draftChangesStorage = globalForDrafts.draftChanges ?? new Map()
const categoryDraftChangesStorage = globalForDrafts.categoryDraftChanges ?? new Map()
if (process.env.NODE_ENV !== 'production') {
  globalForDrafts.draftChanges = draftChangesStorage
  globalForDrafts.categoryDraftChanges = categoryDraftChangesStorage
}

// POST - Execute batch update of all pending changes
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { dryRun = false } = await request.json()
    const sessionId = session.user.email

    // Get all changes for this session (both product and category changes)
    const sessionChanges = []
    
    // Get product changes
    for (const [key, value] of draftChangesStorage.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        sessionChanges.push(value)
      }
    }
    
    // Get category changes
    for (const [key, value] of categoryDraftChangesStorage.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        sessionChanges.push(value)
      }
    }

    if (sessionChanges.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes to process',
        results: []
      })
    }

    console.log(`🔄 Starting batch update: ${sessionChanges.length} changes (dryRun: ${dryRun})`)

    // Initialize Odoo client
    const odooClient = getOdooClient()

    await odooClient.auth()

    const results = []
    let successCount = 0
    let errorCount = 0

    // Process changes in batches
    const BATCH_SIZE = 10
    for (let i = 0; i < sessionChanges.length; i += BATCH_SIZE) {
      const batch = sessionChanges.slice(i, i + BATCH_SIZE)
      
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(sessionChanges.length / BATCH_SIZE)}`)

      for (const change of batch) {
        try {
          const startTime = Date.now()
          
          if (change.entityType === 'product') {
            // Update product cost in Odoo
            if (!dryRun) {
              const success = await odooClient.updateProduct(change.entityId, {
                standard_price: change.newValue
              })
              
              if (!success) {
                throw new Error('Odoo update returned false')
              }
            }

            const result = {
              id: change.id,
              entityType: change.entityType,
              entityId: change.entityId,
              entityName: change.entityName,
              fieldName: change.fieldName,
              currentValue: change.currentValue,
              newValue: change.newValue,
              success: true,
              dryRun,
              duration: Date.now() - startTime,
              error: null
            }

            results.push(result)
            successCount++

            console.log(`✅ ${dryRun ? '[DRY RUN] ' : ''}Updated ${change.entityName} (${change.entityId}): ${change.currentValue} → ${change.newValue}`)

          } else if (change.entityType === 'category') {
            // Update all affected products in this category
            const affectedProducts = change.affectedProducts || []
            
            console.log(`📁 ${dryRun ? '[DRY RUN] ' : ''}Processing category change: ${change.entityName} → $${change.newValue}, affecting ${affectedProducts.length} products`)
            
            for (const product of affectedProducts) {
              if (!dryRun) {
                const success = await odooClient.updateProduct(product.id, {
                  standard_price: change.newValue
                })
                
                if (!success) {
                  throw new Error(`Failed to update product ${product.name} (${product.id})`)
                }
              }
              
              const productResult = {
                id: `${change.id}:product:${product.id}`,
                entityType: 'product',
                entityId: product.id,
                entityName: product.name,
                fieldName: 'standard_price',
                currentValue: product.currentCost,
                newValue: change.newValue,
                success: true,
                dryRun,
                duration: Date.now() - startTime,
                error: null,
                categoryChange: change.entityName
              }
              
              results.push(productResult)
              successCount++
              
              console.log(`✅ ${dryRun ? '[DRY RUN] ' : ''}Updated product ${product.name} (${product.id}) via category: ${product.currentCost} → ${change.newValue}`)
            }

          } else {
            throw new Error(`Unsupported entity type: ${change.entityType}`)
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          
          const result = {
            id: change.id,
            entityType: change.entityType,
            entityId: change.entityId,
            entityName: change.entityName,
            fieldName: change.fieldName,
            currentValue: change.currentValue,
            newValue: change.newValue,
            success: false,
            dryRun,
            duration: Date.now() - Date.now(),
            error: errorMessage
          }

          results.push(result)
          errorCount++

          console.error(`❌ ${dryRun ? '[DRY RUN] ' : ''}Failed to update ${change.entityName} (${change.entityId}): ${errorMessage}`)
        }
      }

      // Small delay between batches to avoid overwhelming Odoo
      if (i + BATCH_SIZE < sessionChanges.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Clear draft changes only if not dry run and no errors
    if (!dryRun && errorCount === 0) {
      // Clear product changes
      for (const [key] of draftChangesStorage.entries()) {
        if (key.startsWith(`${sessionId}:`)) {
          draftChangesStorage.delete(key)
        }
      }
      
      // Clear category changes
      for (const [key] of categoryDraftChangesStorage.entries()) {
        if (key.startsWith(`${sessionId}:`)) {
          categoryDraftChangesStorage.delete(key)
        }
      }
      
      console.log(`🗑️ Cleared ${sessionChanges.length} draft changes after successful batch update`)
    }

    const summary = {
      total: sessionChanges.length,
      success: successCount,
      errors: errorCount,
      dryRun,
      executedBy: session.user.email,
      executedAt: new Date().toISOString()
    }

    console.log(`📊 Batch update completed:`, summary)

    return NextResponse.json({
      success: true,
      summary,
      results
    })

  } catch (error) {
    console.error('❌ Error in batch update:', error)
    return NextResponse.json(
      { success: false, error: 'Error executing batch update' },
      { status: 500 }
    )
  }
}