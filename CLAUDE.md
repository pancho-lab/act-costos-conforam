# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sistema de Gestión de Costos para Odoo 14 Community - Conforam-Rincon del Aroma**

Web application that integrates with Odoo 14 Community to manage product costs with automatic price analysis and draft changes system. Key features:
- Read categories and products from Odoo via XML-RPC
- Define base costs per category with automatic price analysis
- Define product-specific cost overrides (takes precedence over category)
- Calculate effective costs with proper precedence rules
- Batch update `standard_price` field in Odoo with draft/preview system

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + NextAuth + SQLite + Prisma

## Commands & Development Workflow

```bash
# Development
npm run dev              # Start Next.js dev server
npm run build           # Build for production
npm run lint            # ESLint
npm run typecheck       # TypeScript check

# Database
npm run db:migrate      # Run Prisma migrations
npm run db:generate     # Generate Prisma client
npm run db:studio       # Open Prisma Studio GUI
npm run db:seed         # Seed database

# Testing
npm run test            # Run Vitest unit tests
npm run test:e2e        # Run Playwright E2E tests
npm run test:odoo-connection  # Test Odoo XML-RPC connection
```

## Odoo Integration Architecture (CRITICAL)

### Connection & Authentication
- **Protocol:** XML-RPC over HTTPS using custom fetch-based client (`src/lib/odoo-simple.ts`)
- **Models:** `product.category`, `product.template` 
- **Target Field:** `standard_price` (company-dependent field in Odoo)
- **Authentication:** Username + API key (not password)

### Environment Variables Required
```bash
DATABASE_URL="file:./dev.db"     # SQLite database
ODOO_URL=https://your-odoo-instance
ODOO_DB=your_database_name
ODOO_USER=your_username
ODOO_API_KEY=your_api_key
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_secret
GOOGLE_CLIENT_ID=your_google_oauth_id
GOOGLE_CLIENT_SECRET=your_google_oauth_secret
```

### Odoo Client Implementation
- **File:** `src/lib/odoo-simple.ts` - Production client used throughout the app
- **Alternative clients:** `odoo-final.ts`, `odoo-library.ts` for testing/comparison
- **Key methods:**
  - `auth()` - XML-RPC authentication returning UID
  - `searchRead(model, domain, fields, options)` - Query Odoo records
  - `searchCount(model, domain)` - Count records matching criteria
  - `write(model, ids, values, context)` - Update Odoo records
- **XML-RPC Implementation:** Custom parser handling Odoo's XML responses (structs, arrays, values)

## Core Business Logic & Data Flow

### Cost Precedence Rules
1. **Product Override** → Use `ProductCostOverride.cost` (highest priority)
2. **Category Rule** → Use `CategoryCostRule.cost` for the product's category
3. **No Rule** → Exclude from batch updates (no cost defined)

**Multi-company consideration:** `standard_price` is company-dependent in Odoo, always use `context={"company_id": X}`

### Draft Changes System
- **Session-based:** Changes are stored per user session before committing to Odoo
- **Preview Mode:** Users can see before/after states via `/dashboard/preview`
- **API Endpoints:**
  - `/api/draft-changes` - Product cost changes
  - `/api/draft-category-changes` - Category cost changes
  - `/api/batch-update` - Commit all draft changes to Odoo

### Automatic Price Analysis
- **Trigger:** Runs automatically when "Actualizar desde Odoo" is clicked
- **Analysis Types:**
  - `uniform` - All products in category have same cost
  - `mixed` - Products have different costs
  - `all_zero` - All products have zero/null cost
  - `no_products` - Category has no products
- **Auto-fill:** Categories with uniform prices automatically get base cost set
- **Storage:** Results persisted in `CategoryPriceAnalysis` table

### Database Schema (SQLite + Prisma)
**Core Models:**
- `CategoryCostRule` - Base costs per category
- `ProductCostOverride` - Product-specific cost overrides
- `CategoryPriceAnalysis` - Automatic price analysis results  
- `DraftChange` - Session-based pending changes
- `SyncSnapshot` - Batch update execution logs
- `AuditLog` - Complete change auditing

## Application Architecture

