 Inga har markerats 

Fortsätt till innehåll
Använda Gmail med skärmläsningsprogram
1 av 8 549
ACNE_STUDIOS_IMS_PROJECT_PLAN
Inkorgen

Thomas <thomas.von.matern@gmail.com>
Bilagor
09:26 (för 3 minuter sedan)
till mig

 En bilaga
  •  Genomsökt av Gmail
# Acne Studios — Inventory Management System (IMS)
## Project Plan for Claude Code Implementation

---

## 1. Executive Summary

This document specifies an Inventory Management System (IMS) for **Acne Studios**, a Stockholm-based luxury fashion house operating 80+ owned stores worldwide, 20+ e-commerce sites, and ~800 wholesale/franchise partners across 50+ countries. The system centers on **Sales Order (SO)** and **Purchase Order (PO)** management — with a particular emphasis on **intelligent SO↔PO matching** — while providing role-specific entry points for all stakeholders.

A core differentiator of this IMS is its **AI Intelligence Layer**: neural network models and context-aware AI that continuously learn from Acne Studios' order history, seasonal patterns, and sell-through data to optimise demand forecasting, automate PO generation, intelligently allocate stock, and predict SO fulfillment bottlenecks before they occur. Projected efficiency gains from this layer are detailed in Section 9.

Annual revenue is approximately SEK 2 billion (~€180M / $350M). The distribution model is hybrid: direct retail (stores + e-commerce) accounts for ~75% of revenue, with wholesale contributing ~25%. The company operates a centralised warehouse with outbound flows to EU, APAC, and North American markets.

### Key Business Context

- **Seasons**: SS (Spring/Summer), AW (Autumn/Winter), plus Resort and Pre-Fall — typically 4–5 collection drops per year
- **Product categories**: Ready-to-wear (men's & women's), denim, footwear, accessories (bags, small leather goods, eyewear)
- **Existing tech stack**: Salesforce Commerce Cloud (e-commerce), Teamwork Commerce (OMS), Blue Yonder Dispatcher (WMS), Nedap iD Cloud (RFID stock accuracy), NuORDER by Lightspeed (B2B wholesale), Medius (AP automation), Centric Software (merchandise & assortment planning)
- **SKU complexity**: High — each style has multiple sizes, colours, and seasonal variants

---

## 2. Stakeholders & Entry Points

Each stakeholder group requires a dedicated portal or dashboard within the IMS. The system uses **role-based access control (RBAC)** with the following roles and permissions.

### 2.1 Stakeholder Matrix

| # | Stakeholder | Role ID | Primary Needs | Entry Point |
|---|-------------|---------|---------------|-------------|
| 1 | **Buying & Merchandising Team** | `BUYER` | Create POs, manage seasonal buy plans, track order status, approve samples | Buying Dashboard |
| 2 | **Wholesale / Commercial Team** | `WHOLESALE` | Manage wholesale SOs, buyer appointments, B2B order tracking, sell-through analytics | Wholesale Portal |
| 3 | **Retail Store Managers** | `STORE_MGR` | Replenishment requests, stock transfers, in-store SO creation, RFID stock counts | Store Portal |
| 4 | **Retail Sales Associates** | `STORE_ASSOC` | Check stock availability, create customer SOs (clienteling), request out-of-stock items | Store POS Integration |
| 5 | **E-commerce Operations** | `ECOM` | Monitor online SOs, manage returns/exchanges, view real-time inventory across channels | E-commerce Dashboard |
| 6 | **Warehouse / Logistics** | `WAREHOUSE` | Receive PO shipments, pick/pack SOs, manage cross-docking, handle returns | Warehouse Dashboard |
| 7 | **Suppliers / Manufacturers** | `SUPPLIER` | View and confirm POs, update shipment status, upload invoices, communicate delays | Supplier Portal (external) |
| 8 | **Finance / Accounting** | `FINANCE` | PO cost tracking, SO revenue, margin analysis, accounts payable/receivable | Finance Dashboard |
| 9 | **Planning / Demand Team** | `PLANNER` | Demand forecasting, assortment planning, stock allocation by region, reorder triggers | Planning Dashboard |
| 10 | **C-Suite / Directors** | `EXEC` | KPI dashboards, P&L by channel/region/season, strategic inventory health | Executive Dashboard |
| 11 | **Customer Service** | `CS_AGENT` | Order status lookup, initiate returns/exchanges, create replacement SOs | CS Dashboard |
| 12 | **Quality Assurance** | `QA` | Inspect inbound PO shipments, flag defective goods, approve/reject batches | QA Portal |

---

## 3. System Architecture

### 3.1 Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                           │
│  React 18 + TypeScript + Tailwind CSS + shadcn/ui               │
│  Role-specific dashboards served from a single SPA with         │
│  route-based code splitting per portal                          │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                        API LAYER                                │
│  Node.js (Express or Fastify) + TypeScript                      │
│  - /api/v1/purchase-orders    (PO CRUD + lifecycle)             │
│  - /api/v1/sales-orders       (SO CRUD + lifecycle)             │
│  - /api/v1/matching           (SO↔PO matching engine)           │
│  - /api/v1/inventory          (stock queries, transfers)        │
│  - /api/v1/products           (catalog, SKUs, seasons)          │
│  - /api/v1/ai                 (predictions, recommendations)    │
│  - /api/v1/stakeholders       (users, roles, permissions)       │
│  - /api/v1/reports            (analytics, exports)              │
│  - /api/v1/webhooks           (inbound from integrations)       │
│  Auth: JWT + RBAC middleware                                    │
└────────┬───────────────────────────────┬────────────────────────┘
         │                               │
┌────────▼────────────┐   ┌──────────────▼────────────────────────┐
│    DATA LAYER       │   │      AI INTELLIGENCE LAYER            │
│  PostgreSQL 16      │   │  TensorFlow.js / ONNX Runtime (Node)  │
│  Redis              │   │  - Demand Forecasting (LSTM)           │
│  S3-compatible      │   │  - SO↔PO Match Scoring (Neural Net)   │
│  storage            │   │  - Allocation Optimiser (RL Agent)     │
│                     │   │  - Anomaly Detection (Autoencoder)     │
│                     │   │  - Context-Aware Recommendations       │
│                     │   │    (Transformer / Embeddings)          │
└────────┬────────────┘   └──────────────┬────────────────────────┘
         │                               │
┌────────▼───────────────────────────────▼────────────────────────┐
│                   INTEGRATION LAYER                             │
│  Message queue (BullMQ on Redis) for async processing           │
│  Adapters for external systems (see section 3.2)                │
│  ML training pipeline (scheduled retraining jobs)               │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Integration Points (Adapters)

The IMS must integrate with Acne Studios' existing systems. Each integration is implemented as an adapter module under `/src/integrations/`.

| System | Direction | Purpose | Adapter Pattern |
|--------|-----------|---------|-----------------|
| **Salesforce Commerce Cloud** | Bi-directional | Sync online SOs, inventory availability | REST API polling + webhooks |
| **Teamwork Commerce (OMS)** | Bi-directional | SO fulfillment orchestration, order routing | Event-driven via queue |
| **Blue Yonder WMS** | Bi-directional | PO receiving, pick/pack confirmation, stock levels | EDI / API |
| **Nedap iD Cloud (RFID)** | Inbound | Real-time in-store stock counts | Webhook / REST |
| **NuORDER by Lightspeed** | Bi-directional | Wholesale SO ingestion, line sheet sync | REST API |
| **Centric Software** | Inbound | Seasonal assortment plans, buy budgets | Scheduled sync |
| **Medius AP** | Outbound | PO invoice matching, payment triggers | API |
| **ERP (accounting)** | Bi-directional | GL entries, cost of goods, financial reporting | API |

> **Implementation note for Claude Code**: Build each adapter as a standalone module with a common interface (`IIntegrationAdapter`) containing `sync()`, `push()`, `pull()`, and `healthCheck()` methods. Use a factory pattern to instantiate adapters. Initially implement with mock/stub data; real integrations come in later phases.

### 3.3 Project Structure

