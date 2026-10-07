import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import '../styles/RegistroCobros.css'

const RegistroCobros = ({ user, onChargeAdded }) => {
  const [formData, setFormData] = useState({
    category: 'partido-casa',
    amount: '',
    should_charge: '',
    actual_charge: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    rival: '',
    lugar: '',
    precioGasolina: '',
    dividirCobro: false,
    usuariosSeleccionados: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [usuariosDisponibles] = useState([
    { id: user.id, email: user.email, nombre: user.user_metadata?.name || 'Yo' }
  ])

  useEffect(() => {
    if (formData.dividirCobro && formData.usuariosSeleccionados.length === 0) {
      setFormData(prev => ({
        ...prev,
        usuariosSeleccionados: [user.id]
      }))
    }
  }, [formData.dividirCobro, user.id])

  const CATEGORIES = {
    'partido-casa': { label: 'Partido Casa', icon: '🏠' },
    'partido-fuera': { label: 'Partido Fuera', icon: '✈️' },
    'entrenamiento': { label: 'Entrenamiento', icon: '🏋️' },
    'arbitraje': { label: 'Arbitraje', icon: '🏆' },
    'gasolina': { label: 'Gasolina', icon: '⛽' },
    'otros': { label: 'Otros', icon: '📝' },
  }

  const handleCategoryClick = (category) => {
    setFormData(prev => ({
      ...prev,
      category,
      precioGasolina: '',
      dividirCobro: false,
      usuariosSeleccionados: []
    }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleToggleDividir = () => {
    setFormData(prev => ({
      ...prev,
      dividirCobro: !prev.dividirCobro,
      usuariosSeleccionados: !prev.dividirCobro ? [user.id] : []
    }))
  }

  const toggleUsuario = (usuarioId) => {
    setFormData(prev => ({
      ...prev,
      usuariosSeleccionados: prev.usuariosSeleccionados.includes(usuarioId)
        ? prev.usuariosSeleccionados.filter(id => id !== usuarioId)
        : [...prev.usuariosSeleccionados, usuarioId]
    }))
  }

  const calcularMonto = () => {
    let monto = parseFloat(formData.actual_charge) || parseFloat(formData.should_charge) || parseFloat(formData.amount) || 0

    if (formData.dividirCobro && formData.usuariosSeleccionados.length > 0) {
      return monto / formData.usuariosSeleccionados.length
    }

    return monto
  }

  const montoTotal = calcularMonto()
  const displayAmount = formData.dividirCobro
    ? `${montoTotal.toFixed(2)}€ (÷${formData.usuariosSeleccionados.length})`
    : montoTotal.toFixed(2) + '€'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const chargeAmount = montoTotal

      let description = formData.description
      if (!description) {
        description = `${CATEGORIES[formData.category].label}`
        if (formData.rival) description += ` - ${formData.rival}`
        if (formData.lugar) description += ` - ${formData.lugar}`
      }

      const chargeData = {
        user_id: user.id,
        category: formData.category,
        should_charge: chargeAmount,
        actual_charge: chargeAmount,
        created_at: new Date(formData.date).toISOString(),
        description: description,
      }

      // Agregar info específica para gasolina
      if (formData.category === 'gasolina' && formData.precioGasolina) {
        chargeData.description += ` - ${formData.precioGasolina}€/L`
      }

      // Agregar info de división si aplica
      if (formData.dividirCobro) {
        chargeData.description += ` (Dividido entre ${formData.usuariosSeleccionados.length})`
      }

      const { error: insertError } = await supabase.from('charges').insert([chargeData])

      if (insertError) throw insertError

      // Si se divide, crear registros para otros usuarios
      if (formData.dividirCobro && formData.usuariosSeleccionados.length > 1) {
        const otrosRegistros = formData.usuariosSeleccionados
          .filter(id => id !== user.id)
          .map(usuarioId => ({
            user_id: usuarioId,
            category: formData.category,
            should_charge: chargeAmount,
            actual_charge: chargeAmount,
            created_at: chargeData.created_at,
            description: chargeData.description
          }))

        if (otrosRegistros.length > 0) {
          const { error: divideError } = await supabase.from('charges').insert(otrosRegistros)
          if (divideError) console.warn('Error al crear registros divididos:', divideError)
        }
      }

      setSuccess(`Cobro registrado exitosamente${formData.dividirCobro ? ' y dividido' : ''} ✓`)

      setFormData({
        category: 'partido-casa',
        amount: '',
        should_charge: '',
        actual_charge: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        rival: '',
        lugar: '',
        precioGasolina: '',
        dividirCobro: false,
        usuariosSeleccionados: [],
      })

      setTimeout(() => setSuccess(''), 3000)

      if (onChargeAdded) onChargeAdded()
    } catch (err) {
      setError(err.message || 'Error al registrar el cobro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="registro-container">
      <div className="registro-header">
        <h1>Registrar Cobro</h1>
        <span className="month-label">Octubre 2026</span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit} className="registro-form">

        {/* FECHA */}
        <div className="form-section">
          <label className="section-label">Fecha</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            className="date-input"
          />
        </div>

        {/* TIPO DE COBRO - BOTONES */}
        <div className="form-section">
          <label className="section-label">Tipo de Cobro</label>
          <div className="category-buttons">
            {Object.entries(CATEGORIES).map(([key, { label, icon }]) => (
              <button
                key={key}
                type="button"
                className={`category-btn ${formData.category === key ? 'active' : ''}`}
                onClick={() => handleCategoryClick(key)}
              >
                <span className="btn-icon">{icon}</span>
                <span className="btn-text">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* CAMPOS DINÁMICOS SEGÚN CATEGORÍA */}
        {formData.category === 'partido-casa' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Partido en Casa</h3>
            <div className="detail-group">
              <label>Ubicación</label>
              <input
                type="text"
                name="rival"
                placeholder="Ciudad/Ubicación"
                value={formData.rival}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
            <div className="detail-group">
              <label>Equipo contrario</label>
              <input
                type="text"
                name="lugar"
                placeholder="Nombre del equipo"
                value={formData.lugar}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {formData.category === 'partido-fuera' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Partido Desplazado</h3>
            <div className="detail-group">
              <label>Ubicación</label>
              <input
                type="text"
                name="rival"
                placeholder="Ciudad/Ubicación"
                value={formData.rival}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
            <div className="detail-group">
              <label>Equipo contrario</label>
              <input
                type="text"
                name="lugar"
                placeholder="Nombre del equipo"
                value={formData.lugar}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {formData.category === 'entrenamiento' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Entrenamiento</h3>
            <div className="detail-group">
              <label>Tipo de Entrenamiento</label>
              <input
                type="text"
                name="rival"
                placeholder="Ej: Preparación física, técnica, etc."
                value={formData.rival}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {formData.category === 'arbitraje' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Arbitraje</h3>
            <div className="detail-group">
              <label>Competición</label>
              <input
                type="text"
                name="rival"
                placeholder="Nombre de la competición o lugar"
                value={formData.rival}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {formData.category === 'gasolina' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Gasolina</h3>

            <div className="detail-group">
              <label>Precio Gasolina (€/L) - Informativo</label>
              <input
                type="text"
                name="precioGasolina"
                placeholder="Ej: 1.50€/L"
                value={formData.precioGasolina}
                onChange={handleChange}
                className="detail-input"
              />
            </div>

            {/* OPCIÓN DIVIDIR */}
            <div className="dividir-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.dividirCobro}
                  onChange={handleToggleDividir}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Dividir gasto entre usuarios</span>
              </label>

              {formData.dividirCobro && (
                <div className="usuarios-lista">
                  <label className="section-label">Selecciona quiénes van:</label>
                  <div className="usuarios-grid">
                    {usuariosDisponibles.map(usuario => (
                      <label key={usuario.id} className="usuario-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.usuariosSeleccionados.includes(usuario.id)}
                          onChange={() => toggleUsuario(usuario.id)}
                          className="checkbox-input-small"
                        />
                        <span className="usuario-nombre">{usuario.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {formData.category === 'otros' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Otros Ingresos</h3>
            <div className="detail-group">
              <label>Descripción</label>
              <input
                type="text"
                name="rival"
                placeholder="Describe la fuente de ingreso"
                value={formData.rival}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {/* MONTO A COBRAR */}
        <div className="form-section">
          <label className="section-label">Cantidad a Cobrar</label>
          <div className="amount-input-group">
            <input
              type="number"
              name="should_charge"
              placeholder="0.00"
              value={formData.should_charge}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="amount-input"
            />
            <span className="currency">€</span>
          </div>
        </div>

        {/* TOTAL A COBRAR - PROMINENTE */}
        <div className="total-section">
          <div className="total-label">TOTAL A COBRAR</div>
          <div className="total-amount">{displayAmount}</div>
        </div>

        {/* DESCRIPCIÓN ADICIONAL */}
        <div className="form-section">
          <label className="section-label">Notas Adicionales</label>
          <textarea
            name="description"
            placeholder="Detalles extras..."
            value={formData.description}
            onChange={handleChange}
            className="description-input"
            rows="3"
          />
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="form-actions">
          <button type="reset" className="btn-cancel">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-guardar"
          >
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RegistroCobros
