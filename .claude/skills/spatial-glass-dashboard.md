---
name: "spatial-glass-dashboard"
description: "Construir dashboards glassy tipo visionOS con animaciones Liquid Glass sutiles: cristal ahumado sobre fondo de color o escenas, indicadores líquidos y widgets flotantes. React + Tailwind."
---

# Spatial Glass Dashboard (estilo visionOS + Liquid Glass)

Usa esta skill cuando el usuario pida un dashboard, panel o widget "glassy", "glass", "visionOS", "Liquid Glass", "Apple Vision", "cristal" o "frosted". El objetivo es una interfaz que parezca ventanas de cristal ahumado flotando en el espacio, cuyos elementos se mueven con la suavidad de un líquido, no el glassmorphism genérico de degradados morados.

Stack por defecto: React + TypeScript + Tailwind CSS + framer-motion + lucide-react. Si el proyecto no usa React, aplica los mismos tokens en CSS plano y las animaciones con Web Animations API / requestAnimationFrame.

## Principios del estilo

1. **El fondo tiene color y se elige junto al acento.** Por defecto, un color plano complementario del acento; también puede ser una secuencia de escenas abstractas cambiantes o, solo si se pide, una foto. Nunca negro puro ni blanco. Detalles en "Fondo".
2. **Cristal ahumado, no blanco lechoso.** Paneles oscuros translúcidos con desenfoque fuerte y saturación alta, de modo que el color del fondo tiña el panel.
3. **Ventana principal + ornamentos.** Una ventana grande (sidebar + contenido) y, a su derecha, una columna de widgets flotantes independientes, separados por aire, como en visionOS.
4. **Jerarquía tipográfica con contraste de familias.** Cifras grandes y títulos en serif elegante; etiquetas, navegación y metadatos en sans pequeña y con opacidad reducida.
5. **Un solo acento saturado.** Casi todo es neutro (blanco con opacidades). Un único widget o elemento usa el acento en cristal saturado; en las gráficas, solo la barra/serie destacada lleva color.
6. **Movimiento líquido, sutil y natural.** Los indicadores de selección se deslizan como una gota que apenas se estira con la velocidad y se asienta sin rebotar; los componentes ceden muy ligeramente al pulsarlos. La animación se intuye más que se ve: si llama la atención por sí misma, es demasiado. Detalles en "Liquid Glass".
7. **Luz natural.** La interacción con el cursor se expresa como un reflejo en el filo del cristal, nunca como un foco circular sobre la superficie.

## Tokens

```css
:root {
  /* Fondo (ver "Fondo") */
  --bg-base: oklch(0.26 0.07 50);   /* complementario del acento azul: ámbar oscuro */
  --bg-glow: oklch(0.36 0.08 52);   /* luz del viñeteado central */

  /* Superficies: neutras; el color lo aporta el fondo vía saturate() */
  --glass-bg: rgba(18, 16, 20, 0.34);          /* panel principal */
  --glass-bg-strong: rgba(12, 10, 14, 0.40);   /* tarjetas internas / tablas */
  --glass-bg-light: rgba(255, 255, 255, 0.07); /* sidebar, chips, inputs */
  --glass-accent: rgba(60, 100, 205, 0.55);    /* widget de acento */
  --glass-blur: 40px;
  --glass-saturate: 180%;

  /* Bordes y luz */
  --glass-border: rgba(255, 255, 255, 0.15);
  --glass-highlight: rgba(255, 255, 255, 0.24); /* filo superior iluminado */
  --glass-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.55);

  /* Texto */
  --text-primary: rgba(255, 255, 255, 0.96);
  --text-secondary: rgba(255, 255, 255, 0.62);
  --text-tertiary: rgba(255, 255, 255, 0.40);

  /* Datos */
  --data-accent: #5b8cff;
  --data-positive: #6ee7b7;
  --data-warning: #fbbf24;
  --data-violet: #a78bfa;

  /* Radios */
  --radius-window: 32px;
  --radius-card: 22px;
  --radius-pill: 999px;

  /* Movimiento: overshoot muy leve */
  --spring: cubic-bezier(.3, 1.18, .5, 1);
}
```

