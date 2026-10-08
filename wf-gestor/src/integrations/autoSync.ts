import { useEffect, useState, useSyncExternalStore } from 'react'
import { hydrateStates, readLastSync, runAmazonSync } from './sync'
import type { SyncState } from './types'

const ENABLED_KEY = 'wf.autoSync'
const INTERVAL_MS = 5 * 60_000
const BOOT_DELAY_MS = 2_000

export type AutoSyncStatus = {
  enabled: boolean
  running: boolean
  lastSync: string | null
  lastSyncAt: number
  lastAttemptAt: number
  states: SyncState[]
  message: string
  hint?: string
  ok: boolean | null
}

function readEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ENABLED_KEY)
    return raw === null ? true : raw === '1'
  } catch {
    return true
  }
}

let status: AutoSyncStatus = {
  enabled: readEnabled(),
  running: false,
  lastSync: readLastSync(),
  lastSyncAt: 0,
  lastAttemptAt: 0,
  states: hydrateStates(),
  message: '',
  ok: null,
}

const listeners = new Set<() => void>()

function emit(patch: Partial<AutoSyncStatus>) {
  status = { ...status, ...patch }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => status

export function getAutoSyncStatus(): AutoSyncStatus {
  return status
}

export function useAutoSyncStatus(): AutoSyncStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function setAutoSyncEnabled(enabled: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
  } catch {
    /* armazenamento indisponível */
  }
  emit({ enabled })
  if (enabled) void runSyncNow()
}

let retryTimer: number | undefined

export async function runSyncNow(): Promise<void> {
  if (status.running) return
  emit({ running: true, message: '', lastAttemptAt: Date.now() })

  try {
    const outcome = await runAmazonSync((states) => emit({ states }))
    emit({
      running: false,
      ok: outcome.ok,
      message: outcome.message,
      hint: outcome.hint,
      lastSync: outcome.ok ? readLastSync() : status.lastSync,
      lastSyncAt: outcome.ok ? Date.now() : status.lastSyncAt,
    })
  } catch (error) {
    emit({ running: false, ok: false, message: (error as Error).message })
  }

  window.clearTimeout(retryTimer)
  if (status.enabled && !status.ok) {
    retryTimer = window.setTimeout(() => {
      if (readEnabled() && document.visibilityState === 'visible') void runSyncNow()
    }, INTERVAL_MS)
  }
}

let started = false

export function startAutoSync() {
  if (started) return
  started = true

  window.setTimeout(() => {
    if (readEnabled()) void runSyncNow()
  }, BOOT_DELAY_MS)

  window.setInterval(() => {
    if (!readEnabled() || status.running || document.visibilityState !== 'visible') return
    void runSyncNow()
  }, INTERVAL_MS)

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (!readEnabled() || status.running) return
    const sinceLastAttempt = Date.now() - status.lastAttemptAt
    if (!status.lastAttemptAt || sinceLastAttempt >= INTERVAL_MS) void runSyncNow()
  })
}

export function useMinuteTick() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

export function describeSync(current: AutoSyncStatus): string {
  if (current.running) return 'Sincronizando…'
  if (!current.enabled) return 'Auto-sync pausado'
  if (!current.lastSyncAt) return 'Aguardando 1ª sync'

  const minutes = Math.max(0, Math.floor((Date.now() - current.lastSyncAt) / 60_000))
  if (minutes < 1) return 'Sincronizado agora'
  if (minutes < 60) return `Sincronizado há ${minutes} min`

  const hours = Math.floor(minutes / 60)
  return `Sincronizado há ${hours} h`
}
