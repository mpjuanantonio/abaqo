# Abaqo

[![CI](https://github.com/mpjuanantonio/abaqo/actions/workflows/ci.yml/badge.svg)](https://github.com/mpjuanantonio/abaqo/actions/workflows/ci.yml)

> **Estado:** en desarrollo temprano (fase 0). Todavía no es utilizable.
> **Status:** early development (phase 0). Not usable yet.

[Español](#español) · [English](#english)

## Español

Abaqo es una app de presupuesto mensual por sobres, autoalojada, construida sobre
[Firefly III](https://www.firefly-iii.org/). Reparte tu sueldo entre categorías, clasifica los
gastos sola y solo te pregunta lo que no sabe. Pensada para bancos españoles (Santander vía
Enable Banking) y para usarse desde el móvil como PWA.

- **Firefly III guarda las transacciones.** Abaqo aporta los sobres, el cierre de mes, los
  objetivos, la bandeja de entrada y los gastos compartidos.
- **Clasificación automática:** primero reglas, después un modelo de decisión con umbral de
  confianza; lo dudoso va a la bandeja.
- **Privado por diseño:** todo corre en tu servidor y se accede por Tailscale. Al clasificador
  solo salen la descripción, el importe, la fecha y la lista de categorías.

El diseño completo está en [`docs/architecture.md`](docs/architecture.md).

### Desarrollo

Requisitos: Node 24 y Docker.

```bash
npm install
npm run lint && npm run typecheck && npm run test
npm run dev
```

El desarrollo lo hace un equipo de agentes de Claude Code configurado en `.claude/`; las
normas del repo están en [`CLAUDE.md`](CLAUDE.md).

### Licencia

[AGPL-3.0](LICENSE).

## English

Abaqo is a self-hosted, envelope-based monthly budgeting app built on top of
[Firefly III](https://www.firefly-iii.org/). It splits your salary into categories, classifies
expenses on its own and only asks about what it cannot decide. It targets Spanish banks
(Santander through Enable Banking) and is used from the phone as a PWA.

- **Firefly III stores the transactions.** Abaqo adds envelopes, month close, goals, the inbox
  and shared expenses.
- **Automatic classification:** rules first, then a decision model with a confidence threshold;
  anything doubtful goes to the inbox.
- **Private by design:** everything runs on your server and is reached through Tailscale. Only
  the description, amount, date and category list are sent to the classifier.

The full design (in Spanish) is in [`docs/architecture.md`](docs/architecture.md).

### Development

Requirements: Node 24 and Docker.

```bash
npm install
npm run lint && npm run typecheck && npm run test
npm run dev
```

Development is done by a Claude Code agent team configured in `.claude/`; the repo rules are
in [`CLAUDE.md`](CLAUDE.md).

### License

[AGPL-3.0](LICENSE).
