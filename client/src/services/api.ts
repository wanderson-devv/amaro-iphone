import type { Customer, Product, Sale, ServiceOrder, FinancialEntry, Supplier, PurchaseOrder, AuditLog } from '../lib/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

let authToken: string | null = localStorage.getItem('auth-token')

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) localStorage.setItem('auth-token', token)
  else localStorage.removeItem('auth-token')
}

export function getAuthToken(): string | null { return authToken }

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  if (res.status === 401) { setAuthToken(null); window.location.reload(); throw new Error('Sessao expirada.') }
  if (!res.ok) { const err = await res.json().catch(() => ({ error: 'Erro de conexao' })); throw new Error(err.error || `Erro ${res.status}`) }
  return res.json()
}

export const api = {
  auth: {
    login: (email: string, password: string) => request<{ token: string; user: { uuid: string; name: string; email: string } }>('POST', '/v1/auth/login', { email, password }),
    register: (name: string, email: string, password: string) => request<{ token: string; user: { uuid: string; name: string; email: string } }>('POST', '/v1/auth/register', { name, email, password }),
    me: () => request<{ uuid: string; name: string; email: string }>('GET', '/v1/auth/me'),
  },
  customers: {
    list: () => request<Customer[]>('GET', '/v1/customers'),
    get: (uuid: string) => request<Customer>('GET', `/v1/customers/${uuid}`),
    create: (data: Partial<Customer>) => request<Customer>('POST', '/v1/customers', data),
    update: (uuid: string, data: Partial<Customer>) => request<Customer>(`PUT`, `/v1/customers/${uuid}`, data),
    delete: (uuid: string) => request<void>('DELETE', `/v1/customers/${uuid}`),
  },
  products: {
    list: () => request<Product[]>('GET', '/v1/products'),
    get: (uuid: string) => request<Product>('GET', `/v1/products/${uuid}`),
    create: (data: Partial<Product>) => request<Product>('POST', '/v1/products', data),
    update: (uuid: string, data: Partial<Product>) => request<Product>('PUT', `/v1/products/${uuid}`, data),
    delete: (uuid: string) => request<void>('DELETE', `/v1/products/${uuid}`),
    adjustStock: (uuid: string, quantity: number, reason: string) => request<Product>('POST', `/v1/products/${uuid}/stock`, { quantity, reason }),
  },
  sales: {
    list: () => request<Sale[]>('GET', '/v1/sales'),
    get: (uuid: string) => request<Sale>('GET', `/v1/sales/${uuid}`),
    create: (data: { items: Array<{ productUuid: string; quantity: number }>; customerUuid?: string; discount: number; surcharge: number; paymentMethod: string }) => request<Sale>('POST', '/v1/sales', data),
  },
  serviceOrders: {
    list: () => request<ServiceOrder[]>('GET', '/v1/service-orders'),
    get: (uuid: string) => request<ServiceOrder>('GET', `/v1/service-orders/${uuid}`),
    create: (data: { customerUuid: string; equipment: string; brand?: string; model?: string; reportedIssue: string; expectedDelivery?: string; technician?: string }) => request<ServiceOrder>('POST', '/v1/service-orders', data),
    updateStatus: (uuid: string, status: string) => request<ServiceOrder>('PUT', `/v1/service-orders/${uuid}/status`, { status }),
    consumePart: (uuid: string, productUuid: string, quantity: number) => request<ServiceOrder>('POST', `/v1/service-orders/${uuid}/parts`, { productUuid, quantity }),
  },
  financial: {
    list: () => request<FinancialEntry[]>('GET', '/v1/financial'),
    create: (data: Partial<FinancialEntry>) => request<FinancialEntry>('POST', '/v1/financial', data),
    pay: (uuid: string, amount: number, paymentMethod: string) => request<FinancialEntry>('POST', `/v1/financial/${uuid}/pay`, { amount, paymentMethod }),
    cancel: (uuid: string) => request<void>('DELETE', `/v1/financial/${uuid}`),
  },
  suppliers: {
    list: () => request<Supplier[]>('GET', '/v1/suppliers'),
    create: (data: Partial<Supplier>) => request<Supplier>('POST', '/v1/suppliers', data),
    delete: (uuid: string) => request<void>('DELETE', `/v1/suppliers/${uuid}`),
  },
  purchaseOrders: {
    list: () => request<PurchaseOrder[]>('GET', '/v1/purchase-orders'),
    get: (uuid: string) => request<PurchaseOrder>('GET', `/v1/purchase-orders/${uuid}`),
    create: (data: { supplierUuid: string; supplierName: string; items: Array<{ productUuid: string; name: string; quantity: number; unitCost: number }>; expectedDelivery?: string; notes?: string }) => request<PurchaseOrder>('POST', '/v1/purchase-orders', data),
    updateStatus: (uuid: string, status: string) => request<PurchaseOrder>('PUT', `/v1/purchase-orders/${uuid}/status`, { status }),
    receiveItem: (uuid: string, productUuid: string, quantity: number) => request<PurchaseOrder>('POST', `/v1/purchase-orders/${uuid}/receive`, { productUuid, quantity }),
  },
  audit: {
    list: () => request<AuditLog[]>('GET', '/v1/audit'),
  },
}
