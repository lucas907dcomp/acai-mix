import Dexie, { type Table } from 'dexie'
import type { Sale } from '@/types'

export interface PendingSale extends Sale {
  local_id?: number
  synced: boolean
  sync_attempts: number
  last_sync_error?: string
}

export interface ProvisionalShift {
  local_id: string
  location_id: string
  shift_number: number
  opened_at: string
  opened_by: string
  status: 'provisional' | 'synced'
  remote_id?: string
}

class AcaiMixDatabase extends Dexie {
  pending_sales!: Table<PendingSale, number>
  provisional_shifts!: Table<ProvisionalShift, string>

  constructor() {
    super('acaimix')
    this.version(2).stores({
      pending_sales: '++local_id, id, shift_id, created_at, payment_method, synced',
    })
    this.version(3).stores({
      pending_sales: '++local_id, id, shift_id, created_at, payment_method, synced',
      provisional_shifts: 'local_id, status, location_id',
    })
  }
}

export const db = new AcaiMixDatabase()
