import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { daysAgo, now } from '../../utils/date.js';

// D365 F&O OData response wrapper
function odataResponse(entitySet: string, items: unknown[], count?: number, skip = 0) {
  const result: Record<string, unknown> = {
    '@odata.context': `https://acne-d365.operations.dynamics.mock/data/$metadata#${entitySet}`,
    value: items,
  };
  if (count !== undefined) {
    result['@odata.count'] = count;
  }
  if (items.length > 0 && skip + items.length < (count || items.length + 1)) {
    result['@odata.nextLink'] = `https://acne-d365.operations.dynamics.mock/data/${entitySet}?$skip=${skip + items.length}`;
  }
  return result;
}

function applyODataQuery<T>(items: T[], query: Record<string, unknown>): { result: T[]; total: number } {
  let result = [...items];

  // Support $filter with dataAreaId — all items have dataAreaId 'acse' so this is a pass-through
  const filter = String(query.$filter || '');
  if (filter) {
    // Parse simple eq filters: "dataAreaId eq 'acse'" or "Field eq 'value'"
    const eqMatches = [...filter.matchAll(/(\w+)\s+eq\s+'([^']+)'/g)];
    for (const m of eqMatches) {
      const field = m[1];
      const value = m[2];
      result = result.filter(item => {
        const rec = item as Record<string, unknown>;
        return rec[field] === value || rec[field] === undefined; // pass-through if field missing
      });
    }
  }

  const total = result.length;
  const top = Number(query.$top) || 1000;
  const skip = Number(query.$skip) || 0;
  result = result.slice(skip, skip + top);
  return { result, total };
}

const DATA_AREA_ID = 'acse'; // Acne Studios SE legal entity

// ─── Metadata ─────────────────────────────────────────