Tipografía: serif de display para cifras y títulos ("Instrument Serif", "Fraunces" o "Newsreader"; fallback Georgia). Sans para UI ("Inter", "Geist" o system-ui). Cifras con `font-variant-numeric: tabular-nums` en tablas, no en los KPI grandes.

## Fondo

Tres modos. Usa el que pida el usuario; si no dice nada, **color plano**. Si el dashboard lo permite, ofrece un selector Plano / Escenas en un widget.

### A. Color plano complementario (por defecto)

- El fondo es el complementario del acento: tono del acento + 180°, oscuro y poco saturado. Con acento azul `#5b8cff` (tono ~225°) sale un ámbar/terracota oscuro (tono ~45-50°).
- Regla: `oklch(L C H)` con L entre 0.22 y 0.32, C entre 0.06 y 0.09, H = tono del acento + 180°. Si cambia el acento, recalcula el fondo.
- "Plano" no significa sin profundidad: añade un viñeteado radial muy sutil y grano/ruido al 3-5% de opacidad. Así el desenfoque tiene algo que capturar sin que se vean manchas.
- Con fondo plano, el cristal se lee sobre todo por el filo de luz, la sombra y el tinte; sube `--glass-border` a 0.18 si los paneles se pierden.

```css
body {
  background:
    radial-gradient(ellipse at 45% 38%, var(--bg-glow), transparent 70%),
    var(--bg-base);
  min-height: 100dvh;
}
```

### B. Escenas cambiantes

- Elige 3-5 escenas abstractas hechas con CSS (sin fotos): un color base + 2-3 manchas difusas grandes (divs con `border-radius:50%` y `filter: blur(90px)`), en armonía con el acento (complementario, análogos o el propio acento muy oscurecido).
- Transición: fundido cruzado de 1.5-2 s cada 12-30 s, y manchas que derivan despacio (animación de `transform` de 40-60 s, `alternate`). Nunca cambios bruscos ni animar el blur.
- Escenas de ejemplo con acento azul:
  - Ámbar: base `#2b1d12`, manchas `#8a5a2b`, `#3d5a99`, `#b07a3c`
  - Noche: base `#0f1424`, manchas `#2f4f9e`, `#6b4fa0`, `#1e3a6e`
  - Arcilla: base `#2a1612`, manchas `#a0553a`, `#c7894f`, `#5c2e22`
  - Niebla: base `#1b1f26`, manchas `#4a5a73`, `#8a7a66`, `#2d3a4d`
- Implementación: capa `fixed inset-0 -z-10` con una escena por div apilada, alternando `opacity`.
- Con `prefers-reduced-motion`: escena fija, sin deriva.

### C. Foto (opcional)

Solo si el usuario la pide o la aporta. Interior o paisaje desenfocado, `object-cover`, WebP/AVIF de 200-400 KB, con una capa oscura encima al 20-30% para asegurar el contraste.

## CSS base

```css
.glass {
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  border: 1px solid var(--glass-border);
  box-shadow:
    inset 0 1px 0 var(--glass-highlight),   /* filo de luz arriba */
    inset 0 -1px 0 rgba(0,0,0,0.25),
    var(--glass-shadow);
  border-radius: var(--radius-window);
}
.glass-card {
  background: var(--glass-bg-strong);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.10);
  border-radius: var(--radius-card);
}
.glass-accent {
  background: linear-gradient(160deg, rgba(120,160,245,0.72), var(--glass-accent));
}
```

Las tarjetas internas NO llevan su propio backdrop-filter (ya están dentro de un panel desenfocado); así se evita el coste de rendimiento y el efecto barro.

En Tailwind, registra estas clases en `@layer components` y añade las fuentes en `theme.extend.fontFamily` como `serif-display` y `sans`.

## Luz al pasar el cursor (`.spec`)

Nada de foco circular sobre la superficie. Dos capas:

1. **Filo iluminado** (`::after`): un degradado radial centrado en el cursor que solo se ve en el borde de 1px, gracias a una máscara que recorta el interior. Brilla más cerca del cursor y se desvanece a lo largo del contorno.
2. **Velo interior** (`::before`): un degradado radial muy amplio (480px) al 3.5% de opacidad. Da volumen sin que se perciba como mancha.