```
acne-ims/
├── README.md
├── package.json
├── tsconfig.json
├── docker-compose.yml              # PostgreSQL, Redis, app
├── .env.example
│
├── prisma/
│   ├── schema.prisma               # Database schema (Prisma ORM)
│   └── migrations/
│   └── seed.ts                     # Seed data (sample products, users, seasons)
│
├── src/
│   ├── server.ts                   # Express/Fastify entry point
│   ├── config/
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   └── auth.ts
│   │
│   ├── middleware/
│   │   ├── authenticate.ts         # JWT verification
│   │   ├── authorize.ts            # RBAC permission check
│   │   ├── validate.ts             # Zod request validation
│   │   └── errorHandler.ts
│   │
│   ├── modules/
│   │   ├── purchase-orders/        # PO module
│   │   │   ├── po.routes.ts
│   │   │   ├── po.controller.ts
│   │   │   ├── po.service.ts
│   │   │   ├── po.types.ts
│   │   │   └── po.validators.ts
│   │   │
│   │   ├── sales-orders/           # SO module
│   │   │   ├── so.routes.ts
│   │   │   ├── so.controller.ts
│   │   │   ├── so.service.ts
│   │   │   ├── so.types.ts
│   │   │   └── so.validators.ts
│   │   │
│   │   ├── matching/               # SO↔PO Matching Engine (Section 7A)
│   │   │   ├── matching.routes.ts
│   │   │   ├── matching.controller.ts
│   │   │   ├── matching.service.ts       # Core matching logic
│   │   │   ├── matching.scorer.ts        # Multi-factor scoring algorithm
│   │   │   ├── matching.resolver.ts      # Conflict resolution & split logic
│   │   │   ├── matching.types.ts
│   │   │   └── matching.validators.ts
│   │   │
│   │   ├── inventory/              # Stock management
│   │   │   ├── inventory.routes.ts
│   │   │   ├── inventory.controller.ts
│   │   │   ├── inventory.service.ts
│   │   │   └── inventory.types.ts
│   │   │
│   │   ├── products/               # Product catalog & SKUs
│   │   │   ├── product.routes.ts
│   │   │   ├── product.controller.ts
│   │   │   ├── product.service.ts
│   │   │   └── product.types.ts
│   │   │
│   │   ├── auth/                   # Authentication & authorization
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.service.ts
│   │   │
│   │   └── reports/                # Reporting & analytics
│   │       ├── report.routes.ts
│   │       ├── report.controller.ts
│   │       └── report.service.ts
│   │
│   ├── ai/                         # AI Intelligence Layer (Section 9)
│   │   ├── models/
│   │   │   ├── demand-forecast/    # LSTM demand forecasting
│   │   │   │   ├── model.ts
│   │   │   │   ├── features.ts     # Feature engineering
│   │   │   │   ├── train.ts        # Training pipeline
│   │   │   │   └── predict.ts      # Inference endpoint
│   │   │   │
│   │   │   ├── match-scorer/       # Neural SO↔PO match scoring
│   │   │   │   ├── model.ts
│   │   │   │   ├── features.ts
│   │   │   │   ├── train.ts
│   │   │   │   └── predict.ts
│   │   │   │
│   │   │   ├── allocation-optimizer/ # RL-based stock allocation
│   │   │   │   ├── agent.ts
│   │   │   │   ├── environment.ts
│   │   │   │   └── train.ts
│   │   │   │
│   │   │   ├── anomaly-detector/   # Autoencoder for anomalies
│   │   │   │   ├── model.ts
│   │   │   │   ├── train.ts
│   │   │   │   └── detect.ts
│   │   │   │
│   │   │   └── context-engine/     # Context-aware recommendations
│   │   │       ├── embeddings.ts   # Product/order embeddings
│   │   │       ├── context.ts      # Contextual feature assembly
│   │   │       └── recommend.ts
│   │   │
│   │   ├── pipelines/
│   │   │   ├── dataPrep.ts         # ETL for training data
│   │   │   ├── trainAll.ts         # Orchestrate retraining
│   │   │   └── evaluate.ts         # Model evaluation metrics
│   │   │
│   │   ├── ai.routes.ts
│   │   ├── ai.controller.ts
│   │   └── ai.service.ts           # Unified AI service facade
│   │
│   ├── integrations/               # External system adapters
│   │   ├── adapter.interface.ts    # IIntegrationAdapter
│   │   ├── adapter.factory.ts
│   │   ├── salesforce/
│   │   ├── teamwork-commerce/
│   │   ├── blue-yonder/
│   │   ├── nedap-rfid/
│   │   ├── nuorder/
│   │   ├── centric/
│   │   └── medius/
│   │
│   ├── jobs/                       # Background jobs (BullMQ)
│   │   ├── syncInventory.ts
│   │   ├── processOrders.ts
│   │   ├── runSOPOMatching.ts      # Periodic SO↔PO matching sweep
│   │   ├── trainModels.ts          # Scheduled ML model retraining
│   │   ├── generatePredictions.ts  # Demand forecast + anomaly detection
│   │   └── generateReports.ts
│   │
│   └── utils/
│       ├── logger.ts
│       ├── constants.ts
│       └── helpers.ts
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── router.tsx              # Role-based route config
│   │   │
│   │   ├── layouts/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── PortalLayout.tsx
│   │   │   └── AuthLayout.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── buying/             # Buying Dashboard
│   │   │   ├── wholesale/          # Wholesale Portal
│   │   │   ├── store/              # Store Portal
│   │   │   ├── ecommerce/          # E-commerce Dashboard
│   │   │   ├── warehouse/          # Warehouse Dashboard
│   │   │   ├── supplier/           # Supplier Portal
│   │   │   ├── finance/            # Finance Dashboard
│   │   │   ├── planning/           # Planning Dashboard
│   │   │   ├── executive/          # Executive Dashboard
│   │   │   ├── cs/                 # Customer Service Dashboard
│   │   │   └── qa/                 # QA Portal
│   │   │
│   │   ├── components/
│   │   │   ├── common/             # Shared UI components
│   │   │   ├── orders/             # SO & PO shared components
│   │   │   └── inventory/          # Stock display components
│   │   │
│   │   ├── hooks/
│   │   ├── services/               # API client functions
│   │   ├── stores/                 # Zustand state management
│   │   └── types/
│   │
│   └── public/
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## 4. Data Model

### 4.1 Core Entities (Prisma Schema)

Claude Code should implement the following schema in `prisma/schema.prisma`. This is the authoritative data model.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ─────────────────────────────────────────────

enum Season {
  SS    // Spring/Summer
  AW    // Autumn/Winter
  RESORT
  PRE_FALL
  CAPSULE
}

enum POStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  SENT_TO_SUPPLIER
  CONFIRMED_BY_SUPPLIER
  IN_PRODUCTION
  SHIPPED
  PARTIALLY_RECEIVED
  RECEIVED
  CLOSED
  CANCELLED
}

enum SOStatus {
  DRAFT
  CONFIRMED
  ALLOCATED
  PICKING
  PACKED
  SHIPPED
  PARTIALLY_SHIPPED
  DELIVERED
  RETURNED
  CANCELLED
  ON_HOLD
}

enum SOChannel {
  RETAIL_STORE
  ECOMMERCE
  WHOLESALE
  MARKETPLACE
  CLIENTELING     // In-store special order for a customer
}

enum SOType {
  STANDARD
  PRE_ORDER
  BACK_ORDER
  TRANSFER       // Inter-store transfer
  REPLENISHMENT  // Warehouse-to-store replenishment
  RETURN
  EXCHANGE
}

enum Currency {
  SEK
  EUR
  USD
  GBP
  JPY
  CNY
  KRW
  AUD
  CAD
  SGD
  HKD
}

enum UserRole {
  BUYER
  WHOLESALE
  STORE_MGR
  STORE_ASSOC
  ECOM
  WAREHOUSE
  SUPPLIER
  FINANCE
  PLANNER
  EXEC
  CS_AGENT
  QA
  ADMIN
}

enum StockMovementType {
  PO_RECEIPT
  SO_ALLOCATION
  SO_SHIPMENT
  TRANSFER_OUT
  TRANSFER_IN
  RETURN_RECEIPT
  ADJUSTMENT_POSITIVE
  ADJUSTMENT_NEGATIVE
  DAMAGE_WRITEOFF
  RFID_RECONCILIATION
}

// ─── USERS & AUTH ──────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  firstName     String
  lastName      String
  role          UserRole
  isActive      Boolean   @default(true)
  locationId    String?
  location      Location? @relation(fields: [locationId], references: [id])
  supplierId    String?
  supplier      Supplier? @relation(fields: [supplierId], references: [id])
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  createdPOs    PurchaseOrder[]  @relation("POCreatedBy")
  approvedPOs   PurchaseOrder[]  @relation("POApprovedBy")
  createdSOs    SalesOrder[]     @relation("SOCreatedBy")
  auditLogs     AuditLog[]
}

// ─── PRODUCT CATALOG ───────────────────────────────────

model Product {
  id            String    @id @default(cuid())
  styleNumber   String    @unique    // e.g., "FN-UX-JACK000123"
  name          String
  category      String               // e.g., "Outerwear", "Denim", "Accessories"
  subCategory   String?              // e.g., "Bomber Jacket", "Straight Leg"
  gender        String               // "Men", "Women", "Unisex"
  season        Season
  seasonYear    Int                  // e.g., 2026
  collection    String?              // e.g., "Blå Konst", "Main Collection"
  isCarryOver   Boolean   @default(false)  // Core/continuity style
  costPrice     Decimal   @db.Decimal(10, 2)
  costCurrency  Currency  @default(SEK)
  description   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  skus          SKU[]
  images        ProductImage[]
}

model SKU {
  id            String    @id @default(cuid())
  productId     String
  product       Product   @relation(fields: [productId], references: [id])
  sku           String    @unique    // e.g., "FN-UX-JACK000123-BLK-M"
  barcode       String?   @unique    // EAN/UPC
  rfidTag       String?   @unique
  colour        String
  colourCode    String               // Pantone or internal code
  size          String               // e.g., "XS", "S", "M", "L", "XL", "36", "38"
  sizeIndex     Int                  // Numeric for sorting
  wholesalePrice Decimal  @db.Decimal(10, 2)
  retailPrice   Decimal   @db.Decimal(10, 2)
  priceCurrency Currency  @default(SEK)
  weight        Decimal?  @db.Decimal(8, 3)  // kg
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  stockLevels   StockLevel[]
  stockMovements StockMovement[]
  poLines       POLine[]
  soLines       SOLine[]
}

model ProductImage {
  id         String  @id @default(cuid())
  productId  String
  product    Product @relation(fields: [productId], references: [id])
  url        String
  altText    String?
  isPrimary  Boolean @default(false)
  sortOrder  Int     @default(0)
}

// ─── LOCATIONS ─────────────────────────────────────────

model Location {
  id            String    @id @default(cuid())
  name          String               // e.g., "Stockholm Flagship", "Central Warehouse EU"
  type          String               // "STORE", "WAREHOUSE", "OFFICE", "POPUP"
  address       String
  city          String
  country       String
  countryCode   String               // ISO 3166-1 alpha-2
  region        String               // "EU", "APAC", "NA"
  timezone      String               // e.g., "Europe/Stockholm"
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())

  users         User[]
  stockLevels   StockLevel[]
  stockMovementsFrom StockMovement[] @relation("MovementFromLocation")
  stockMovementsTo   StockMovement[] @relation("MovementToLocation")
  salesOrders   SalesOrder[]
}

// ─── SUPPLIERS ─────────────────────────────────────────

model Supplier {
  id            String    @id @default(cuid())
  name          String
  code          String    @unique    // Internal supplier code
  contactName   String?
  contactEmail  String?
  country       String
  leadTimeDays  Int                  // Average production lead time
  paymentTerms  String?              // e.g., "Net 30", "Net 60"
  currency      Currency  @default(EUR)
  isActive      Boolean   @default(true)
  fairWearScore String?              // Sustainability rating
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  users         User[]
  purchaseOrders PurchaseOrder[]
}

// ─── PURCHASE ORDERS ───────────────────────────────────

model PurchaseOrder {
  id              String    @id @default(cuid())
  poNumber        String    @unique    // Auto-generated: "PO-{SEASON}{YEAR}-{SEQ}"
  supplierId      String
  supplier        Supplier  @relation(fields: [supplierId], references: [id])
  season          Season
  seasonYear      Int
  status          POStatus  @default(DRAFT)
  currency        Currency
  totalAmount     Decimal   @db.Decimal(12, 2) @default(0)
  expectedDelivery DateTime?
  actualDelivery  DateTime?
  deliveryLocationId String?           // Target warehouse
  shippingTerms   String?              // Incoterms (e.g., "FOB", "CIF")
  paymentTerms    String?
  notes           String?
  createdById     String
  createdBy       User      @relation("POCreatedBy", fields: [createdById], references: [id])
  approvedById    String?
  approvedBy      User?     @relation("POApprovedBy", fields: [approvedById], references: [id])
  approvedAt      DateTime?
  sentToSupplierAt DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  lines           POLine[]
  documents       PODocument[]
  statusHistory   POStatusHistory[]
}

model POLine {
  id              String    @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
  skuId           String
  sku             SKU       @relation(fields: [skuId], references: [id])
  quantityOrdered Int
  quantityReceived Int       @default(0)
  unitCost        Decimal   @db.Decimal(10, 2)
  lineTotal       Decimal   @db.Decimal(12, 2)
  expectedDate    DateTime?              // Line-level delivery date
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  receipts        POReceipt[]
}

model POReceipt {
  id              String    @id @default(cuid())
  poLineId        String
  poLine          POLine    @relation(fields: [poLineId], references: [id])
  quantityReceived Int
  receivedAt      DateTime  @default(now())
  receivedById    String
  locationId      String
  qualityStatus   String    @default("PENDING")  // PENDING, PASSED, FAILED
  damagedQuantity Int       @default(0)
  notes           String?
}

model PODocument {
  id              String    @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  type            String               // "INVOICE", "PACKING_LIST", "QUALITY_CERT"
  fileName        String
  fileUrl         String
  uploadedAt      DateTime  @default(now())
}

model POStatusHistory {
  id              String    @id @default(cuid())
  purchaseOrderId String
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  fromStatus      POStatus?
  toStatus        POStatus
  changedById     String
  reason          String?
  changedAt       DateTime  @default(now())
}

// ─── SALES ORDERS ──────────────────────────────────────

model SalesOrder {
  id              String    @id @default(cuid())
  soNumber        String    @unique    // Auto-generated: "SO-{CHANNEL_PREFIX}-{SEQ}"
  channel         SOChannel
  type            SOType    @default(STANDARD)
  status          SOStatus  @default(DRAFT)
  locationId      String?              // Originating store or warehouse
  location        Location? @relation(fields: [locationId], references: [id])
  customerId      String?              // External customer reference
  customerName    String?
  customerEmail   String?
  wholesaleBuyerId String?             // For wholesale SOs (NuORDER buyer ID)
  currency        Currency
  subtotal        Decimal   @db.Decimal(12, 2) @default(0)
  taxAmount       Decimal   @db.Decimal(10, 2) @default(0)
  discountAmount  Decimal   @db.Decimal(10, 2) @default(0)
  totalAmount     Decimal   @db.Decimal(12, 2) @default(0)
  shippingAddress String?
  shippingCity    String?
  shippingCountry String?
  requestedShipDate DateTime?
  actualShipDate  DateTime?
  deliveredAt     DateTime?
  notes           String?
  priority        Int       @default(0)   // 0=normal, 1=high, 2=urgent
  createdById     String
  createdBy       User      @relation("SOCreatedBy", fields: [createdById], references: [id])
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  lines           SOLine[]
  statusHistory   SOStatusHistory[]
  shipments       Shipment[]
}

model SOLine {
  id              String    @id @default(cuid())
  salesOrderId    String
  salesOrder      SalesOrder @relation(fields: [salesOrderId], references: [id], onDelete: Cascade)
  skuId           String
  sku             SKU       @relation(fields: [skuId], references: [id])
  quantityOrdered Int
  quantityAllocated Int     @default(0)
  quantityShipped Int       @default(0)
  quantityReturned Int      @default(0)
  unitPrice       Decimal   @db.Decimal(10, 2)
  discountPercent Decimal   @db.Decimal(5, 2) @default(0)
  lineTotal       Decimal   @db.Decimal(12, 2)
  notes           String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model SOStatusHistory {
  id              String    @id @default(cuid())
  salesOrderId    String
  salesOrder      SalesOrder @relation(fields: [salesOrderId], references: [id])
  fromStatus      SOStatus?
  toStatus        SOStatus
  changedById     String
  reason          String?
  changedAt       DateTime  @default(now())
}

model Shipment {
  id              String    @id @default(cuid())
  salesOrderId    String
  salesOrder      SalesOrder @relation(fields: [salesOrderId], references: [id])
  trackingNumber  String?
  carrier         String?
  shippedAt       DateTime?
  deliveredAt     DateTime?
  createdAt       DateTime  @default(now())
}

// ─── INVENTORY ─────────────────────────────────────────

model StockLevel {
  id              String    @id @default(cuid())
  skuId           String
  sku             SKU       @relation(fields: [skuId], references: [id])
  locationId      String
  location        Location  @relation(fields: [locationId], references: [id])
  quantityOnHand  Int       @default(0)
  quantityAllocated Int     @default(0)   // Reserved for SOs
  quantityInTransit Int     @default(0)   // In shipment
  quantityOnOrder  Int      @default(0)   // On open POs
  reorderPoint    Int?                    // Min stock trigger
  reorderQuantity Int?                    // Default PO quantity
  lastCountedAt   DateTime?              // Last RFID/physical count
  updatedAt       DateTime  @updatedAt

  @@unique([skuId, locationId])
}

model StockMovement {
  id              String    @id @default(cuid())
  skuId           String
  sku             SKU       @relation(fields: [skuId], references: [id])
  type            StockMovementType
  quantity        Int                    // Positive for additions, negative for removals
  fromLocationId  String?
  fromLocation    Location? @relation("MovementFromLocation", fields: [fromLocationId], references: [id])
  toLocationId    String?
  toLocation      Location? @relation("MovementToLocation", fields: [toLocationId], references: [id])
  referenceType   String?               // "PO", "SO", "TRANSFER", "ADJUSTMENT"
  referenceId     String?               // PO or SO ID
  reason          String?
  performedById   String
  performedAt     DateTime  @default(now())
}

// ─── AUDIT ─────────────────────────────────────────────

model AuditLog {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  action      String              // "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"
  entityType  String              // "PO", "SO", "INVENTORY", etc.
  entityId    String
  oldValue    Json?
  newValue    Json?
  ipAddress   String?
  timestamp   DateTime @default(now())
}

// ─── SO↔PO MATCHING ───────────────────────────────────

enum MatchStatus {
  PROPOSED       // AI/system proposed, awaiting human review
  CONFIRMED      // Human confirmed the match
  AUTO_CONFIRMED // System auto-confirmed (high confidence + rule-based)
  REJECTED       // Human rejected the match
  SUPERSEDED     // Replaced by a better match
  FULFILLED      // Stock from PO was allocated to SO
  EXPIRED        // PO delivery missed, match no longer valid
}

model SOPOMatch {
  id              String      @id @default(cuid())
  salesOrderId    String
  salesOrderLineId String?    // Null = entire SO, populated = line-level match
  purchaseOrderId String
  purchaseOrderLineId String? // Null = entire PO, populated = line-level match
  skuId           String      // The SKU being matched
  quantityMatched Int         // Units from this PO allocated to this SO
  matchScore      Float       // 0.0–1.0 confidence from scoring algorithm
  matchFactors    Json        // Breakdown: { timing: 0.9, sku: 1.0, location: 0.7, ... }
  status          MatchStatus @default(PROPOSED)
  proposedBy      String      // "SYSTEM", "AI_MODEL", or userId
  confirmedById   String?
  confirmedAt     DateTime?
  rejectedReason  String?
  expectedFulfillDate DateTime? // When PO stock is expected to fulfil this SO
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([salesOrderId])
  @@index([purchaseOrderId])
  @@index([skuId])
  @@index([status])
}

model MatchingRun {
  id              String   @id @default(cuid())
  triggeredBy     String              // "SCHEDULED", "PO_RECEIVED", "SO_CREATED", "MANUAL"
  matchesProposed Int      @default(0)
  matchesAutoConfirmed Int @default(0)
  matchesRequiringReview Int @default(0)
  unmatched       Int      @default(0) // SOs that could not be matched
  avgMatchScore   Float?
  executionTimeMs Int?
  modelVersion    String?              // AI model version used
  startedAt       DateTime @default(now())
  completedAt     DateTime?
}

// ─── AI / ML ───────────────────────────────────────────

model DemandForecast {
  id              String   @id @default(cuid())
  skuId           String
  locationId      String?             // Null = global, populated = location-specific
  season          Season
  seasonYear      Int
  forecastDate    DateTime            // The date this forecast is for
  predictedDemand Int                 // Predicted units
  confidenceLow   Int                 // Lower bound (80% CI)
  confidenceHigh  Int                 // Upper bound (80% CI)
  modelVersion    String
  features        Json?               // Input features snapshot
  createdAt       DateTime @default(now())

  @@index([skuId, forecastDate])
  @@index([season, seasonYear])
}

model AIRecommendation {
  id              String   @id @default(cuid())
  type            String              // "REORDER", "TRANSFER", "MARKDOWN", "CANCEL_PO", "EXPEDITE_PO"
  targetEntity    String              // "SKU", "PO", "SO", "LOCATION"
  targetId        String
  recommendation  String              // Human-readable recommendation text
  confidence      Float               // 0.0–1.0
  reasoning       Json                // Explainable AI: factors and weights
  impact          Json?               // Projected impact: { revenueGain, costSaving, riskReduction }
  status          String   @default("PENDING")  // PENDING, ACCEPTED, DISMISSED, EXPIRED
  acceptedById    String?
  acceptedAt      DateTime?
  createdAt       DateTime @default(now())

  @@index([type, status])
  @@index([targetEntity, targetId])
}

model AnomalyAlert {
  id              String   @id @default(cuid())
  type            String              // "DEMAND_SPIKE", "DEMAND_DROP", "SUPPLIER_DELAY", "STOCK_DISCREPANCY", "MARGIN_EROSION"
  severity        String              // "LOW", "MEDIUM", "HIGH", "CRITICAL"
  entityType      String              // "SKU", "PO", "SO", "SUPPLIER", "LOCATION"
  entityId        String
  description     String
  detectedValue   Float               // The anomalous value
  expectedRange   Json                // { low: number, high: number }
  modelVersion    String
  isResolved      Boolean  @default(false)
  resolvedById    String?
  resolvedAt      DateTime?
  createdAt       DateTime @default(now())

  @@index([type, severity, isResolved])
}

model ModelRegistry {
  id              String   @id @default(cuid())
  modelName       String              // "demand_forecast", "match_scorer", "anomaly_detector"
  version         String              // Semver: "1.2.0"
  status          String              // "TRAINING", "VALIDATING", "ACTIVE", "RETIRED"
  metrics         Json                // { accuracy, mae, f1Score, etc. }
  hyperparameters Json
  trainingDataRange Json              // { from: date, to: date, recordCount: number }
  artifactPath    String              // S3 path to saved model weights
  trainedAt       DateTime
  activatedAt     DateTime?
  createdAt       DateTime @default(now())

  @@unique([modelName, version])
}
```

