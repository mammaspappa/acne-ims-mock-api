# Acne Studios IMS — Mock API Reference

> Machine-readable API reference for AI agents and hackathon developers.

## Quick Start

```bash
# Install and run
npm install && npm run dev

# Server starts at http://localhost:3000
# Dashboard:   http://localhost:3000/
# Swagger UI:  http://localhost:3000/docs
# OpenAPI JSON: http://localhost:3000/docs/json
```

## Authentication

**Authentication is OPTIONAL.** All endpoints work without a token — the server defaults to the `ADMIN` role which has unrestricted access.

### To use authentication:

```bash
# Login — returns a JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "buyer@acne.mock", "password": "hackathon2026"}'

# Response:
# { "token": "eyJhbG...", "user": { "id": "...", "email": "buyer@acne.mock", "role": "BUYER", ... } }

# Use the token in subsequent requests:
curl http://localhost:3000/api/v1/purchase-orders \
  -H "Authorization: Bearer eyJhbG..."
```

### Authentication Details

| Property | Value |
|----------|-------|
| **Method** | JWT Bearer Token (HS256) |
| **Secret** | `acne-hackathon-2026` |
| **Header** | `Authorization: Bearer <token>` |
| **Expiry** | 24 hours |
| **Default (no token)** | `ADMIN` role — full access to all endpoints |
| **Password (all users)** | `hackathon2026` |

### Test User Credentials

| Email | Role | Description |
|-------|------|-------------|
| `buyer@acne.mock` | BUYER | Buying & Merchandising Team |
| `buyer2@acne.mock` | BUYER | Second buyer |
| `wholesale@acne.mock` | WHOLESALE | Wholesale / Commercial Team |
| `storemanager@acne.mock` | STORE_MGR | Stockholm store manager |
| `associate@acne.mock` | STORE_ASSOC | Stockholm sales associate |
| `ecom@acne.mock` | ECOM | E-commerce Operations |
| `warehouse@acne.mock` | WAREHOUSE | Warehouse / Logistics (EU) |
| `warehouse.na@acne.mock` | WAREHOUSE | Warehouse / Logistics (NA) |
| `supplier@acne.mock` | SUPPLIER | Tessuti Italiani supplier |
| `supplier.denim@acne.mock` | SUPPLIER | Denim Craft supplier |
| `finance@acne.mock` | FINANCE | Finance / Accounting |
| `planner@acne.mock` | PLANNER | Planning / Demand Team |
| `exec@acne.mock` | EXEC | C-Suite / Directors |
| `cs@acne.mock` | CS_AGENT | Customer Service |
| `qa@acne.mock` | QA | Quality Assurance |
| `admin@acne.mock` | ADMIN | System Administrator |
| `store.paris@acne.mock` | STORE_MGR | Paris store manager |
| `store.london@acne.mock` | STORE_MGR | London store manager |
| `store.nyc@acne.mock` | STORE_MGR | New York store manager |
| `store.tokyo@acne.mock` | STORE_MGR | Tokyo store manager |

### JWT Token Payload Structure

```json
{
  "userId": "abc123...",
  "email": "buyer@acne.mock",
  "role": "BUYER",
  "locationId": "loc456...",
  "iat": 1712736000,
  "exp": 1712822400
}
```

## Base URL

All API endpoints are prefixed with `/api/v1/`.

```
http://localhost:3000/api/v1/
```

## Response Format

All list endpoints return paginated responses:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

Query parameters for pagination: `?page=1&limit=20`

## Endpoints by Module

### Auth (2 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/login` | Login with `{ email, password }`. Returns JWT token. |
| `GET` | `/api/v1/auth/me` | Get current user profile. |

### Products (3 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/products` | List products. Filters: `category`, `gender`, `season`, `collection`, `isCarryOver`, `search`. |
| `GET` | `/api/v1/products/:id` | Get product with all SKUs. |
| `GET` | `/api/v1/skus` | List SKUs. Filters: `productId`, `colour`, `size`, `isActive`, `search`. |