Ambas aparecen y desaparecen despacio (0.7-0.9 s) y la posición sigue al cursor con inercia (interpolación), no pegada a él.

```css
.spec { position: relative; }
.spec::after {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  opacity: 0; transition: opacity .7s ease; padding: 1px;
  background: radial-gradient(180px circle at var(--mx,50%) var(--my,0%),
              rgba(255,255,255,.42), rgba(255,255,255,.08) 45%, transparent 75%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0);
}
.spec::before {
  content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  opacity: 0; transition: opacity .9s ease;
  background: radial-gradient(480px circle at var(--mx,50%) var(--my,0%), rgba(255,255,255,.035), transparent 65%);
}
.spec:hover::after, .spec:hover::before { opacity: 1; }
```

```ts
// La luz sigue al cursor con inercia (lerp 0.09 por frame)
function wireSpec(el: HTMLElement) {
  const st = { x: 0, y: 0, tx: 0, ty: 0, run: false };
  const loop = () => {
    st.x += (st.tx - st.x) * .09; st.y += (st.ty - st.y) * .09;
    el.style.setProperty('--mx', st.x + 'px'); el.style.setProperty('--my', st.y + 'px');
    if (Math.abs(st.tx - st.x) + Math.abs(st.ty - st.y) > .5) requestAnimationFrame(loop); else st.run = false;
  };
  const target = (e: PointerEvent) => { const r = el.getBoundingClientRect(); st.tx = e.clientX - r.left; st.ty = e.clientY - r.top; };
  el.addEventListener('pointerenter', e => { target(e); st.x = st.tx; st.y = st.ty; loop(); });
  el.addEventListener('pointermove', e => { target(e); if (!st.run) { st.run = true; requestAnimationFrame(loop); } });
}
```

Con `prefers-reduced-motion`, sin interpolación (posición directa). En React, un hook `useSpecular(ref)` que haga lo mismo en un `useEffect`.

## Liquid Glass

Inspirado en el Liquid Glass de Apple: el cristal se comporta como un líquido viscoso. Calibrado para ser **sutil**: sin rebotes visibles, deformaciones del 1-2% y estiramientos pequeños.

### 1. Indicador líquido (sidebar, segmented controls, pestañas, listas)

Todo marcador de selección (item activo del sidebar, "Este año / Año pasado", pestañas de filtro, selector Día/Semana/Mes, mensaje seleccionado) usa este indicador, nunca un fondo que aparece de golpe.

Anatomía:
- **Cabeza**: gota con muelle casi críticamente amortiguado (k=260, c=30) que va al destino y anima también ancho y alto. Llega con desaceleración suave, sin rebote.
- **Cola**: segunda gota al 92% del tamaño con muelle algo más lento (k=190, c=27). Va casi pegada a la cabeza; solo da un leve rastro.
- Ambas gotas son blancas dentro de una capa con filtro SVG **goo** y `opacity: .09`: el rastro líquido se intuye como un reflejo, no como una gota que se separa.
- **Lente**: píldora de cristal que sigue a la cabeza, con filo de luz (`inset 0 1px 0 rgba(255,255,255,.38)`), degradado blanco 10%→2%, sombra suave y, en Chromium, `backdrop-filter: url(#refract)` con una distorsión muy leve.
- **Estiramiento por velocidad**: `s = min(|v|/7000, .12)`. En eje vertical: `scale(1 - s*.4, 1 + s)`; en horizontal: `scale(1 + s, 1 - s*.4)`. Solo se nota en desplazamientos largos y rápidos.
- Simula con `requestAnimationFrame` y subpasos de ~1/240 s; para el bucle cuando velocidades y distancias son casi cero y haz `snap` al destino. `ResizeObserver` en el contenedor para recolocar sin animar.
- Si se pulsa el item ya activo: `jelly(lente, .015)`.

Filtros SVG (una vez por página):

```html
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
  <filter id="goo" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
    <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/>
  </filter>
  <filter id="refract" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="1" seed="4" result="t"/>
    <feGaussianBlur in="t" stdDeviation="2" result="tb"/>
    <feDisplacementMap in="SourceGraphic" in2="tb" scale="6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</defs></svg>
```