---

## 5. Purchase Order (PO) Module — Detailed Specification

### 5.1 PO Lifecycle State Machine

```
DRAFT → PENDING_APPROVAL → APPROVED → SENT_TO_SUPPLIER → CONFIRMED_BY_SUPPLIER
                                                                    ↓
                                            IN_PRODUCTION → SHIPPED → PARTIALLY_RECEIVED → RECEIVED → CLOSED
                                                                                                ↑
                                                                                         (all lines received)

Any state → CANCELLED (with reason, only if not yet RECEIVED)
```

### 5.2 PO Numbering

Format: `PO-{SEASON}{YEAR}-{SEQUENTIAL_5_DIGIT}`
Example: `PO-AW2026-00042`

### 5.3 PO Business Rules

1. **Draft creation**: Buyers create POs linked to a season, supplier, and collection. Lines reference SKUs with quantity and negotiated cost.
2. **Approval workflow**: POs exceeding a configurable threshold (e.g., SEK 500,000) require approval from a senior buyer or director. Below threshold: auto-approve.
3. **Supplier confirmation**: Once sent, suppliers must confirm within a configurable window (default: 5 business days). If not confirmed, auto-escalation notification is sent.
4. **Partial receiving**: Warehouse staff can receive partial shipments against PO lines. Each receipt triggers a stock movement and updates `quantityReceived`.
5. **Quality inspection**: QA can flag received items. Failed items are recorded as damaged and do not add to available stock.
6. **Invoice matching**: Finance matches supplier invoices to PO totals. Three-way match: PO, receipt, invoice.
7. **Seasonal buy plan**: POs are grouped by season/year for budgetary overview. The planning dashboard shows committed spend vs. budget by season.
8. **Carry-over styles**: Core/continuity items (e.g., bestselling denim) have standing PO templates that auto-generate based on reorder points.