export async function getMetadata(_request: FastifyRequest, reply: FastifyReply) {
  return reply.type('application/xml').send(`<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="Microsoft.Dynamics.DataEntities" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="Vendor"><Key><PropertyRef Name="VendorAccountNumber"/><PropertyRef Name="dataAreaId"/></Key><Property Name="VendorAccountNumber" Type="Edm.String" Nullable="false"/><Property Name="dataAreaId" Type="Edm.String" Nullable="false"/><Property Name="VendorName" Type="Edm.String"/><Property Name="VendorGroupId" Type="Edm.String"/><Property Name="AddressCountryRegionId" Type="Edm.String"/><Property Name="PrimaryContactEmail" Type="Edm.String"/><Property Name="PaymentTermsName" Type="Edm.String"/><Property Name="DefaultCurrencyCode" Type="Edm.String"/></EntityType>
      <EntityType Name="PurchaseOrderHeader"><Key><PropertyRef Name="PurchaseOrderNumber"/><PropertyRef Name="dataAreaId"/></Key><Property Name="PurchaseOrderNumber" Type="Edm.String" Nullable="false"/><Property Name="dataAreaId" Type="Edm.String" Nullable="false"/><Property Name="VendorAccountNumber" Type="Edm.String"/><Property Name="PurchaseOrderStatus" Type="Edm.String"/><Property Name="OrderDate" Type="Edm.DateTimeOffset"/><Property Name="DeliveryDate" Type="Edm.DateTimeOffset"/><Property Name="TotalAmount" Type="Edm.Decimal"/><Property Name="CurrencyCode" Type="Edm.String"/><NavigationProperty Name="PurchaseOrderLines" Type="Collection(Microsoft.Dynamics.DataEntities.PurchaseOrderLine)"/></EntityType>
      <EntityType Name="PurchaseOrderLine"><Key><PropertyRef Name="PurchaseOrderNumber"/><PropertyRef Name="LineNumber"/><PropertyRef Name="dataAreaId"/></Key><Property Name="PurchaseOrderNumber" Type="Edm.String" Nullable="false"/><Property Name="LineNumber" Type="Edm.Int32" Nullable="false"/><Property Name="dataAreaId" Type="Edm.String" Nullable="false"/><Property Name="ItemNumber" Type="Edm.String"/><Property Name="OrderedQuantity" Type="Edm.Decimal"/><Property Name="UnitPrice" Type="Edm.Decimal"/><Property Name="LineAmount" Type="Edm.Decimal"/><Property Name="ReceivedQuantity" Type="Edm.Decimal"/></EntityType>
      <EntityType Name="SalesOrderHeader"><Key><PropertyRef Name="SalesOrderNumber"/><PropertyRef Name="dataAreaId"/></Key><Property Name="SalesOrderNumber" Type="Edm.String" Nullable="false"/><Property Name="dataAreaId" Type="Edm.String" Nullable="false"/><Property Name="CustomerAccount" Type="Edm.String"/><Property Name="SalesOrderStatus" Type="Edm.String"/><Property Name="OrderDate" Type="Edm.DateTimeOffset"/><Property Name="TotalAmount" Type="Edm.Decimal"/><Property Name="CurrencyCode" Type="Edm.String"/><Property Name="SalesChannel" Type="Edm.String"/></EntityType>
      <EntityType Name="ReleasedProduct"><Key><PropertyRef Name="ItemNumber"/><PropertyRef Name="dataAreaId"/></Key><Property Name="ItemNumber" Type="Edm.String" Nullable="false"/><Property Name="dataAreaId" Type="Edm.String" Nullable="false"/><Property Name="ProductName" Type="Edm.String"/><Property Name="ProductType" Type="Edm.String"/><Property Name="ItemModelGroupId" Type="Edm.String"/><Property Name="ProductGroupId" Type="Edm.String"/><Property Name="SalesPrice" Type="Edm.Decimal"/><Property Name="PurchasePrice" Type="Edm.Decimal"/><Property Name="CurrencyCode" Type="Edm.String"/></EntityType>
      <EntityType Name="InventoryOnHand"><Key><PropertyRef Name="ItemNumber"/><PropertyRef Name="WarehouseId"/><PropertyRef Name="dataAreaId"/></Key><Property Name="ItemNumber" Type="Edm.String" Nullable="false"/><Property Name="WarehouseId" Type="Edm.String" Nullable="false"/><Property Name="dataAreaId" Type="Edm.String" Nullable="false"/><Property Name="AvailablePhysical" Type="Edm.Decimal"/><Property Name="PhysicalOnHand" Type="Edm.Decimal"/><Property Name="ReservedOrdered" Type="Edm.Decimal"/><Property Name="OnOrder" Type="Edm.Decimal"/></EntityType>
      <EntityType Name="Customer"><Key><PropertyRef Name="CustomerAccount"/><PropertyRef Name="dataAreaId"/></Key><Property Name="CustomerAccount" Type="Edm.String" Nullable="false"/><Property Name="dataAreaId" Type="Edm.String" Nullable="false"/><Property Name="CustomerName" Type="Edm.String"/><Property Name="CustomerGroupId" Type="Edm.String"/><Property Name="PrimaryContactEmail" Type="Edm.String"/><Property Name="AddressCity" Type="Edm.String"/><Property Name="AddressCountryRegionId" Type="Edm.String"/><Property Name="CurrencyCode" Type="Edm.String"/></EntityType>
      <EntityContainer Name="DataServiceContainer">
        <EntitySet Name="Vendors" EntityType="Microsoft.Dynamics.DataEntities.Vendor"/>
        <EntitySet Name="PurchaseOrderHeaders" EntityType="Microsoft.Dynamics.DataEntities.PurchaseOrderHeader"/>
        <EntitySet Name="SalesOrderHeaders" EntityType="Microsoft.Dynamics.DataEntities.SalesOrderHeader"/>
        <EntitySet Name="ReleasedProducts" EntityType="Microsoft.Dynamics.DataEntities.ReleasedProduct"/>
        <EntitySet Name="InventoryOnHand" EntityType="Microsoft.Dynamics.DataEntities.InventoryOnHand"/>
        <EntitySet Name="Customers" EntityType="Microsoft.Dynamics.DataEntities.Customer"/>
        <EntitySet Name="GeneralJournalEntries" EntityType="Microsoft.Dynamics.DataEntities.GeneralJournalEntry"/>
        <EntitySet Name="ExchangeRates" EntityType="Microsoft.Dynamics.DataEntities.ExchangeRate"/>
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`);
}