La refracción con `backdrop-filter: url()` solo funciona en Chromium: actívala con una clase (`.refract`) tras detectar el navegador; en el resto basta la lente sin refracción.

Núcleo del indicador (vanilla; en React, envuélvelo en un hook `useLiquidIndicator(ref, activeIndex, axis)` que cree las capas en un `useEffect`):

```ts
type S = { x:number; y:number; w:number; h:number; vx:number; vy:number; vw:number; vh:number };

function liquidStep(a: S, b: Pick<S,'x'|'y'|'vx'|'vy'>, t: {x:number;y:number;w:number;h:number}, dt: number) {
  const n = Math.ceil(dt / (1/240)), h = dt / n;
  for (let i = 0; i < n; i++) {
    for (const k of ['x','y','w','h'] as const) { const f = 260*(t[k]-a[k]) - 30*a[`v${k}`]; a[`v${k}`] += f*h; a[k] += a[`v${k}`]*h; }
    for (const k of ['x','y'] as const)         { const f = 190*(t[k]-b[k]) - 27*b[`v${k}`]; b[`v${k}`] += f*h; b[k] += b[`v${k}`]*h; }
  }
}

function liquidTransform(a: S, axis: 'x'|'y') {
  const v = axis === 'y' ? a.vy : a.vx, s = Math.min(Math.abs(v)/7000, .12);
  const sx = axis === 'y' ? 1 - s*.4 : 1 + s, sy = axis === 'y' ? 1 + s : 1 - s*.4;
  return `translate(${a.x}px,${a.y}px) scale(${sx},${sy})`;   // cabeza y lente; la cola solo translate (centrada, al 92%)
}
```

Estructura del contenedor: `position:relative; isolation:isolate`; primero la capa goo (`absolute inset-0`, `filter:url(#goo)`, z-0) con cola y cabeza, luego la lente (z-1) y encima los items (z-2) con color de texto que pasa de `--text-secondary` a `--text-primary` al activarse.

### 2. Deformación de componentes (jelly sutil)

Usa la propiedad individual `scale` (no `transform`) para no pisar `translate` de los hovers. Un solo rebote apenas perceptible:

```ts
function jelly(el: HTMLElement, k = .01) {
  el.animate([
    { scale: '1 1' },
    { scale: `${1+k} ${1-k}`, offset: .35 },
    { scale: `${1-k*.3} ${1+k*.3}`, offset: .7 },
    { scale: '1 1' },
  ], { duration: 700, easing: 'cubic-bezier(.25,.8,.3,1)' });
}
```

Dónde y cuánto:
- **Pulsar** tarjetas, botones, días del calendario, tarjetas de kanban: en `pointerdown` hundir a `scale: .988 .982` (120 ms); en `pointerup` soltar con `jelly(el, .01)`.
- **Cambio de pantalla**: la ventana NO se deforma. Los widgets flotantes hacen una onda casi imperceptible: `jelly(widget, .006)` escalonado 80 ms.
- **Interruptores**: el pomo se alarga levemente (20→23→20 px) mientras viaja, 420 ms con `cubic-bezier(.3,1.1,.5,1)`. Sin jelly en el carril.
- **Botones que mutan**: un botón circular `+` se expande a píldora con texto ("Recargar") al hover animando `max-width` y `padding` con `--spring`.
- **Hover**: tarjetas `translate: 0 -2px` con `--spring`; filas de tabla solo cambian de fondo (sin desplazarse); luz de filo `.spec`.

### 3. Transiciones de contenido

- Salida: `opacity 1→0`, `filter blur(0→6px)`, `scale 1→.996`, 220 ms ease-in.
- Entrada: `opacity 0→1`, `filter blur(6px→0)`, `scale 1.006→1`, 520 ms `cubic-bezier(.2,.8,.2,1)`; las tarjetas entran escalonadas 30 ms con `translate 0 4px→0`.
- Filtros de tabla: las filas que aparecen hacen un fundido con blur 2px, 400 ms, escalonado 30 ms.
- Barras de gráfica al cambiar de serie: `height` con `--spring` y `transition-delay` escalonado 25 ms.
- En framer-motion: `AnimatePresence mode="wait"` con `initial/animate/exit` equivalentes; para indicadores `transition={{ type:'spring', stiffness:260, damping:30 }}` (`layoutId` sirve como base; añade el estiramiento por velocidad con `useVelocity`).

