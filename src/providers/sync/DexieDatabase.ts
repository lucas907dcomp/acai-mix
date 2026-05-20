import Dexie, { type Table } from 'dexie'
import type { Sale } from '@/types'

export interface PendingSale extends Omit<Sale, 'id'> {
  local_id?: number
}

class AcaiMixDatabase extends Dexie {
  pending_sales!: Table<PendingSale, number>

  constructor() {
    super('acaimix')
    this.version(1).stores({
      pending_sales: '++local_id, shift_id, created_at, payment_method',
    })
  }
}

export const db = new AcaiMixDatabase()
