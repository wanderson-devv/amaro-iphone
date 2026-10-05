import type { Channel } from '../data'

export type SyncResource = 'orders' | 'settlements' | 'inventory' | 'listings'

export const syncResources: { key: SyncResource; label: string; scope: string }[] = [
  { key: 'orders', label: 'Pedidos', scope: 'Orders:Advanced' },
  { key: 'settlements', label: 'Repasses e conciliação', scope: 'Finance:Read' },
  { key: 'inventory', label: 'Estoque FBA', scope: 'Inventory:Read' },
  { key: 'listings', label: 'Catálogo e anúncios', scope: 'Product Listing' },
]

export type SyncStatus = 'aguardando' | 'em curso' | 'ok' | 'erro'

export type SyncState = {
  resource: SyncResource
  status: SyncStatus
  count: number
  detail?: string
}

export type FetchResult = { count: number; detail: string }

export type ProbeResult = { ok: boolean; detail: string }

export interface ChannelConnector {
  readonly channel: Channel
  probe(): Promise<ProbeResult>
  fetch(resource: SyncResource, since: string): Promise<FetchResult>
}

export class SyncError extends Error {
  hint?: string

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'SyncError'
    this.hint = hint
  }
}
