/**
 * ============================================================
 * Archivo:   FloatingMenu.jsx
 * Autor:     Alejandro Gomez Garcia
 * Versión:   1.1.1
 * Última modificación: 29-10-2026
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
 *   - NUEVO (1.1.0): tiene en cuenta las zonas seguras del móvil
 *     (notch / isla dinámica y barra de inicio). En reposo abajo
 *     queda justo encima de la barra de inicio, y al arrastrarlo
 *     llega hasta el borde de la zona segura sin meterse debajo.
 *   - MEJORADO (1.1.0): recalcula el tamaño de pantalla también al
 *     girar el móvil y cuando cambia el viewport visual (teclado).
 *   - CORREGIDO (1.1.1): el alto de pantalla se mide en #root en vez
 *     de window.innerHeight, que en modo app de iOS se queda corto y
 *     dejaba el botón más alto de lo debido.
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
 * Mide las zonas seguras reales del dispositivo (en px).
 * env(safe-area-inset-*) solo se puede leer desde CSS, así que se
 * aplica a un elemento invisible y se lee su padding calculado.
 */
const readSafeInsets = () => {
  try {
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);' +
      'padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);'
    document.body.appendChild(probe)
    const cs = getComputedStyle(probe)
    const insets = {
      top: parseFloat(cs.paddingTop) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
      right: parseFloat(cs.paddingRight) || 0,
    }
    probe.remove()
    return insets
  } catch {
    return { top: 0, bottom: 0, left: 0, right: 0 }
  }
}

/**
 * Tamaño de la pantalla + zonas seguras.
 * El alto se toma de #root y no de window.innerHeight: en modo app de
 * iOS, innerHeight resta la barra de estado (793 en vez de 852 en un
 * iPhone 16) y el botón quedaba demasiado alto. #root mide la pantalla
 * real gracias al 100lvh de index.css.
 */
const readViewport = () => {
  const root = document.getElementById('root')
  const rootH = root ? root.getBoundingClientRect().height : 0
  return {
    w: window.innerWidth,
    h: rootH > 0 ? rootH : window.innerHeight,
    ...readSafeInsets(),
  }
}

/**
 * Límites para el centro del botón en reposo: separado MARGIN de cada
 * pared, o lo que mida la zona segura si es mayor (así abajo queda justo
 * encima de la barra de inicio del iPhone y arriba bajo la isla dinámica).
 */
const restBounds = (vp) => {
  const half = FAB_SIZE / 2
  return {
    minX: Math.max(MARGIN, vp.left) + half,
    maxX: vp.w - Math.max(MARGIN, vp.right) - half,
    minY: Math.max(MARGIN, vp.top) + half,
    maxY: vp.h - Math.max(MARGIN, vp.bottom) - half,
  }
}

/**
 * Convierte el "ancla" (pared + posición relativa 0..1 a lo largo de ella)
 * en coordenadas del centro del botón. Así, al cambiar el tamaño de la
 * ventana, el botón sigue pegado a la misma pared y en la misma proporción.
 */
const anchorToXY = ({ edge, offset }, vp) => {
  const { w, h } = vp
  const { minX, maxX, minY, maxY } = restBounds(vp)

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
const getBubblePositions = (center, count, vp) => {
  const { w, h } = vp
  const baseAngle = Math.atan2(h / 2 - center.y, w / 2 - center.x)
  const spread = (SPREAD_DEG * Math.PI) / 180
  const halfX = Math.max(BUBBLE_SIZE / 2, LABEL_HALF_WIDTH) + 8
  const halfY = BUBBLE_SIZE / 2 + 8

  return Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1) - 0.5 // de -0.5 a 0.5
    const angle = baseAngle + t * spread
    return {
      x: clamp(center.x + Math.cos(angle) * RADIUS, vp.left + halfX, w - vp.right - halfX),
      y: clamp(
        center.y + Math.sin(angle) * RADIUS,
        vp.top + halfY,
        h - vp.bottom - halfY - LABEL_HEIGHT
      ),
    }
  })
}

// ---------- Componente ----------
const FloatingMenu = () => {
  const navigate = useNavigate()
  const location = useLocation()

  const [viewport, setViewport] = useState(readViewport)
  const [anchor, setAnchor] = useState(loadAnchor) // posición en reposo
  const [dragPos, setDragPos] = useState(null)     // posición mientras se arrastra
  const [isOpen, setIsOpen] = useState(false)

  // Refs para la lógica de pulsación (no necesitan re-render)
  const pressTimer = useRef(null)
  const startPoint = useRef(null)   // dónde empezó la pulsación
  const grabOffset = useRef({ x: 0, y: 0 }) // dedo respecto al centro del botón
  const isDragging = useRef(false)
  const pressCancelled = useRef(false)

  // Recalcular al redimensionar, girar el móvil o cambiar el viewport visual
  useEffect(() => {
    const onResize = () => setViewport(readViewport())
    const vv = window.visualViewport
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    vv?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
      vv?.removeEventListener('resize', onResize)
    }
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

  const center = dragPos ?? anchorToXY(anchor, viewport)
  const bubbles = getBubblePositions(center, TABS.length, viewport)

  const isActive = (path) => location.pathname === path

  /**
   * Posición del botón siguiendo al puntero, sin salirse de la zona
   * segura (ni bajo la isla dinámica ni bajo la barra de inicio).
   */
  const getDragXY = (e) => {
    const half = FAB_SIZE / 2
    return {
      x: clamp(
        e.clientX - grabOffset.current.x,
        viewport.left + half,
        viewport.w - viewport.right - half
      ),
      y: clamp(
        e.clientY - grabOffset.current.y,
        viewport.top + half,
        viewport.h - viewport.bottom - half
      ),
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