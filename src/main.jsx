/**
 * ============================================================
 * Archivo:   main.jsx
 * Autor:     Alejandro Gomez Garcia
 * Versión:   1.1.0
 * Última modificación: 29-10-2026
 * ------------------------------------------------------------
 * Descripción:
 *   Punto de arranque de React para la app de cobros de voleibol.
 *   - Carga los estilos globales (index.css) y monta <App /> en #root.
 *   - NUEVO (1.1.0): bloqueo del zoom con dos dedos en iOS. Safari
 *     ignora user-scalable=no del viewport, así que se cancelan sus
 *     gestos de pellizco (gesturestart/gesturechange/gestureend) y
 *     cualquier movimiento táctil con más de un dedo.
 * ============================================================
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ------------------------------------------------------------
// Bloqueo de zoom con dos dedos (pellizco)
// - Android ya lo bloquea con el viewport de index.html.
// - iOS necesita cancelar el gesto a mano. passive: false es
//   obligatorio para que preventDefault() tenga efecto.
// ------------------------------------------------------------
const cancelarGesto = (e) => e.preventDefault()

;['gesturestart', 'gesturechange', 'gestureend'].forEach((evento) =>
  document.addEventListener(evento, cancelarGesto, { passive: false })
)

document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault()
  },
  { passive: false }
)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
