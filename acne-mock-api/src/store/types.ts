// ─── ENUMS ─────────────────────────────────────────────

export type Season = 'SS' | 'AW' | 'RESORT' | 'PRE_FALL' | 'CAPSULE';

export type POStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT_TO_SUPPLIER'
  | 'CONFIRMED_BY_SUPPLIER'
  | 'IN_PRODUCTION'
  | 'SHIPPED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CLOSED'
  | 'CANCELLED';

export type SOStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'ALLOCATED'
  | 'PICKING'
  | 'PACKED'
  | 'SHIPPED'
  | 'PARTIALLY_SHIPPED'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'ON_HOLD';

export type SOChannel =
  | 'RETAIL_STORE'
  | 'ECOMMERCE'
  | 'WHOLESALE'
  | 'MARKETPLACE'
  | 'CLIENTELING';

export type SOType =
  | 'STANDARD'
  | 'PRE_ORDER'
  | 'BACK_ORDER'
  | 'TRANSFER'
  | 'REPLENISHMENT'
  | 'RETURN'
  | 'EXCHANGE';

export type Currency =
  | 'SEK'
  | 'EUR'
  | 'USD'
  | 'GBP'
  | 'JPY'
  | 'CNY'
  | 'KRW'
  | 'AUD'
  | 'CAD'
  | 'SGD'
  | 'HKD';

export type UserRole =
  | 'BUYER'
  | 'WHOLESALE'
  | 'STORE_MGR'
  | 'STORE_ASSOC'
  | 'ECOM'
  | 'WAREHOUSE'
  | 'SUPPLIER'
  | 'FINANCE'
  | 'PLANNER'
  | 'EXEC'
  | 'CS_AGENT'
  | 'QA'
  | 'ADMIN';

export type StockMovementType =
  | 'PO_RECEIPT'
  | 'SO_ALLOCATION'
  | 'SO_SHIPMENT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'RETURN_RECEIPT'
  | 'ADJUSTMENT_POSITIVE'
  | 'ADJUSTMENT_NEGATIVE'
  | 'DAMAGE_WRITEOFF'
  | 'RFID_RECONCILIATION';

export type MatchStatus =
  | 'PROPOSED'
  | 'CONFIRMED'
  | 'AUTO_CONFIRMED'
  | 'REJECTED'
  | 'SUPERSEDED'
  | 'FULFILLED'
  | 'EXPIRED';

// ─── ENTITIES ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  locationId: string | null;
  supplierId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  styleNumber: string;
  name: string;
  category: string;
  subCategory: string | null;
  gender: string;
  season: Season;
  seasonYear: number;
  collection: string | null;
  isCarryOver: boolean;
  costPrice: number;
  costCurrency: Currency;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SKU {
  id: string;
  productId: string;
  sku: string;
  barcode: string | null;
  rfidTag: string | null;
  colour: string;
  colourCode: string;
  size: string;
  sizeIndex: number;
  wholesalePrice: number;
  retailPrice: number;
  priceCurrency: Currency;
  weight: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id: string;
  productId: string;
  url: string;
  altText: string | null;
  isPrimary: boolean;
  sortOrder: number;
}

