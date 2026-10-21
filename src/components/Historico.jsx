/**
 * ============================================================
 * Archivo:   Historico.jsx
 * Versión:   1.0.0
 * Última modificación: 21-10-2026
 * ------------------------------------------------------------
 * Descripción:
 *   Pantalla "Histórico" de la app de cobros de voleibol.
 *   - Carga desde Supabase todos los cobros del usuario logueado,
 *     ordenados del más reciente al más antiguo.
 *   - Permite filtrar la lista por categoría.
 *   - Permite eliminar un cobro de la base de datos pulsando la "×".
 * ============================================================
 */

import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import '../styles/Historico.css'

const Historico = ({ user }) => {
  // ---------- ESTADO ----------
  const [charges, setCharges] = useState([])               // Lista de cobros cargados
  const [loading, setLoading] = useState(false)            // Indicador de carga
  const [filterCategory, setFilterCategory] = useState('all') // Filtro activo
  const [deletingId, setDeletingId] = useState(null)       // id del cobro que se está borrando

  // ---------- CONSTANTES ----------
  // Nombre visible de cada categoría
  const CATEGORY_LABELS = {
    'partido': 'Partido',
    'entrenamiento': 'Entrenamiento',
    'arbitraje': 'Arbitraje',
    'gasolina': 'Gasolina',
    'otros': 'Otros'
  }

  // Color del punto de cada categoría
  const COLORS = {
    'partido': '#2d5016',
    'entrenamiento': '#a58a4a',
    'arbitraje': '#d4a574',
    'gasolina': '#8b7355',
    'otros': '#c9b8a3'
  }

  // ---------- EFECTOS ----------
  // Carga los cobros al montar el componente o al cambiar de usuario
  useEffect(() => {
    fetchCharges()
  }, [user])

  // ---------- FUNCIONES ----------

  /**
   * fetchCharges()
   * Consulta en Supabase todos los cobros del usuario actual
   * (más recientes primero) y los guarda en el estado.
   */
  const fetchCharges = async () => {
    if (!user) return

    setLoading(true)
    const { data, error } = await supabase
      .from('charges')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching charges:', error)
    } else {
      setCharges(data || [])
    }
    setLoading(false)
  }

  /**
   * deleteCharge(id)
   * Pide confirmación y elimina el cobro con ese id de Supabase.
   * - Usa .select() para que Supabase devuelva las filas borradas:
   *   si devuelve 0 filas, la política RLS ha bloqueado el borrado.
   * - Si se borra bien, lo quita de la lista al momento (sin recargar).
   */
  const deleteCharge = async (id) => {
    if (!user || deletingId) return

    const confirmed = window.confirm('¿Estás seguro de que quieres eliminar este registro?')
    if (!confirmed) return

    setDeletingId(id)

    const { data, error } = await supabase
      .from('charges')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Solo puede borrar sus propios cobros
      .select()

    if (error) {
      // Error real de Supabase (red, permisos, etc.)
      console.error('Error deleting charge:', error)
      alert('No se pudo eliminar el registro: ' + error.message)
    } else if (!data || data.length === 0) {
      // Sin error pero 0 filas borradas => RLS lo ha bloqueado
      console.warn('Delete devolvió 0 filas. Revisa la política RLS de DELETE en "charges".')
      alert('No se pudo eliminar el registro (sin permisos en la base de datos).')
    } else {
      // Borrado correcto: lo quitamos de la lista local
      setCharges(prev => prev.filter(charge => charge.id !== id))
    }

    setDeletingId(null)
  }

  // ---------- DATOS DERIVADOS ----------
  // Cobros que se muestran según el filtro activo
  const filteredCharges = filterCategory === 'all'
    ? charges
    : charges.filter(charge => charge.category === filterCategory)

  // Lista de categorías disponibles para los botones de filtro
  const categories = ['all', ...new Set(charges.map(c => c.category))]

  // ---------- RENDER ----------
  return (
    <div className="contenido-scroll">
      <div className="historico-container">
        {/* Cabecera con título y total de registros */}
        <div className="historico-header">
          <h1>Histórico</h1>
          <p className="total-count">Total registros: {charges.length}</p>
        </div>

        {/* Botones de filtro por categoría */}
        <div className="filter-section">
          <div className="filter-buttons">
            {categories.map(category => (
              <button
                key={category}
                type="button"
                className={`filter-btn ${filterCategory === category ? 'active' : ''}`}
                onClick={() => setFilterCategory(category)}
              >
                {category === 'all' ? 'Todos' : (CATEGORY_LABELS[category] || category)}
              </button>
            ))}
          </div>
        </div>

        {/* Lista de cobros */}
        <div className="charges-list">
          {loading ? (
            <div className="loading">Cargando registros...</div>
          ) : filteredCharges.length > 0 ? (
            filteredCharges.map(charge => (
              <div key={charge.id} className="charge-item">
                <div
                  className="charge-category-dot"
                  style={{ backgroundColor: COLORS[charge.category] || COLORS['otros'] }}
                ></div>

                <div className="charge-info">
                  <div className="charge-category">
                    {CATEGORY_LABELS[charge.category] || charge.category}
                  </div>
                  <div className="charge-date">
                    {new Date(charge.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  {charge.description && (
                    <div className="charge-description">{charge.description}</div>
                  )}
                </div>

                <div className="charge-amount">
                  <div className="amount">{Number(charge.amount || 0).toFixed(2)}€</div>
                </div>

                {/* Botón eliminar */}
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => deleteCharge(charge.id)}
                  disabled={deletingId === charge.id}
                  title="Eliminar"
                >
                  {deletingId === charge.id ? '…' : '×'}
                </button>
              </div>
            ))
          ) : (
            <div className="no-data">
              <p>No hay registros {filterCategory !== 'all' ? 'en esta categoría' : 'aún'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Historico