/**
 * ============================================================
 * Archivo:   diagnostico.js
 * Autor:     Alejandro Gomez Garcia
 * Versión:   1.0.0
 * Última modificación: 29-10-2026
 * ------------------------------------------------------------
 * Descripción:
 *   Panel TEMPORAL de diagnóstico de pantalla (borrar al terminar).
 *   - Muestra arriba las medidas que iOS/Android dan a la app:
 *     innerHeight, visualViewport, screen, 100vh/dvh/lvh/svh,
 *     tamaño de body y #root, zonas seguras y modo standalone.
 *   - Dibuja un marco magenta en position: fixed; inset: 0 (donde
 *     el navegador cree que acaba la pantalla) y una línea cian a
 *     la altura de screen.height (donde acaba la pantalla física).
 *   - Tocar el panel lo minimiza / lo vuelve a abrir.
 *   - Se activa con un solo import en main.jsx.
 * ============================================================
 */

const crear = (css) => {
  const el = document.createElement('div')
  el.style.cssText = css
  document.body.appendChild(el)
  return el
}

// Mide una longitud CSS (p. ej. '100dvh' o 'env(safe-area-inset-top)')
const medirAlto = (valor) => {
  const el = crear(`position:fixed;top:0;left:0;width:0;visibility:hidden;height:${valor};`)
  const h = el.getBoundingClientRect().height
  el.remove()
  return Math.round(h * 10) / 10
}

const medirPadding = (lado) => {
  const el = crear(`position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;padding-${lado}:env(safe-area-inset-${lado},0px);`)
  const v = parseFloat(getComputedStyle(el)[`padding${lado[0].toUpperCase()}${lado.slice(1)}`]) || 0
  el.remove()
  return v
}

const iniciar = () => {
  // Marco magenta: lo que el navegador considera "toda la pantalla"
  crear('position:fixed;inset:0;border:3px solid magenta;pointer-events:none;z-index:99998;')

  // Línea cian: dónde acaba la pantalla física (screen.height)
  const linea = crear('position:fixed;left:0;right:0;height:3px;background:cyan;pointer-events:none;z-index:99998;')

  const panel = crear(
    'position:fixed;top:calc(env(safe-area-inset-top,0px) + 4px);left:8px;right:8px;' +
    'z-index:99999;background:rgba(0,0,0,0.85);color:#0f0;font:12px/1.35 monospace;' +
    'padding:8px 10px;border-radius:8px;white-space:pre;overflow:hidden;'
  )

  let minimizado = false
  panel.addEventListener('click', () => {
    minimizado = !minimizado
    actualizar()
  })

  const actualizar = () => {
    const vv = window.visualViewport
    const body = document.body.getBoundingClientRect()
    const root = document.getElementById('root')?.getBoundingClientRect()

    linea.style.top = `${screen.height - 3}px`

    if (minimizado) {
      panel.textContent = 'DIAG (toca para abrir)'
      return
    }

    panel.textContent = [
      `standalone: ${matchMedia('(display-mode: standalone)').matches} / navigator.standalone: ${navigator.standalone}`,
      `screen:        ${screen.width} x ${screen.height}  (dpr ${devicePixelRatio})`,
      `innerW/H:      ${innerWidth} x ${innerHeight}`,
      `clientHeight:  ${document.documentElement.clientHeight}`,
      `visualViewport:${vv ? ` ${Math.round(vv.width)} x ${Math.round(vv.height)}  top ${Math.round(vv.offsetTop)}  scale ${vv.scale}` : ' n/a'}`,
      `100vh:  ${medirAlto('100vh')}   100dvh: ${medirAlto('100dvh')}`,
      `100lvh: ${medirAlto('100lvh')}   100svh: ${medirAlto('100svh')}`,
      `body:   top ${Math.round(body.top)}  alto ${Math.round(body.height)}`,
      `#root:  top ${Math.round(root?.top ?? -1)}  alto ${Math.round(root?.height ?? -1)}`,
      `safe:   top ${medirPadding('top')}  bottom ${medirPadding('bottom')}  left ${medirPadding('left')}  right ${medirPadding('right')}`,
      `orientación: ${screen.orientation?.type ?? 'n/a'}`,
      '(toca para minimizar)',
    ].join('\n')
  }

  actualizar()
  window.addEventListener('resize', actualizar)
  window.visualViewport?.addEventListener('resize', actualizar)
  setTimeout(actualizar, 500)
  setTimeout(actualizar, 2000)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciar)
} else {
  iniciar()
}