export interface Location {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  region: string;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  contactEmail: string | null;
  country: string;
  leadTimeDays: number;
  paymentTerms: string | null;
  currency: Currency;
  isActive: boolean;
  fairWearScore: string | null;
  tier: number;
  partnershipYears: number;
  orderValuePercent: number;
  leverage: number;
  labourRisks: {
    country: number;
    gender: number;
    migrantWork: number;
    freedomOfAssociation: number;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  season: Season;
  seasonYear: number;
  status: POStatus;
  currency: Currency;
  totalAmount: number;
  expectedDelivery: string | null;
  actualDelivery: string | null;
  deliveryLocationId: string | null;
  shippingTerms: string | null;
  paymentTerms: string | null;
  notes: string | null;
  createdById: string;
  approvedById: string | null;
  approvedAt: string | null;
  sentToSupplierAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface POLine {
  id: string;
  purchaseOrderId: string;
  skuId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  lineTotal: number;
  expectedDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface POReceipt {
  id: string;
  poLineId: string;
  quantityReceived: number;
  receivedAt: string;
  receivedById: string;
  locationId: string;
  qualityStatus: string;
  damagedQuantity: number;
  notes: string | null;
}

export interface PODocument {
  id: string;
  purchaseOrderId: string;
  type: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

export interface POStatusHistory {
  id: string;
  purchaseOrderId: string;
  fromStatus: POStatus | null;
  toStatus: POStatus;
  changedById: string;
  reason: string | null;
  changedAt: string;
}

export interface SalesOrder {
  id: string;
  soNumber: string;
  channel: SOChannel;
  type: SOType;
  status: SOStatus;
  locationId: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  wholesaleBuyerId: string | null;
  currency: Currency;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  requestedShipDate: string | null;
  actualShipDate: string | null;
  deliveredAt: string | null;
  notes: string | null;
  priority: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface SOLine {
  id: string;
  salesOrderId: string;
  skuId: string;
  quantityOrdered: number;
  quantityAllocated: number;
  quantityShipped: number;
  quantityReturned: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SOStatusHistory {
  id: string;
  salesOrderId: string;
  fromStatus: SOStatus | null;
  toStatus: SOStatus;
  changedById: string;
  reason: string | null;
  changedAt: string;
}

export interface Shipment {
  id: string;
  salesOrderId: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface StockLevel {
  id: string;
  skuId: string;
  locationId: string;
  quantityOnHand: number;
  quantityAllocated: number;
  quantityInTransit: number;
  quantityOnOrder: number;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  lastCountedAt: string | null;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  skuId: string;
  type: StockMovementType;
  quantity: number;
  fromLocationId: string | null;
  toLocationId: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  performedById: string;
  performedAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  timestamp: string;
}

export interface SOPOMatch {
  id: string;
  salesOrderId: string;
  salesOrderLineId: string | null;
  purchaseOrderId: string;
  purchaseOrderLineId: string | null;
  skuId: string;
  quantityMatched: number;
  matchScore: number;
  matchFactors: Record<string, number>;
  status: MatchStatus;
  proposedBy: string;
  confirmedById: string | null;
  confirmedAt: string | null;
  rejectedReason: string | null;
  expectedFulfillDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchingRun {
  id: string;
  triggeredBy: string;
  matchesProposed: number;
  matchesAutoConfirmed: number;
  matchesRequiringReview: number;
  unmatched: number;
  avgMatchScore: number | null;
  executionTimeMs: number | null;
  modelVersion: string | null;
  startedAt: string;
  completedAt: string | null;
}

export interface DemandForecast {
  id: string;
  skuId: string;
  locationId: string | null;
  season: Season;
  seasonYear: number;
  forecastDate: string;
  predictedDemand: number;
  confidenceLow: number;
  confidenceHigh: number;
  modelVersion: string;
  features: Record<string, unknown> | null;
  createdAt: string;
}

export interface AIRecommendation {
  id: string;
  type: string;
  targetEntity: string;
  targetId: string;
  recommendation: string;
  confidence: number;
  reasoning: Record<string, unknown>;
  impact: Record<string, unknown> | null;
  status: string;
  acceptedById: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface AnomalyAlert {
  id: string;
  type: string;
  severity: string;
  entityType: string;
  entityId: string;
  description: string;
  detectedValue: number;
  expectedRange: { low: number; high: number };
  modelVersion: string;
  isResolved: boolean;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface ModelRegistry {
  id: string;
  modelName: string;
  version: string;
  status: string;
  metrics: Record<string, unknown>;
  hyperparameters: Record<string, unknown>;
  trainingDataRange: Record<string, unknown>;
  artifactPath: string;
  trainedAt: string;
  activatedAt: string | null;
  createdAt: string;
}
