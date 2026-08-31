import { api } from './api'
import type { Customer, Product, PaymentMethod, ServiceOrderStatus, FinancialEntryType, PurchaseOrderStatus, Supplier } from '../lib/types'

export async function createCustomer(input: Pick<Customer, 'name' | 'document' | 'phone' | 'email' | 'notes'>) {
  return api.customers.create(input)
}

export async function createProduct(input: Pick<Product, 'code' | 'sku' | 'barcode' | 'name' | 'category' | 'cost' | 'salePrice' | 'minStock' | 'unit'>) {
  return api.products.create(input)
}

export async function updateProduct(productUuid: string, input: Pick<Product, 'code' | 'sku' | 'barcode' | 'name' | 'category' | 'cost' | 'salePrice' | 'minStock' | 'unit'>) {
  return api.products.update(productUuid, input)
}

export async function deleteProduct(productUuid: string) {
  return api.products.delete(productUuid)
}

export async function adjustStock(productUuid: string, quantity: number, reason: string) {
  return api.products.adjustStock(productUuid, quantity, reason)
}

export async function completeSale(input: { items: Array<{ productUuid: string; quantity: number }>; customerUuid?: string; discount: number; surcharge: number; paymentMethod: PaymentMethod }) {
  return api.sales.create(input)
}

export async function createServiceOrder(input: { customerUuid: string; equipment: string; brand?: string; model?: string; reportedIssue: string; expectedDelivery?: string; technician?: string }) {
  return api.serviceOrders.create(input)
}

export async function consumePartInServiceOrder(orderUuid: string, productUuid: string, quantity: number) {
  return api.serviceOrders.consumePart(orderUuid, productUuid, quantity)
}

export async function updateServiceOrderStatus(orderUuid: string, status: ServiceOrderStatus) {
  return api.serviceOrders.updateStatus(orderUuid, status)
}

export async function seedDemoData() {
  const customer = await createCustomer({ name: 'DEMO - Marina Alves', document: '000.000.000-00', phone: '(11) 99999-0000', email: 'marina@demo.local' })
  const screen = await createProduct({ code: 'DEMO-001', sku: 'TEL-IP13', name: 'DEMO - Tela iPhone 13', category: 'Pecas', cost: 270, salePrice: 490, minStock: 2, unit: 'UN' })
  const cable = await createProduct({ code: 'DEMO-002', sku: 'CAB-USB-C', name: 'DEMO - Cabo USB-C 1m', category: 'Acessorios', cost: 12, salePrice: 39.9, minStock: 5, unit: 'UN' })
  await adjustStock(screen.uuid, 4, 'Carga DEMO inicial')
  await adjustStock(cable.uuid, 12, 'Carga DEMO inicial')
  await createServiceOrder({ customerUuid: customer.uuid, equipment: 'DEMO - iPhone 13', brand: 'Apple', model: 'A2633', reportedIssue: 'Tela trincada', technician: 'Tecnico DEMO' })
}

export async function createFinancialEntry(input: { type: FinancialEntryType; description: string; amount: number; dueDate: string; customerUuid?: string; supplierName?: string; referenceType?: string; referenceUuid?: string; notes?: string }) {
  return api.financial.create(input)
}

export async function payFinancialEntry(entryUuid: string, amount: number, paymentMethod: PaymentMethod) {
  return api.financial.pay(entryUuid, amount, paymentMethod)
}

export async function cancelFinancialEntry(entryUuid: string) {
  return api.financial.cancel(entryUuid)
}

export async function createSupplier(input: Pick<Supplier, 'name' | 'document' | 'phone' | 'email' | 'address' | 'notes'>) {
  return api.suppliers.create(input)
}

export async function deleteSupplier(supplierUuid: string) {
  return api.suppliers.delete(supplierUuid)
}

export async function createPurchaseOrder(input: { supplierUuid: string; supplierName: string; items: Array<{ productUuid: string; name: string; quantity: number; unitCost: number }>; expectedDelivery?: string; notes?: string }) {
  return api.purchaseOrders.create(input)
}

export async function updatePurchaseOrderStatus(orderUuid: string, status: PurchaseOrderStatus) {
  return api.purchaseOrders.updateStatus(orderUuid, status)
}

export async function receivePurchaseOrderItem(orderUuid: string, productUuid: string, quantity: number) {
  return api.purchaseOrders.receiveItem(orderUuid, productUuid, quantity)
}

export async function clearAllLocalData() { window.location.reload() }