export async function listEntities(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    '@odata.context': 'https://acne-d365.operations.dynamics.mock/data/$metadata',
    value: [
      { name: 'Vendors', kind: 'EntitySet', url: 'Vendors' },
      { name: 'PurchaseOrderHeaders', kind: 'EntitySet', url: 'PurchaseOrderHeaders' },
      { name: 'SalesOrderHeaders', kind: 'EntitySet', url: 'SalesOrderHeaders' },
      { name: 'ReleasedProducts', kind: 'EntitySet', url: 'ReleasedProducts' },
      { name: 'InventoryOnHand', kind: 'EntitySet', url: 'InventoryOnHand' },
      { name: 'Customers', kind: 'EntitySet', url: 'Customers' },
      { name: 'GeneralJournalEntries', kind: 'EntitySet', url: 'GeneralJournalEntries' },
      { name: 'ExchangeRates', kind: 'EntitySet', url: 'ExchangeRates' },
    ],
  });
}

// ─── Vendors ──────────────────────────────────────────

export async function listVendors(request: FastifyRequest, reply: FastifyReply) {
  const bankIds = ['NORDEA-SE', 'SEB-SE', 'HANDELSBANKEN-SE', 'DNB-NO', 'UNICREDIT-IT', 'HSBC-GB', 'BNP-FR', 'DEUTSCHE-DE'];
  const paymentSchedules = ['NET30', 'NET45', 'NET60', 'NET90', '2_10_NET30'];
  const vendors = store.suppliers.map((s, idx) => ({
    '@odata.etag': `W/"${generateId().slice(0, 8)}"`,
    dataAreaId: DATA_AREA_ID,
    VendorAccountNumber: s.code,
    VendorName: s.name,
    VendorGroupId: 'FASHION',
    AddressCountryRegionId: s.country,
    PrimaryContactEmail: s.contactEmail,
    PrimaryContactName: s.contactName,
    PaymentTermsName: s.paymentTerms,
    DefaultCurrencyCode: s.currency,
    DeliveryLeadTimeDays: s.leadTimeDays,
    VendorHoldStatus: s.isActive ? 'No' : 'Yes',
    FairWearScore: s.fairWearScore,
    BankAccountId: bankIds[idx % bankIds.length],
    PaymentSchedule: paymentSchedules[idx % paymentSchedules.length],
  }));
  const { result, total } = applyODataQuery(vendors, request.query as Record<string, unknown>);
  return reply.send(odataResponse('Vendors', result, (request.query as any).$count ? total : undefined));
}

export async function getVendor(request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) {
  const code = request.params.key.match(/VendorAccountNumber='([^']+)'/)?.[1];
  const supplier = store.suppliers.find(s => s.code === code || s.id === code);
  if (!supplier) return reply.status(404).send({ error: { code: 'ObjectNotFound', message: 'Vendor not found' } });
  const idx = store.suppliers.indexOf(supplier);
  const bankIds = ['NORDEA-SE', 'SEB-SE', 'HANDELSBANKEN-SE', 'DNB-NO', 'UNICREDIT-IT', 'HSBC-GB', 'BNP-FR', 'DEUTSCHE-DE'];
  const paymentSchedules = ['NET30', 'NET45', 'NET60', 'NET90', '2_10_NET30'];
  return reply.send({
    '@odata.context': 'https://acne-d365.operations.dynamics.mock/data/$metadata#Vendors/$entity',
    '@odata.etag': `W/"${generateId().slice(0, 8)}"`,
    dataAreaId: DATA_AREA_ID,
    VendorAccountNumber: supplier.code,
    VendorName: supplier.name,
    VendorGroupId: 'FASHION',
    AddressCountryRegionId: supplier.country,
    PrimaryContactEmail: supplier.contactEmail,
    PrimaryContactName: supplier.contactName,
    PaymentTermsName: supplier.paymentTerms,
    DefaultCurrencyCode: supplier.currency,
    BankAccountId: bankIds[idx % bankIds.length],
    PaymentSchedule: paymentSchedules[idx % paymentSchedules.length],
  });
}

