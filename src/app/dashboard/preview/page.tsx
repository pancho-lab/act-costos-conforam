'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle, AlertTriangle, Loader2, Trash2 } from 'lucide-react'

interface DraftChange {
  id: string
  sessionId: string
  entityType: string
  entityId: number
  fieldName: string
  currentValue?: number | null
  newValue: number
  entityName: string
  currency?: string
  createdAt?: string
  updatedAt?: string
  timestamp?: string
  affectedProducts?: Array<{
    id: number
    name: string
    currentCost: number
    newCost: number
  }>
}

export default function PreviewPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [productChanges, setProductChanges] = useState<DraftChange[]>([])
  const [categoryChanges, setCategoryChanges] = useState<DraftChange[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [testingDryRun, setTestingDryRun] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    const loadDraftChanges = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Load product changes
        const productResponse = await fetch('/api/draft-changes')
        const productData = await productResponse.json()
        
        // Load category changes
        const categoryResponse = await fetch('/api/draft-category-changes')
        const categoryData = await categoryResponse.json()
        
        if (productData.success) {
          setProductChanges(productData.changes || [])
        }
        
        if (categoryData.success) {
          setCategoryChanges(categoryData.changes || [])
        }
        
        console.log(`📂 Loaded ${productData.changes?.length || 0} product changes and ${categoryData.changes?.length || 0} category changes`)
        
      } catch (error) {
        console.error('Error loading draft changes:', error)
        setError(error instanceof Error ? error.message : 'Error loading changes')
      } finally {
        setLoading(false)
      }
    }
    
    if (session) {
      loadDraftChanges()
    }
  }, [session])

  const totalChanges = productChanges.length + categoryChanges.length
  const totalAffectedProducts = productChanges.length + categoryChanges.reduce((sum, change) => sum + (change.affectedProducts?.length || 0), 0)
  
  const handleExecuteChanges = async () => {
    if (totalChanges === 0) return
    
    setExecuting(true)
    setError(null)
    
    try {
      console.log('🚀 Executing batch update for', totalAffectedProducts, 'product updates')
      
      const response = await fetch('/api/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dryRun: false
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to execute batch update')
      }
      
      const { summary } = result
      console.log('✅ Batch update completed:', summary)
      
      if (summary.errors > 0) {
        setError(`Actualización completada con ${summary.errors} errores de ${summary.total} productos`)
      } else {
        // Redirect to dashboard with success message
        router.push('/dashboard?success=batch-update&count=' + summary.success)
      }
      
    } catch (error) {
      console.error('❌ Error executing changes:', error)
      setError(error instanceof Error ? error.message : 'Error ejecutando cambios')
    } finally {
      setExecuting(false)
    }
  }

  const handleDryRun = async () => {
    if (totalChanges === 0) return
    
    setTestingDryRun(true)
    setError(null)
    
    try {
      console.log('🧪 Testing dry run for', totalAffectedProducts, 'product updates')
      
      const response = await fetch('/api/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dryRun: true
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to test batch update')
      }
      
      const { summary } = result
      console.log('✅ Dry run completed:', summary)
      
      if (summary.errors > 0) {
        setError(`Prueba completada: ${summary.errors} errores detectados de ${summary.total} productos. Revise la configuración antes de ejecutar.`)
      } else {
        // Show success message without clearing changes
        alert(`✅ Prueba exitosa: Todos los ${summary.success} productos se pueden actualizar correctamente.`)
      }
      
    } catch (error) {
      console.error('❌ Error in dry run:', error)
      setError(error instanceof Error ? error.message : 'Error en la prueba')
    } finally {
      setTestingDryRun(false)
    }
  }

  const handleClearChanges = async () => {
    if (!confirm('¿Está seguro que desea descartar todos los cambios pendientes?')) {
      return
    }
    
    try {
      // Clear both product and category changes
      await Promise.all([
        fetch('/api/draft-changes?clearAll=true', { method: 'DELETE' }),
        fetch('/api/draft-category-changes?clearAll=true', { method: 'DELETE' })
      ])
      
      router.push('/dashboard')
    } catch (error) {
      console.error('Error clearing changes:', error)
      setError('Error al descartar cambios')
    }
  }

  const handleRemoveProductChange = async (changeId: string) => {
    if (!confirm('¿Está seguro que desea descartar este cambio?')) {
      return
    }
    
    try {
      await fetch(`/api/draft-changes?id=${changeId}`, {
        method: 'DELETE'
      })
      
      // Remove from local state
      setProductChanges(prev => prev.filter(change => change.id !== changeId))
      
      console.log(`🗑️ Removed product change: ${changeId}`)
    } catch (error) {
      console.error('Error removing product change:', error)
      setError('Error al descartar el cambio de producto')
    }
  }

  const handleRemoveCategoryChange = async (changeId: string) => {
    if (!confirm('¿Está seguro que desea descartar este cambio?')) {
      return
    }
    
    try {
      const categoryId = changeId.split(':category:')[1]
      await fetch(`/api/draft-category-changes?categoryId=${categoryId}`, {
        method: 'DELETE'
      })
      
      // Remove from local state
      setCategoryChanges(prev => prev.filter(change => change.id !== changeId))
      
      console.log(`🗑️ Removed category change: ${changeId}`)
    } catch (error) {
      console.error('Error removing category change:', error)
      setError('Error al descartar el cambio de categoría')
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando cambios pendientes...</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const totalCostChange = productChanges.reduce((sum, change) => {
    const currentValue = change.currentValue || 0
    const newValue = change.newValue || 0
    return sum + (newValue - currentValue)
  }, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </div>
          
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Vista Previa de Cambios
              </h1>
              <p className="mt-2 text-gray-600">
                Revise todos los cambios antes de aplicarlos a Odoo
              </p>
            </div>
            
            <div className="flex space-x-3">
              <Button
                onClick={handleClearChanges}
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Descartar Todo
              </Button>
              <Button
                onClick={handleDryRun}
                disabled={totalChanges === 0 || executing || testingDryRun}
                variant="outline"
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                {testingDryRun ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Probando...
                  </>
                ) : (
                  <>
                    🧪 Probar Actualización
                  </>
                )}
              </Button>
              <Button
                onClick={handleExecuteChanges}
                disabled={totalChanges === 0 || executing || testingDryRun}
                className="bg-green-600 hover:bg-green-700"
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Aplicando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Aplicar Cambios ({totalAffectedProducts} productos)
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertTriangle className="h-5 w-5 text-red-400 mr-3 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Error</h4>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {totalChanges}
                </div>
                <div className="text-sm text-gray-600">
                  Cambios pendientes
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {productChanges.length}
                </div>
                <div className="text-sm text-gray-600">
                  Productos directos
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {categoryChanges.length}
                </div>
                <div className="text-sm text-gray-600">
                  Categorías
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {totalAffectedProducts}
                </div>
                <div className="text-sm text-gray-600">
                  Total productos
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  +${totalCostChange.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">
                  Cambio total en costos
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  ARS
                </div>
                <div className="text-sm text-gray-600">
                  Moneda
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Changes Table */}
        <div className="space-y-6">
          {totalChanges === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No hay cambios pendientes</p>
                  <Button 
                    onClick={() => router.push('/dashboard')}
                    variant="outline"
                    className="mt-4"
                  >
                    Volver al Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Product Changes */}
              {productChanges.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>🛍️ Cambios Directos de Productos ({productChanges.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Producto
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Costo Actual
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Nuevo Costo
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Diferencia
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Fecha
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {productChanges.map((change) => {
                            const currentValue = change.currentValue || 0
                            const difference = change.newValue - currentValue
                            const isIncrease = difference > 0
                            
                            return (
                              <tr key={change.id}>
                                <td className="px-4 py-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {change.entityName}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    ID: {change.entityId}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm text-gray-900">
                                    ${currentValue.toFixed(2)}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm font-medium text-green-600">
                                    ${change.newValue.toFixed(2)}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className={`text-sm font-medium ${
                                    isIncrease ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'
                                  }`}>
                                    {isIncrease ? '+' : ''}${difference.toFixed(2)}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="text-sm text-gray-500">
                                    {new Date(change.updatedAt || change.timestamp || Date.now()).toLocaleString('es-AR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <Button
                                    onClick={() => handleRemoveProductChange(change.id)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Category Changes */}
              {categoryChanges.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>📁 Cambios por Categoría ({categoryChanges.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {categoryChanges.map((change) => (
                        <div key={change.id} className="border border-orange-200 rounded-lg p-4 bg-orange-50">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h3 className="text-lg font-medium text-gray-900">
                                📁 {change.entityName}
                              </h3>
                              <div className="text-sm text-gray-600 mt-1">
                                Nuevo costo base: <span className="font-medium text-orange-600">${change.newValue.toFixed(2)}</span>
                              </div>
                              <div className="text-sm text-gray-500">
                                Afectará {change.affectedProducts?.length || 0} productos
                              </div>
                            </div>
                            <Button
                              onClick={() => handleRemoveCategoryChange(change.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          {change.affectedProducts && change.affectedProducts.length > 0 && (
                            <div className="border-t border-orange-200 pt-3 mt-3">
                              <h4 className="text-sm font-medium text-gray-700 mb-2">
                                Productos que se actualizarán:
                              </h4>
                              <div className="max-h-40 overflow-y-auto">
                                <div className="grid grid-cols-1 gap-1 text-xs">
                                  {change.affectedProducts.slice(0, 10).map((product) => (
                                    <div key={product.id} className="flex justify-between items-center py-1 px-2 bg-white rounded border">
                                      <span className="text-gray-900 truncate">
                                        {product.name}
                                      </span>
                                      <span className="text-gray-600 ml-2 flex-shrink-0">
                                        ${product.currentCost.toFixed(2)} → <span className="text-orange-600">${product.newCost.toFixed(2)}</span>
                                      </span>
                                    </div>
                                  ))}
                                  {change.affectedProducts.length > 10 && (
                                    <div className="text-gray-500 text-center py-1">
                                      +{change.affectedProducts.length - 10} productos más...
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        {/* Warning and Help */}
        {totalChanges > 0 && (
          <div className="mt-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="text-blue-400 mr-3 mt-0.5">💡</div>
                <div>
                  <h4 className="text-sm font-medium text-blue-800">
                    Recomendación: Use "Probar Actualización" primero
                  </h4>
                  <p className="text-sm text-blue-700 mt-1">
                    La función de prueba valida que todos los cambios se puedan aplicar correctamente 
                    sin modificar Odoo, permitiendo detectar posibles problemas antes de la ejecución final.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">
                    ⚠️ Confirmación requerida
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Una vez aplicados, estos cambios se guardarán permanentemente en Odoo. 
                    Asegúrese de revisar todos los valores antes de continuar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}