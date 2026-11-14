# Abaqo — Arquitectura

Nov 5, 2026 · @Juan

## Visión y objetivos

Abaqo es una app de presupuesto mensual por sobres alrededor del sueldo, construida sobre Firefly III: reparte el sueldo entre categorías, clasifica los gastos sola y solo te pregunta lo que no sabe. Firefly guarda las transacciones; Abaqo aporta los sobres, la bandeja de entrada, la experiencia móvil y el enfoque en bancos españoles.

**Objetivos**

- Repartir el sueldo cada mes en sobres por categoría, con reglas de sobrante (Acumulativo, Traspaso) y de faltante (Préstamo, Ladrón).
- Objetivos por categoría con margen y avisos.
- Que los movimientos entren solos cada día desde Santander (Enable Banking, PSD2).
- Clasificar automáticamente: primero reglas, luego Jev con umbral de confianza, y convertir en reglas los cobros que se repiten.
- Bandeja de entrada en el móvil para lo dudoso.
- Dashboard completo en el ordenador; en el móvil, solo el día a día: bandeja, gasto manual, resumen del mes, alertas y objetivos.
- Instalable por cualquiera con un `docker compose up` y publicado en GitHub como código abierto.

**Fuera de alcance**

- Rehacer la contabilidad, las cuentas o la importación: eso ya lo hace Firefly.
- Uso comercial, multiusuario o alojamiento en la nube.
- Operar en bolsa desde Abaqo o dar recomendaciones de inversión: la cartera solo se consulta.

## Vista general

Firefly III hace de motor contable y Abaqo se engancha a él por webhook y API REST; todo vive en el servidor casero y solo se accede por Tailscale.

&#91;embedded content: arquitectura de Abaqo · 6 piezas, 2 propias\]

Los movimientos entran a diario a Firefly; cada transacción nueva dispara un webhook a Abaqo API, que la clasifica o la deja en la bandeja y avisa al móvil.

## Componentes

Son seis contenedores; solo dos son código propio (Abaqo API y Abaqo web).

| Componente | Responsabilidad | Origen |
| --- | --- | --- |
| Firefly III | Fuente de verdad de transacciones, cuentas, categorías y reglas | Imagen oficial |
| Firefly Data Importer | Descarga movimientos de Santander vía Enable Banking; cron diario | Imagen oficial |
| PostgreSQL | Una instancia con dos bases: `firefly` y `abaqo` | Imagen oficial |
| Abaqo API (TypeScript) | Motor de sobres y cierre mensual, objetivos, clasificación, reglas dinámicas, bandeja, alertas y API para la web | Propio |
| Abaqo web (TypeScript) | PWA responsive: vistas móviles (bandeja, gasto manual, resumen, objetivos) y dashboard de escritorio | Propio |
| ntfy (opcional) | Notificaciones push al móvil | Imagen oficial |

**Clasificador intercambiable.** Abaqo API define una interfaz `Classifier` con varias implementaciones: Jev (por defecto), cualquier API compatible con OpenAI y Ollama local. Así quien no tenga clave de Jev también puede usarlo.

**n8n queda fuera del núcleo.** Telegram se conectará más adelante a través de la API de Abaqo, desde n8n o como notificador propio.

## Flujo de clasificación

Cada transacción pasa tres filtros en orden y solo la que no supera ninguno llega a la bandeja; cada decisión tuya puede convertirse en regla.

&#91;embedded content: flujo de clasificación · 3 filtros y bucle de aprendizaje\]

- **Reglas primero:** las de Firefly son gratis e instantáneas; con el tiempo deberían resolver la mayoría. En los Bizum, las reglas miran el concepto («cena» → Comer fuera).
- **Bizum sin concepto, a la bandeja:** sin concepto no hay forma de saber qué se pagó. Si tiene concepto pero ninguna regla coincide, pasa por Jev como cualquier otro gasto.
- **Jev con umbral:** recibe descripción (o el concepto del Bizum), importe, fecha y tu lista de categorías; devuelve una categoría y su probabilidad. Si la llamada falla, la transacción va a la bandeja sin sugerencia.
- **Aprendizaje:** al elegir en el móvil puedes crear una regla para ese comercio o concepto; la siguiente vez ya no pasa por la IA.

## Presupuesto mensual por sobres

Cada mes el sueldo se reparte en sobres, uno por categoría; el gasto se descuenta de su sobre y al cerrar el mes cada sobre aplica su regla de sobrante y de faltante. Los sobres son virtuales: el dinero sigue en tu cuenta de Santander.

