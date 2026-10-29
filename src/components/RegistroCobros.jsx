/**
 * ============================================================
 * Archivo:   RegistroCobros.jsx
 * Autor:     Alejandro Gomez Garcia
 * Versión:   1.1.1
 * Última modificación: 29-10-2026
 * ------------------------------------------------------------
 * Descripción:
 *   Pantalla "Registrar Cobro" de la app de cobros de voleibol.
 *   - Formulario para registrar un cobro por categoría: partido
 *     (casa 30 € / fuera 50 €), entrenamiento (10 €/hora según
 *     duración), arbitraje, gasolina y otros ingresos.
 *   - Calcula el total a cobrar en tiempo real.
 *   - En gasolina permite dividir el gasto entre varios usuarios,
 *     creando un registro por cada uno.
 *   - Guarda el cobro en la tabla "charges" de Supabase.
 *   - NUEVO (1.1.0): si se llega desde el calendario (botón
 *     "+ Nuevo"), la fecha del formulario se rellena con el día
 *     elegido. Tras guardar, vuelve automáticamente al calendario,
 *     que muestra el aviso de cobro guardado.
 *   - CORREGIDO (1.1.1): la fecha de hoy se calcula con la hora
 *     local del móvil (antes en UTC, fallaba de madrugada).
 *   - CORREGIDO (1.1.1): el mes de la cabecera ya no está fijo;
 *     muestra el mes y año de la fecha elegida en el formulario.
 * ============================================================
 */
import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import '../styles/RegistroCobros.css'

const PRECIO_HORA_ENTRENAMIENTO = 10
const HORAS_OPCIONES = Array.from({ length: 9 }, (_, i) => i) // 0h a 8h
const MINUTOS_OPCIONES = [0, 15, 30, 45]

// Fecha de hoy en formato "AAAA-MM-DD" según la hora LOCAL del móvil
// (el locale sueco 'sv-SE' formatea justo como AAAA-MM-DD)
const fechaHoy = () => new Date().toLocaleDateString('sv-SE')

// "2026-10-21" -> "Octubre 2026"
const textoMes = (fecha) => {
  if (!fecha) return ''
  const d = new Date(fecha + 'T00:00')
  if (isNaN(d)) return ''
  const mes = d.toLocaleDateString('es-ES', { month: 'long' })
  return `${mes.charAt(0).toUpperCase()}${mes.slice(1)} ${d.getFullYear()}`
}

const RegistroCobros = ({ user, onChargeAdded }) => {
  const navigate = useNavigate()
  const location = useLocation()

  // Fecha enviada desde el calendario (null si se entra desde el menú)
  const fechaDesdeCalendario = location.state?.fecha || null

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
    trainHours: '1',     // horas de entrenamiento
    trainMinutes: '0',   // minutos de entrenamiento
    date: fechaDesdeCalendario || fechaHoy(),
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
      trainHours: '1',
      trainMinutes: '0',
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
      const totalMin = (parseInt(formData.trainHours) || 0) * 60 + (parseInt(formData.trainMinutes) || 0)
      monto = Math.round((totalMin / 60) * PRECIO_HORA_ENTRENAMIENTO * 100) / 100
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
        const horas = parseInt(formData.trainHours) || 0
        const minutos = parseInt(formData.trainMinutes) || 0
        if (horas === 0 && minutos === 0) {
          throw new Error('Elige una duración mayor a 0')
        }
        details = {
          hours: horas,
          minutes: minutos,
          duration_minutes: horas * 60 + minutos,
          hourly_rate: PRECIO_HORA_ENTRENAMIENTO
        }
        if (!description) {
          description = `Entrenamiento ${horas}h ${String(minutos).padStart(2, '0')}min`
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

      if (onChargeAdded) onChargeAdded()

      // SI VENÍA DEL CALENDARIO, VOLVER A ÉL CON EL AVISO
      // (replace para que "atrás" no regrese a este formulario)
      if (fechaDesdeCalendario) {
        navigate('/calendario', {
          replace: true,
          state: { cobroGuardado: true },
        })
        return
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
        trainHours: '1',
        trainMinutes: '0',
        date: fechaHoy(),
        description: '',
        dividirGas: false,
        usuariosSeleccionados: [],
      })

      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err.message || 'Error al registrar el cobro')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="contenido-scroll">
    <div className="registro-container">
      <div className="registro-header">
        <h1>Registrar Cobro</h1>
        <span className="month-label">{textoMes(formData.date)}</span>
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
              <label>Duración</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  name="trainHours"
                  value={formData.trainHours}
                  onChange={handleChange}
                  className="detail-input"
                >
                  {HORAS_OPCIONES.map(h => (
                    <option key={h} value={h}>{h} h</option>
                  ))}
                </select>

                <select
                  name="trainMinutes"
                  value={formData.trainMinutes}
                  onChange={handleChange}
                  className="detail-input"
                >
                  {MINUTOS_OPCIONES.map(m => (
                    <option key={m} value={m}>{String(m).padStart(2, '0')} min</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="detail-group">
              <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', margin: '0' }}>
                Tarifa: <strong>{PRECIO_HORA_ENTRENAMIENTO}€/hora</strong>
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
    </div>
  )
}

export default RegistroCobros
