'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

interface Category {
  id: number
  name: string
  parent_name?: string
  current_cost?: number
  updated_cost?: number
  products_count?: number
  has_override?: boolean
  price_analysis?: {
    hasProducts: boolean
    uniformPrice: number | null
    priceConsistency: 'uniform' | 'mixed' | 'all_zero' | 'no_products'
    message: string
    productCount: number
    uniquePrices: number[]
    suggestedAction?: 'auto_fill' | 'set_base_cost' | 'manual_decision'
  }
}

export default function CategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [draftChanges, setDraftChanges] = useState<{ [key: number]: number }>({})
  const [editingInputs, setEditingInputs] = useState<{ [key: number]: string }>({})
  const [savingCosts, setSavingCosts] = useState<{ [key: number]: boolean }>({})
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCategories, setTotalCategories] = useState(0)
  const [categoriesPerPage] = useState(50) // Items por página
  const [analyzingPrices, setAnalyzingPrices] = useState<{ [key: number]: boolean }>({})
  const [priceFilter, setPriceFilter] = useState<'all' | 'uniform' | 'mixed' | 'no_cost' | 'with_products'>('all')

  // Load draft changes from API
  const loadDraftChanges = async () => {
    try {
      const response = await fetch('/api/draft-category-changes')
      const data = await response.json()
      
      if (data.success) {
        const draftMap: { [key: number]: number } = {}
        
        data.changes.forEach((change: any) => {
          if (change.entityType === 'category' && change.fieldName === 'base_cost') {
            draftMap[change.entityId] = parseFloat(change.newValue)
          }
        })
        
        setDraftChanges(draftMap)
        console.log(`📂 Loaded ${data.changes.length} draft category changes`)
      }
    } catch (error) {
      console.error('Error loading draft category changes:', error)
    }
  }

  // Analyze prices for a specific category
  const analyzeCategoryPrices = async (categoryId: number, isAutoUpdate = false) => {
    try {
      setAnalyzingPrices(prev => ({ ...prev, [categoryId]: true }))
      
      const response = await fetch('/api/analyze-category-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId })
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Update the category with analysis results
        setCategories(prev => prev.map(cat => 
          cat.id === categoryId 
            ? { ...cat, price_analysis: data.analysis }
            : cat
        ))
        
        // Auto-fill if all products have the same price
        if (data.analysis.suggestedAction === 'auto_fill' && data.analysis.uniformPrice) {
          const currentCategory = categories.find(c => c.id === categoryId)
          const currentCost = draftChanges[categoryId] !== undefined ? draftChanges[categoryId] : currentCategory?.current_cost || 0
          
          // Only auto-fill if the uniform price is different from current cost
          if (Math.abs(data.analysis.uniformPrice - currentCost) > 0.01) {
            if (isAutoUpdate) {
              // Durante actualización automática desde Odoo, establecer directamente sin draft
              setCategories(prev => prev.map(cat => 
                cat.id === categoryId 
                  ? { ...cat, current_cost: data.analysis.uniformPrice }
                  : cat
              ))
              console.log(`✅ Auto-set uniform cost for ${currentCategory?.name}: $${data.analysis.uniformPrice.toFixed(2)} (no draft)`)
            } else {
              // Durante edición manual, usar draft changes
              setEditingInputs(prev => ({
                ...prev,
                [categoryId]: data.analysis.uniformPrice.toFixed(2)
              }))
              
              // Automatically save the change
              await handleCostBlur(categoryId, data.analysis.uniformPrice.toFixed(2))
            }
          }
        }
        
        console.log(`🔍 Price analysis completed for category ${categoryId}:`, data.analysis)
      }
    } catch (error) {
      console.error('Error analyzing category prices:', error)
    } finally {
      setAnalyzingPrices(prev => ({ ...prev, [categoryId]: false }))
    }
  }

  // Load real data from Odoo via API
  const loadCategories = async () => {
    try {
      setLoadingData(true)
      setError(null)
      console.log('🔄 Loading categories from API...')
      
      const params = new URLSearchParams({
        limit: categoriesPerPage.toString(),
        offset: ((currentPage - 1) * categoriesPerPage).toString()
      })
      
      if (debouncedSearchTerm.trim()) {
        params.append('search', debouncedSearchTerm.trim())
      }
      
      if (priceFilter !== 'all') {
        params.append('priceFilter', priceFilter)
      }
      
      const response = await fetch(`/api/odoo/categories?${params}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load categories')
      }
      
      console.log('📂 Loaded categories:', data.categories)
      
      // Apply draft changes to categories
      const categoriesWithDrafts = data.categories.map((cat: Category) => ({
        ...cat,
        has_override: draftChanges[cat.id] !== undefined,
        current_cost: draftChanges[cat.id] !== undefined ? draftChanges[cat.id] : cat.current_cost
      }))
      
      setCategories(categoriesWithDrafts)
      setTotalCategories(data.total || data.categories.length)
      console.log('✅ Categories loaded successfully!')
    } catch (error) {
      console.error('❌ Error loading categories:', error)
      setError(error instanceof Error ? error.message : 'Error loading categories')
    } finally {
      setLoadingData(false)
    }
  }

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay
    
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [priceFilter, debouncedSearchTerm])

  useEffect(() => {
    if (session) {
      loadDraftChanges().then(() => {
        loadCategories()
      })
    }
  }, [session, debouncedSearchTerm, currentPage, categoriesPerPage, priceFilter])

  useEffect(() => {
    if (categories.length > 0) {
      // Re-apply draft changes when they change
      const updatedCategories = categories.map(cat => ({
        ...cat,
        has_override: draftChanges[cat.id] !== undefined,
        current_cost: draftChanges[cat.id] !== undefined ? draftChanges[cat.id] : (cat.current_cost || 0)
      }))
      setCategories(updatedCategories)
    }
  }, [draftChanges])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando categorías desde Odoo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ Error al cargar categorías</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  // No client-side filtering needed - API handles it

  const handleCostInputChange = (categoryId: number, value: string) => {
    setEditingInputs(prev => ({
      ...prev,
      [categoryId]: value
    }))
  }

  const handleCostFocus = (categoryId: number, currentCost: number) => {
    // Clear any existing editing input for this category to show current value
    setEditingInputs(prev => {
      const { [categoryId]: _, ...rest } = prev
      return rest
    })
  }

  const handleCostBlur = async (categoryId: number, value: string) => {
    const newCost = parseFloat(value) || 0
    const category = categories.find(c => c.id === categoryId)
    
    if (!category) {
      console.error('Category not found:', categoryId)
      return
    }

    const currentCost = draftChanges[categoryId] !== undefined ? draftChanges[categoryId] : category.current_cost || 0

    // Only save if the value actually changed
    if (Math.abs(newCost - currentCost) < 0.01) {
      // Remove from editing inputs since no change
      setEditingInputs(prev => {
        const { [categoryId]: _, ...rest } = prev
        return rest
      })
      return
    }

    try {
      setSavingCosts(prev => ({ ...prev, [categoryId]: true }))

      // Save to draft changes API
      const response = await fetch('/api/draft-category-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId,
          categoryName: category.name,
          newValue: newCost
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log(`💾 Saved draft category change: ${category.name} → $${newCost}, affecting ${data.affectedProductsCount} products`)
        
        // Update local state
        setDraftChanges(prev => ({ ...prev, [categoryId]: newCost }))
        
        // Clear editing input
        setEditingInputs(prev => {
          const { [categoryId]: _, ...rest } = prev
          return rest
        })
      } else {
        console.error('Failed to save draft category change')
      }
    } catch (error) {
      console.error('Error saving draft category change:', error)
    } finally {
      setSavingCosts(prev => ({ ...prev, [categoryId]: false }))
    }
  }

  const handleRefreshData = async () => {
    setRefreshing(true)
    setError(null)
    
    try {
      console.log('🔄 Refreshing categories from Odoo...')
      await loadDraftChanges()
      await loadCategories()
      console.log('✅ Categories refreshed successfully')
      
      // Auto-analyze prices for all categories with products
      console.log('🔍 Starting automatic price analysis...')
      await runAutomaticPriceAnalysis()
      console.log('✅ Automatic price analysis completed')
      
    } catch (error) {
      console.error('❌ Error refreshing categories:', error)
      setError(error instanceof Error ? error.message : 'Error refreshing categories')
    } finally {
      setRefreshing(false)
    }
  }

  // Run automatic price analysis for ALL categories with products (not just paginated ones)
  const runAutomaticPriceAnalysis = async () => {
    try {
      console.log('🔍 Loading ALL categories for price analysis...')
      
      // Fetch ALL categories (not just paginated ones) with a high limit
      const response = await fetch(`/api/odoo/categories?limit=1000&offset=0`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error('Failed to fetch all categories for analysis')
      }
      
      const allCategories = data.categories || []
      const categoriesWithProducts = allCategories.filter((cat: any) => (cat.products_count || 0) > 0)
      
      console.log(`🔍 Analyzing ${categoriesWithProducts.length} categories with products (from ${allCategories.length} total)...`)
      
      // Process in batches to avoid overwhelming the API
      const BATCH_SIZE = 5
      for (let i = 0; i < categoriesWithProducts.length; i += BATCH_SIZE) {
        const batch = categoriesWithProducts.slice(i, i + BATCH_SIZE)
        
        console.log(`📦 Analyzing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(categoriesWithProducts.length / BATCH_SIZE)}`)
        
        // Run analysis for this batch in parallel (auto update mode)
        await Promise.all(
          batch.map((category: any) => analyzeCategoryPrices(category.id, true))
        )
        
        // Small delay between batches
        if (i + BATCH_SIZE < categoriesWithProducts.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
      console.log('✅ Completed analysis for all categories')
      
    } catch (error) {
      console.error('❌ Error in automatic price analysis:', error)
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const totalPages = Math.ceil(totalCategories / categoriesPerPage)
  const hasChanges = Object.keys(draftChanges).length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestión de Costos por Categoría
              </h1>
              <p className="mt-2 text-gray-600">
                Conforam-Rincon del Aroma - Define costos base por categoría
              </p>
            </div>
            <div className="flex space-x-3">
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
              >
                Volver al Dashboard
              </Button>
              <Button
                onClick={handleRefreshData}
                variant="outline"
                disabled={refreshing}
                className="border-green-200 text-green-600 hover:bg-green-50"
              >
                {refreshing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Actualizando y analizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar desde Odoo
                  </>
                )}
              </Button>
              {hasChanges && (
                <Button
                  onClick={() => router.push('/dashboard/preview')}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Ver Cambios Pendientes ({Object.keys(draftChanges).length})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 max-w-md">
              <Input
                placeholder="Buscar categorías..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={priceFilter}
                onChange={(e) => setPriceFilter(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas las categorías</option>
                <option value="with_products">Con productos</option>
                <option value="uniform">✅ Precios uniformes</option>
                <option value="mixed">⚠️ Precios variados</option>
                <option value="no_cost">🔸 Sin costo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Categories Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Categorías de Productos ({categories.length} de {totalCategories})
                {totalPages > 1 && (
                  <span className="text-sm font-normal text-gray-500 ml-2">
                    - Página {currentPage} de {totalPages}
                  </span>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoría
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Categoría Padre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Productos
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Costo Base (ARS)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Análisis
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {categories.map((category) => {
                    const isSaving = savingCosts[category.id]
                    
                    return (
                      <tr key={category.id} className={category.has_override ? 'bg-blue-50 border-l-4 border-l-blue-400' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {category.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {category.id}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {category.parent_name || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {category.products_count || 0} productos
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="text"
                              value={editingInputs[category.id] !== undefined 
                                ? editingInputs[category.id]
                                : category.current_cost?.toFixed(2) || '0.00'
                              }
                              onChange={(e) => handleCostInputChange(category.id, e.target.value)}
                              onFocus={(e) => {
                                handleCostFocus(category.id, category.current_cost || 0)
                                // Use requestAnimationFrame to ensure DOM is updated before selecting
                                requestAnimationFrame(() => {
                                  e.target.select()
                                })
                              }}
                              onBlur={(e) => handleCostBlur(category.id, e.target.value)}
                              className="w-28 text-sm"
                              disabled={isSaving}
                              placeholder="0"
                            />
                            {isSaving && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {analyzingPrices[category.id] ? (
                            <div className="flex items-center text-xs text-blue-600">
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                              Analizando...
                            </div>
                          ) : category.price_analysis ? (
                            <div className="text-xs">
                              <div className={`px-2 py-1 rounded text-center ${
                                category.price_analysis.priceConsistency === 'uniform' 
                                  ? 'bg-green-100 text-green-800' 
                                  : category.price_analysis.priceConsistency === 'mixed'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : category.price_analysis.priceConsistency === 'all_zero'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {category.price_analysis.priceConsistency === 'uniform' && '✅ Uniforme'}
                                {category.price_analysis.priceConsistency === 'mixed' && '⚠️ Variado'}
                                {category.price_analysis.priceConsistency === 'all_zero' && '🔸 Sin costo'}
                                {category.price_analysis.priceConsistency === 'no_products' && '📭 Vacía'}
                              </div>
                              <div className="text-gray-600 mt-1 text-center" title={category.price_analysis.message}>
                                {category.price_analysis.productCount} prod.
                              </div>
                            </div>
                          ) : category.products_count > 0 ? (
                            <div className="text-xs text-gray-400">
                              Pendiente análisis
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400">
                              Sin productos
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-col space-y-1">
                            {category.has_override ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Pendiente
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Base
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                <div className="text-sm text-gray-700">
                  Mostrando {((currentPage - 1) * categoriesPerPage) + 1} a {Math.min(currentPage * categoriesPerPage, totalCategories)} de {totalCategories} categorías
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || loadingData}
                    variant="outline"
                    size="sm"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  
                  {/* Page Numbers */}
                  <div className="flex space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }
                      
                      return (
                        <Button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          disabled={loadingData}
                          variant={pageNumber === currentPage ? "default" : "outline"}
                          size="sm"
                          className="w-10"
                        >
                          {pageNumber}
                        </Button>
                      );
                    })}
                  </div>
                  
                  <Button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || loadingData}
                    variant="outline"
                    size="sm"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help text */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">
            ℹ️ Sobre los costos por categoría:
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Los costos por categoría sirven como base para productos sin costo específico</li>
            <li>• Los productos con costo individual siempre tienen precedencia</li>
            <li>• Los cambios se aplican inmediatamente en Odoo tras guardar</li>
            <li>• Se registra auditoría de todos los cambios realizados</li>
          </ul>
        </div>
      </div>
    </div>
  )
}