### 5.4 PO API Endpoints

| Method | Endpoint | Role(s) | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/purchase-orders` | BUYER, PLANNER | Create new PO |
| GET | `/api/v1/purchase-orders` | BUYER, PLANNER, FINANCE, EXEC, WAREHOUSE | List POs with filters |
| GET | `/api/v1/purchase-orders/:id` | ALL (scoped) | Get PO details |
| PATCH | `/api/v1/purchase-orders/:id` | BUYER (own draft), ADMIN | Update PO |
| POST | `/api/v1/purchase-orders/:id/lines` | BUYER | Add line items |
| PATCH | `/api/v1/purchase-orders/:id/lines/:lineId` | BUYER | Update line item |
| DELETE | `/api/v1/purchase-orders/:id/lines/:lineId` | BUYER | Remove line item |
| POST | `/api/v1/purchase-orders/:id/submit` | BUYER | Submit for approval |
| POST | `/api/v1/purchase-orders/:id/approve` | BUYER (senior), EXEC | Approve PO |
| POST | `/api/v1/purchase-orders/:id/reject` | BUYER (senior), EXEC | Reject PO with reason |
| POST | `/api/v1/purchase-orders/:id/send` | BUYER | Send to supplier |
| POST | `/api/v1/purchase-orders/:id/confirm` | SUPPLIER | Supplier confirms |
| POST | `/api/v1/purchase-orders/:id/receive` | WAREHOUSE, QA | Record receipt |
| POST | `/api/v1/purchase-orders/:id/cancel` | BUYER, ADMIN | Cancel PO |
| POST | `/api/v1/purchase-orders/:id/documents` | BUYER, SUPPLIER, FINANCE | Upload document |
| GET | `/api/v1/purchase-orders/:id/history` | ALL (scoped) | Get status history |

### 5.5 PO Dashboard Views by Stakeholder

- **Buying Dashboard**: Open POs by season, budget utilisation chart, overdue deliveries, PO creation form
- **Supplier Portal**: Pending confirmations, production timeline updater, document upload, shipment notifications
- **Warehouse Dashboard**: Expected arrivals (next 7/14/30 days), receiving form, QA queue
- **Finance Dashboard**: PO cost summary by season/supplier, invoice matching queue, payment status
- **Planning Dashboard**: Buy plan vs. actuals by category, season, region

---

## 6. Sales Order (SO) Module — Detailed Specification

### 6.1 SO Lifecycle State Machine

```
DRAFT → CONFIRMED → ALLOCATED → PICKING → PACKED → SHIPPED → DELIVERED
                                                        ↓
                                                 PARTIALLY_SHIPPED → (repeat until complete)

Any pre-SHIPPED state → CANCELLED
Any post-SHIPPED state → RETURNED (full or partial)
Any state → ON_HOLD ↔ (previous state)
```

### 6.2 SO Numbering by Channel

| Channel | Format | Example |
|---------|--------|---------|
| Retail Store | `SO-RT-{STORE_CODE}-{SEQ}` | `SO-RT-STHLM01-00312` |
| E-commerce | `SO-EC-{REGION}-{SEQ}` | `SO-EC-EU-84291` |
| Wholesale | `SO-WH-{BUYER_CODE}-{SEQ}` | `SO-WH-NORD001-00089` |
| Marketplace | `SO-MP-{PLATFORM}-{SEQ}` | `SO-MP-FARFETCH-00045` |
| Clienteling | `SO-CL-{STORE_CODE}-{SEQ}` | `SO-CL-PARIS02-00007` |

### 6.3 SO Business Rules

1. **Multi-channel ingestion**: SOs arrive from multiple channels — Salesforce Commerce Cloud (e-commerce), NuORDER (wholesale), POS systems (retail), and manual entry (clienteling). Each channel has an inbound adapter.
2. **Stock allocation**: Upon confirmation, the system attempts to allocate stock from the optimal location. Allocation priority: (a) same location, (b) nearest warehouse, (c) nearest store with surplus.
3. **Wholesale pre-orders**: Wholesale buyers place seasonal pre-orders months in advance (at trade shows / buying appointments). These SOs are linked to future POs and allocated when stock arrives.
4. **Split shipment**: If a multi-line SO cannot be fully allocated from one location, it may be split into multiple shipments from different locations (configurable per channel).
5. **Clienteling / special orders**: Store associates can create SOs for items not in-store stock. These trigger either a warehouse transfer or, if out of stock globally, a back-order flag.
6. **Returns & exchanges**: Customer service or store staff can initiate returns that create reverse stock movements and, optionally, a replacement SO.
7. **Pricing**: Retail SOs use the SKU retail price. Wholesale SOs use the wholesale price, potentially with negotiated discounts. Currency conversion is applied based on SO currency.
8. **Priority handling**: VIC (Very Important Client) orders can be flagged as high priority, which affects allocation and fulfillment sequencing.
9. **Replenishment SOs**: Auto-generated when store stock drops below the reorder point (triggered by RFID counts or POS sales). These are internal transfer orders from warehouse to store.

### 6.4 SO API Endpoints

| Method | Endpoint | Role(s) | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/sales-orders` | STORE_MGR, STORE_ASSOC, ECOM, WHOLESALE, CS_AGENT | Create SO |
| GET | `/api/v1/sales-orders` | ALL (scoped by role/location) | List SOs with filters |
| GET | `/api/v1/sales-orders/:id` | ALL (scoped) | Get SO details |
| PATCH | `/api/v1/sales-orders/:id` | Creator role, ADMIN | Update SO |
| POST | `/api/v1/sales-orders/:id/lines` | Creator role | Add line items |
| POST | `/api/v1/sales-orders/:id/confirm` | STORE_MGR, ECOM, WHOLESALE | Confirm SO |
| POST | `/api/v1/sales-orders/:id/allocate` | WAREHOUSE, SYSTEM | Allocate stock |
| POST | `/api/v1/sales-orders/:id/pick` | WAREHOUSE | Mark as picking |
| POST | `/api/v1/sales-orders/:id/pack` | WAREHOUSE | Mark as packed |
| POST | `/api/v1/sales-orders/:id/ship` | WAREHOUSE | Record shipment |
| POST | `/api/v1/sales-orders/:id/deliver` | SYSTEM (carrier webhook) | Mark delivered |
| POST | `/api/v1/sales-orders/:id/return` | CS_AGENT, STORE_MGR | Initiate return |
| POST | `/api/v1/sales-orders/:id/cancel` | Creator role, CS_AGENT, ADMIN | Cancel SO |
| POST | `/api/v1/sales-orders/:id/hold` | STORE_MGR, ECOM, ADMIN | Put on hold |
| POST | `/api/v1/sales-orders/:id/release` | STORE_MGR, ECOM, ADMIN | Release from hold |
| GET | `/api/v1/sales-orders/:id/history` | ALL (scoped) | Get status history |

### 6.5 SO Dashboard Views by Stakeholder

