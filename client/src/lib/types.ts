export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error'
export type StockMovementType = 'entry' | 'sale' | 'service_order' | 'adjustment' | 'return' | 'loss'
export type PaymentMethod = 'Dinheiro' | 'PIX' | 'Debito' | 'Credito' | 'Crediario' | 'Transferencia'
export type ServiceOrderStatus = 'Entrada' | 'Diagnostico' | 'Aguardando aprovacao' | 'Aguardando peca' | 'Em reparo' | 'Testes' | 'Pronto para entrega' | 'Entregue'
export type FinancialEntryType = 'receivable' | 'payable'
export type FinancialEntryStatus = 'pending' | 'partial' | 'paid' | 'overdue'
export type PurchaseOrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'

export interface Entity {
  uuid: string
  createdAt: string
  updatedAt: string
  deletedAt?: string
  createdBy: string
  updatedBy: string
  syncStatus: SyncStatus
}

export interface Customer extends Entity { name: string; document?: string; phone?: string; email?: string; notes?: string }
export interface Product extends Entity { code: string; sku?: string; barcode?: string; name: string; category?: string; cost: number; salePrice: number; stockQty: number; minStock: number; unit: string }
export interface StockMovement extends Entity { productUuid: string; type: StockMovementType; quantity: number; previousQty: number; resultingQty: number; referenceType?: string; referenceUuid?: string; reason?: string }
export interface SaleItem { productUuid: string; name: string; quantity: number; unitPrice: number; unitCost?: number; total: number }
export interface Sale extends Entity { number: number; customerUuid?: string; items: SaleItem[]; subtotal: number; discount: number; surcharge: number; total: number; paymentMethod: PaymentMethod; status: 'completed' | 'cancelled' }
export interface CashMovement extends Entity { type: 'sale' | 'receipt' | 'expense' | 'supply' | 'withdrawal'; amount: number; paymentMethod?: PaymentMethod; referenceUuid?: string; description: string }
export interface ServiceOrderItem { productUuid: string; name: string; quantity: number; unitPrice: number; total: number }
export interface ServiceOrder extends Entity { number: number; customerUuid: string; equipment: string; brand?: string; model?: string; serialNumber?: string; imei?: string; reportedIssue: string; diagnosis?: string; status: ServiceOrderStatus; technician?: string; expectedDelivery?: string; labor: number; discount: number; total: number; items: ServiceOrderItem[]; warrantyDays: number }
export interface AuditLog extends Entity { entityType: string; entityUuid: string; action: string; previousValue?: string; newValue?: string }
export interface SyncOperation { operationId: string; entityType: string; entityUuid: string; operationType: string; payload: string; deviceId: string; userId: string; createdAt: string; status: SyncStatus; attempts: number; error?: string }
export interface SyncConflict { uuid: string; entityType: string; entityUuid: string; localValue: string; remoteValue: string; localUpdatedAt: string; remoteUpdatedAt: string; status: 'open' | 'resolved' }
export interface FinancialEntry extends Entity {
  type: FinancialEntryType
  status: FinancialEntryStatus
  description: string
  amount: number
  paidAmount: number
  dueDate: string
  paidDate?: string
  paymentMethod?: PaymentMethod
  customerUuid?: string
  supplierName?: string
  referenceType?: string
  referenceUuid?: string
  notes?: string
}

export interface Supplier extends Entity {
  name: string
  document?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

export interface PurchaseOrderItem {
  productUuid: string
  name: string
  quantity: number
  unitCost: number
  total: number
  receivedQty: number
}

export interface PurchaseOrder extends Entity {
  number: number
  supplierUuid: string
  supplierName: string
  status: PurchaseOrderStatus
  items: PurchaseOrderItem[]
  total: number
  expectedDelivery?: string
  notes?: string
}

export interface Settings { key: string; value: string }
