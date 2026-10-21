/**
 * ============================================================
 * Archivo:   FloatingMenu.jsx
 * Versión:   1.0.1
 * Última modificación: 21-10-2026
 * ------------------------------------------------------------
 * Descripción:
 *   Menú principal flotante de la app de cobros de voleibol
 *   (sustituye a BottomNav).
 *   - Muestra un botón flotante (FAB), por defecto abajo en el centro.
 *   - Pulsación corta: abre/cierra un menú de burbujas flotantes
 *     (Dashboard, Registrar, Histórico, Calendario) que se abren
 *     en abanico hacia el centro de la pantalla.
 *   - Pulsación larga (~350 ms): activa el modo arrastre; el botón
 *     sigue al dedo/ratón y al soltarlo se pega a la pared más cercana.
 *   - La posición se guarda en localStorage y se recalcula al
 *     redimensionar la ventana.
 *   - Se cierra al navegar, al tocar fuera o con la tecla Escape.
 * ============================================================
 */
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import '../styles/FloatingMenu.css'

// ---------- Configuración ----------
const FAB_SIZE = 60           // diámetro del botón flotante (px)
const BUBBLE_SIZE = 64        // diámetro de cada burbuja (px)
const LABEL_HALF_WIDTH = 44   // mitad aprox. del ancho de la etiqueta
const LABEL_HEIGHT = 26       // alto aprox. de la etiqueta bajo la burbuja
const MARGIN = 16             // separación del botón con la pared (px)
const RADIUS = 115            // distancia de las burbujas al botón (px)
const SPREAD_DEG = 150        // apertura del abanico de burbujas (grados)
const LONG_PRESS_MS = 350     // tiempo para activar el arrastre
const MOVE_TOLERANCE = 10     // px que se puede mover el dedo sin cancelar el toque
const STORAGE_KEY = 'floatingMenu:pos'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { id: 'registrar', label: 'Registrar', path: '/registrar', icon: '➕' },
  { id: 'historico', label: 'Histórico', path: '/historico', icon: '📋' },
  { id: 'calendario', label: 'Calendario', path: '/calendario', icon: '📅' },
]

// ---------- Utilidades ----------
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

/** Lee la posición guardada ({ edge, offset }) o devuelve abajo-centro. */
const loadAnchor = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (
      saved &&
      ['top', 'bottom', 'left', 'right'].includes(saved.edge) &&
      typeof saved.offset === 'number'
    ) {
      return saved
    }
  } catch {
    /* localStorage no disponible: usamos la posición por defecto */
  }
  return { edge: 'bottom', offset: 0.5 }
}

/**
 * Convierte el "ancla" (pared + posición relativa 0..1 a lo largo de ella)
 * en coordenadas del centro del botón. Así, al cambiar el tamaño de la
 * ventana, el botón sigue pegado a la misma pared y en la misma proporción.
 */
const anchorToXY = ({ edge, offset }, w, h) => {
  const half = FAB_SIZE / 2
  const minX = MARGIN + half
  const maxX = w - MARGIN - half
  const minY = MARGIN + half
  const maxY = h - MARGIN - half

  switch (edge) {
    case 'top':
      return { x: clamp(offset * w, minX, maxX), y: minY }
    case 'left':
      return { x: minX, y: clamp(offset * h, minY, maxY) }
    case 'right':
      return { x: maxX, y: clamp(offset * h, minY, maxY) }
    case 'bottom':
    default:
      return { x: clamp(offset * w, minX, maxX), y: maxY }
  }
}

/** Calcula a qué pared está más cerca un punto y lo convierte en ancla. */
const xyToAnchor = ({ x, y }, w, h) => {
  const distances = { left: x, right: w - x, top: y, bottom: h - y }
  const edge = Object.keys(distances).reduce((a, b) =>
    distances[a] <= distances[b] ? a : b
  )
  const offset = edge === 'top' || edge === 'bottom' ? x / w : y / h
  return { edge, offset: clamp(offset, 0, 1) }
}

/**
 * Posiciona las burbujas en abanico apuntando hacia el centro de la
 * pantalla, de modo que siempre se abran "hacia dentro" esté donde esté
 * el botón. Después se recortan para que nunca se salgan de la pantalla.
 */
const getBubblePositions = (center, count, w, h) => {
  const baseAngle = Math.atan2(h / 2 - center.y, w / 2 - center.x)
  const spread = (SPREAD_DEG * Math.PI) / 180
  const halfX = Math.max(BUBBLE_SIZE / 2, LABEL_HALF_WIDTH) + 8
  const halfY = BUBBLE_SIZE / 2 + 8

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5 // de -0.5 a 0.5
    const angle = baseAngle + t * spread
    return {
      x: clamp(center.x + Math.cos(angle) * RADIUS, halfX, w - halfX),
      y: clamp(center.y + Math.sin(angle) * RADIUS, halfY, h - halfY - LABEL_HEIGHT),
    }
  })
}

