import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function RegistroCobros({ user, onChargeAdded }) {
  const [formData, setFormData] = useState({
    category: 'partido-casa',
    amount: '',
    should_charge: '',
    actual_charge: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { error } = await supabase.from('charges').insert([
        {
          user_id: user.id,
          category: formData.category,
          amount: parseFloat(formData.amount),
          should_charge: parseFloat(formData.should_charge) || null,
          actual_charge: parseFloat(formData.actual_charge) || null,
          date: formData.date,
          description: formData.description,
        },
      ])

      if (error) throw error

      // Limpiar form
      setFormData({
        category: 'partido-casa',
        amount: '',
        should_charge: '',
        actual_charge: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
      })

      onChargeAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '20px auto', padding: '20px' }}>
      <h2>Registrar Cobro</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '12px' }}>
          <label>Categoría</label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px' }}
          >
            <option value="partido-casa">Partido en Casa</option>
            <option value="partido-fuera">Partido Desplazado</option>
            <option value="entrenamiento">Entrenamiento</option>
            <option value="arbitraje">Arbitraje</option>
            <option value="gasolina">Gasolina</option>
            <option value="otros">Otros</option>
          </select>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Fecha</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Monto</label>
          <input
            type="number"
            name="amount"
            placeholder="100"
            value={formData.amount}
            onChange={handleChange}
            step="0.01"
            style={{ width: '100%', padding: '8px' }}
            required
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Debería Cobrar (para Ajuste)</label>
          <input
            type="number"
            name="should_charge"
            placeholder="100"
            value={formData.should_charge}
            onChange={handleChange}
            step="0.01"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Realmente Cobré (para Ajuste)</label>
          <input
            type="number"
            name="actual_charge"
            placeholder="100"
            value={formData.actual_charge}
            onChange={handleChange}
            step="0.01"
            style={{ width: '100%', padding: '8px' }}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label>Descripción</label>
          <textarea
            name="description"
            placeholder="Detalles adicionales"
            value={formData.description}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', minHeight: '60px' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#2d5016',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          {loading ? 'Guardando...' : 'Guardar Cobro'}
        </button>
      </form>
    </div>
  )
}