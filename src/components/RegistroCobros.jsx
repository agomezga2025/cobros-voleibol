import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import '../styles/RegistroCobros.css'

const RegistroCobros = ({ user, onChargeAdded }) => {
  const [formData, setFormData] = useState({
    category: 'partido',
    partType: 'home',              // home (30€) o away (50€)
    partLocation: '',              // Ubicación del partido
    rivalTeam: '',                 // Equipo rival
    arbitTitle: '',                // Título arbitraje
    otherTitle: '',                // Título otros ingresos
    gasKm: '',                     // KM gasolina
    gasAmount: '',                 // Cantidad gastada en gasolina
    customAmount: '',              // Monto custom (arbitraje, otros)
    date: new Date().toISOString().split('T')[0],
    description: '',               // Notas adicionales
    // División gasolina
    dividirGas: false,
    usuariosSeleccionados: [],
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [usuariosDisponibles, setUsuariosDisponibles] = useState([])

  const CATEGORIES = {
    'partido': { label: 'Partido', icon: '🏠' },
    'entrenamiento': { label: 'Entrenamiento', icon: '🏋️' },
    'arbitraje': { label: 'Arbitraje', icon: '🏆' },
    'gasolina': { label: 'Gasolina', icon: '⛽' },
    'otros': { label: 'Otros Ingresos', icon: '📝' },
  }

  // CARGAR USUARIOS DESDE DB
  useEffect(() => {
    const cargarUsuarios = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('users')
          .select('id, full_name')
          .order('full_name', { ascending: true })

        if (fetchError) throw fetchError

        // Agregar el usuario actual al inicio
        const usuariosConActual = [
          { id: user.id, full_name: user.user_metadata?.name || 'Yo' },
          ...(data || []).filter(u => u.id !== user.id)
        ]

        setUsuariosDisponibles(usuariosConActual)
      } catch (err) {
        console.error('Error cargando usuarios:', err)
      }
    }

    if (user?.id) {
      cargarUsuarios()
    }
  }, [user])

  // AUTO-SELECCIONAR USUARIO CUANDO SE ACTIVA DIVIDIR
  useEffect(() => {
    if (formData.dividirGas && formData.usuariosSeleccionados.length === 0) {
      setFormData(prev => ({
        ...prev,
        usuariosSeleccionados: [user.id]
      }))
    }
  }, [formData.dividirGas, user.id])

  const handleCategoryClick = (category) => {
    setFormData(prev => ({
      ...prev,
      category,
      partLocation: '',
      rivalTeam: '',
      arbitTitle: '',
      otherTitle: '',
      gasKm: '',
      gasAmount: '',
      customAmount: '',
      dividirGas: false,
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
      dividirGas: !prev.dividirGas,
      usuariosSeleccionados: !prev.dividirGas ? [user.id] : []
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

  // CALCULAR MONTO FINAL
  const calcularMonto = () => {
    let monto = 0

    if (formData.category === 'partido') {
      // Montos fijos: home 30€, away 50€
      monto = formData.partType === 'home' ? 30 : 50
    } else if (formData.category === 'entrenamiento') {
      // Monto fijo 12,50€
      monto = 12.50
    } else if (formData.category === 'arbitraje') {
      monto = parseFloat(formData.customAmount) || 0
    } else if (formData.category === 'gasolina') {
      monto = parseFloat(formData.gasAmount) || 0
    } else if (formData.category === 'otros') {
      monto = parseFloat(formData.customAmount) || 0
    }

    // Si se divide gasolina
    if (formData.category === 'gasolina' && formData.dividirGas && formData.usuariosSeleccionados.length > 0) {
      return monto / formData.usuariosSeleccionados.length
    }

    return monto
  }

  const montoTotal = calcularMonto()
  const displayAmount = formData.category === 'gasolina' && formData.dividirGas
    ? `${montoTotal.toFixed(2)}€ (÷${formData.usuariosSeleccionados.length})`
    : montoTotal.toFixed(2) + '€'

  // MANEJAR ENVÍO
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const chargeAmount = montoTotal
      let details = {}
      let description = formData.description

      // ARMAR DETAILS SEGÚN CATEGORÍA
      if (formData.category === 'partido') {
        details = {
          location: formData.partLocation,
          rival_team: formData.rivalTeam,
          type: formData.partType
        }
        if (!description) {
          description = `Partido ${formData.partType === 'home' ? 'Casa' : 'Fuera'} - ${formData.partLocation}`
          if (formData.rivalTeam) description += ` - ${formData.rivalTeam}`
        }
      } else if (formData.category === 'entrenamiento') {
        details = {}
        if (!description) {
          description = 'Entrenamiento'
        }
      } else if (formData.category === 'arbitraje') {
        details = { title: formData.arbitTitle }
        if (!description) {
          description = `Arbitraje - ${formData.arbitTitle}`
        }
      } else if (formData.category === 'gasolina') {
        details = {
          km: parseInt(formData.gasKm),
          amount_spent: parseFloat(formData.gasAmount),
          is_divided: formData.dividirGas,
          divided_among: formData.dividirGas ? formData.usuariosSeleccionados : []
        }
        if (!description) {
          description = `Gasolina ${formData.gasKm}km${formData.dividirGas ? ` (÷${formData.usuariosSeleccionados.length})` : ''}`
        }
      } else if (formData.category === 'otros') {
        details = { title: formData.otherTitle }
        if (!description) {
          description = `Otros - ${formData.otherTitle}`
        }
      }

      // SI ES GASOLINA DIVIDIDA, CREAR UN REGISTRO POR CADA USUARIO
      if (formData.category === 'gasolina' && formData.dividirGas && formData.usuariosSeleccionados.length > 1) {
        const charges = formData.usuariosSeleccionados.map(usuarioId => ({
          user_id: usuarioId,
          category: formData.category,
          amount: chargeAmount,
          created_at: new Date(formData.date).toISOString(),
          description: description,
          details: details,
        }))

        const { error: insertError } = await supabase
          .from('charges')
          .insert(charges)

        if (insertError) throw insertError
      } else {
        // INSERTAR CARGO NORMAL
        const chargeData = {
          user_id: user.id,
          category: formData.category,
          amount: chargeAmount,
          created_at: new Date(formData.date).toISOString(),
          description: description,
          details: details,
        }

        const { data: chargeResult, error: insertError } = await supabase
          .from('charges')
          .insert([chargeData])
          .select()

        if (insertError) throw insertError
        if (!chargeResult || !chargeResult[0]) throw new Error('Error al crear cargo')
      }

      setSuccess(`Cobro registrado exitosamente${formData.dividirGas ? ' y dividido' : ''} ✓`)

      // LIMPIAR FORMULARIO
      setFormData({
        category: 'partido',
        partType: 'home',
        partLocation: '',
        rivalTeam: '',
        arbitTitle: '',
        otherTitle: '',
        gasKm: '',
        gasAmount: '',
        customAmount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        dividirGas: false,
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

        {/* PARTIDO */}
        {formData.category === 'partido' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Partido</h3>

            <div className="detail-group">
              <label>Tipo</label>
              <select
                name="partType"
                value={formData.partType}
                onChange={handleChange}
                className="detail-input"
              >
                <option value="home">Casa (30€)</option>
                <option value="away">Fuera (50€)</option>
              </select>
            </div>

            <div className="detail-group">
              <label>Ubicación</label>
              <input
                type="text"
                name="partLocation"
                placeholder="Ciudad/Ubicación"
                value={formData.partLocation}
                onChange={handleChange}
                className="detail-input"
              />
            </div>

            <div className="detail-group">
              <label>Equipo Contrario</label>
              <input
                type="text"
                name="rivalTeam"
                placeholder="Nombre del equipo"
                value={formData.rivalTeam}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {/* ENTRENAMIENTO */}
        {formData.category === 'entrenamiento' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Entrenamiento</h3>
            <div className="detail-group">
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', margin: '0' }}>
                Monto fijo: <strong>12,50€</strong>
              </p>
            </div>
          </div>
        )}

        {/* ARBITRAJE */}
        {formData.category === 'arbitraje' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Arbitraje</h3>

            <div className="detail-group">
              <label>Competición</label>
              <input
                type="text"
                name="arbitTitle"
                placeholder="Nombre de la competición o lugar"
                value={formData.arbitTitle}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {/* GASOLINA */}
        {formData.category === 'gasolina' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Gasolina</h3>

            <div className="detail-group">
              <label>KM Recorridos</label>
              <input
                type="number"
                name="gasKm"
                placeholder="Ej: 150"
                value={formData.gasKm}
                onChange={handleChange}
                step="1"
                min="0"
                className="detail-input"
              />
            </div>

            <div className="detail-group">
              <label>Cantidad Gastada (€)</label>
              <input
                type="number"
                name="gasAmount"
                placeholder="0.00"
                value={formData.gasAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="detail-input"
              />
            </div>

            {/* OPCIÓN DIVIDIR */}
            <div className="dividir-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.dividirGas}
                  onChange={handleToggleDividir}
                  className="checkbox-input"
                />
                <span className="checkbox-text">Dividir gasto entre usuarios</span>
              </label>

              {formData.dividirGas && (
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
                        <span className="usuario-nombre">{usuario.full_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OTROS INGRESOS */}
        {formData.category === 'otros' && (
          <div className="form-section category-details">
            <h3 className="detail-title">Otros Ingresos</h3>
            <div className="detail-group">
              <label>Descripción</label>
              <input
                type="text"
                name="otherTitle"
                placeholder="Describe la fuente de ingreso"
                value={formData.otherTitle}
                onChange={handleChange}
                className="detail-input"
              />
            </div>
          </div>
        )}

        {/* MONTO A COBRAR - Solo si no es arbitraje, otros o entrenamiento */}
        {formData.category !== 'arbitraje' && formData.category !== 'otros' && formData.category !== 'entrenamiento' && (
          <div className="form-section">
            <label className="section-label">Cantidad a Cobrar</label>
            <div className="amount-input-group">
              <input
                type="number"
                name="customAmount"
                placeholder="0.00"
                value={formData.customAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="amount-input"
                disabled
              />
              <span className="currency">€</span>
            </div>
          </div>
        )}

        {/* MONTO A COBRAR - Para arbitraje y otros */}
        {(formData.category === 'arbitraje' || formData.category === 'otros') && (
          <div className="form-section">
            <label className="section-label">Cantidad a Cobrar</label>
            <div className="amount-input-group">
              <input
                type="number"
                name="customAmount"
                placeholder="0.00"
                value={formData.customAmount}
                onChange={handleChange}
                step="0.01"
                min="0"
                className="amount-input"
                required
              />
              <span className="currency">€</span>
            </div>
          </div>
        )}

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