- **Store Portal**: Today's orders, pending pickups, stock availability checker, clienteling SO form, replenishment status
- **E-commerce Dashboard**: Live order feed, fulfillment SLA tracker, return rate by SKU, back-order queue
- **Wholesale Portal**: Seasonal order book, order status by buyer, delivery schedule, sell-through analytics
- **Warehouse Dashboard**: Pick queue (prioritized), pack station view, shipment manifest, daily dispatch summary
- **CS Dashboard**: Order search (by SO#, email, name), return initiation form, replacement SO creation
- **Executive Dashboard**: Orders by channel (today/week/month), revenue tracking, fulfillment rate

---

## 7. Inventory Module — Cross-cutting Concerns

### 7.1 Real-time Stock Availability

The system maintains a **computed available quantity** for every SKU at every location:

```
Available = On Hand − Allocated − Damaged + In Transit (optional)
```

This value is cached in Redis for sub-millisecond reads and updated via a write-through pattern whenever stock movements occur.

### 7.2 Stock Allocation Algorithm

When an SO is confirmed, the allocation service runs:

1. Check available stock at the SO's origin location
2. If insufficient, check the primary warehouse for the region
3. If still insufficient, check other warehouses by proximity
4. If still insufficient, check stores with surplus (stock > reorder point + buffer)
5. If no stock available, mark as BACK_ORDER and link to pending POs

### 7.3 RFID Reconciliation

Nedap iD Cloud pushes periodic stock count data. The system:
1. Compares RFID count with `quantityOnHand` in the database
2. Flags discrepancies exceeding a threshold (configurable, default: 2 units per SKU per location)
3. Creates adjustment stock movements for reconciled discrepancies
4. Alerts store managers and the planning team

### 7.4 Inventory API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/inventory/availability` | Check stock by SKU, location, or region |
| GET | `/api/v1/inventory/levels` | Stock levels with filters |
| POST | `/api/v1/inventory/transfer` | Initiate inter-location transfer |
| POST | `/api/v1/inventory/adjust` | Manual stock adjustment (with reason) |
| POST | `/api/v1/inventory/reconcile` | Process RFID count data |
| GET | `/api/v1/inventory/movements` | Stock movement history |
| GET | `/api/v1/inventory/alerts` | Low stock alerts, discrepancy flags |

---

## 7A. SO↔PO Matching Engine — Core System Capability

The matching engine is the **central nervous system** of the IMS. It answers the fundamental question: "Which purchase orders will fulfil which sales orders?" This is non-trivial at Acne Studios' scale, where wholesale pre-orders are placed 6 months before stock arrives, e-commerce SOs need immediate allocation, and carry-over styles have overlapping POs across seasons.

### 7A.1 Why Matching Matters

In luxury fashion, the gap between demand (SOs) and supply (POs) is where margin is made or lost. Poor matching leads to: overstock on slow movers, stockouts on bestsellers, late wholesale deliveries causing retailer penalties, and excessive markdowns at season end. At Acne Studios' scale (~200 SKUs × 10 locations × 4 seasons = 8,000+ stock positions), manual matching is error-prone and slow.

### 7A.2 Match Types

| Match Type | Description | Trigger | Automation Level |
|------------|-------------|---------|-----------------|
| **Direct Allocation** | SO line matches existing on-hand stock (no PO needed) | SO confirmed, stock available | Fully automatic |
| **PO-to-SO Forward Match** | Incoming PO stock is pre-assigned to waiting SOs | PO confirmed by supplier, unallocated SOs exist | Auto-propose, human confirm |
| **SO-to-PO Back-Order Match** | New SO has no stock; linked to the next arriving PO | SO confirmed, zero stock, open PO exists | Auto-propose, human confirm |
| **Wholesale Pre-Order Match** | Wholesale SO placed months ahead, matched to a seasonal PO | Wholesale SO ingested from NuORDER | Auto-propose, buyer confirms |
| **Replenishment Match** | Store reorder matched to warehouse stock or incoming PO | Stock < reorder point | Fully automatic |
| **Cross-Location Match** | SO at Location A matched to PO arriving at Location B (triggers transfer) | No local stock, PO arriving at another location | Auto-propose, planner confirms |
| **Split Match** | One SO fulfilled by multiple POs, or one PO distributed across multiple SOs | Partial availability | Auto-propose, human confirm |

### 7A.3 Multi-Factor Scoring Algorithm

Every potential SO↔PO match is scored on a 0.0–1.0 scale using weighted factors. Matches above a configurable **auto-confirm threshold** (default: 0.85) are automatically confirmed. Matches between 0.50–0.85 are proposed for human review. Below 0.50, no match is proposed.

```
MatchScore = Σ(weight_i × factor_i) for i in factors

Factors:
┌────────────────────────┬────────┬──────────────────────────────────────────────┐
│ Factor                 │ Weight │ Scoring Logic                                │
├────────────────────────┼────────┼──────────────────────────────────────────────┤
│ SKU Exact Match        │ 0.30   │ 1.0 if same SKU; 0.0 otherwise              │
│ Timing Alignment       │ 0.25   │ 1.0 if PO arrives ≥7 days before SO needed; │
│                        │        │ linear decay to 0.0 at 30 days late          │
│ Location Proximity     │ 0.15   │ 1.0 = same location; 0.7 = same region;     │
│                        │        │ 0.4 = different region; 0.0 = impossible     │
│ Quantity Fit           │ 0.10   │ 1.0 if PO qty ≥ SO qty; proportional below  │
│ Channel Priority       │ 0.08   │ Wholesale pre-order: 1.0; VIC: 0.9;         │
│                        │        │ E-com: 0.7; Retail: 0.6; Replenishment: 0.4 │
│ Season Alignment       │ 0.05   │ 1.0 = same season; 0.5 = adjacent;          │
│                        │        │ 0.0 = carry-over mismatch                   │
│ Supplier Reliability   │ 0.04   │ Based on supplier's on-time delivery rate    │
│ Margin Contribution    │ 0.03   │ Higher margin SOs scored higher              │
└────────────────────────┴────────┴──────────────────────────────────────────────┘
```

> **Implementation note for Claude Code**: Implement the scoring algorithm in `matching.scorer.ts` as a pure function: `scoreMatch(soLine, poLine, context) → { score: number, factors: Record<string, number> }`. The weights should be configurable via environment variables or a database config table so they can be tuned without redeployment. The AI model (Section 9) will later learn optimal weights from historical match outcomes.

### 7A.4 Matching Engine Triggers & Execution Flow

The matching engine runs in four modes:

**1. Event-Driven (Real-time)**
Triggered when a relevant event occurs:
- `SO_CONFIRMED` → Find best PO/stock for this SO's lines
- `PO_RECEIVED` → Find waiting SOs that can now be fulfilled
- `PO_CONFIRMED_BY_SUPPLIER` → Re-score all unmatched SOs against this PO
- `STOCK_ADJUSTMENT` → Recheck unmatched SOs at affected location

**2. Scheduled Sweep (Batch)**
A BullMQ job runs every 4 hours (configurable) to:
- Re-score all PROPOSED matches (in case context has changed)
- Find new matches for unmatched SOs
- Expire matches where the PO delivery date has passed
- Generate a matching health report

**3. Season Opening Batch**
When a new season's wholesale SOs are bulk-imported from NuORDER, a one-time batch job runs:
- Load all incoming wholesale SOs for the season
- Load all confirmed/in-production POs for the season
- Run the full matching matrix and propose matches
- Generate a "Seasonal Match Overview" report for the buying team

**4. Manual Trigger**
Buyers, planners, or warehouse managers can trigger a matching run for specific SOs, POs, SKUs, or seasons from the dashboard.

### 7A.5 Conflict Resolution

When multiple SOs compete for the same PO stock:

1. **Priority scoring**: Each SO gets a priority score based on channel (wholesale > VIC > e-com > retail > replenishment), delivery deadline proximity, and order value.
2. **First-come-first-served tiebreak**: Among equal priority, the earliest confirmed SO wins.
3. **Partial allocation**: If a PO can only partially satisfy the highest-priority SO, allocate what's available and cascade the remainder to the next PO.
4. **Split proposals**: The system proposes split matches, showing the planner which SOs are partially allocated and from which POs, with a consolidated view.
5. **Overbooking protection**: The engine never allocates more than the PO's remaining unmatched quantity. A `quantityAvailableForMatching` computed field is maintained:

```
PO Line Available = quantityOrdered − quantityReceived(damaged) − Σ(matched & confirmed quantities)
```

### 7A.6 Matching Dashboard

The Matching Dashboard is accessible to BUYER, PLANNER, WAREHOUSE, and EXEC roles. It displays:

- **Match Overview**: Donut chart showing matched vs. unmatched SO lines for the current season
- **Pending Review Queue**: Table of PROPOSED matches sorted by score, with one-click confirm/reject
- **Unmatched SOs**: SOs with no viable PO match — flagged for the buying team to create new POs
- **PO Availability**: POs with unmatched remaining quantity, available for manual assignment
- **Match Timeline**: Gantt-style view showing PO arrival dates vs. SO required-by dates, highlighting gaps
- **Seasonal Health Scorecard**: For each season — % SOs matched, avg match score, projected stockouts, projected overstock

### 7A.7 Matching API Endpoints

| Method | Endpoint | Role(s) | Description |
|--------|----------|---------|-------------|
| POST | `/api/v1/matching/run` | BUYER, PLANNER, ADMIN | Trigger matching run (scoped by season/SKU/SO) |
| GET | `/api/v1/matching/proposals` | BUYER, PLANNER, WAREHOUSE | List proposed matches with filters |
| GET | `/api/v1/matching/proposals/:id` | BUYER, PLANNER, WAREHOUSE | Get match details with scoring breakdown |
| POST | `/api/v1/matching/proposals/:id/confirm` | BUYER, PLANNER | Confirm a proposed match |
| POST | `/api/v1/matching/proposals/:id/reject` | BUYER, PLANNER | Reject with reason |
| POST | `/api/v1/matching/bulk-confirm` | BUYER, PLANNER | Bulk confirm matches above a score threshold |
| GET | `/api/v1/matching/unmatched-sos` | BUYER, PLANNER | SOs with no match — buying action needed |
| GET | `/api/v1/matching/unmatched-po-capacity` | BUYER, PLANNER | PO lines with available unmatched qty |
| GET | `/api/v1/matching/health` | PLANNER, EXEC | Seasonal matching health scorecard |
| GET | `/api/v1/matching/timeline` | BUYER, PLANNER | PO arrival vs. SO deadline timeline data |
| GET | `/api/v1/matching/runs` | ADMIN, PLANNER | History of matching runs with statistics |

---

## 8. AI Intelligence Layer — Neural Networks & Context-Aware Predictions

### 8.1 Architecture Overview

The AI layer runs as a set of models within the Node.js process using **TensorFlow.js** (for neural networks) and **ONNX Runtime for Node** (for models trained externally in Python). Models are retrained on a weekly schedule using BullMQ jobs, with the active model version tracked in the `ModelRegistry` table.

```
┌─────────────────────────────────────────────────────────────────┐
│                    AI Intelligence Layer                        │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │   Feature    │  │   Model      │  │   Inference            │ │
│  │   Store      │→ │   Registry   │→ │   Service              │ │
│  │  (Redis)     │  │  (Postgres)  │  │  (TF.js / ONNX)       │ │
│  └─────────────┘  └──────────────┘  └───────────┬────────────┘ │
│         ↑                                        ↓              │
│  ┌──────┴──────┐                     ┌───────────┴────────────┐ │
│  │  ETL /      │                     │   Outputs:             │ │
│  │  Feature    │                     │   - DemandForecast     │ │
│  │  Pipeline   │                     │   - AIRecommendation   │ │
│  │  (BullMQ)   │                     │   - AnomalyAlert       │ │
│  └─────────────┘                     │   - MatchScore boost   │ │
│                                      └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 8.2 Model 1: Demand Forecasting (LSTM Neural Network)

**Purpose**: Predict future demand per SKU per location per week, enabling proactive PO creation and smarter SO↔PO matching.

**Architecture**: A stacked LSTM (Long Short-Term Memory) network — ideal for sequential, seasonal time-series data like fashion sales.

```
Input Features (per SKU per location per week):
├── Historical sales (last 52 weeks, same SKU)
├── Historical sales (last 52 weeks, same category at same location)
├── Season indicator (one-hot: SS, AW, Resort, Pre-Fall)
├── Week-of-season position (0.0–1.0, normalised)
├── Is carry-over style (binary)
├── Price point tier (normalised)
├── Location region (one-hot: EU, NA, APAC)
├── Location type (one-hot: STORE, WAREHOUSE)
├── Channel mix (% retail, % e-com, % wholesale — rolling 8 weeks)
├── Promotional flag (binary — is this SKU on sale?)
├── Fashion week proximity (weeks since/until nearest fashion week)
└── External: Google Trends index for category (weekly, normalised)

Network:
  Input(22 features × 52 timesteps)
  → LSTM(128 units, return_sequences=True)
  → Dropout(0.2)
  → LSTM(64 units)
  → Dropout(0.2)
  → Dense(32, ReLU)
  → Dense(1, output = predicted_weekly_demand)

Output: Point forecast + 80% confidence interval (via Monte Carlo dropout)
Retrain: Weekly (Sunday night), on rolling 2-year window
```

**How it feeds into SO↔PO Matching**: The forecast generates expected demand for the next 12 weeks per SKU per location. The matching engine uses this to:
- Prioritise matching POs to SKUs with high predicted demand (prevent stockouts)
- De-prioritise matching for SKUs with declining demand (prevent overstock)
- Alert buyers when unmatched SO demand exceeds total PO pipeline

### 8.3 Model 2: Neural Match Scorer (SO↔PO Match Quality)

**Purpose**: Replace and enhance the rule-based scoring from Section 7A.3 with a neural network that learns from historical match outcomes.

**Architecture**: A feedforward neural network trained on confirmed/rejected historical matches.

```
Input Features (per SO-line ↔ PO-line candidate pair):
├── All 8 rule-based factors from Section 7A.3 (pre-computed)
├── SO age (days since creation)
├── PO delivery certainty (supplier's historical on-time rate for this lead time)
├── SKU velocity (units sold per week, rolling 8 weeks)
├── SKU demand forecast (from Model 1)
├── Competing SO count (other SOs wanting the same PO stock)
├── Remaining PO capacity (% of PO line still unmatched)
├── Historical match success (for this SKU: % of past matches that led to on-time fulfillment)
├── Customer/buyer tier (VIC, standard, new — for wholesale: buyer's payment history)
└── Days until SO deadline

Network:
  Input(18 features)
  → Dense(64, ReLU)
  → BatchNorm
  → Dense(32, ReLU)
  → Dropout(0.3)
  → Dense(16, ReLU)
  → Dense(1, Sigmoid → 0.0–1.0 match quality score)

Training Labels: Binary — 1 if the match was confirmed AND resulted in on-time fulfillment, 0 otherwise
Retrain: Bi-weekly, min 1000 labelled examples before first deployment
```

**Hybrid scoring**: Until the neural scorer has enough training data (first ~6 months), the system uses a weighted blend: `FinalScore = 0.7 × RuleScore + 0.3 × NeuralScore`. As the model proves itself, the blend shifts toward the neural scorer.

### 8.4 Model 3: Context-Aware Allocation Optimiser (Reinforcement Learning)

**Purpose**: Optimise the allocation decision — given N waiting SOs and M available PO lines, find the allocation that maximises total fulfillment rate, minimises transfer costs, and respects priority rules.

**Architecture**: A Deep Q-Network (DQN) agent that treats allocation as a sequential decision problem.

```
State:
├── For each unmatched SO line: [SKU embedding, deadline, priority, channel, location]
├── For each available PO line: [SKU embedding, expected arrival, quantity, location]
├── Current stock levels per SKU per location (top 20 SKUs)
└── Days until season end

Actions:
├── Match SO_i to PO_j (with quantity)
├── Split SO_i across PO_j and PO_k
├── Defer SO_i (wait for a better PO)
└── Trigger transfer from Location_A to Location_B

Reward Function:
  +10  for on-time SO fulfillment
  +5   for wholesale pre-order matched within delivery window
  −5   for each day an SO is overdue
  −3   for each cross-region transfer triggered
  −15  for an SO that expires unmatched (stockout → lost sale)
  +2   for maintaining stock balance (Gini coefficient across locations)

Training: Simulated environment using 2 years of historical PO/SO data
```

**Implementation note for Claude Code**: The RL agent is the most complex model. For initial implementation, build the environment simulator (`environment.ts`) using historical data and implement a simple epsilon-greedy DQN with TensorFlow.js. The agent can train overnight on the server. In production, it provides allocation recommendations alongside the rule-based system, with human override.

### 8.5 Model 4: Anomaly Detection (Autoencoder)

**Purpose**: Detect unusual patterns in orders, inventory, and supplier behavior that indicate problems requiring human attention.

```
Anomaly Types:
├── DEMAND_SPIKE    — SKU selling 3σ above forecast → replenishment urgency
├── DEMAND_DROP     — SKU selling 3σ below forecast → potential markdown needed
├── SUPPLIER_DELAY  — Supplier's recent POs trending late → re-score affected matches
├── STOCK_DISCREPANCY — RFID count diverging from system → potential shrinkage
├── MARGIN_EROSION  — SO prices trending below target margin → pricing review
└── MATCH_DEGRADATION — Match confirmation rate dropping → model/rule review

Architecture: Symmetric autoencoder
  Encoder: Dense(64) → Dense(32) → Dense(8, latent space)
  Decoder: Dense(32) → Dense(64) → Dense(original_dim)
  Anomaly = reconstruction error > threshold (tuned per entity type)
```

### 8.6 Model 5: Context-Aware Recommendation Engine (Embeddings + Transformer)

**Purpose**: Generate actionable recommendations for each stakeholder by understanding the full context of the business state.

This model produces the `AIRecommendation` records that appear in each stakeholder's dashboard:

| Recommendation Type | Target Stakeholder | Example |
|--------------------|--------------------|---------|
| `REORDER` | BUYER, PLANNER | "SKU FN-UX-JACK000123 is forecasted to stockout in 2 weeks at Stockholm and Paris. Recommended: create PO for 150 units from Nordic Textile AB." |
| `TRANSFER` | PLANNER, WAREHOUSE | "Tokyo Aoyama has 45 units of FN-WN-KNIT000089 with slow sell-through (0.3/week). Seoul Gangnam is selling 4.2/week and has 3 weeks of cover. Recommend transfer of 20 units." |
| `MARKDOWN` | PLANNER, FINANCE | "12 AW2025 carry-over SKUs have >16 weeks of stock cover. Recommend 20–30% markdown to clear before SS2026 floor set." |
| `CANCEL_PO` | BUYER | "PO-AW2026-00089 for 200 units of FN-MN-TROUS000045: demand forecast has dropped 60% since PO creation. Recommend reducing to 80 units or cancelling." |
| `EXPEDITE_PO` | BUYER | "PO-SS2026-00023 from Denim Craft Co. is tracking 2 weeks late. 340 wholesale pre-orders depend on it. Recommend expedite request or air freight." |

**Architecture**: Product and order embeddings are generated using a small Transformer encoder trained on the product catalog, historical orders, and seasonal context. Recommendations are generated by comparing current state embeddings against known patterns.

```
Embedding Model:
  Input: [SKU attributes, season, location, channel, price, velocity, stock, PO status]
  → Transformer Encoder (4 heads, 2 layers, dim=64)
  → 32-dim embedding per SKU-location pair

Recommendation Logic:
  1. Compute current-state embeddings for all active SKU-location pairs
  2. Compare against "healthy state" cluster centroids (learned from best-performing historical periods)
  3. For each deviation beyond threshold, generate typed recommendation with confidence and reasoning
  4. Filter and rank by projected impact (revenue gain, cost saving, risk reduction)
```

### 8.7 AI API Endpoints

| Method | Endpoint | Role(s) | Description |
|--------|----------|---------|-------------|
| GET | `/api/v1/ai/forecasts` | PLANNER, BUYER, EXEC | Demand forecasts with filters (SKU, location, season) |
| GET | `/api/v1/ai/forecasts/:skuId` | PLANNER, BUYER | Detailed forecast for a SKU with confidence intervals |
| GET | `/api/v1/ai/recommendations` | ALL (scoped by role) | Active recommendations for the user's scope |
| POST | `/api/v1/ai/recommendations/:id/accept` | Relevant role | Accept a recommendation (triggers action) |
| POST | `/api/v1/ai/recommendations/:id/dismiss` | Relevant role | Dismiss with reason (feeds back to model) |
| GET | `/api/v1/ai/anomalies` | PLANNER, BUYER, WAREHOUSE, EXEC | Active anomaly alerts |
| POST | `/api/v1/ai/anomalies/:id/resolve` | Relevant role | Mark anomaly as resolved |
| GET | `/api/v1/ai/models` | ADMIN | Model registry: versions, metrics, status |
| POST | `/api/v1/ai/models/:name/retrain` | ADMIN | Trigger manual retraining |
| GET | `/api/v1/ai/matching/scores` | PLANNER, BUYER | Neural match scores for current proposals |
| GET | `/api/v1/ai/insights/season/:season/:year` | EXEC, PLANNER | Seasonal AI insights summary |

### 8.8 AI Dashboard Components

Each stakeholder portal includes an AI-powered section:

- **Buying Dashboard**: "AI Buy Recommendations" panel — suggested POs, cancel/reduce alerts, supplier risk flags
- **Planning Dashboard**: Demand forecast charts (actual vs. predicted), anomaly timeline, reorder/transfer suggestions
- **Warehouse Dashboard**: "Incoming Priority" — AI-ranked list of which PO receipts to process first based on waiting SOs
- **Executive Dashboard**: "AI Insights" tile — top 5 recommendations by projected impact, model confidence trends
- **Matching Dashboard**: Neural match score overlay on all proposals, "Model vs. Rules" comparison chart

---

## 9. Efficiency Projections — AI-Driven Improvements

Based on industry benchmarks from comparable luxury fashion deployments and the specific characteristics of Acne Studios' operation, the following efficiency improvements are projected once the AI layer is fully trained (approximately 6–12 months of operational data).

### 9.1 Projected Gains by Function

| Area | Current State (Manual/Rule-Based) | Projected State (AI-Enhanced) | Improvement |
|------|-----------------------------------|-------------------------------|-------------|
| **SO↔PO Match Accuracy** | ~70% of matches require manual review/correction | ~92% auto-confirmed with >95% fulfillment success | +22pp accuracy, −75% manual review time |
| **Demand Forecast Error (MAE)** | ±35–45% (category-level heuristics) | ±12–18% (SKU-level LSTM) | 55–65% reduction in forecast error |
| **Stockout Rate** | 8–12% of SKU-locations per season | 3–5% (proactive reorder recommendations) | 50–60% reduction |
| **Overstock / Markdown Rate** | 15–20% of seasonal inventory marked down | 8–12% (AI-driven buy quantity optimization) | 35–45% reduction |
| **PO Creation Time** | 2–4 hours per PO (manual SKU selection, quantity planning) | 15–30 min (AI-suggested PO draft with pre-filled quantities) | 80–85% time reduction |
| **Wholesale Pre-Order Matching** | 3–5 days for seasonal match cycle (manual spreadsheets) | 4–6 hours (batch matching + auto-confirm) | 90% cycle time reduction |
| **Stock Allocation Decisions** | 5–10 min per complex SO (multi-location check) | <2 seconds (RL agent recommendation) | 99%+ time reduction |
| **Anomaly Detection** | Discovered reactively (days/weeks late) | Detected within hours, alerted proactively | Days → hours response time |
| **Cross-Region Transfers** | Reactive, triggered by stockouts | Proactive, triggered by forecast divergence | 40–50% fewer emergency transfers |
| **Supplier Risk Identification** | Quarterly manual review | Continuous monitoring with real-time alerts | 4× faster intervention |

### 9.2 Financial Impact Projection (Annual, at Steady State)

Estimated annual impact for a business with ~SEK 2 billion revenue:

| Impact Category | Conservative | Moderate | Optimistic |
|----------------|-------------|----------|------------|
| **Reduced markdowns** (fewer overstock) | SEK 15M | SEK 25M | SEK 40M |
| **Recovered lost sales** (fewer stockouts) | SEK 20M | SEK 35M | SEK 55M |
| **Labour efficiency** (less manual matching/planning) | SEK 3M | SEK 5M | SEK 8M |
| **Reduced transfer costs** (proactive vs. reactive) | SEK 2M | SEK 4M | SEK 6M |
| **Improved wholesale on-time delivery** (fewer penalties) | SEK 1M | SEK 2M | SEK 4M |
| **Total projected annual gain** | **SEK 41M** | **SEK 71M** | **SEK 113M** |
| **As % of revenue** | **~2.0%** | **~3.5%** | **~5.5%** |

### 9.3 Model Maturity Roadmap

| Phase | Timeline | Models Active | Expected Matching Accuracy | Data Requirement |
|-------|----------|--------------|---------------------------|-----------------|
| **Baseline** | Months 1–3 | Rule-based scoring only | ~70% auto-confirm rate | — |
| **Early AI** | Months 4–6 | Demand LSTM + Anomaly detector | ~78% auto-confirm rate | 3 months of SO/PO/inventory data |
| **Hybrid Scoring** | Months 7–9 | + Neural match scorer (blended 70/30 with rules) | ~85% auto-confirm rate | 6 months + 1,000 labelled matches |
| **AI-Primary** | Months 10–12 | + RL allocation optimizer, neural scorer at 50/50 blend | ~90% auto-confirm rate | 9 months + 5,000 labelled matches |
| **Mature** | Month 13+ | Full AI suite, neural scorer dominant, context engine | ~92–95% auto-confirm rate | 12+ months, continuous learning |

### 9.4 Feedback Loop Design

The AI system improves through continuous human feedback:

```
┌───────────────┐    ┌──────────────┐    ┌────────────────┐    ┌──────────────┐
│  AI Proposes   │ →  │ Human Reviews │ →  │ Outcome Tracked│ →  │ Model Retrain │
│  (match/rec)   │    │ (confirm/     │    │ (fulfilled on  │    │ (improved     │
│                │    │  reject/      │    │  time? margin   │    │  weights)     │
│                │    │  modify)      │    │  achieved?)     │    │              │
└───────────────┘    └──────────────┘    └────────────────┘    └──────┬───────┘
       ↑                                                              │
       └──────────────────────────────────────────────────────────────┘
```

Every confirmed/rejected match, accepted/dismissed recommendation, and resolved anomaly becomes a training signal. The system tracks:
- **Prediction accuracy**: Forecast vs. actual demand (weekly)
- **Match success rate**: % of confirmed matches that led to on-time fulfillment
- **Recommendation conversion**: % of AI recommendations accepted by humans
- **False positive rate**: % of anomaly alerts that were dismissed as noise
- **Model drift**: Statistical tests comparing recent prediction distributions to training distributions

---

## 10. Reporting & Analytics

### 10.1 Standard Reports

| Report | Audience | Refresh | Description |
|--------|----------|---------|-------------|
| Seasonal Buy Summary | BUYER, PLANNER, EXEC | Daily | PO spend vs. budget by season, category, supplier |
| Open-to-Buy | BUYER, PLANNER | Real-time | Remaining budget for the season by category |
| Stock Aging | PLANNER, FINANCE | Weekly | Inventory age by SKU, flagging slow-movers |
| Sell-Through Rate | WHOLESALE, PLANNER, EXEC | Weekly | Units sold / units received, by channel and wholesale account |
| Fulfillment SLA | ECOM, WAREHOUSE, EXEC | Real-time | % of orders shipped within target window |
| Gross Margin by Channel | FINANCE, EXEC | Daily | Revenue − COGS by channel (retail, e-com, wholesale) |
| Supplier Performance | BUYER, QA | Monthly | On-time delivery rate, defect rate, lead time variance |
| Store Replenishment | STORE_MGR, PLANNER | Daily | Below-reorder-point SKUs by store |
| Return Analysis | CS_AGENT, ECOM, PLANNER | Weekly | Return rate by SKU, reason code breakdown |
| Inventory Accuracy | WAREHOUSE, PLANNER | After each RFID cycle | RFID count vs. system discrepancy |
| **SO↔PO Match Health** | BUYER, PLANNER, EXEC | Real-time | Match rate, auto-confirm rate, unmatched SOs, avg score |
| **Match Outcome Tracking** | PLANNER, EXEC | Weekly | % of matches that led to on-time fulfillment, by channel |
| **AI Forecast Accuracy** | PLANNER, EXEC, ADMIN | Weekly | Predicted vs. actual demand, MAE by category and region |
| **AI Recommendation ROI** | EXEC, FINANCE | Monthly | Revenue saved/gained from accepted AI recommendations |
| **Anomaly Summary** | PLANNER, EXEC | Daily | Open anomalies by severity, avg resolution time |
| **Model Performance** | ADMIN | Weekly | All model metrics, drift detection, retraining history |

### 10.2 Executive KPI Dashboard

The executive dashboard displays real-time tiles for:
- Total revenue (today / MTD / YTD) by channel
- Inventory value (at cost) and inventory turns
- PO pipeline (open POs by status, expected inbounds)
- SO pipeline (open SOs by status, fulfillment rate)
- **SO↔PO Match Rate**: % of SO lines matched, auto-confirm rate, avg match score
- **AI Confidence Index**: Composite score of demand forecast accuracy, match success, and recommendation conversion
- Gross margin trend (line chart, last 12 months)
- Top 10 selling SKUs (current season)
- Stock health: % of SKUs above reorder point
- **Top AI Recommendations**: 5 highest-impact actionable recommendations with projected value

---

## 11. Implementation Phases

### Phase 1 — Foundation (Weeks 1–3)

**Goal**: Core infrastructure, data model, auth, and basic CRUD for POs, SOs, and matching entities.

Tasks for Claude Code:
1. Initialize the monorepo with the project structure from Section 3.3
2. Set up `docker-compose.yml` with PostgreSQL 16 and Redis
3. Implement the full Prisma schema from Section 4.1 — including SO↔PO matching tables (`SOPOMatch`, `MatchingRun`) and AI tables (`DemandForecast`, `AIRecommendation`, `AnomalyAlert`, `ModelRegistry`); run migrations
4. Create seed script with sample data: 5 suppliers, 50 products, 200 SKUs, 10 locations (stores + warehouses), 20 users across all roles
5. Implement auth module: JWT-based login, RBAC middleware
6. Implement PO CRUD endpoints (Section 5.4): create, list, get, update, add/edit/delete lines
7. Implement SO CRUD endpoints (Section 6.4): create, list, get, update, add lines
8. Basic request validation with Zod
9. Error handling middleware
10. Unit tests for PO and SO services

### Phase 2 — Lifecycle, Matching Engine & Business Logic (Weeks 4–7)

**Goal**: Full PO and SO state machines, stock management, allocation, and the SO↔PO matching engine.

Tasks for Claude Code:
1. PO state machine: implement all transitions from Section 5.1 with validation rules
2. PO approval workflow: threshold-based, with notification stubs
3. PO receiving: partial receipt, QA status tracking, stock movement creation
4. SO state machine: implement all transitions from Section 6.1
5. Stock allocation service: implement algorithm from Section 7.2
6. Real-time stock levels: Redis cache write-through on every stock movement
7. Stock movement logging for full audit trail
8. SO split shipment logic
9. Return processing: reverse stock movements, replacement SO creation
10. Auto-replenishment: trigger SO (type=REPLENISHMENT) when stock < reorder point
11. **SO↔PO Matching Engine — Core** (Section 7A):
    - Implement `matching.scorer.ts` with the multi-factor scoring algorithm (Section 7A.3) — all 8 weighted factors as a pure, testable function
    - Implement `matching.service.ts` with event-driven triggers: `SO_CONFIRMED`, `PO_RECEIVED`, `PO_CONFIRMED_BY_SUPPLIER` (Section 7A.4)
    - Implement `matching.resolver.ts` for conflict resolution: priority scoring, first-come tiebreak, partial allocation, overbooking protection (Section 7A.5)
    - Implement auto-confirm logic: matches above 0.85 threshold auto-confirm; 0.50–0.85 go to review queue
    - Build all matching API endpoints (Section 7A.7)
12. **SO↔PO Matching Engine — Batch**:
    - BullMQ scheduled sweep job (every 4 hours): re-score PROPOSED matches, find new matches, expire stale matches
    - Season opening batch job for wholesale pre-order matching from NuORDER
    - `MatchingRun` logging for every execution with statistics
13. **SO↔PO Matching Engine — Split & Cross-Location**:
    - Split match proposals: one SO fulfilled by multiple POs, one PO distributed to multiple SOs
    - Cross-location matching with automatic transfer SO generation
    - `quantityAvailableForMatching` computed field maintenance on PO lines
14. Audit log recording on all state changes
15. Comprehensive integration tests for: PO lifecycle, SO lifecycle, matching engine (all 7 match types from Section 7A.2)

### Phase 3 — AI Intelligence Layer (Weeks 8–11)

**Goal**: Implement all five AI models, training pipelines, and the inference service.

Tasks for Claude Code:
1. **AI Infrastructure Setup**:
    - Install TensorFlow.js (`@tensorflow/tfjs-node`) and ONNX Runtime (`onnxruntime-node`)
    - Implement `ModelRegistry` CRUD and model versioning service
    - Implement feature store using Redis (pre-computed features for real-time inference)
    - Implement ETL pipeline (`dataPrep.ts`) that extracts training data from PostgreSQL → normalized feature tensors
2. **Model 1 — Demand Forecasting LSTM** (Section 8.2):
    - Implement feature engineering: 22 input features per SKU-location-week as specified
    - Build stacked LSTM network (128→64 units) with TensorFlow.js
    - Training pipeline: rolling 2-year window, weekly retraining schedule
    - Inference endpoint: 12-week forecast per SKU with 80% confidence interval via Monte Carlo dropout
    - Seed with synthetic historical data for initial training (generate 2 years of realistic sales patterns)
3. **Model 2 — Neural Match Scorer** (Section 8.3):
    - Implement 18-feature extraction for SO-line ↔ PO-line pairs
    - Build feedforward network (64→32→16→1 sigmoid)
    - Implement hybrid scoring: `0.7 × RuleScore + 0.3 × NeuralScore` (configurable blend)
    - Training pipeline: requires labelled match outcomes (generate from seed data initially)
    - Wire into matching engine as an optional score augmentation (off by default until model validates)
4. **Model 3 — Allocation Optimiser DQN** (Section 8.4):
    - Implement `environment.ts`: simulated allocation environment using historical data
    - Implement DQN agent with epsilon-greedy exploration
    - Reward function as specified (on-time: +10, overdue: −5/day, stockout: −15, etc.)
    - Training loop: overnight batch training on simulation
    - Inference: given current unmatched SOs + available POs, suggest optimal allocation sequence
5. **Model 4 — Anomaly Detection Autoencoder** (Section 8.5):
    - Implement symmetric autoencoder (64→32→8→32→64)
    - Train on "normal" operational patterns from historical data
    - Implement threshold tuning per anomaly type
    - Wire into scheduled job: run detection hourly, write `AnomalyAlert` records
6. **Model 5 — Context-Aware Recommendation Engine** (Section 8.6):
    - Implement product/order embedding generation using Transformer encoder
    - Implement "healthy state" cluster centroids from historical best-performing periods
    - Implement recommendation generation logic for all 5 types: REORDER, TRANSFER, MARKDOWN, CANCEL_PO, EXPEDITE_PO
    - Write `AIRecommendation` records with confidence, reasoning, and projected impact
7. **AI API & Feedback Loop**:
    - Build all AI API endpoints (Section 8.7)
    - Implement feedback collection: track accept/dismiss on recommendations, confirm/reject on matches
    - Implement model drift detection: statistical comparison of prediction distributions
    - BullMQ jobs: `trainModels.ts` (weekly), `generatePredictions.ts` (daily)

### Phase 4 — Frontend Portals (Weeks 12–16)

**Goal**: Role-specific dashboards with matching views and AI insights.

Tasks for Claude Code:
1. Set up React + Vite + Tailwind + shadcn/ui frontend project
2. Implement auth pages: login, role-based redirect
3. Implement shared components: OrderTable, StatusBadge, TimelineView, StockIndicator, MatchScoreBadge, AIRecommendationCard, AnomalyBanner
4. **Buying Dashboard**: PO list with filters, PO creation wizard, seasonal budget overview chart (recharts), **AI Buy Recommendations panel**, **PO↔SO match status per PO**
5. **Warehouse Dashboard**: PO receiving form, SO pick queue (sortable/filterable), pack & ship workflow, **AI "Incoming Priority" list** (which PO receipts to process first based on waiting SOs)
6. **Store Portal**: Stock checker, clienteling SO form, replenishment status, transfer requests
7. **Wholesale Portal**: Seasonal order book view, order status tracker, delivery schedule, **wholesale pre-order match status**
8. **Supplier Portal**: Pending PO confirmations, shipment status updater, document upload
9. **Finance Dashboard**: PO cost summary, invoice matching UI, margin charts, **AI recommendation ROI tracker**
10. **Matching Dashboard** (Section 7A.6): Match overview donut, pending review queue (one-click confirm/reject), unmatched SOs, PO availability, match timeline (Gantt), seasonal health scorecard, **neural score overlay**
11. **Planning Dashboard**: Open-to-buy tracker, stock aging view, **demand forecast charts (actual vs. predicted)**, **anomaly timeline**, **reorder/transfer AI suggestions**
12. **Executive Dashboard**: KPI tiles (Section 10.2), charts for revenue/inventory health/fulfillment, **AI Confidence Index**, **top 5 AI recommendations by projected impact**, **SO↔PO match rate trend**
13. **CS Dashboard**: Order search, return initiation, replacement SO
14. **QA Portal**: Inspection queue, pass/fail recording
15. Responsive design for tablet use in-store and warehouse

### Phase 5 — Integrations & Automation (Weeks 17–20)

**Goal**: Connect to external systems, real-time events, and production-grade automation.

Tasks for Claude Code:
1. Implement `IIntegrationAdapter` interface and factory
2. Build mock adapters for all 8 systems (Section 3.2) with realistic stub data
3. BullMQ job queue setup with workers for:
   - Inventory sync (periodic pull from WMS/RFID)
   - Order processing (SO allocation on confirmation)
   - SO↔PO matching sweep (every 4 hours)
   - AI model retraining (weekly)
   - Demand forecast generation (daily)
   - Anomaly detection (hourly)
   - Report generation (scheduled)
   - Notification dispatch (email stubs)
4. Webhook endpoints for inbound events (Salesforce, NuORDER, carrier tracking)
5. PO auto-generation from AI reorder recommendations for carry-over styles
6. Wholesale SO ingestion from NuORDER mock adapter → automatic matching run
7. RFID reconciliation job (Section 7.3)
8. WebSocket implementation for real-time dashboard updates (matching proposals, AI alerts)

### Phase 6 — Polish, Testing & AI Validation (Weeks 21–24)

**Goal**: Comprehensive testing, AI model validation, documentation, deployment readiness.

Tasks for Claude Code:
1. End-to-end test suite covering critical flows:
   - PO creation → approval → supplier confirmation → receiving → stock update → **SO match fulfillment**
   - SO creation (each channel) → **matching engine proposes match** → allocation → pick → pack → ship → deliver
   - **Wholesale pre-order batch import → season matching run → match review → confirm → fulfillment tracking**
   - Return flow → stock reversal → **re-matching of freed stock to waiting SOs**
   - Replenishment trigger → transfer SO → receiving
   - **AI recommendation → human accept → triggered action (PO creation / transfer / markdown)**
2. **AI Model Validation Suite**:
   - Demand forecast backtesting: train on months 1–18, predict months 19–24, compare to actuals
   - Match scorer A/B test: rule-based vs. neural on historical data, measure fulfillment success rate
   - Anomaly detector precision/recall on injected synthetic anomalies
   - Recommendation quality: does accepting the recommendation improve the target metric?
3. API documentation (OpenAPI/Swagger) — including all matching and AI endpoints
4. Performance optimization: database indexes, query optimization, Redis caching review, **model inference latency benchmarks (<50ms p95)**
5. Security review: input sanitization, SQL injection prevention, rate limiting
6. README with setup instructions, architecture diagram, AI model documentation, and deployment guide
7. Environment configuration documentation (.env.example with all variables including model paths and thresholds)

---

## 12. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Availability** | 99.9% uptime during business hours (CET) |
| **Response time** | API: < 200ms (p95); Dashboard load: < 2s |
| **Concurrent users** | Support 500+ simultaneous users across all portals |
| **Data retention** | All transactional data retained for 7 years (Swedish accounting law) |
| **Multi-currency** | 11 currencies (see Currency enum); exchange rates updated daily |
| **Multi-language** | English (primary), Swedish (secondary); i18n-ready architecture |
| **Time zones** | All timestamps stored in UTC; displayed in user's local timezone |
| **Audit trail** | Every create, update, delete, and status change logged |
| **Security** | HTTPS, JWT with refresh tokens, bcrypt password hashing, RBAC |
| **AI Inference Latency** | < 50ms (p95) for match scoring; < 200ms for demand forecast query |
| **AI Model Retraining** | Weekly automated retraining; manual retrain on demand |
| **AI Explainability** | Every AI recommendation/match score includes human-readable reasoning (JSON factors) |
| **Matching Engine SLA** | Event-driven matches proposed within 5 seconds of trigger; batch sweep completes in < 10 minutes |

---

## 13. Seed Data Specification

Claude Code should generate realistic seed data that reflects Acne Studios' actual business:

### Products (50 styles × 4 avg SKUs each = ~200 SKUs)
- Categories: Outerwear (8), Denim (10), Knitwear (8), T-shirts/Tops (8), Trousers (5), Accessories/Bags (6), Footwear (5)
- Gender split: 50% Women's, 40% Men's, 10% Unisex
- Season: Mix of current AW2026 and carry-over styles
- Price range: SEK 1,200 (basic tee) to SEK 18,000 (leather outerwear)
- Wholesale prices: ~50% of retail

### Locations (10)
- Warehouses: "Central Warehouse EU" (Sweden), "Warehouse NA" (USA), "Warehouse APAC" (Japan)
- Stores: "Stockholm Norrmalmstorg", "Paris Rue Saint-Honoré", "London Dover Street", "New York Madison Ave", "Tokyo Aoyama", "Seoul Gangnam", "Milan Via della Spiga"

### Suppliers (5)
- "Tessuti Italiani S.r.l." (Italy, leather goods, 45 day lead time)
- "Nordic Textile AB" (Sweden, knitwear, 30 day lead time)
- "Denim Craft Co." (Turkey, denim, 60 day lead time)
- "East Fashion Manufacturing" (China, ready-to-wear, 50 day lead time)
- "Lisboa Footwear Lda." (Portugal, footwear, 40 day lead time)

### Sample POs (10) and SOs (30)
- POs in various statuses across the lifecycle
- SOs across all channels: 10 retail, 10 e-commerce, 5 wholesale, 3 clienteling, 2 marketplace

### Sample SO↔PO Matches (50)
- 20 CONFIRMED matches (variety of match types from Section 7A.2)
- 10 AUTO_CONFIRMED matches (score > 0.85)
- 10 PROPOSED matches (awaiting review, scores 0.50–0.85)
- 5 REJECTED matches (with rejection reasons)
- 5 FULFILLED matches (completed end-to-end)

### Historical Data for AI Training (synthetic, 2 years)
- Weekly sales data per SKU per location (104 weeks × 200 SKUs × 10 locations — aggregated as sparse matrix, only stocked locations)
- Historical PO delivery performance per supplier (on-time rate, average delay)
- Historical match outcomes: 2,000 labelled match records (confirmed/rejected + fulfillment success)
- Seasonal demand patterns reflecting Acne Studios' category mix (denim peaks, knitwear seasonality, etc.)

---

## 14. Key Implementation Notes for Claude Code

1. **Start with the backend**: Get the data model, API, and business logic solid before building the frontend.
2. **Use Prisma migrations**: Never modify the database directly. All schema changes go through `prisma migrate`.
3. **TypeScript strict mode**: Enable `strict: true` in tsconfig. All types must be explicit.
4. **Modular architecture**: Each module (PO, SO, matching, AI, inventory, etc.) should be self-contained with its own routes, controller, service, types, and validators.
5. **Service layer pattern**: Controllers call services. Services contain business logic. Controllers handle HTTP concerns only.
6. **Transactional writes**: Use Prisma transactions for operations that modify multiple tables (e.g., PO receiving updates POLine + StockLevel + StockMovement + triggers matching re-score).
7. **Event-driven stock updates**: Every stock movement should emit an event that updates Redis cache and triggers downstream logic (matching engine, alerts, replenishment checks).
8. **Matching engine is the priority after PO/SO CRUD**: The SO↔PO matching engine is the most business-critical new capability. Build and test the rule-based scorer thoroughly in Phase 2 before adding AI scoring in Phase 3.
9. **Scorer must be a pure function**: `scoreMatch(soLine, poLine, context) → { score, factors }` — stateless, testable, with configurable weights. This is the foundation everything else builds on.
10. **AI models should degrade gracefully**: If a model fails inference, the system falls back to rule-based logic. Never block a PO or SO lifecycle action on an AI model response.
11. **Hybrid scoring blend is configurable**: The `ruleWeight` vs. `neuralWeight` blend for match scoring should be adjustable via environment variable. Start at 100% rules, 0% neural.
12. **Generate synthetic training data in seed script**: The AI models need historical data to train. The seed script should generate 2 years of realistic sales, PO, and match data that reflects seasonal patterns.
13. **Integration adapters are stubs first**: Don't attempt to connect to real APIs. Build the adapter interface and mock implementations that return realistic data.
14. **Test the state machines and matching engine thoroughly**: PO/SO lifecycle transitions and the matching engine are the core business logic. Cover all valid transitions, reject invalid ones, and test all 7 match types.
15. **Responsive but desktop-first**: The primary users are office workers and warehouse staff. Mobile-optimized store portal is a secondary concern.
16. **AI explainability is non-negotiable**: Every AI output (match score, recommendation, anomaly alert) must include a human-readable `reasoning` or `factors` field. Black-box outputs will not be trusted by the buying team.
ACNE_STUDIO ... ECT_PLAN.md
Visar ACNE_STUDIOS_IMS_PROJECT_PLAN.md.