// ─── Purchase Orders ──────────────────────────────────

export async function listPurchaseOrders(request: FastifyRequest, reply: FastifyReply) {
  const expand = String((request.query as any).$expand || '');
  const pos = store.purchaseOrders.map(po => {
    const supplier = store.suppliers.find(s => s.id === po.supplierId);
    const entry: Record<string, unknown> = {
      '@odata.etag': `W/"${generateId().slice(0, 8)}"`,
      dataAreaId: DATA_AREA_ID,
      PurchaseOrderNumber: po.poNumber,
      VendorAccountNumber: supplier?.code || 'UNKNOWN',
      PurchaseOrderStatus: mapPOStatus(po.status),
      OrderDate: po.createdAt,
      RequestedDeliveryDate: po.expectedDelivery,
      ConfirmedDeliveryDate: po.actualDelivery,
      TotalAmount: po.totalAmount,
      CurrencyCode: po.currency,
      PurchaseOrderName: `${po.season}${po.seasonYear} - ${supplier?.name || 'Unknown'}`,
    };
    if (expand.includes('PurchaseOrderLines')) {
      const lines = store.poLines.filter(l => l.purchaseOrderId === po.id);
      entry.PurchaseOrderLines = lines.map((l, i) => {
        const sku = store.skus.find(s => s.id === l.skuId);
        return {
          dataAreaId: DATA_AREA_ID,
          PurchaseOrderNumber: po.poNumber,
          LineNumber: (i + 1) * 10,
          ItemNumber: sku?.sku || l.skuId,
          ProductName: store.products.find(p => p.id === sku?.productId)?.name,
          OrderedQuantity: l.quantityOrdered,
          ReceivedQuantity: l.quantityReceived,
          UnitPrice: l.unitCost,
          LineAmount: l.lineTotal,
          DeliveryDate: l.expectedDate,
        };
      });
    }
    return entry;
  });
  const { result, total } = applyODataQuery(pos, request.query as Record<string, unknown>);
  return reply.send(odataResponse('PurchaseOrderHeaders', result, total));
}

export async function getPurchaseOrder(request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) {
  const poNum = request.params.key.match(/PurchaseOrderNumber='([^']+)'/)?.[1] || request.params.key;
  const po = store.purchaseOrders.find(p => p.poNumber === poNum || p.id === poNum);
  if (!po) return reply.status(404).send({ error: { code: 'ObjectNotFound', message: 'PurchaseOrder not found' } });
  const supplier = store.suppliers.find(s => s.id === po.supplierId);
  const lines = store.poLines.filter(l => l.purchaseOrderId === po.id);
  return reply.send({
    '@odata.context': 'https://acne-d365.operations.dynamics.mock/data/$metadata#PurchaseOrderHeaders/$entity',
    dataAreaId: DATA_AREA_ID,
    PurchaseOrderNumber: po.poNumber,
    VendorAccountNumber: supplier?.code,
    PurchaseOrderStatus: mapPOStatus(po.status),
    OrderDate: po.createdAt,
    TotalAmount: po.totalAmount,
    CurrencyCode: po.currency,
    PurchaseOrderLines: lines.map((l, i) => {
      const sku = store.skus.find(s => s.id === l.skuId);
      return { LineNumber: (i + 1) * 10, ItemNumber: sku?.sku, OrderedQuantity: l.quantityOrdered, ReceivedQuantity: l.quantityReceived, UnitPrice: l.unitCost, LineAmount: l.lineTotal };
    }),
  });
}

// ─── Sales Orders ─────────────────────────────────────

