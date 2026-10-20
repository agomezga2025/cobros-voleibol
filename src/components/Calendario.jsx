import { useState, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import interactionPlugin from '@fullcalendar/react/interaction'
import '@fullcalendar/react/skeleton.css'
import { supabase } from '../supabaseClient'
import '../styles/Calendario.css'

const COLORES = {
  partido: '#c84c3c',
  entrenamiento: '#e91e8c',
  arbitraje: '#8b6e3f',
  gasolina: '#d68910',
  otros: '#888780',
}

const NOMBRES = {
  partido: 'Partido',
  entrenamiento: 'Entrenamiento',
  arbitraje: 'Arbitraje',
  gasolina: 'Gasolina',
  otros: 'Otros',
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

// "2026-10-21" según la hora local del móvil
function fechaLocal(iso) {
  return new Date(iso).toLocaleDateString('sv-SE')
}

// "2026-10-21" a partir de un Date de FullCalendar
function claveDia(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export default function Calendario() {
  const [cobrosPorDia, setCobrosPorDia] = useState({})
  const [diaActivo, setDiaActivo] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [arrastre, setArrastre] = useState(0)
  const touchY = useRef(null)
  const timer = useRef(null)
  const calRef = useRef(null)
  const [titulo, setTitulo] = useState('')  

const mesesCargados = useRef(new Set())

const cargarMes = useCallback(async (anio, mes) => {
  const base = new Date(anio, mes, 1)
  const clave = `${base.getFullYear()}-${base.getMonth()}`
  if (mesesCargados.current.has(clave)) return
  mesesCargados.current.add(clave)

  const desde = base.toISOString()
  const hasta = new Date(base.getFullYear(), base.getMonth() + 1, 1).toISOString()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    mesesCargados.current.delete(clave)
    return
  }

  const { data: propios, error: e1 } = await supabase
    .from('charges')
    .select('id, category, amount, description, created_at')
    .eq('user_id', user.id)
    .gte('created_at', desde)
    .lt('created_at', hasta)
  if (e1) {
    console.error(e1)
    mesesCargados.current.delete(clave)
    return
  }

  const { data: divisiones, error: e2 } = await supabase
    .from('gas_divisions')
    .select('share_amount, charges!inner(id, category, description, created_at)')
    .eq('user_id', user.id)
    .gte('charges.created_at', desde)
    .lt('charges.created_at', hasta)
  if (e2) {
    console.error(e2)
    mesesCargados.current.delete(clave)
    return
  }

  const mapa = new Map()

  propios.forEach(c => {
    mapa.set(c.id, {
      id: c.id,
      category: c.category,
      description: c.description,
      importe: Number(c.amount),
      created_at: c.created_at,
    })
  })

  divisiones.forEach(d => {
    if (!d.charges) return
    mapa.set(d.charges.id, {
      id: d.charges.id,
      category: d.charges.category,
      description: d.charges.description,
      importe: Number(d.share_amount),
      created_at: d.charges.created_at,
    })
  })

  const nuevos = {}
  mapa.forEach(c => {
    const dia = fechaLocal(c.created_at)
    if (!nuevos[dia]) nuevos[dia] = []
    nuevos[dia].push(c)
  })

  setCobrosPorDia(prev => ({ ...prev, ...nuevos }))
}, [])
  const cerrar = () => {
    setAbierto(false)
    setArrastre(0)
  }

  const seleccionarDia = (dia) => {
    clearTimeout(timer.current)

    // Tocar el mismo día con el papelito abierto lo cierra
    if (abierto && diaActivo === dia) {
      cerrar()
      return
    }

    if (abierto) {
      // Baja el papelito actual y, cuando ha bajado, sube el nuevo
      setAbierto(false)
      setArrastre(0)
      timer.current = setTimeout(() => {
        setDiaActivo(dia)
        setAbierto(true)
      }, 250)
    } else {
      setDiaActivo(dia)
      setAbierto(true)
    }
  }

  const onTouchStart = e => {
    touchY.current = e.touches[0].clientY
  }

  const onTouchMove = e => {
    if (touchY.current === null) return
    const delta = e.touches[0].clientY - touchY.current
    if (delta > 0) setArrastre(delta)
  }

  const onTouchEnd = () => {
    if (arrastre > 80) cerrar()
    else setArrastre(0)
    touchY.current = null
  }

  const renderPuntos = useCallback((arg) => {
    if (arg.isOther) {
      return <span className="numero otro-mes">{arg.dayNumberText}</span>
    }

    const clave = claveDia(arg.date)
    const categorias = [...new Set((cobrosPorDia[clave] || []).map(c => c.category))]

    return (
      <>
        <span className="numero">{arg.dayNumberText}</span>
        {categorias.length > 0 && (
          <div className="puntos">
            {categorias.map(cat => (
              <span key={cat} className="punto" style={{ background: COLORES[cat] }} />
            ))}
          </div>
        )}
      </>
    )
  }, [cobrosPorDia])

  const cobrosDia = diaActivo ? (cobrosPorDia[diaActivo] || []) : []
  const total = cobrosDia.reduce((suma, c) => suma + c.importe, 0)
  const tituloDia = diaActivo
    ? new Date(diaActivo + 'T00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long',
      })
    : ''

  return (
    <div className="pantalla">
      <div className="cabecera-mes">
        <button onClick={() => calRef.current.getApi().prev()} aria-label="Mes anterior">‹</button>
        <span className="titulo-mes">{titulo}</span>
        <button onClick={() => calRef.current.getApi().next()} aria-label="Mes siguiente">›</button>
      </div>
      <div className="calendario-zona">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="es"
          firstDay={1}
          fixedWeekCount={true}
          height="100%"
          dateClick={info => seleccionarDia(info.dateStr)}
          dayCellTopContent={renderPuntos}
          ref={calRef}
          headerToolbar={false}
          datesSet={info => {
            setTitulo(info.view.title)
            const actual = info.view.currentStart
            cargarMes(actual.getFullYear(), actual.getMonth() - 1)
            cargarMes(actual.getFullYear(), actual.getMonth())
            cargarMes(actual.getFullYear(), actual.getMonth() + 1)
          }}
        />
      </div>

      <div
        className="papelito"
        style={{
          transform: abierto ? `translateY(${arrastre}px)` : 'translateY(100%)',
          transition: arrastre ? 'none' : undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="agarre" />
        <div className="papelito-cabecera">
          <strong>{tituloDia}</strong>
          <button className="cerrar" aria-label="Cerrar" onClick={cerrar}>×</button>
        </div>

        {cobrosDia.length === 0 ? (
          <p className="vacio">No tiene cobros este día.</p>
        ) : (
          <>
            <ul className="lista-cobros">
              {cobrosDia.map(c => (
                <li key={c.id}>
                  <span className="cobro-izq">
                    <span className="punto" style={{ background: COLORES[c.category] }} />
                    <span>
                      <span className="cobro-cat">{NOMBRES[c.category]}</span>
                      {c.description && <span className="cobro-desc">{c.description}</span>}
                    </span>
                  </span>
                  <strong>{eur.format(c.importe)}</strong>
                </li>
              ))}
            </ul>
            <div className="total">
              <span>Total</span>
              <span>{eur.format(total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}