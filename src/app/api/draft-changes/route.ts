import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

// Temporary in-memory storage for draft changes
// TODO: Replace with proper Prisma integration later
const globalForDrafts = globalThis as unknown as {
  draftChanges: Map<string, any> | undefined
}

const draftChangesStorage = globalForDrafts.draftChanges ?? new Map()

if (process.env.NODE_ENV !== 'production') globalForDrafts.draftChanges = draftChangesStorage

// GET - Obtener todos los draft changes para una sesión
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const sessionId = session.user.email // Usar email como session identifier

    // Get all changes for this session from memory
    const sessionChanges = []
    for (const [key, value] of draftChangesStorage.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        sessionChanges.push(value)
      }
    }

    return NextResponse.json({
      success: true,
      changes: sessionChanges,
      count: sessionChanges.length
    })

  } catch (error) {
    console.error('❌ Error loading draft changes:', error)
    return NextResponse.json(
      { success: false, error: 'Error loading draft changes' },
      { status: 500 }
    )
  }
}

// POST - Crear o actualizar un draft change
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { entityType, entityId, fieldName, currentValue, newValue, entityName } = await request.json()

    if (!entityType || !entityId || !fieldName || newValue === undefined || !entityName) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const sessionId = session.user.email

    // Create unique key for this change
    const changeKey = `${sessionId}:${entityType}:${parseInt(entityId)}:${fieldName}`
    
    // Create/update the draft change in memory
    const draftChange = {
      id: changeKey,
      sessionId,
      entityType,
      entityId: parseInt(entityId),
      fieldName,
      currentValue: currentValue ? parseFloat(currentValue) : null,
      newValue: parseFloat(newValue),
      entityName,
      currency: 'ARS',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Store in memory
    draftChangesStorage.set(changeKey, draftChange)

    console.log(`📝 Draft change saved: ${entityType} ${entityId} (${entityName}) ${currentValue} → ${newValue}`)

    return NextResponse.json({
      success: true,
      change: draftChange
    })

  } catch (error) {
    console.error('❌ Error saving draft change:', error)
    return NextResponse.json(
      { success: false, error: 'Error saving draft change' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar draft changes
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
    const changeId = searchParams.get('id')
    const clearAll = searchParams.get('clearAll') === 'true'

    const sessionId = session.user.email

    if (clearAll) {
      // Eliminar todos los draft changes de la sesión
      let deletedCount = 0
      for (const [key] of draftChangesStorage.entries()) {
        if (key.startsWith(`${sessionId}:`)) {
          draftChangesStorage.delete(key)
          deletedCount++
        }
      }

      console.log(`🗑️ Cleared ${deletedCount} draft changes for session ${sessionId}`)

      return NextResponse.json({
        success: true,
        deletedCount
      })
    } else if (changeId) {
      // Eliminar un draft change específico
      const deleted = draftChangesStorage.delete(changeId)

      console.log(`🗑️ Deleted draft change ${changeId}`)

      return NextResponse.json({
        success: true,
        deletedId: changeId
      })
    } else {
      return NextResponse.json(
        { success: false, error: 'Missing id or clearAll parameter' },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('❌ Error deleting draft changes:', error)
    return NextResponse.json(
      { success: false, error: 'Error deleting draft changes' },
      { status: 500 }
    )
  }
}