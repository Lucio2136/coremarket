# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server en http://localhost:8080
npm run build        # Build de producción
npm run lint         # ESLint
npm run test         # Vitest una vez
npm run test:watch   # Vitest en modo watch
```

## Proyecto

**QUOTR** — Plataforma de apuestas de predicción estilo Polymarket, en español/mexicano con pesos MXN. Los usuarios apuestan sobre lo que dirán o harán personajes públicos.

- Supabase Project ID: `odtqsptglayxtwqvxxyr`
- Admin email: `outfisin@gmail.com` (gateado en AuthContext)
- Stripe en modo prueba: tarjeta `4242 4242 4242 4242 / 12/28 / 123`
- Edge Functions desplegadas con `--no-verify-jwt`

## Stack

- **Frontend**: React 18 + TypeScript + Vite (SWC)
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions)
- **Estilos**: Tailwind CSS + shadcn/ui + Framer Motion
- **Estado**: AuthContext (auth/perfil) + React Query (datos servidor)
- **Pagos**: Stripe vía Edge Functions

## Arquitectura clave

### Auth y estado (`src/context/AuthContext.tsx`)
- Envuelve Supabase Auth. Expone: `user`, `profile`, `balance`, `isAuthenticated`, `signIn/signOut/signUp`, `updateBalance`
- `balance` viene de `profile.balance_mxn` — **NUNCA usar la columna `balance`**
- Sincronización en tiempo real vía Realtime channel `profile-{userId}` sobre tabla `profiles`
- `signOut` llama a `supabase.auth.signOut()` y resetea estado local — hay un bug conocido de navegación al cerrar sesión

### Acceso a datos (`src/hooks/`)
- **Mercados** (`use-markets.ts`): usa `fetch` directo a la REST API de Supabase — **NO usar supabase-js client** para mercados porque daba problemas con la sesión
- **Apuestas** (`use-bet.ts`): inserta con `side`, `odds_at_bet`, `potential_payout` via supabase-js
- **Mis apuestas** (`use-my-bets.ts`): consulta tabla `bets` con supabase-js
- Resolución de mercados: RPC function `resolve_market` en Supabase

### Edge Functions (`supabase/functions/`)
- `create-payment-intent` — Crea intención de pago en Stripe
- `place-bet` — Lógica de apuesta server-side
- `stripe-webhook` — Recibe eventos de Stripe y acredita `balance_mxn` en `profiles`

### Routing (`src/App.tsx`)
- React Router v6: `/` (HomePage), `/my-bets` (MyBetsPage), `/admin` (AdminPage)
- Todas las rutas envueltas en `AppLayout` (header + outlet, **sin sidebar**)

## Base de datos — columnas importantes

```
profiles:     id, username, balance_mxn (usar ESTO, no balance), total_won, total_bet
markets:      id, title, subject_name, category, yes_odds, no_odds, yes_percent,
              total_pool, bettor_count, closes_at, status ("open"/"closed"),
              result ("yes"/"no"), is_trending
bets:         id, user_id, market_id, side ("yes"/"no"), amount, odds_at_bet,
              potential_payout, status ("pending"/"won"/"lost"), created_at
transactions: id, user_id, type, amount
```

## Diseño objetivo

Clon de Polymarket adaptado a español/MXN:
- Fondo blanco, cards blancas con borde gris suave
- Grid de 4 columnas en desktop (`xl:grid-cols-4`)
- Cada MarketCard muestra filas Sí/No con porcentaje y botones pequeños
- AppHeader: logo + balance + botón Depositar azul + avatar
- Todo el texto en español (es-MX)

## Componentes principales por archivo

| Archivo | Responsabilidad |
|---|---|
| `src/components/MarketCard.tsx` | Tarjeta de mercado (rediseñar al estilo Polymarket) |
| `src/pages/HomePage.tsx` | Grid de mercados, sin secciones extra |
| `src/pages/MyBetsPage.tsx` | Historial de apuestas del usuario |
| `src/pages/AdminPage.tsx` | Dashboard admin: mercados, usuarios, crear |
| `src/components/layout/AppHeader.tsx` | Header principal (ya rediseñado, funciona bien) |
| `src/components/layout/AppLayout.tsx` | Solo header + `<Outlet />`, sin sidebar |
| `src/components/BetModal.tsx` | Modal para colocar apuesta (mínimo 10 MXN) |
| `src/components/modals/AuthModal.tsx` | Modal login/registro |
| `src/components/modals/DepositModal.tsx` | Modal depósito con Stripe |

## Path alias

`@` → `./src` — usar en todos los imports internos.

## Variables de entorno

```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```