// ---------- Componente ----------
const FloatingMenu = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [viewport, setViewport] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  })
  const [anchor, setAnchor] = useState(loadAnchor) // posición en reposo
  const [dragPos, setDragPos] = useState(null)     // posición mientras se arrastra
  const [isOpen, setIsOpen] = useState(false)

  // Refs para la lógica de pulsación (no necesitan re-render)
  const pressTimer = useRef(null)
  const startPoint = useRef(null)   // dónde empezó la pulsación
  const grabOffset = useRef({ x: 0, y: 0 }) // dedo respecto al centro del botón
  const isDragging = useRef(false)
  const pressCancelled = useRef(false)

  // Recalcular al redimensionar / girar el móvil
  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Cerrar el menú cuando cambia la ruta
  useEffect(() => {
    setIsOpen(false)
  }, [location.pathname])

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => e.key === 'Escape' && setIsOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen])

  // Guardar la posición del botón
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(anchor))
    } catch {
      /* sin localStorage: simplemente no se recuerda */
    }
  }, [anchor])

  // Limpiar el temporizador al desmontar
  useEffect(() => () => clearTimeout(pressTimer.current), [])

  const center = dragPos ?? anchorToXY(anchor, viewport.w, viewport.h)
  const bubbles = getBubblePositions(center, TABS.length, viewport.w, viewport.h)

  const isActive = (path) => location.pathname === path

  /** Posición del botón siguiendo al puntero, sin salirse de la pantalla. */
  const getDragXY = (e) => {
    const half = FAB_SIZE / 2
    return {
      x: clamp(e.clientX - grabOffset.current.x, half, viewport.w - half),
      y: clamp(e.clientY - grabOffset.current.y, half, viewport.h - half),
    }
  }

  // ---------- Eventos del botón flotante ----------
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return // solo clic izquierdo
    e.currentTarget.setPointerCapture(e.pointerId)

    startPoint.current = { x: e.clientX, y: e.clientY }
    grabOffset.current = { x: e.clientX - center.x, y: e.clientY - center.y }
    pressCancelled.current = false
    isDragging.current = false

    clearTimeout(pressTimer.current)
    pressTimer.current = setTimeout(() => {
      // Pulsación larga → modo arrastre
      isDragging.current = true
      setIsOpen(false)
      setDragPos(center)
      if (navigator.vibrate) navigator.vibrate(30)
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e) => {
    if (!startPoint.current) return

    if (isDragging.current) {
      setDragPos(getDragXY(e))
    } else if (!pressCancelled.current) {
      // Si el dedo se mueve antes de la pulsación larga, no es un toque
      const dist = Math.hypot(
        e.clientX - startPoint.current.x,
        e.clientY - startPoint.current.y
      )
      if (dist > MOVE_TOLERANCE) {
        pressCancelled.current = true
        clearTimeout(pressTimer.current)
      }
    }
  }

  const finishPress = (e, allowToggle) => {
    clearTimeout(pressTimer.current)
    if (!startPoint.current) return

    if (isDragging.current) {
      // Soltar → pegarse a la pared más cercana
      setAnchor(xyToAnchor(getDragXY(e), viewport.w, viewport.h))
      setDragPos(null)
      isDragging.current = false
    } else if (allowToggle && !pressCancelled.current) {
      // Pulsación corta → abrir/cerrar menú
      setIsOpen((open) => !open)
    }
    startPoint.current = null
  }

  // Activación con teclado (Enter/Espacio): click sin pulsaciones de puntero
  const handleKeyboardClick = (e) => {
    if (e.detail === 0) setIsOpen((open) => !open)
  }

  const handleNavigate = (path) => {
    navigate(path)
    setIsOpen(false)
  }

  return (
    <>
      {/* Fondo oscuro: tocarlo cierra el menú */}
      <div
        className={`fm-backdrop ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* Burbujas del menú */}
      <nav className="fm-bubbles" aria-label="Menú principal">
        {TABS.map((tab, i) => {
          const pos = bubbles[i]
          const active = isActive(tab.path)
          return (
            <button
              key={tab.id}
              type="button"
              className={`fm-bubble ${isOpen ? 'open' : ''} ${active ? 'active' : ''}`}
              style={{
                // esquina superior izquierda (no usamos translate(-50%) para
                // que ningún :hover global pueda descolocar la burbuja)
                left: pos.x - BUBBLE_SIZE / 2,
                top: pos.y - BUBBLE_SIZE / 2,
                '--dx': `${center.x - pos.x}px`,  // desde dónde "sale" la burbuja
                '--dy': `${center.y - pos.y}px`,
                '--delay': `${i * 50}ms`,          // aparición escalonada
                '--float-delay': `${i * -0.7}s`,   // cada una flota a su ritmo
              }}
              onClick={() => handleNavigate(tab.path)}
              tabIndex={isOpen ? 0 : -1}
              aria-hidden={!isOpen}
              aria-current={active ? 'page' : undefined}
            >
              <span className="fm-bubble-inner">
                <span className="fm-bubble-icon">{tab.icon}</span>
                <span className="fm-bubble-label">{tab.label}</span>
              </span>
            </button>
          )
        })}
      </nav>

      {/* Botón flotante */}
      <button
        type="button"
        className={`fm-fab ${isOpen ? 'open' : ''} ${dragPos ? 'dragging' : ''}`}
        style={{ left: center.x - FAB_SIZE / 2, top: center.y - FAB_SIZE / 2 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => finishPress(e, true)}
        onPointerCancel={(e) => finishPress(e, false)}
        onClick={handleKeyboardClick}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
        aria-expanded={isOpen}
      >
        <span className="fm-fab-icon">{isOpen ? '✕' : '🏐'}</span>
      </button>
    </>
  )
}

export default FloatingMenu