### Purchase Orders (15 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/purchase-orders` | Create PO. Body: `{ supplierId, season, seasonYear, currency, deliveryLocationId, shippingTerms, paymentTerms, notes }` |
| `GET` | `/api/v1/purchase-orders` | List POs. Filters: `season`, `seasonYear`, `status`, `supplierId`, `search`. |
| `GET` | `/api/v1/purchase-orders/:id` | Get PO with lines. |
| `PATCH` | `/api/v1/purchase-orders/:id` | Update PO (DRAFT only). |
| `POST` | `/api/v1/purchase-orders/:id/lines` | Add line. Body: `{ skuId, quantityOrdered, unitCost }` |
| `PATCH` | `/api/v1/purchase-orders/:id/lines/:lineId` | Update line. |
| `DELETE` | `/api/v1/purchase-orders/:id/lines/:lineId` | Delete line. |
| `POST` | `/api/v1/purchase-orders/:id/submit` | Submit for approval (DRAFT → PENDING_APPROVAL). |
| `POST` | `/api/v1/purchase-orders/:id/approve` | Approve (PENDING_APPROVAL → APPROVED). |
| `POST` | `/api/v1/purchase-orders/:id/reject` | Reject with reason (→ DRAFT). Body: `{ reason }` |
| `POST` | `/api/v1/purchase-orders/:id/send` | Send to supplier (APPROVED → SENT_TO_SUPPLIER). |
| `POST` | `/api/v1/purchase-orders/:id/confirm` | Supplier confirms (→ CONFIRMED_BY_SUPPLIER). |
| `POST` | `/api/v1/purchase-orders/:id/receive` | Record receipt. Body: `{ lines: [{ poLineId, quantityReceived, damagedQuantity }] }` |
| `POST` | `/api/v1/purchase-orders/:id/cancel` | Cancel PO. Body: `{ reason }` |
| `GET` | `/api/v1/purchase-orders/:id/history` | Get status change history. |

### Sales Orders (16 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/sales-orders` | Create SO. Body: `{ channel, type, currency, locationId, customerName, customerEmail, ... }` |
| `GET` | `/api/v1/sales-orders` | List SOs. Filters: `channel`, `status`, `type`, `locationId`, `search`. |
| `GET` | `/api/v1/sales-orders/:id` | Get SO with lines and shipments. |
| `PATCH` | `/api/v1/sales-orders/:id` | Update SO. |
| `POST` | `/api/v1/sales-orders/:id/lines` | Add line. Body: `{ skuId, quantityOrdered, unitPrice, discountPercent }` |
| `POST` | `/api/v1/sales-orders/:id/confirm` | Confirm (DRAFT → CONFIRMED). |
| `POST` | `/api/v1/sales-orders/:id/allocate` | Allocate stock (CONFIRMED → ALLOCATED). |
| `POST` | `/api/v1/sales-orders/:id/pick` | Mark picking (ALLOCATED → PICKING). |
| `POST` | `/api/v1/sales-orders/:id/pack` | Mark packed (PICKING → PACKED). |
| `POST` | `/api/v1/sales-orders/:id/ship` | Ship. Body: `{ trackingNumber, carrier }` |
| `POST` | `/api/v1/sales-orders/:id/deliver` | Mark delivered. |
| `POST` | `/api/v1/sales-orders/:id/return` | Initiate return. Body: `{ reason }` |
| `POST` | `/api/v1/sales-orders/:id/cancel` | Cancel. Body: `{ reason }` |
| `POST` | `/api/v1/sales-orders/:id/hold` | Put on hold. Body: `{ reason }` |
| `POST` | `/api/v1/sales-orders/:id/release` | Release from hold. |
| `GET` | `/api/v1/sales-orders/:id/history` | Get status history. |