Límites: k ≤ .015 en elementos pequeños, ≤ .006 en widgets, 0 en la ventana; estiramiento máx. 12%; nada de rebotes visibles. Si alguien nota la animación antes que el contenido, es demasiado.

## Layout

```
┌──────────────────── fondo: color o escenas cambiantes ────────────────────┐
│   ┌──────────── ventana .glass ─────────────┐   ┌─ selector fondo ┐     │
│   │ sidebar  │ Título serif + subtítulo     │   ┌─ widget acento ─┐     │
│   │ (avatar, │ [KPI][KPI][KPI][KPI]         │   │ 3,241  ▮▮▮▮▮▮   │     │
│   │  nav con │ [Gráfica grande   ][Donut  ] │   ┌─ widget ────────┐     │
│   │  gota    │ [Ranking          ][Funnel ] │   │ $2,450   (+)    │     │
│   │  líquida)│                              │   ┌─ widget ────────┐     │
│   └──────────┴──────────────────────────────┘   │ 95,215  ∿ curva │     │
│                 ── • ━━━ (barra de ventana)     └─────────────────┘     │
└───────────────────────────────────────────────────────────────────────────┘
```

- Ventana principal: ancho máx. ~1000px, alto fijo (~640px) con scroll interno en el contenido, `p-2.5`; sidebar ~208px con fondo `--glass-bg-light` y radio interior `calc(var(--radius-window) - 10px)`.
- Sidebar: avatar + nombre del workspace arriba; items de 36px con icono lucide 16px + label 13px en `--text-secondary`; el activo marcado por el indicador líquido; badges del color de acento; ajustes y soporte abajo.
- Cabecera de contenido: título serif ~30px, subtítulo sans 12px en `--text-tertiary`, acciones a la derecha en píldoras (botón primario del color de acento, sólido, con filo de luz y sombra del acento).
- Fila de 4 KPI con `gap-2.5`; grid inferior 2/3 + 1/3.
- Debajo de la ventana: indicador estilo visionOS (un punto + una barra corta, blancos al 55%) que se alarga al hover.
- Columna de widgets: ~250px, separada 22px de la ventana; el de acento usa `.glass-accent`.
- Responsive: por debajo de ~1320px los widgets pasan debajo en fila; por debajo de `md` el sidebar se convierte en barra de iconos (el indicador sigue funcionando).

## Componentes

### StatsCard (KPI)

