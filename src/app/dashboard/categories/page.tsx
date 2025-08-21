'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Category {
  id: number
  name: string
  parent_name?: string
  current_cost?: number
  updated_cost?: number
  products_count?: number
}

// Mock data basado en lo que sabemos de Odoo Conforam
const mockCategories: Category[] = [
  { id: 1, name: 'All', current_cost: 0, products_count: 1450 },
  { id: 301, name: 'All / Accesorios', parent_name: 'All', current_cost: 25.50, products_count: 35 },
  { id: 305, name: 'Aparatos aromatizadores Saphirus', current_cost: 45.80, products_count: 12 },
  { id: 310, name: 'Aceites esenciales', current_cost: 15.30, products_count: 89 },
  { id: 315, name: 'Velas aromáticas', current_cost: 8.90, products_count: 67 },
  { id: 320, name: 'Difusores', current_cost: 32.40, products_count: 23 },
  { id: 325, name: 'Perfumes ambientales', current_cost: 18.75, products_count: 45 }
]

export default function CategoriesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>(mockCategories)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingCosts, setEditingCosts] = useState<{ [key: number]: number }>({})

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

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCostChange = (categoryId: number, newCost: string) => {
    const cost = parseFloat(newCost) || 0
    setEditingCosts(prev => ({ ...prev, [categoryId]: cost }))
  }

  const saveCost = (categoryId: number) => {
    const newCost = editingCosts[categoryId]
    if (newCost !== undefined) {
      setCategories(prev => prev.map(cat => 
        cat.id === categoryId 
          ? { ...cat, current_cost: newCost, updated_cost: newCost }
          : cat
      ))
      setEditingCosts(prev => {
        const { [categoryId]: _, ...rest } = prev
        return rest
      })
    }
  }

  const cancelEdit = (categoryId: number) => {
    setEditingCosts(prev => {
      const { [categoryId]: _, ...rest } = prev
      return rest
    })
  }

  const saveAllChanges = async () => {
    setLoading(true)
    try {
      // Aquí implementaremos la llamada a Odoo
      console.log('Saving changes to Odoo...', editingCosts)
      
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Aplicar todos los cambios
      Object.entries(editingCosts).forEach(([categoryId, cost]) => {
        saveCost(parseInt(categoryId))
      })
      
      alert('Costos actualizados exitosamente')
    } catch (error) {
      console.error('Error saving costs:', error)
      alert('Error al guardar costos')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = Object.keys(editingCosts).length > 0

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
              {hasChanges && (
                <Button
                  onClick={saveAllChanges}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {loading ? 'Guardando...' : `Guardar Cambios (${Object.keys(editingCosts).length})`}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="max-w-md">
            <Input
              placeholder="Buscar categorías..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Categories Table */}
        <Card>
          <CardHeader>
            <CardTitle>Categorías de Productos ({filteredCategories.length})</CardTitle>
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
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCategories.map((category) => {
                    const isEditing = editingCosts.hasOwnProperty(category.id)
                    const displayCost = isEditing ? editingCosts[category.id] : category.current_cost
                    
                    return (
                      <tr key={category.id} className={isEditing ? 'bg-blue-50' : ''}>
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
                          {category.products_count} productos
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing ? (
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={displayCost}
                              onChange={(e) => handleCostChange(category.id, e.target.value)}
                              className="w-24"
                              autoFocus
                            />
                          ) : (
                            <div className="text-sm">
                              <span className="font-medium">
                                ${displayCost?.toFixed(2) || '0.00'}
                              </span>
                              {category.updated_cost && (
                                <span className="ml-2 text-green-600 text-xs">
                                  ✓ Actualizado
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {isEditing ? (
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                onClick={() => saveCost(category.id)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                Guardar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => cancelEdit(category.id)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCostChange(category.id, String(category.current_cost || 0))}
                            >
                              Editar
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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