Firefly III no reparte el dinero en sobres ([documentación](https://docs.firefly-iii.org/explanation/data-classification/best-practices/index.md)), así que este motor es código propio de Abaqo y es su pieza central.

1. **Empieza el mes** el día que elija cada usuario (por defecto, el 1). No depende de cuándo entra el sueldo, porque puede cobrarse en otra cuenta distinta a la de la tarjeta.
2. **Presupuesto del mes:** el usuario fija su importe (normalmente, el sueldo), más los ingresos extra que vayan llegando.
3. **Asignación:** cada sobre recibe un importe fijo o un porcentaje del presupuesto, a elección del usuario. La suma no puede superar el presupuesto (la app lo valida) y lo que quede sin asignar va a Ahorro.
4. **Durante el mes:** disponible = asignado + arrastre del mes anterior − gastado.
5. **Cierre:** cada sobre aplica su regla y se calcula el arrastre del mes siguiente.

| Caso | Regla | Al cerrar el mes | Ejemplo: Caprichos con 100 € |
| --- | --- | --- | --- |
| Sobrante | Acumulativo | Se suma al mismo sobre el mes siguiente | Gastas 60 € → el mes siguiente tienes 140 € |
| Sobrante | Traspaso | Se suma a otro sobre (por defecto, Ahorro) | Gastas 60 € → 40 € a Ahorro; el mes siguiente, 100 € |
| Faltante | Préstamo | Se resta del mismo sobre el mes siguiente | Gastas 130 € → el mes siguiente tienes 70 € |
| Faltante | Ladrón | Se resta de otro sobre (por defecto, Ahorro) | Gastas 130 € → 30 € menos en Ahorro; el mes siguiente, 100 € |

**Reglas del cierre (propuesta)**

- **Orden fijo:** primero los traspasos de sobrante, después los ladrones y por último acumulativos y préstamos. Así un ladrón puede usar lo que acaba de entrar en Ahorro.
- **Un ladrón nunca deja en negativo a su víctima:** la parte que no cubra pasa a ser préstamo.
- **Cierre recalculable:** guarda una foto del mes, y si entra un movimiento atrasado de un mes ya cerrado, se recalcula ese cierre y los siguientes.
- **Reembolsos:** un Bizum recibido por un gasto compartido resta gasto de esa categoría en lugar de contar como ingreso.

### Sobres y subcategorías

Hay dos tipos de categoría: las que tienen sobre propio y las subcategorías, que gastan del sobre de otra pero llevan su propio seguimiento.

| Tipo | Tiene asignación | Reglas de sobrante y faltante | Seguimiento del gasto |
| --- | --- | --- | --- |
| Sobre | Sí, parte del sueldo | Las suyas | Sí |
| Subcategoría | No, gasta del sobre padre | Las del sobre padre | Sí, por separado |

- **Ejemplo:** «Suscripciones» empieza como subcategoría de «Ahorro». Cada cobro resta de Ahorro, pero ves cuánto llevas en suscripciones cada mes.
- **Promoción a sobre:** tras unos meses, Abaqo te sugiere convertirla en sobre propio con una asignación basada en tu gasto real (media y máximo de los últimos meses). Al aceptar, deja de tirar de Ahorro.
- **También sirve para desglosar:** por ejemplo, «Cenas» y «Cafés» como subcategorías de «Comer fuera», con un solo presupuesto y gasto separado.
- **Un solo nivel:** una subcategoría no puede tener subcategorías, para que el cierre de mes siga siendo sencillo.

### Ingresos extra

Además del sueldo, cualquier dinero inesperado se suma a lo disponible del mes, y tú eliges a qué sobre va.

- **Detección:** todo ingreso que no sea el sueldo (una devolución de Hacienda, una venta de segunda mano, un regalo) entra en la bandeja como ingreso.
- **Reparto:** se puede asignar a un sobre, repartir entre varios (importe o %) o dejarlo en Ahorro, que es la opción por defecto si no lo tocas antes del cierre.
- **Reembolso o ingreso:** si es un Bizum recibido, la bandeja pregunta primero si es la devolución de un gasto compartido (resta gasto de esa categoría) o un ingreso extra (suma a un sobre).
- **Entrada manual:** desde el móvil puedes añadir dinero en efectivo y elegir su sobre en el mismo paso.
- **Reglas:** los ingresos que se repiten pueden tener regla, igual que los gastos (por ejemplo, ventas de segunda mano → Caprichos).

### Gastos compartidos

Cuando pagas tú algo de grupo, tu sobre solo cuenta tu parte; los Bizum que te llegan después se enlazan a ese gasto y no cuentan como ingreso.

1. **Marcar como compartido:** desde la bandeja o el detalle del gasto indicas cuántas personas sois (o importes distintos por persona). Ejemplo: cena de 80 € entre 4 → tu parte, 20 €; te deben 60 €.
2. **Efecto inmediato:** el sobre (por ejemplo, Comer fuera) descuenta solo 20 €, y los 60 € quedan en una lista de «Te deben».
3. **Emparejado automático:** cada Bizum recibido se compara con los gastos compartidos abiertos (importe parecido a una parte, concepto parecido, pocos días después). La bandeja lo propone en un toque: «20 € de Ana, ¿de la cena del viernes?».
4. **Si alguien no paga:** lo pendiente sigue en «Te deben» y pasa al mes siguiente. Si lo das por perdido, se suma al gasto del sobre.
5. **Detección a posteriori:** si a un gasto le siguen varios Bizum recibidos con importes parecidos, Abaqo sugiere marcarlo como compartido.
6. **Caso inverso:** si pagó otra persona y tú le haces un Bizum, es un gasto normal y se clasifica por su concepto.

### Traspasos manuales y otras reglas

- **Traspaso manual:** en cualquier momento del mes puedes mover dinero de un sobre a otro; queda anotado en el libro del sobre.
- **Bandeja sin vaciar al cierre:** lo pendiente cuenta como «Sin clasificar» y el cierre se recalcula cuando lo clasificas.
- **Préstamos encadenados:** si un sobre cierra en préstamo tres meses seguidos, Abaqo avisa y propone subir su asignación.
- **Devoluciones:** el reembolso de una compra resta gasto de su categoría; no cuenta como ingreso.

### Cuentas reales y cuadre

Los sobres no están atados a una cuenta: Abaqo suma el saldo de todas tus cuentas y comprueba que coincide con lo repartido en sobres.

| Cuenta (ejemplo) | Papel | Cómo llega el saldo |
| --- | --- | --- |
| Santander nómina | Entra el sueldo | Automático (Enable Banking) |
| Santander diario | Tarjeta y gasto | Automático (Enable Banking) |
| Trade Republic (ahorro remunerado) | Ahorro y pendiente de invertir | Automático si Enable Banking lo ofrece; si no, saldo a mano |

- **Fórmula:** dinero real en cuentas = suma de los sobres − lo que te deben (gastos compartidos sin cobrar).
- **Transferencias internas:** mover dinero entre tus cuentas no es gasto ni ingreso; Abaqo las empareja por importe y fecha.
- **Descuadre:** si la diferencia no es cero, la pantalla «Cuadre» la muestra y te deja asignarla a un sobre o marcarla como ajuste.
- **Intereses de la cuenta remunerada:** entran como ingreso extra con una regla hacia Ahorro.
- **Plan de transferencias del mes:** al abrir el mes, Abaqo calcula cuánto pasar de la cuenta de nómina a la de diario (suma de los sobres de gasto) y cuánto a la de ahorro (Ahorro e Inversión).
- **Saldo inicial:** al instalar Abaqo, el dinero que ya tienes se reparte una vez entre los sobres.

### Suelo protegido de Ahorro

El colchón de emergencia no es un sobre aparte, sino un suelo dentro de Ahorro: un importe (por ejemplo, tres meses de gasto) por debajo del cual nada puede bajarlo solo.

- Ladrones, subcategorías y financiaciones solo usan lo que hay por encima del suelo; lo que no puedan cubrir pasa a préstamo.
- Bajar del suelo exige un traspaso manual con confirmación.
- La pantalla del mes muestra cuántos meses de gasto cubre tu colchón.

### Financiación interna

Una compra grande que un sobre no puede pagar se financia con otro sobre y se devuelve a plazos, sin intereses.

1. **Ejemplo:** mesa de 500 € en Caprichos, que tiene 100 €. Ahorro presta 400 € y eliges devolverlos en 4 meses.
2. **Cada mes:** al abrir el mes, 100 € de la asignación de Caprichos vuelven a Ahorro hasta saldar la deuda. Se puede adelantar el pago.
3. **Diferencia con Préstamo:** el préstamo descuenta todo el exceso al mes siguiente; la financiación lo reparte en los meses que tú decides.

**Límites**

- El sobre que presta debe tener el dinero de verdad, por encima del suelo protegido; Inversión no presta.
- Las cuotas de un sobre no pueden superar la mitad de su asignación mensual.
- Plazo máximo de 12 meses.
- La pantalla del mes muestra siempre la deuda total contigo mismo y cuándo acaba.

## Reglas dinámicas

Cuando un comercio se repite con la misma categoría, Abaqo crea la regla en Firefly por su cuenta, y la IA deja de recibir ese cobro.

- **Comercio normalizado:** Abaqo limpia la descripción del banco (quita fechas, referencias y números de tarjeta) para obtener una clave estable, por ejemplo `NETFLIX.COM`.
- **Disparo por repetición:** si Jev asigna la misma categoría a la misma clave N veces seguidas por encima del umbral, se crea la regla.
- **Disparo por suscripción:** si aparece el mismo comercio con un importe parecido cada mes, se pregunta a Jev «¿es un cobro recurrente?» y, si la respuesta es sí, la regla se crea en el segundo cobro.
- **Control:** las reglas creadas así llevan la etiqueta `abaqo-auto`, te llega un aviso y puedes deshacerlas desde el móvil.
- **Excepciones:** comercios genéricos (Amazon, PayPal) nunca generan regla automática.

Jev no escribe la regla: solo decide la categoría. La regla se construye siempre igual a partir de la clave del comercio, así que es predecible y fácil de revisar.

**Reglas por concepto de Bizum.** En un Bizum la clave no es el comercio sino el concepto normalizado (en minúsculas y sin tildes). Si «cena» acaba tres veces en Comer fuera, Abaqo crea la regla «Bizum con concepto que contiene “cena” → Comer fuera». Las mismas reglas se pueden crear a mano desde la app. Requisito: que Santander envíe el concepto del Bizum en la descripción del movimiento, algo que hay que comprobar en la prueba con Enable Banking.

## Objetivos

Un objetivo es una meta de saldo sobre un sobre, con un margen, y te avisa cuando el sobre se acerca y cuando llega.

- **Ejemplo:** «Móvil nuevo» en Caprichos, meta de 500 € y margen de 100 €.
- **Avisos (interpretación propuesta):** el primero al llegar a 400 € (meta − margen, «ya puedes mirar ofertas») y el segundo al llegar a 500 €.
- **Requisito:** el sobre debe tener la regla de sobrante Acumulativo; si no, nunca crecería entre meses, y la app lo impide al crear el objetivo.
- **Cumplimiento:** cuando hagas la compra y se clasifique en esa categoría, el objetivo se marca como cumplido y el sobre sigue su curso.
- **En el móvil:** una barra de progreso por objetivo dentro del resumen del mes.

## Inversiones

Las inversiones se llevan con un sobre especial, «Inversión», que recibe cada mes el dinero disponible para invertir, y una pantalla de cartera donde las operaciones se apuntan a mano y los precios se actualizan solos. Va como fase 6, después de la v1.0.

**El sobre de inversión**

- **Es un sobre más:** tiene su asignación mensual (fija o en porcentaje) y la regla de sobrante Acumulativo, así que lo que no inviertas un mes queda disponible para el siguiente.
- **Dos cifras distintas:** «pendiente de invertir» (el saldo del sobre, en euros que siguen en tu banco) y «valor de la cartera» (lo ya invertido, a precio de mercado). La segunda no cuenta como dinero disponible ni entra en el cierre de mes.
- **Transferencias al bróker:** cuando Abaqo ve en Santander una transferencia a Trade Republic, la descuenta del sobre y te propone apuntar la compra.
- **Dinero que vuelve:** una retirada desde el bróker entra como ingreso extra, con el sobre de inversión como destino sugerido.

**Apuntar operaciones a mano**

Trade Republic no ofrece API, así que las operaciones se introducen desde Abaqo, pensado para que cueste segundos.

1. Buscas el activo por nombre o ISIN.
2. Indicas fecha, cantidad, precio y comisión. Tipos: compra, venta y dividendo.
3. **Planes de inversión:** una aportación periódica se define una vez; cada mes Abaqo te propone la operación ya rellenada y solo confirmas el precio real.

**Qué muestra la pantalla**

| Bloque | Contenido |
| --- | --- |
| Resumen | Valor total, aportado, ganancia o pérdida en euros y en %, variación del día |
| Evolución | Gráfico del valor de la cartera frente a lo aportado, por periodo |
| Posiciones | Por activo: cantidad, precio medio de compra, valor actual, rentabilidad y peso en la cartera |
| Diversificación | Reparto por activo, tipo (acciones, ETF, cripto), región y sector, según los datos que dé la fuente de precios |
| Historial | Operaciones y dividendos cobrados |

En el móvil: resumen, posiciones y el formulario de operación. El resto, en el ordenador.

**Motor: Ghostfolio**

Igual que Firefly lleva las transacciones, [Ghostfolio](https://github.com/ghostfolio/ghostfolio) lleva la cartera: guarda las operaciones, descarga los precios y calcula la rentabilidad. Abaqo le envía cada operación por su API y lee de él los datos para pintar la pantalla. Calcular bien la rentabilidad (divisas, dividendos, splits) es delicado, y no compensa rehacerlo.

- **Opcional:** un perfil `investments` de Docker Compose añade Ghostfolio, su base de datos y Redis. Quien no invierta no lo levanta.
- **Memoria:** son tres contenedores más; hay que medir su consumo en el servidor de 8 GB antes de darlo por bueno.
- **Datos propios de Abaqo:** solo los planes de inversión y el enlace entre el sobre y la cuenta de Ghostfolio.

**Más adelante**

- **Consultas en lenguaje natural** («¿cuánto llevo ganado este año?»): necesitan un modelo de lenguaje general, no Jev.
- **Importación por fichero**, si el bróker permite exportar las operaciones.
- **Objetivos sobre la cartera** y aviso de aportación pendiente.

## Seguimiento y hábitos

Estas funciones no cambian el motor de sobres: leen sus datos para que veas a tiempo cómo vas.

| Función | Qué hace | Cuándo |
| --- | --- | --- |
| Ritmo de gasto | En cada sobre, cuánto te queda por día y si llegas a fin de mes | v1.0 |
| Objetivos con fecha | Para un gasto anual o un viaje, cuánto apartar al mes para llegar a tiempo | v1.0 |
| Resumen semanal | Notificación con lo gastado, sobres en riesgo y cargos raros | v1.0 |
| Cierre guiado | Repaso del mes en dos minutos y ajustes sugeridos según tu media real | v1.0 |
| Panel de suscripciones | Cobros recurrentes, coste anual, subidas de precio y próximos cargos | Después |
| Etiquetas de evento | Agrupa gastos de varias categorías, como un viaje | Después |
| Págate primero y tasa de ahorro | Ahorro e inversión se asignan al abrir el mes; porcentaje de ingresos ahorrado, mes a mes | Después |
| Patrimonio total | Cuentas, ahorro y cartera en una sola curva | Con Inversiones |
| Aportación pendiente | Aviso si acaba el mes sin invertir lo previsto | Con Inversiones |
| Concentración y referencia | Aviso si una posición pesa demasiado; comparación con un índice | Con Inversiones |
| Resumen anual para la renta | Ganancias realizadas y dividendos del año | Con Inversiones |

## Categorías: definidas por cada usuario

Abaqo no impone categorías: cada usuario crea sus sobres y subcategorías, con sus reglas, desde la app. Al instalarla, el asistente inicial ofrece dos caminos: empezar desde cero o cargar esta plantilla y modificarla. La plantilla es solo un punto de partida y no condiciona el diseño: el motor de sobres, las reglas y el clasificador funcionan con cualquier lista.

**Plantilla opcional**

| Categoría | Ejemplos | Sobrante | Faltante |
| --- | --- | --- | --- |
| Vivienda | alquiler o hipoteca, comunidad | Traspaso → Ahorro | Ladrón ← Imprevistos |
| Suministros | luz, agua, gas, internet, móvil | Traspaso → Ahorro | Ladrón ← Imprevistos |
| Supermercado | compra semanal, droguería | Traspaso → Ahorro | Préstamo |
| Transporte | gasolina, abono, parking, mantenimiento | Acumulativo | Préstamo |
| Suscripciones | streaming, música, nube, software | Subcategoría de Ahorro (hasta tener presupuesto) | Las de Ahorro |
| Seguros | coche, hogar, salud (pagos anuales) | Acumulativo | Ladrón ← Imprevistos |
| Salud | farmacia, dentista, gimnasio | Acumulativo | Ladrón ← Imprevistos |
| Comer fuera | restaurantes, cafés, a domicilio | Traspaso → Ahorro | Préstamo |
| Ocio | cine, conciertos, planes | Traspaso → Ahorro | Préstamo |
| Caprichos | tecnología, compras personales | Acumulativo | Préstamo |
| Ropa | ropa y calzado | Acumulativo | Préstamo |
| Regalos | cumpleaños, Navidad | Acumulativo | Préstamo |
| Viajes | transporte, alojamiento, actividades | Acumulativo | Ladrón ← Ahorro |
| Formación | cursos, libros, certificaciones | Acumulativo | Préstamo |
| Imprevistos | averías, multas, urgencias | Acumulativo | Ladrón ← Ahorro |
| Ahorro | destino por defecto de los traspasos y de lo no asignado | Acumulativo | No aplica |

Aparte quedan dos tipos que no son sobres: **Ingresos** (sueldo y otros ingresos) y **Transferencias internas** (movimientos entre tus propias cuentas), que no cuentan como gasto.

## Datos y relación con Firefly III

Firefly III es la fuente de verdad de las transacciones. Abaqo guarda en su propia base de PostgreSQL todo lo que Firefly no tiene: sobres, cierres de mes, objetivos y metadatos de clasificación. Si se borran los datos de Abaqo, las transacciones siguen intactas en Firefly.

| Tabla (base `abaqo`) | Qué guarda |
| --- | --- |
| `categories` | Categoría enlazada a la de Firefly, tipo (sobre o subcategoría), sobre padre, asignación mensual, regla de sobrante y de faltante, sobre destino o víctima |
| `budget_months` | Cada mes: presupuesto, ingresos extra, fechas, estado (abierto o cerrado) y foto del cierre |
| `envelope_entries` | Libro de movimientos de cada sobre: asignación, ingreso extra, arrastre, traspaso, préstamo, ladrón o ajuste |
| `goals` | Objetivo por categoría: meta, margen, avisos enviados, estado |
| `inbox_items` | Transacción pendiente, sugerencia de Jev, probabilidad y estado |
| `classification_log` | Cada decisión: origen (regla, Jev o usuario), categoría, probabilidad y fecha |
| `merchant_keys` | Clave normalizada del comercio, historial de categorías y regla creada |
| `settings` | Umbral, proveedor del clasificador, día de inicio del mes, presupuesto por defecto |

Gastos compartidos: tabla `shared_expenses` (gasto original, personas, tu parte, importe pendiente, estado) y tabla `reimbursement_links` (cada Bizum enlazado a su gasto).

El saldo de un sobre nunca se guarda como número suelto: se calcula sumando `envelope_entries` y los gastos del mes en Firefly. Así un cierre siempre se puede recalcular.

**Integración con Firefly**

- Entrada: webhook de Firefly al crear una transacción → Abaqo API.
- Salida: API REST de Firefly con un token personal (asignar categoría, crear reglas, crear gastos manuales, leer presupuestos).
- Las transacciones en bandeja llevan también la etiqueta `abaqo-bandeja` en Firefly, para que se vean desde allí.

## Seguridad y privacidad

Nada se expone a Internet: todo el acceso pasa por Tailscale, y al clasificador externo solo sale lo mínimo.

- **Red:** solo accesible por la tailnet; sin puertos abiertos en el router. HTTPS con los certificados de Tailscale (necesario para instalar la PWA y para push).
- **Datos al clasificador:** descripción del comercio, importe, fecha y lista de categorías. Nunca IBAN, titular ni saldos.
- **Secretos:** token de Firefly, claves de Enable Banking y de Jev en un `.env` fuera del repo; `.env.example` en el repo.
- **Webhook:** Abaqo API valida la firma HMAC que Firefly envía con cada webhook.
- **Autenticación de la web:** identidad de Tailscale Serve, sin contraseñas; contraseña opcional para quien no use Tailscale.
- **Copias de seguridad:** volcado diario de las bases firefly y abaqo.

## Despliegue y estructura del repo

Un único `docker-compose.yml` levanta todo; quien ya tenga Firefly puede usar solo los servicios de Abaqo con un perfil de Compose.

- **Perfil `full`:** Firefly, base de datos, Data Importer, Abaqo API, Abaqo web y ntfy.
- **Perfil `companion`:** solo Abaqo API y Abaqo web, apuntando a un Firefly existente.
- **Importación diaria:** contenedor cron que llama al Data Importer (por ejemplo, a las 7:00).
- **Recursos:** objetivo de menos de 1,5 GB de RAM en total, pensando en un i3 con 8 GB compartido con otros servicios.
- **Imágenes:** publicadas en GitHub Container Registry, construidas con GitHub Actions.

**Estructura del repo (monorepo)**

```
abaqo/
├─ api/            # Abaqo API
├─ web/            # PWA (móvil + dashboard)
├─ deploy/
│  ├─ docker-compose.yml
│  └─ .env.example
├─ docs/           # guía Enable Banking + bancos españoles, capturas
└─ README.md       # ES + EN
```

## Desarrollo con agentes

El desarrollo lo hace un equipo de Claude Code: una sesión principal que hace de jefe técnico y seis subagentes especializados, cada uno con sus skills. Todo vive en el repo (`.claude/`), así que la configuración agéntica también se publica y forma parte del valor del proyecto.

&#91;embedded content: equipo de agentes · 1 sesión principal, 6 subagentes\]

**Subagentes o agent teams.** Empezar con subagentes, que son la opción estable: cada uno trabaja en su propio contexto e informa a la sesión principal. Los agent teams, en los que varias sesiones se coordinan y se escriben entre sí, son experimentales y hay que activarlos con `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Encajan como experimento en la fase 2, con backend y frontend en paralelo.

| Skill (`.claude/skills/`) | Qué enseña | La usan |
| --- | --- | --- |
| `envelope-rules` | Semántica de sobres, sobrante y faltante, orden del cierre, casos límite | Motor de sobres, QA |
| `firefly-api` | Endpoints, webhooks y firma, reglas, etiquetas | API y datos, Integraciones |
| `jev` | Llamadas a Jev, formato de categorías, umbral, errores y alternativas | Integraciones |
| `enable-banking` | Alta, consentimiento de 90 días, particularidades de Santander, Bizum | Integraciones |
| `db` | Esquema de la base `abaqo`, migraciones, convenciones | API y datos |
| `mobile-ui` | Patrones de la PWA, componentes, accesibilidad, diseño para una mano | Frontend PWA |
| `testing` | Vitest, Playwright, datos ficticios, cómo levantar el entorno `dev` | QA, todos |
| `tdd` | Ciclo test primero para la lógica de dominio | Motor de sobres |

**El resto de la configuración**

- **`CLAUDE.md`:** resumen de este documento, comandos (build, test, lint) y reglas del repo.
- **Hooks:** formateo automático tras cada edición, y bloqueo de `.env`, claves privadas y datos reales.
- **MCP:** Playwright para probar la PWA; GitHub (issues y PR) mediante la CLI gh.
- **Flujo de trabajo:** una issue por tarea; el jefe técnico la planifica, la reparte, el revisor la revisa y se abre una PR. Las PR son el registro que podrás enseñar en LinkedIn.

## Desarrollo remoto desde el móvil

Sí: Claude Code puede correr en el servidor casero y manejarse desde la app de Claude con Remote Control. El código y las pruebas se ejecutan en el servidor, y el móvil solo es la ventana ([Claude Code en móvil](https://code.claude.com/docs/en/mobile)).

| Modo | Dónde se ejecuta | Para qué en Abaqo |
| --- | --- | --- |
| Remote Control | En tu servidor | Lo habitual: tiene acceso a Docker, al Firefly de pruebas, a Postgres y a tus MCP |
| Sesiones en la nube | Infraestructura de Anthropic, sobre el repo de GitHub | Tareas que solo necesitan el código (refactor, tests, documentación) o con el servidor apagado |

**Cómo montarlo en el servidor**

1. Instalar Claude Code con un usuario Linux propio (`claude-dev`), sin acceso a la instalación real de Abaqo ni a su `.env`.
2. Iniciar sesión con tu cuenta de claude.ai: Remote Control no funciona con una clave de API de Console.
3. Lanzar `claude remote-control` dentro de `tmux`, porque la sesión termina si se cierra la terminal; con tmux sobrevive aunque cierres SSH.
4. Abrir la app de Claude en el móvil → pestaña Code → elegir la sesión. Con Remote Control activo, te llegan notificaciones push cuando termina una tarea o necesita una decisión.

**Precauciones**

- **Entorno de pruebas separado:** un perfil `dev` de Docker Compose con Firefly y Postgres de pruebas y datos ficticios. Los agentes nunca tocan tus datos bancarios reales.
- **Docker:** acceder al socket de Docker equivale a ser root en el servidor. Mejor usar Docker sin privilegios (rootless) para `claude-dev`, o un contenedor de desarrollo.
- **Memoria:** Claude Code consume poco, pero el entorno de pruebas suma otro Firefly y otro Postgres; conviene levantarlo solo mientras trabajas.
- **Plan:** el móvil necesita una cuenta de claude.ai, y la disponibilidad de Remote Control depende del plan; compruébalo antes.

## Hoja de ruta

Antes de la fase 1 va una fase 0: preparar el equipo de agentes (CLAUDE.md, subagentes, skills y hooks), montar Remote Control en el servidor y probar Santander en Enable Banking. Con las fases 1 a 3 ya usas Abaqo a diario; tras un mes de uso real se publica la v1.0 con datos para el post de LinkedIn.

&#91;embedded content: hoja de ruta · 5 fases, 1 hito\]

Egl registro de decisiones de la fase 1 da las cifras del post: porcentaje clasificado automáticamente y coste real de Jev.

## Decisiones

Todas las decisiones están tomadas; la única tarea abierta antes de programar es probar Santander con la guía de abajo.

| Área | Decisión |
| --- | --- |
| Lenguaje | TypeScript en API y web |
| Banco | Santander, vía Enable Banking en modo restringido gratuito |
| Base de datos | PostgreSQL: una instancia con las bases `firefly` y `abaqo` |
| Categorías | Las crea cada usuario; plantilla opcional |
| Inicio del mes | Día configurable por usuario, por defecto el 1 |
| Asignación | Importe fijo o porcentaje por sobre; la suma no puede superar el presupuesto del mes y lo no asignado va a Ahorro |
| Umbral de Jev | 0,85; calibrar tras 2–4 semanas |
| Reglas dinámicas | 3 repeticiones seguidas; suscripciones, en el segundo cobro |
| Frontend | React + Vite como PWA, con TanStack Query y Tailwind |
| Autenticación | Identidad de Tailscale Serve; contraseña opcional para quien no use Tailscale |
| Aprendizaje desde la bandeja | Preguntar «¿Crear regla?», marcado por defecto |
| Margen de objetivos | Aviso previo: con meta 500 y margen 100, avisos a 400 y a 500 |
| Bizum | Reglas por concepto, después Jev; sin concepto, a la bandeja; gastos compartidos con emparejado automático |
| Notificaciones | ntfy |
| Licencia | AGPL-3.0 |
| Idioma | Código en inglés; README en español e inglés |
| Agentes | Subagentes; agent teams como experimento en la fase 2 |
| Desarrollo remoto | Remote Control en el servidor (usuario `claude-dev` y tmux); sesiones en la nube para tareas que solo necesitan el repo |

### Guía: probar Santander con Enable Banking (fase 0)

El objetivo es confirmar, antes de escribir código, que Santander devuelve tus movimientos y con qué detalle. Enable Banking lista Santander España, pero su ficha específica aún está pendiente ([Enable Banking: España](https://enablebanking.com/docs/markets/es/)). Los pasos siguen la [guía oficial del Data Importer de Firefly](https://docs.firefly-iii.org/tutorials/data-importer/eb/), porque es la misma pieza que usará Abaqo.

1. **Cuenta:** regístrate en enablebanking.com («Get started») y espera el correo de confirmación, que puede tardar. Activa la verificación en dos pasos en tu perfil.
2. **Firefly y Data Importer de pruebas:** levántalos en el servidor con Docker y publica el importador por HTTPS con `tailscale serve`, porque en producción la URL de retorno tiene que ser HTTPS (no hace falta que sea pública).
3. **Aplicación:** en el Control Panel → API applications → nueva aplicación con Environment = **Production** (el sandbox no devuelve datos reales), la clave generada en el navegador, nombre «Abaqo» y como Allowed Redirect URL `https://<importador>/eb-callback`. En las URL de privacidad y condiciones vale la raíz del importador.
4. **Guardar credenciales:** el navegador descarga un fichero PEM con la clave privada; guárdalo fuera del repo y apunta el Application ID.
5. **Vincular cuentas:** en tu aplicación, pulsa «Link accounts», elige España y Santander, y autoriza en el banco. Vincula la cuenta de la tarjeta y también la del sueldo. La aplicación quedará como «Restricted» pero «Active», y es lo esperado.
6. **Importar:** configura `ENABLE_BANKING_APP_ID` y `ENABLE_BANKING_PRIVATE_KEY` en el importador, elige Enable Banking, país, banco y cuentas, y lanza una importación de los últimos 90 días.

**Qué comprobar y apuntar**

- [ ] Aparecen las dos cuentas y llegan movimientos.
- [ ] Cuántos días de historial devuelve y cuánto dura el consentimiento.
- [ ] En los pagos con tarjeta, la descripción incluye el nombre del comercio.
- [ ] En los Bizum enviados y recibidos aparecen el concepto y el nombre de la otra persona.
- [ ] Cuánto tarda un pago con tarjeta en aparecer.
- [ ] Las transferencias entre tus dos cuentas se reconocen como internas.

**Si algo falla:** si no aparecen cuentas, casi siempre es porque falta el paso 5. Si la autorización falla, revisa que la URL de retorno coincida exactamente y que el PEM corresponda a esa aplicación. Si Santander no funciona, el plan B es importar CSV.
