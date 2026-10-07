import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import '../styles/Historico.css'

const Historico = ({ user }) => {
  const [charges, setCharges] = useState([])
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')

  const CATEGORY_LABELS = {
    'partido-casa': 'Partido en Casa',
    'partido-fuera': 'Partido Fuera',
    'entrenamiento': 'Entrenamiento',
    'arbitraje': 'Arbitraje',
    'gasolina': 'Gasolina',
    'otros': 'Otros'
  }

  const COLORS = {
    'partido-casa': '#2d5016',
    'partido-fuera': '#4a7c2f',
    'entrenamiento': '#a58a4a',
    'arbitraje': '#d4a574',
    'gasolina': '#8b7355',
    'otros': '#c9b8a3'
  }

  useEffect(() => {
    fetchCharges()
  }, [user])

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

  const filteredCharges = filterCategory === 'all'
    ? charges
    : charges.filter(charge => charge.category === filterCategory)

  const categories = ['all', ...new Set(charges.map(c => c.category))]

  const deleteCharge = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este registro?')) {
      const { error } = await supabase
        .from('charges')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Error deleting charge:', error)
      } else {
        fetchCharges()
      }
    }
  }

  return (
    <div className="historico-container">
      <div className="historico-header">
        <h1>Histórico</h1>
        <p className="total-count">Total registros: {charges.length}</p>
      </div>

      <div className="filter-section">
        <div className="filter-buttons">
          {categories.map(category => (
            <button
              key={category}
              className={`filter-btn ${filterCategory === category ? 'active' : ''}`}
              onClick={() => setFilterCategory(category)}
            >
              {category === 'all' ? 'Todos' : CATEGORY_LABELS[category]}
            </button>
          ))}
        </div>
      </div>

      <div className="charges-list">
        {loading ? (
          <div className="loading">Cargando registros...</div>
        ) : filteredCharges.length > 0 ? (
          filteredCharges.map(charge => (
            <div key={charge.id} className="charge-item">
              <div className="charge-category-dot" style={{ backgroundColor: COLORS[charge.category] }}></div>
              <div className="charge-info">
                <div className="charge-category">
                  {CATEGORY_LABELS[charge.category]}
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
                <div className="amount">{(charge.actual_charge || charge.should_charge || 0).toFixed(2)}€</div>
                {charge.should_charge !== charge.actual_charge && (
                  <div className="amount-status">
                    {charge.actual_charge ? '✓' : '✗'}
                  </div>
                )}
              </div>
              <button
                className="delete-btn"
                onClick={() => deleteCharge(charge.id)}
                title="Eliminar"
              >
                ×
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
  )
}

export default Historico
