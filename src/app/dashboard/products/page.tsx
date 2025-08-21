'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'

interface Product {
  id: number
  name: string
  default_code?: string
  categ_id: number
  categ_name?: string
  standard_price: number
  current_cost: number
  updated_cost?: number | null
  has_override: boolean
}

interface Category {
  id: number
  name: string
}

export default function ProductsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [costFilter, setCostFilter] = useState<'all' | 'with_cost' | 'zero_cost' | 'has_override' | 'category_cost'>('all')
  const [editingCosts, setEditingCosts] = useState<{ [key: number]: number }>({})
  const [draftChanges, setDraftChanges] = useState<{ [key: number]: number }>({})
  const [savingCosts, setSavingCosts] = useState<{ [key: number]: boolean }>({})
  const [editingInputs, setEditingInputs] = useState<{ [key: number]: string }>({})
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [productsPerPage] = useState(100) // Items por página

  // Load existing draft changes and apply them to products
  const loadDraftChanges = async (products: Product[]) => {
    try {
      console.log('🔍 Fetching draft changes from API...')
      const response = await fetch('/api/draft-changes')
      const data = await response.json()
      console.log('📋 Draft changes response:', data)
      
      if (data.success && data.changes) {
        const draftMap: { [key: number]: number } = {}
        
        // Create a map of productId -> new cost from draft changes
        data.changes.forEach((change: any) => {
          if (change.entityType === 'product' && change.fieldName === 'standard_price') {
            draftMap[change.entityId] = parseFloat(change.newValue)
          }
        })
        
        // Apply draft changes to products
        const updatedProducts = products.map(product => {
          if (draftMap[product.id]) {
            return {
              ...product,
              current_cost: draftMap[product.id],
              updated_cost: draftMap[product.id],
              has_override: true
            }
          }
          return product
        })
        
        setProducts(updatedProducts)
        setDraftChanges(draftMap)
        
        console.log(`📝 Applied ${Object.keys(draftMap).length} draft changes`)
      }
    } catch (error) {
      console.error('Error loading draft changes:', error)
    }
  }

  // Load categories for filter
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/odoo/categories?limit=100')
        const data = await response.json()
        
        if (data.success) {
          setCategories(data.categories)
        }
      } catch (error) {
        console.error('Error loading categories for filter:', error)
      }
    }
    
    if (session) {
      loadCategories()
    }
  }, [session])

  // Load products with filters
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoadingData(true)
        setError(null)
        console.log('🔄 Loading products from API...')
        
        const params = new URLSearchParams({
          limit: productsPerPage.toString(),
          offset: ((currentPage - 1) * productsPerPage).toString()
        })
        
        if (selectedCategory !== 'all') {
          params.append('categoryId', selectedCategory)
        }
        
        if (debouncedSearchTerm.trim()) {
          params.append('search', debouncedSearchTerm.trim())
        }
        
        const response = await fetch(`/api/odoo/products?${params}`)
        const data = await response.json()
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to load products')
        }
        
        console.log('📦 Loaded products:', data.products)
        setProducts(data.products)
        setTotalProducts(data.total || data.products.length)
        
        // Load existing draft changes and apply them to products
        console.log('🔄 Loading draft changes...')
        await loadDraftChanges(data.products)
        
        console.log('✅ Products loaded successfully!')
      } catch (error) {
        console.error('❌ Error loading products:', error)
        setError(error instanceof Error ? error.message : 'Error loading products')
      } finally {
        setLoadingData(false)
      }
    }
    
    if (session) {
      loadProducts()
    }
  }, [session, selectedCategory, debouncedSearchTerm, currentPage, productsPerPage])
  
  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 500) // 500ms delay
    
    return () => clearTimeout(timer)
  }, [searchTerm])

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
          <p className="text-gray-600">Cargando productos desde Odoo...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">❌ Error al cargar productos</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  // Handle input focus - select all text and set editing state
  const handleCostFocus = (productId: number, currentValue: number) => {
    const textValue = currentValue?.toString() || '0'
    setEditingInputs(prev => ({ ...prev, [productId]: textValue }))
  }

  // Handle local input changes (no saving yet)
  const handleCostInputChange = (productId: number, newCost: string) => {
    // Update the editing text state (allows free text input)
    setEditingInputs(prev => ({ ...prev, [productId]: newCost }))
  }

  // Handle saving when input loses focus
  const handleCostBlur = async (productId: number, newCost: string) => {
    const cost = parseFloat(newCost) || 0
    const product = products.find(p => p.id === productId)
    
    if (!product) return
    
    // Clear editing state
    setEditingInputs(prev => {
      const { [productId]: _, ...rest } = prev
      return rest
    })
    
    // Skip if no actual change
    if (cost === product.standard_price) {
      return
    }
    
    // Update final state with override flag
    setProducts(prev => prev.map(prod => 
      prod.id === productId 
        ? { ...prod, current_cost: cost, updated_cost: cost, has_override: true }
        : prod
    ))
    
    // Update draft changes state
    setDraftChanges(prev => ({ ...prev, [productId]: cost }))
    
    // Save to draft_changes table (no auto-save to Odoo)
    setSavingCosts(prev => ({ ...prev, [productId]: true }))
    
    try {
      const response = await fetch('/api/draft-changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          entityType: 'product',
          entityId: productId,
          fieldName: 'standard_price',
          currentValue: product.standard_price,
          newValue: cost,
          entityName: product.name
        })
      })
      
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to save draft change')
      }
      
      console.log(`📝 Draft change saved for product ${productId}: ${product.standard_price} → ${cost}`)
      
    } catch (error) {
      console.error('Error saving draft change:', error)
      // Revertir cambio en caso de error
      setProducts(prev => prev.map(prod => 
        prod.id === productId 
          ? { ...prod, current_cost: product.standard_price, updated_cost: null, has_override: false }
          : prod
      ))
      setDraftChanges(prev => {
        const { [productId]: _, ...rest } = prev
        return rest
      })
    } finally {
      setSavingCosts(prev => ({ ...prev, [productId]: false }))
    }
  }


  const handleRefreshData = async () => {
    setRefreshing(true)
    setError(null)
    
    try {
      console.log('🔄 Refreshing products and categories from Odoo...')
      
      // Refresh both categories and products
      const [categoriesRes, productsRes] = await Promise.all([
        fetch('/api/odoo/categories?limit=500'),
        fetch(`/api/odoo/products?${new URLSearchParams({
          limit: productsPerPage.toString(),
          offset: ((currentPage - 1) * productsPerPage).toString(),
          ...(selectedCategory !== 'all' && { categoryId: selectedCategory }),
          ...(searchTerm.trim() && { search: searchTerm.trim() })
        })}`)
      ])
      
      const [categoriesData, productsData] = await Promise.all([
        categoriesRes.json(),
        productsRes.json()
      ])
      
      if (categoriesData.success) {
        setCategories(categoriesData.categories)
        console.log('✅ Categories refreshed')
      }
      
      if (productsData.success) {
        setProducts(productsData.products)
        setTotalProducts(productsData.total || productsData.products.length)
        console.log('✅ Products refreshed')
      }
      
      if (!categoriesData.success || !productsData.success) {
        throw new Error('Failed to refresh data from Odoo')
      }
      
    } catch (error) {
      console.error('❌ Error refreshing data:', error)
      setError(error instanceof Error ? error.message : 'Error refreshing data')
    } finally {
      setRefreshing(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const totalPages = Math.ceil(totalProducts / productsPerPage)
  const hasUnsavedChanges = Object.keys(draftChanges).length > 0

  // Apply cost filter to products
  const filteredProducts = products.filter(product => {
    if (costFilter === 'all') return true
    
    const currentCost = draftChanges[product.id] !== undefined ? draftChanges[product.id] : product.current_cost
    
    switch (costFilter) {
      case 'with_cost':
        return currentCost > 0
      case 'zero_cost':
        return currentCost === 0
      case 'has_override':
        return product.has_override || draftChanges[product.id] !== undefined
      case 'category_cost':
        return !product.has_override && draftChanges[product.id] === undefined && currentCost > 0
      default:
        return true
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Gestión de Costos por Producto
              </h1>
              <p className="mt-2 text-gray-600">
                Conforam-Rincon del Aroma - Define costos específicos por producto
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
                    Actualizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Actualizar desde Odoo
                  </>
                )}
              </Button>
              {hasUnsavedChanges && (
                <Button
                  onClick={() => router.push('/dashboard/preview')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Vista Previa ({Object.keys(draftChanges).length} cambios)
                </Button>
              )}
            </div>
          </div>
          
          {/* Draft Mode Banner */}
          {hasUnsavedChanges && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">
                    🟡 Modo Borrador: {Object.keys(draftChanges).length} cambios pendientes
                  </h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Los cambios NO se guardan automáticamente en Odoo. Use "Vista Previa" para revisar y aplicar.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Input
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id.toString()}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            >
              <option value="all">Todos los productos</option>
              <option value="with_cost">💰 Con costo > $0</option>
              <option value="zero_cost">🔸 Sin costo ($0)</option>
              <option value="has_override">⚡ Con override</option>
              <option value="category_cost">📂 Solo costo de categoría</option>
            </select>
          </div>
        </div>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Productos ({filteredProducts.length} de {products.length})
                {costFilter !== 'all' && (
                  <span className="text-sm font-normal text-blue-600 ml-2">
                    - Filtro aplicado
                  </span>
                )}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Producto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Categoría
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Costo (ARS)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => {
                    const isSaving = savingCosts[product.id]
                    
                    return (
                      <tr key={product.id} className={product.has_override ? 'bg-blue-50 border-l-4 border-l-blue-400' : ''}>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-gray-900 line-clamp-2">
                            {product.name}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            ID: {product.id} {product.default_code && `• ${product.default_code}`}
                          </div>
                        </td>
                        <td className="px-4 py-4 hidden md:table-cell">
                          <div className="text-sm text-gray-500 line-clamp-2">
                            {product.categ_name || product.categ_id}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center space-x-2">
                            <Input
                              type="text"
                              value={editingInputs[product.id] !== undefined 
                                ? editingInputs[product.id]
                                : product.current_cost?.toFixed(2) || '0.00'
                              }
                              onChange={(e) => handleCostInputChange(product.id, e.target.value)}
                              onFocus={(e) => {
                                handleCostFocus(product.id, product.current_cost || 0)
                                // Use requestAnimationFrame to ensure DOM is updated before selecting
                                requestAnimationFrame(() => {
                                  e.target.select()
                                })
                              }}
                              onBlur={(e) => handleCostBlur(product.id, e.target.value)}
                              className="w-28 text-sm"
                              disabled={isSaving}
                              placeholder="0"
                            />
                            {isSaving && (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col space-y-1">
                            {product.has_override ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Override
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Por categoría
                              </span>
                            )}
                            <div className="md:hidden text-xs text-gray-500 line-clamp-1">
                              {product.categ_name || product.categ_id}
                            </div>
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
                  Mostrando {((currentPage - 1) * productsPerPage) + 1} a {Math.min(currentPage * productsPerPage, totalProducts)} de {totalProducts} productos
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
            ℹ️ Sobre los costos por producto:
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Los productos con costo específico (override) tienen precedencia sobre los costos por categoría</li>
            <li>• Los productos sin override utilizan el costo definido en su categoría</li>
            <li>• <strong>Modo Borrador:</strong> Los cambios se guardan como borradores y NO se sincronizan automáticamente con Odoo</li>
            <li>• <strong>Deshacer:</strong> Use el botón ↩️ junto al ✓ para deshacer un cambio individual</li>
            <li>• <strong>Vista Previa:</strong> Use el botón "Vista Previa" para revisar y aplicar todos los cambios</li>
            <li>• Se mantiene auditoría completa de todos los cambios realizados</li>
          </ul>
        </div>
      </div>
    </div>
  )
}