# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sistema de Gestión de Costos para Odoo 14 Community**

Aplicación web (SPA/SSR) con login Google que se integra con Odoo 14 Community para:
- Leer categorías y productos desde Odoo
- Definir costo por categoría
- Definir costo por producto (sobre-escribe el de categoría)
- Calcular costo efectivo (precedencia: producto > categoría)
- Actualizar masivamente el campo `standard_price` en Odoo

**Stack Tecnológico Elegido:** Next.js 14 (App Router) + TypeScript + Tailwind + NextAuth + PostgreSQL + Prisma

## Integración Odoo 14 (CRÍTICO)

### Conexión
- **Autenticación:** XML-RPC usando API key como password
- **Modelos:** `product.category`, `product.template`
- **Campo objetivo:** `standard_price` (company-dependent)

### Variables de Entorno Requeridas
```bash
ODOO_URL=https://<tu_odoo>
ODOO_DB=<tu_db>
ODOO_USER=<tu_usuario>
ODOO_API_KEY=<tu_api_key>
OAUTH_GOOGLE_ID=<id_google>
OAUTH_GOOGLE_SECRET=<secret_google>
USE_ACCOUNTING_REVALUATION=false  # Feature flag: write directo vs método contable
```

### Cliente Odoo TypeScript
Funciones principales:
- `auth()` - Autenticación XML-RPC
- `searchRead(model, domain, fields, opts)` - Lectura de datos
- `write(model, ids, vals, ctx)` - Escritura directa
- `changeStandardPrice(productIds, newCost, companyId)` - Método contable

## Reglas de Negocio (PRECEDENCIA)

1. **Producto con override** → usar `product_cost_override.cost`
2. **Sin override** → usar `category_cost_rule.cost` de la categoría
3. **Sin regla** → excluir de actualización masiva

**Consideraciones multi-compañía:** `standard_price` es company-dependent, usar `context={"company_id": X}`

## Base de Datos Local (Prisma)

### Modelos Principales
- `CategoryCostRule` - Costos por categoría
- `ProductCostOverride` - Overrides por producto  
- `SyncSnapshot` - Registro de ejecuciones masivas
- `AuditLog` - Auditoría completa
- `User` - Usuarios con roles Admin/Viewer

### Esquema de Precedencia
Los costos efectivos **NO** se persisten, se calculan al vuelo aplicando las reglas.

## Arquitectura del Sistema

```
Frontend (Next.js 14 App Router)
├── Server Actions (sin API Routes)
├── NextAuth (Google OAuth)
└── Prisma Client

Backend Services  
├── Odoo Client (XML-RPC)
├── PostgreSQL Database
└── Cache Layer (memoria/Redis)

External
├── Odoo 14 Community
└── Google OAuth
```

## Estructura del Proyecto

```
src/
├── app/                    # App Router pages
│   ├── (auth)/login/
│   ├── dashboard/
│   ├── categories/
│   ├── products/
│   └── preview/
├── components/             # UI Components
│   ├── ui/                # shadcn/ui base
│   ├── tables/           # Tablas editables
│   └── forms/
├── lib/                   # Utilities
│   ├── odoo.ts           # Cliente Odoo XML-RPC
│   ├── db.ts             # Prisma client
│   └── auth.ts           # NextAuth config
├── server/               # Server Actions
│   ├── categories.ts
│   ├── products.ts
│   └── costs.ts
└── types/               # TypeScript types
```

## Comandos de Desarrollo

```bash
# Setup inicial
npm install
npx prisma migrate dev --name init
npx prisma db seed

# Desarrollo
npm run dev              # Next.js dev server
npm run test            # Vitest unit tests
npm run test:e2e        # Playwright E2E
npm run lint            # ESLint
npm run typecheck       # TypeScript check

# Producción
npm run build
npm run start
```

## Features Críticas

### Actualización Masiva
- **Batching:** Lotes de 50-100 productos
- **Feature Flag:** `USE_ACCOUNTING_REVALUATION` (write directo vs método contable)
- **Dry Run:** Vista previa antes → después
- **Auditoría:** Registro completo en `SyncSnapshot` y `AuditLog`
- **Manejo de errores:** Reintentos exponenciales

### Seguridad
- **Roles:** Admin (edición) vs Viewer (solo lectura)
- **Secrets:** Solo en servidor, nunca exponer credenciales Odoo
- **Auditoría:** Logging completo de cambios y ejecuciones

### UX
- **Tablas editables** con guardado inline
- **Búsqueda y filtros** en productos
- **Progreso visual** en actualizaciones masivas
- **Validación** de montos y permisos

## Casos Edge a Considerar

- Productos inactivos
- Categorías sin regla definida
- Productos sin categoría
- Múltiples compañías
- Productos con `cost_method` ≠ `standard`
- Valuación automática FIFO/AVCO

## Plan de Implementación (Sprint 1 - 2 semanas)

**Semana 1:** Setup, Auth, Odoo Client, DB Schema
**Semana 2:** UI Core, Reglas de Costos, Actualización Masiva, Tests

## Criterios de Aceptación

- ✅ Login Google funcionando
- ✅ Catálogo visible y filtrable  
- ✅ Edición de costos con validación
- ✅ Cálculo correcto de precedencia
- ✅ Vista previa de cambios
- ✅ Actualización masiva en lotes
- ✅ Feature flag contable operativo
- ✅ Roles Admin/Viewer
- ✅ Auditoría completa