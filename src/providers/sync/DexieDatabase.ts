import Dexie, { type Table } from 'dexie'
import type { Sale } from '@/types'

export interface PendingSale extends Sale {
  local_id?: number
  synced: boolean
}

class AcaiMixDatabase extends Dexie {
  pending_sales!: Table<PendingSale, number>

  constructor() {
    super('acaimix')
    this.version(2).stores({
      pending_sales: '++local_id, id, shift_id, created_at, payment_method, synced',
    })
  }
}

export const db = new AcaiMixDatabase()