### SO↔PO Matching (11 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/matching/run` | Trigger matching run. Body: `{ season, skuId }` (optional filters). |
| `GET` | `/api/v1/matching/proposals` | List match proposals. Filters: `status`, `minScore`, `maxScore`, `skuId`. |
| `GET` | `/api/v1/matching/proposals/:id` | Get match with full scoring breakdown. |
| `POST` | `/api/v1/matching/proposals/:id/confirm` | Confirm a proposed match. |
| `POST` | `/api/v1/matching/proposals/:id/reject` | Reject with reason. Body: `{ reason }` |
| `POST` | `/api/v1/matching/bulk-confirm` | Bulk confirm. Body: `{ minScore: 0.85 }` |
| `GET` | `/api/v1/matching/unmatched-sos` | SO lines with no match. |
| `GET` | `/api/v1/matching/unmatched-po-capacity` | PO lines with available capacity. |
| `GET` | `/api/v1/matching/health` | Matching health scorecard. |
| `GET` | `/api/v1/matching/timeline` | PO arrival vs SO deadline timeline. |
| `GET` | `/api/v1/matching/runs` | History of matching runs. |

### Inventory (7 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/inventory/availability` | Check availability. Filters: `skuId`, `locationId`, `region`. Returns `available = onHand - allocated + inTransit`. |
| `GET` | `/api/v1/inventory/levels` | Stock levels. Filters: `skuId`, `locationId`, `belowReorderPoint`. |
| `POST` | `/api/v1/inventory/transfer` | Transfer stock. Body: `{ skuId, fromLocationId, toLocationId, quantity, reason }` |
| `POST` | `/api/v1/inventory/adjust` | Adjust stock. Body: `{ skuId, locationId, quantity, reason }` (positive or negative). |
| `POST` | `/api/v1/inventory/reconcile` | RFID reconciliation. Body: `{ locationId, counts: [{ skuId, counted }] }` |
| `GET` | `/api/v1/inventory/movements` | Movement history. Filters: `skuId`, `type`, `locationId`. |
| `GET` | `/api/v1/inventory/alerts` | Low stock alerts (stock ≤ reorder point). |

### AI Intelligence (11 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/ai/forecasts` | Demand forecasts. Filters: `skuId`, `locationId`, `season`. |
| `GET` | `/api/v1/ai/forecasts/:skuId` | Detailed forecast for one SKU with confidence intervals. |
| `GET` | `/api/v1/ai/recommendations` | AI recommendations. Filters: `type`, `status`. Types: REORDER, TRANSFER, MARKDOWN, CANCEL_PO, EXPEDITE_PO. |
| `POST` | `/api/v1/ai/recommendations/:id/accept` | Accept a recommendation. |
| `POST` | `/api/v1/ai/recommendations/:id/dismiss` | Dismiss. Body: `{ reason }` |
| `GET` | `/api/v1/ai/anomalies` | Anomaly alerts. Filters: `type`, `severity`, `isResolved`. |
| `POST` | `/api/v1/ai/anomalies/:id/resolve` | Mark anomaly resolved. |
| `GET` | `/api/v1/ai/models` | Model registry (all ML models and versions). |
| `POST` | `/api/v1/ai/models/:name/retrain` | Trigger model retraining (mock). |
| `GET` | `/api/v1/ai/matching/scores` | Neural match scores for proposals. |
| `GET` | `/api/v1/ai/insights/season/:season/:year` | Seasonal AI insights. E.g., `/ai/insights/season/AW/2026`. |

### Reports (9 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/reports/seasonal-buy-summary` | PO spend by season, category, supplier. |
| `GET` | `/api/v1/reports/open-to-buy` | Remaining budget by category. |
| `GET` | `/api/v1/reports/sell-through` | Sell-through rates by channel/category. |
| `GET` | `/api/v1/reports/fulfillment-sla` | Fulfillment SLA compliance. |
| `GET` | `/api/v1/reports/gross-margin` | Gross margin by channel/category. |
| `GET` | `/api/v1/reports/supplier-performance` | Supplier on-time delivery, defect rates. |
| `GET` | `/api/v1/reports/stock-aging` | Inventory aging analysis. |
| `GET` | `/api/v1/reports/match-health` | SO↔PO matching health. |
| `GET` | `/api/v1/reports/executive-kpis` | Executive KPI dashboard. |