### Frontend Architecture (Next.js 14 App Router)
```
src/app/
├── dashboard/
│   ├── page.tsx              # Main dashboard with stats
│   ├── categories/page.tsx   # Category management with price analysis
│   ├── products/page.tsx     # Product cost management
│   └── preview/page.tsx      # Draft changes preview
├── api/                      # API Routes (REST endpoints)
│   ├── odoo/
│   │   ├── categories/       # Fetch categories with server-side filtering
│   │   └── products/         # Fetch products with cost calculation
│   ├── draft-changes/        # Session-based draft management
│   ├── analyze-category-prices/ # Automatic price analysis
│   └── batch-update/         # Commit changes to Odoo
└── auth/[...nextauth]/       # NextAuth configuration
```

### Key Integration Patterns
- **Server-Side Filtering:** Categories API supports `priceFilter` parameter for efficient pagination
- **Session-Based Drafts:** Changes are stored per user session, not immediately committed
- **Batch Processing:** Price analysis runs in batches of 5 categories to avoid API overload
- **Real-time Updates:** UI reflects draft changes immediately, database sync happens on commit

### Data Synchronization Flow
1. **Odoo → Local Cache:** "Actualizar desde Odoo" pulls fresh data + triggers price analysis
2. **Local Editing:** Changes stored in draft tables by session ID
3. **Preview:** Shows before/after comparison from drafts + calculated costs
4. **Batch Commit:** Applies all draft changes to Odoo via XML-RPC `write()` calls

## Critical Implementation Details

### User Experience Patterns
- **Inline Editing:** Categories and products support click-to-edit cost fields
- **Draft Changes Indicator:** Blue highlighting shows items with pending changes
- **Smart Pagination:** Server-side filtering maintains consistent 50 results per page
- **Visual Analysis Status:** Categories show ✅ uniform, ⚠️ mixed, 🔸 no cost indicators
- **Auto-refresh Analysis:** Price analysis runs automatically when refreshing from Odoo

### Error Handling & Edge Cases
- **Odoo Connection Issues:** Graceful fallback with retry mechanisms in XML-RPC client  
- **Empty Categories:** Handle categories with no products gracefully
- **Concurrent Users:** Session-based drafts prevent user conflict
- **Large Datasets:** Pagination + server-side filtering for performance
- **Invalid Costs:** Client-side validation before saving drafts

### Security & Authentication
- **NextAuth Google OAuth:** Handles user authentication
- **API Routes Protection:** Session validation on sensitive endpoints
- **Odoo Credentials:** Server-side only, never exposed to client
- **Role-based Access:** Admin vs Viewer roles (planned for future implementation)

## Important Notes for Claude Code Development

### When Working on This Codebase:
- **Always use `src/lib/odoo-simple.ts`** - This is the production Odoo client, other files are for testing/comparison
- **Session Management:** Draft changes use NextAuth session.user.email as session identifier
- **Database:** Uses SQLite with Prisma - run `npm run db:generate` after schema changes
- **XML-RPC Parsing:** The custom parser handles Odoo's XML format - be careful when modifying
- **Price Analysis:** Triggers automatically on "Actualizar desde Odoo" - don't duplicate this functionality
- **Filtering Logic:** Server-side filtering in categories API, client-side removed for performance

### Current Implementation Status:
- ✅ Google OAuth authentication working
- ✅ Odoo XML-RPC integration functional (UID: 6 on Conforam-Rincon del Aroma)
- ✅ Category management with automatic price analysis
- ✅ Product cost management with draft changes
- ✅ Server-side filtering and pagination
- ✅ Draft changes preview system
- ✅ Database persistence for analysis results
- ✅ Batch processing for performance

### Key Files to Understand:
- `src/lib/odoo-simple.ts` - Odoo XML-RPC client implementation
- `src/app/api/odoo/categories/route.ts` - Categories API with server-side filtering
- `src/app/api/analyze-category-prices/route.ts` - Automatic price analysis
- `src/app/dashboard/categories/page.tsx` - Main categories management UI
- `prisma/schema.prisma` - Database schema with all models

### Architecture Principles:
- Session-based draft changes before committing to Odoo
- Server-side filtering for efficient pagination  
- Automatic price analysis with database persistence
- Real-time UI updates with batch processing
- Proper error handling for Odoo connection issues