export async function listSalesOrders(request: FastifyRequest, reply: FastifyReply) {
  const sos = store.salesOrders.map(so => ({
    '@odata.etag': `W/"${generateId().slice(0, 8)}"`,
    dataAreaId: DATA_AREA_ID,
    SalesOrderNumber: so.soNumber,
    CustomerAccount: so.customerId?.slice(0, 10) || 'WALK-IN',
    CustomerName: so.customerName,
    SalesOrderStatus: mapSOStatus(so.status),
    OrderDate: so.createdAt,
    RequestedShipDate: so.requestedShipDate,
    TotalAmount: so.totalAmount,
    CurrencyCode: so.currency,
    SalesChannel: so.channel,
    SalesOrderType: so.type,
  }));
  const { result, total } = applyODataQuery(sos, request.query as Record<string, unknown>);
  return reply.send(odataResponse('SalesOrderHeaders', result, total));
}

export async function getSalesOrder(request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) {
  const soNum = request.params.key.match(/SalesOrderNumber='([^']+)'/)?.[1] || request.params.key;
  const so = store.salesOrders.find(s => s.soNumber === soNum || s.id === soNum);
  if (!so) return reply.status(404).send({ error: { code: 'ObjectNotFound', message: 'SalesOrder not found' } });
  const lines = store.soLines.filter(l => l.salesOrderId === so.id);
  return reply.send({
    '@odata.context': 'https://acne-d365.operations.dynamics.mock/data/$metadata#SalesOrderHeaders/$entity',
    dataAreaId: DATA_AREA_ID,
    SalesOrderNumber: so.soNumber,
    CustomerAccount: so.customerId?.slice(0, 10),
    CustomerName: so.customerName,
    SalesOrderStatus: mapSOStatus(so.status),
    OrderDate: so.createdAt,
    TotalAmount: so.totalAmount,
    CurrencyCode: so.currency,
    SalesChannel: so.channel,
    SalesOrderLines: lines.map((l, i) => {
      const sku = store.skus.find(s => s.id === l.skuId);
      return { LineNumber: (i + 1) * 10, ItemNumber: sku?.sku, OrderedQuantity: l.quantityOrdered, ShippedQuantity: l.quantityShipped, UnitPrice: l.unitPrice, LineAmount: l.lineTotal };
    }),
  });
}

// ─── Products ─────────────────────────────────────────

export async function listProducts(request: FastifyRequest, reply: FastifyReply) {
  const products = store.products.map(p => ({
    '@odata.etag': `W/"${generateId().slice(0, 8)}"`,
    dataAreaId: DATA_AREA_ID,
    ItemNumber: p.styleNumber,
    ProductName: p.name,
    ProductType: 'Item',
    ItemModelGroupId: p.category === 'Accessories' ? 'ACCESSORIES' : 'APPAREL',
    ProductGroupId: p.category.toUpperCase().replace(/\s+/g, '_'),
    ProductSubGroupId: p.subCategory?.toUpperCase().replace(/\s+/g, '_') || null,
    SalesPrice: store.skus.find(s => s.productId === p.id)?.retailPrice || 0,
    PurchasePrice: p.costPrice,
    CurrencyCode: p.costCurrency,
    Season: `${p.season}${p.seasonYear}`,
    Gender: p.gender,
    IsCarryOver: p.isCarryOver ? 'Yes' : 'No',
  }));
  const { result, total } = applyODataQuery(products, request.query as Record<string, unknown>);
  return reply.send(odataResponse('ReleasedProducts', result, total));
}

export async function getProduct(request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) {
  const itemNum = request.params.key.match(/ItemNumber='([^']+)'/)?.[1] || request.params.key;
  const product = store.products.find(p => p.styleNumber === itemNum || p.id === itemNum);
  if (!product) return reply.status(404).send({ error: { code: 'ObjectNotFound', message: 'Product not found' } });
  return reply.send({
    '@odata.context': 'https://acne-d365.operations.dynamics.mock/data/$metadata#ReleasedProducts/$entity',
    dataAreaId: DATA_AREA_ID,
    ItemNumber: product.styleNumber,
    ProductName: product.name,
    ProductType: 'Item',
    ProductGroupId: product.category.toUpperCase(),
    SalesPrice: store.skus.find(s => s.productId === product.id)?.retailPrice || 0,
    PurchasePrice: product.costPrice,
    CurrencyCode: product.costCurrency,
  });
}