```tsx
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';

type Props = { title: string; value: string; change: number; icon: LucideIcon };

export function StatsCard({ title, value, change, icon: Icon }: Props) {
  const up = change >= 0;
  return (
    <motion.div
      whileHover={{ y: -2 }}
      whileTap={{ scaleX: .988, scaleY: .982 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="glass-card spec p-4 flex flex-col gap-2.5"
    >
      <div className="size-8 rounded-full bg-white/10 grid place-items-center">
        <Icon size={14} className="text-white/80" />
      </div>
      <div>
        <p className="text-[11px] text-white/40">{title}</p>
        <p className="font-serif-display text-3xl text-white/95 leading-tight">{value}</p>
      </div>
      <span className={`inline-flex w-fit items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] ${up ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300'}`}>
        {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
        {Math.abs(change)}%
      </span>
    </motion.div>
  );
}
```

### Gráfica de barras

- Barras redondeadas por completo, relleno blanco con degradado vertical de 0.55 a 0.12 de opacidad y filo de luz, como cristal esmerilado.
- Solo la barra seleccionada/actual en `--data-accent` con degradado y glow suave.
- Sin rejilla o con líneas al 6% de opacidad; etiquetas 10px en `--text-tertiary`.
- Tooltip como mini panel oscuro con blur que aparece con escala 0.9→1 y `--spring`.
- Selector de periodo con indicador líquido horizontal.

### Donut / fuentes

Anillo grueso con huecos entre segmentos (strokeLinecap round), cifra total en serif en el centro, leyenda de puntos de color debajo.

### Funnel / progreso

Barras horizontales en píldora con degradado acento → violeta, centradas, valor a la derecha en `--text-secondary`.

### Tabla (leads, contactos)

- Filas sin bordes visibles; hover solo con `bg-white/5`.
- Avatar circular con iniciales sobre degradado pastel, nombre + subtítulo.
- Chips de estado tipo píldora con punto de color.
- Mini barra de puntuación coloreada (verde/ámbar/gris) + número.
- Pestañas de filtro con indicador líquido; las filas filtradas entran con fundido + blur leve.

### Widgets flotantes

- **Acento**: etiqueta pequeña, cifra serif grande, delta en píldora, mini gráfica de barras blancas sólidas con la última barra rayada (proyección).
- **Saldo/créditos**: icono + etiqueta, cifra serif, botón `+` que muta a píldora "Recargar" al hover.
- **Serie temporal**: cifra serif, selector `Siempre ⌄`, curva suave blanca de 2px sin relleno, con punto final brillante (círculo blanco con glow).
- **Ajuste rápido**: interruptor líquido.
- Icono de "agarre" muy tenue en la esquina superior derecha.

## Animación general

- Entrada inicial: ventana `opacity 0→1, y 12→0, scale 0.99→1` en 0.5s easeOut; widgets escalonados 80 ms desde la derecha.
- Respeta `prefers-reduced-motion`: indicadores saltan sin animación, sin jelly, sin blur en transiciones, luz sin inercia, escena de fondo fija.

## Accesibilidad y rendimiento

- Contraste: el texto principal siempre ≥ 90% de opacidad sobre cristal oscuro; si el fondo es claro, sube la opacidad de `--glass-bg` a 0.5+.
- Fallback sin `backdrop-filter` (`@supports not (backdrop-filter: blur(1px))`): fondo sólido `rgba(20,18,22,0.92)`.
- Máximo ~5-6 elementos con `backdrop-filter` en pantalla (ventana + widgets + lentes). Nunca en filas de lista.
- Anima solo `transform`, `scale`, `translate`, `opacity` y, puntualmente, `filter: blur` en transiciones cortas de pantalla. Nada en bucle salvo la deriva de escenas.
- Bucles rAF (indicador y luz) se detienen al asentarse.
- Indicadores accesibles: los items son `button` o `role="tab"` con `aria-selected`; el indicador es decorativo (`aria-hidden`).

## Errores a evitar

- Fondo negro puro, blanco o degradado neón morado/rosa: el cristal se queda sin color que capturar.
- Fondo que no armoniza con el acento (por ejemplo, fondo azul con acento azul: todo se funde).
- Cristal blanco lechoso con texto oscuro: es otro estilo.
- Todos los números en sans: se pierde el carácter editorial.
- Varios acentos de color compitiendo.
- Bordes gruesos o sombras duras.
- Anidar backdrop-filter dentro de backdrop-filter.
- Foco de luz circular sobre la superficie al hacer hover: usa la luz de filo.
- Indicadores que aparecen de golpe, que se deslizan rígidos o, al revés, que se estiran y rebotan de forma visible.
- Jelly exagerado, deformar la ventana entera o desplazar filas al hover.
- Usar `transform` para el jelly cuando el elemento ya tiene un `transform` de hover: usa `scale`/`translate` individuales.

## Checklist final

- [ ] El fondo sigue uno de los modos de "Fondo", armoniza con el acento y su color se nota a través del cristal.
- [ ] Ventana principal + columna de widgets separados.
- [ ] Cifras en serif, etiquetas en sans pequeña y tenue.
- [ ] Un único acento.
- [ ] Filo de luz superior en paneles y luz de filo con inercia al hover.
- [ ] Todo selector usa el indicador líquido con los valores sutiles (k 260/c 30, estiramiento ≤ 12%, goo al 9%).
- [ ] Pulsaciones con hundimiento leve + jelly ≤ .015; cambio de pantalla con blur 6px y onda casi imperceptible en widgets.
- [ ] reduced-motion respetado y fallback sin backdrop-filter.
