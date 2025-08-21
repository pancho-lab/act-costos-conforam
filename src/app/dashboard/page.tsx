'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, X, RefreshCw, Database, Package, FolderTree, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'

interface DashboardStats {
  totalProducts: number
  totalCategories: number
  pendingChanges: number
  zeroCostCount: number
  lowCostProducts: Array<{ id: number; name: string; cost: number }>
  highCostProducts: Array<{ id: number; name: string; cost: number }>
}

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Load dashboard stats
  const loadStats = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/stats')
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats)
      } else {
        console.error('Failed to load dashboard stats:', data.error)
      }
    } catch (error) {
      console.error('Error loading dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const success = searchParams.get('success')
    const count = searchParams.get('count')
    
    if (success === 'batch-update') {
      setSuccessMessage(`✅ Actualización masiva completada exitosamente. ${count || 'Todos'} productos actualizados en Odoo.`)
      setShowSuccessMessage(true)
      
      // Clear URL parameters after showing message
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      url.searchParams.delete('count')
      window.history.replaceState({}, '', url.pathname)
    }

    // Load stats on component mount
    loadStats()
  }, [searchParams])

  const handleFullSync = async () => {
    setSyncing(true)
    
    try {
      console.log('🔄 Performing full sync from Odoo...')
      
      // Sync both categories and products
      const [categoriesRes, productsRes] = await Promise.all([
        fetch('/api/odoo/categories?limit=100'),
        fetch('/api/odoo/products?limit=100')
      ])
      
      const [categoriesData, productsData] = await Promise.all([
        categoriesRes.json(),
        productsRes.json()
      ])
      
      if (categoriesData.success && productsData.success) {
        setSuccessMessage(`✅ Sincronización completa: ${categoriesData.categories?.length || 0} categorías y ${productsData.products?.length || 0} productos actualizados desde Odoo.`)
        setShowSuccessMessage(true)
        console.log('✅ Full sync completed successfully')
        
        // Reload stats after sync
        await loadStats()
      } else {
        throw new Error('Failed to sync data from Odoo')
      }
      
    } catch (error) {
      console.error('❌ Error during full sync:', error)
      setSuccessMessage(`❌ Error durante la sincronización: ${error instanceof Error ? error.message : 'Error desconocido'}`)
      setShowSuccessMessage(true)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="container mx-auto p-6">
      {/* Success Message Banner */}
      {showSuccessMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
              <p className="text-sm font-medium text-green-800">{successMessage}</p>
            </div>
            <button
              onClick={() => setShowSuccessMessage(false)}
              className="text-green-400 hover:text-green-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-2">Resumen del sistema de costos</p>
          </div>
          <div>
            <button
              onClick={handleFullSync}
              disabled={syncing}
              className="inline-flex items-center px-4 py-2 border border-green-300 rounded-md shadow-sm text-sm font-medium text-green-700 bg-white hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Sincronizar con Odoo
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Productos Totales
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats?.totalProducts?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos almacenables activos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Categorías
            </CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats?.totalCategories?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Categorías de productos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Sin Costo
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats?.zeroCostCount?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Productos con costo $0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cambios Pendientes
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : stats?.pendingChanges?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              Listos para actualizar
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingDown className="h-5 w-5 mr-2 text-green-600" />
              Productos con Menor Costo
            </CardTitle>
            <CardDescription>
              Top 10 productos más económicos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : stats?.lowCostProducts && stats.lowCostProducts.length > 0 ? (
              <div className="space-y-2">
                {stats.lowCostProducts.slice(0, 5).map((product, index) => (
                  <div key={product.id} className="flex justify-between items-center text-sm">
                    <span className="truncate flex-1 mr-2" title={product.name}>
                      {index + 1}. {product.name}
                    </span>
                    <span className="text-green-600 font-medium">
                      ${product.cost.toFixed(2)}
                    </span>
                  </div>
                ))}
                {stats.lowCostProducts.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{stats.lowCostProducts.length - 5} productos más
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay productos con costo bajo
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-red-600" />
              Productos con Mayor Costo
            </CardTitle>
            <CardDescription>
              Top 10 productos más caros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Cargando...</p>
            ) : stats?.highCostProducts && stats.highCostProducts.length > 0 ? (
              <div className="space-y-2">
                {stats.highCostProducts.slice(0, 5).map((product, index) => (
                  <div key={product.id} className="flex justify-between items-center text-sm">
                    <span className="truncate flex-1 mr-2" title={product.name}>
                      {index + 1}. {product.name}
                    </span>
                    <span className="text-red-600 font-medium">
                      ${product.cost.toLocaleString()}
                    </span>
                  </div>
                ))}
                {stats.highCostProducts.length > 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    +{stats.highCostProducts.length - 5} productos más
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay productos con costo alto
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Acciones Rápidas</CardTitle>
            <CardDescription>
              Navegación del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a 
                href="/dashboard/categories" 
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <FolderTree className="h-8 w-8 text-blue-500 mr-3" />
                <div>
                  <div className="font-medium text-sm">Categorías</div>
                  <div className="text-xs text-muted-foreground">Gestionar costos por categoría</div>
                </div>
              </a>
              
              <a 
                href="/dashboard/products" 
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <Package className="h-8 w-8 text-green-500 mr-3" />
                <div>
                  <div className="font-medium text-sm">Productos</div>
                  <div className="text-xs text-muted-foreground">Ver y editar productos</div>
                </div>
              </a>
              
              <a 
                href="/dashboard/preview" 
                className="flex items-center p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                <RefreshCw className="h-8 w-8 text-orange-500 mr-3" />
                <div>
                  <div className="font-medium text-sm">Vista Previa</div>
                  <div className="text-xs text-muted-foreground">Revisar cambios pendientes</div>
                </div>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}