// ─── Inventory ────────────────────────────────────────

export async function listInventoryOnHand(request: FastifyRequest, reply: FastifyReply) {
  const items = store.stockLevels
    .map(sl => {
      const sku = store.skus.find(s => s.id === sl.skuId);
      const loc = store.locations.find(l => l.id === sl.locationId);
      return {
        dataAreaId: DATA_AREA_ID,
        ItemNumber: sku?.sku || sl.skuId,
        WarehouseId: loc?.name.replace(/\s+/g, '_').toUpperCase().slice(0, 10) || sl.locationId,
        WarehouseName: loc?.name,
        AvailablePhysical: sl.quantityOnHand - sl.quantityAllocated,
        PhysicalOnHand: sl.quantityOnHand,
        ReservedOrdered: sl.quantityAllocated,
        OnOrder: sl.quantityOnOrder,
        InTransit: sl.quantityInTransit,
      };
    });
  const { result, total } = applyODataQuery(items, request.query as Record<string, unknown>);
  return reply.send(odataResponse('InventoryOnHand', result, total));
}

// ─── Customers ────────────────────────────────────────

export async function listCustomers(request: FastifyRequest, reply: FastifyReply) {
  const customerMap = new Map<string, Record<string, unknown>>();
  for (const so of store.salesOrders) {
    if (!so.customerName || customerMap.has(so.customerName)) continue;
    customerMap.set(so.customerName, {
      dataAreaId: DATA_AREA_ID,
      CustomerAccount: `CUST-${so.customerId?.slice(0, 8) || generateId().slice(0, 8)}`,
      CustomerName: so.customerName,
      CustomerGroupId: so.channel === 'WHOLESALE' ? 'WHOLESALE' : so.channel === 'ECOMMERCE' ? 'ECOM' : 'RETAIL',
      PrimaryContactEmail: so.customerEmail,
      AddressCity: so.shippingCity,
      AddressCountryRegionId: so.shippingCountry,
      CurrencyCode: so.currency,
      SalesChannel: so.channel,
    });
  }
  const customers = Array.from(customerMap.values());
  const { result, total } = applyODataQuery(customers, request.query as Record<string, unknown>);
  return reply.send(odataResponse('Customers', result, total));
}

export async function getCustomer(request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) {
  const acct = request.params.key.match(/CustomerAccount='([^']+)'/)?.[1] || request.params.key;
  const so = store.salesOrders.find(s => s.customerId?.startsWith(acct.replace('CUST-', '')) || s.customerName === acct);
  if (!so) return reply.status(404).send({ error: { code: 'ObjectNotFound', message: 'Customer not found' } });
  return reply.send({
    '@odata.context': 'https://acne-d365.operations.dynamics.mock/data/$metadata#Customers/$entity',
    dataAreaId: DATA_AREA_ID,
    CustomerAccount: `CUST-${so.customerId?.slice(0, 8)}`,
    CustomerName: so.customerName,
    PrimaryContactEmail: so.customerEmail,
    AddressCity: so.shippingCity,
    AddressCountryRegionId: so.shippingCountry,
    CurrencyCode: so.currency,
  });
}

// ─── Financial ────────────────────────────────────────