### Stakeholders (8 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/stakeholders` | List users. Filters: `role`, `locationId`, `isActive`, `search`. |
| `GET` | `/api/v1/stakeholders/:id` | Get user details. |
| `POST` | `/api/v1/stakeholders` | Create user. Body: `{ email, firstName, lastName, role, locationId }` |
| `PATCH` | `/api/v1/stakeholders/:id` | Update user. |
| `DELETE` | `/api/v1/stakeholders/:id` | Deactivate user (soft delete). |
| `GET` | `/api/v1/stakeholders/roles` | List all 13 roles with descriptions. |
| `GET` | `/api/v1/stakeholders/locations` | List all 10 locations. |
| `GET` | `/api/v1/stakeholders/suppliers` | List all 5 suppliers. |

### Webhooks (5 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/webhooks/salesforce` | Receive SFCC e-commerce event. Any JSON body accepted. |
| `POST` | `/api/v1/webhooks/nuorder` | Receive NuORDER wholesale event. |
| `POST` | `/api/v1/webhooks/nedap` | Receive Nedap RFID event. |
| `POST` | `/api/v1/webhooks/carrier` | Receive carrier tracking event. |
| `GET` | `/api/v1/webhooks/log` | View received webhook log. Filters: `source`, `limit`. |

### Admin (5 endpoints)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/health` | Health check + data statistics. |
| `POST` | `/api/v1/admin/reset` | Reset all data to seed state. |
| `GET` | `/api/v1/admin/seed-info` | All test user credentials and sample IDs. |
| `POST` | `/api/v1/admin/latency` | Set response latency. Body: `{ preset: "none"|"fast"|"realistic"|"slow" }` or `{ ms: 200 }` |
| `POST` | `/api/v1/admin/time-travel` | Change mock clock. Body: `{ date: "2026-09-01" }` or `{ advanceDays: 30 }` |

## Seeded Data Summary

| Entity | Count | Notes |
|--------|-------|-------|
| Products | 50 | Realistic Acne Studios styles with descriptions |
| SKUs | 718 | Products × colours × sizes |
| Locations | 10 | 3 warehouses (EU/NA/APAC) + 7 flagship stores |
| Suppliers | 5 | With lead times, Fair Wear scores |
| Users | 20 | Across all 13 roles |
| Purchase Orders | 20 | Full lifecycle spread + cancelled |
| PO Lines | 90 | With partial receiving, damaged goods |
| Sales Orders | 42 | Retail, e-com, wholesale, clienteling, marketplace |
| SO Lines | 150 | Realistic customer/buyer names |
| Stock Levels | ~3,100 | SKU/location combinations |
| SO↔PO Matches | 55 | Confirmed, auto-confirmed, proposed, rejected, fulfilled |
| Demand Forecasts | 2,100 | 12-week horizon, global + per-location |
| AI Recommendations | 19 | REORDER, TRANSFER, MARKDOWN, CANCEL_PO, EXPEDITE_PO |
| Anomaly Alerts | 15 | Active + resolved |
| Model Registry | 5 | demand_forecast, match_scorer, anomaly_detector, allocation_optimizer |
| Weekly Sales History | ~15,000 records | 2 years, per-SKU per-location |
| Daily Store Traffic | ~630 records | 90 days × 7 stores |
| Supplier Performance | 120 records | 24 months × 5 suppliers |
| Stock Movements | ~1,500 | 60 days of movement history |
| Audit Logs | ~900 | 30 days of user activity |

## For Claude Agents

### Getting Started

1. Fetch the OpenAPI spec: `GET http://localhost:3000/docs/json`
2. Get all credentials and sample IDs: `GET http://localhost:3000/api/v1/admin/seed-info`
3. No authentication needed — all requests work without a Bearer token

### Key Workflows to Explore

1. **PO Lifecycle**: Create PO → add lines → submit → approve → send → confirm → receive → close
2. **SO Lifecycle**: Create SO → confirm → allocate → pick → pack → ship → deliver
3. **Matching**: Run matching engine → review proposals → confirm/reject → track fulfillment
4. **AI**: Query forecasts → review recommendations → accept/dismiss → monitor anomalies
5. **Inventory**: Check availability → transfer between locations → reconcile RFID counts

### Reset Data

If you modify data and want to start fresh:
```bash
curl -X POST http://localhost:3000/api/v1/admin/reset
```