export async function listGeneralJournalEntries(request: FastifyRequest, reply: FastifyReply) {
  const entries: Record<string, unknown>[] = [];

  // Generate GL entries from POs (cost of goods)
  for (const po of store.purchaseOrders.filter(p => ['RECEIVED', 'CLOSED'].includes(p.status))) {
    entries.push({
      dataAreaId: DATA_AREA_ID,
      JournalNumber: `GJ-PO-${po.poNumber}`,
      AccountType: 'Vendor',
      AccountNumber: store.suppliers.find(s => s.id === po.supplierId)?.code,
      TransactionDate: po.actualDelivery || po.updatedAt,
      AmountInTransactionCurrency: -po.totalAmount,
      TransactionCurrencyCode: po.currency,
      Description: `PO Receipt: ${po.poNumber}`,
      PostingType: 'Purchase',
      LedgerAccount: '5100-COGS',
    });
    entries.push({
      dataAreaId: DATA_AREA_ID,
      JournalNumber: `GJ-PO-${po.poNumber}`,
      AccountType: 'Ledger',
      AccountNumber: '1400-INVENTORY',
      TransactionDate: po.actualDelivery || po.updatedAt,
      AmountInTransactionCurrency: po.totalAmount,
      TransactionCurrencyCode: po.currency,
      Description: `Inventory Receipt: ${po.poNumber}`,
      PostingType: 'Purchase',
      LedgerAccount: '1400-INVENTORY',
    });
  }

  // Generate GL entries from SOs (revenue)
  for (const so of store.salesOrders.filter(s => ['SHIPPED', 'DELIVERED'].includes(s.status))) {
    entries.push({
      dataAreaId: DATA_AREA_ID,
      JournalNumber: `GJ-SO-${so.soNumber}`,
      AccountType: 'Customer',
      AccountNumber: `CUST-${so.customerId?.slice(0, 8)}`,
      TransactionDate: so.actualShipDate || so.updatedAt,
      AmountInTransactionCurrency: so.totalAmount,
      TransactionCurrencyCode: so.currency,
      Description: `Sales Revenue: ${so.soNumber} - ${so.customerName}`,
      PostingType: 'Sales',
      LedgerAccount: '4100-REVENUE',
    });
  }

  const { result, total } = applyODataQuery(entries, request.query as Record<string, unknown>);
  return reply.send(odataResponse('GeneralJournalEntries', result, total));
}

export async function listExchangeRates(_request: FastifyRequest, reply: FastifyReply) {
  const rates = [
    { FromCurrency: 'EUR', ToCurrency: 'SEK', ExchangeRate: 11.35, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'USD', ToCurrency: 'SEK', ExchangeRate: 10.45, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'GBP', ToCurrency: 'SEK', ExchangeRate: 13.20, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'JPY', ToCurrency: 'SEK', ExchangeRate: 0.072, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'CNY', ToCurrency: 'SEK', ExchangeRate: 1.45, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'KRW', ToCurrency: 'SEK', ExchangeRate: 0.0078, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'AUD', ToCurrency: 'SEK', ExchangeRate: 6.85, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'CAD', ToCurrency: 'SEK', ExchangeRate: 7.65, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'SGD', ToCurrency: 'SEK', ExchangeRate: 7.90, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
    { FromCurrency: 'HKD', ToCurrency: 'SEK', ExchangeRate: 1.34, ValidFrom: '2026-01-01', ValidTo: '2026-12-31' },
  ].map(r => ({ ...r, dataAreaId: DATA_AREA_ID, ExchangeRateType: 'Default' }));

  return reply.send(odataResponse('ExchangeRates', rates));
}

// ─── Status mappers ───────────────────────────────────

function mapPOStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Draft', PENDING_APPROVAL: 'InReview', APPROVED: 'Approved',
    SENT_TO_SUPPLIER: 'ExternalReview', CONFIRMED_BY_SUPPLIER: 'Confirmed',
    IN_PRODUCTION: 'Confirmed', SHIPPED: 'Received', PARTIALLY_RECEIVED: 'Received',
    RECEIVED: 'Received', CLOSED: 'Invoiced', CANCELLED: 'Canceled',
  };
  return map[status] || status;
}

function mapSOStatus(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Open', CONFIRMED: 'Open', ALLOCATED: 'Open',
    PICKING: 'Open', PACKED: 'Open', SHIPPED: 'Delivered',
    DELIVERED: 'Invoiced', RETURNED: 'Returned', CANCELLED: 'Canceled', ON_HOLD: 'OnHold',
  };
  return map[status] || status;
}
