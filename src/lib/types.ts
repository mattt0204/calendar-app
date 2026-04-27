// supabase-js 가 기대하는 Database shape 는 자동 생성으로 두고 (database.types.ts),
// 여기는 frontend helper 만. category 는 CHECK constraint 가 보장하는 union 으로 narrow.
// kind 도 동일 — DB CHECK ('product' | 'area').
//
// 재생성: supabase gen types typescript --linked > src/lib/database.types.ts

import type { Database } from './database.types'
import type { CategoryId } from './categories'

export type { Database }

export type SubjectKind = 'product' | 'area'

type RawSubject = Database['public']['Tables']['subjects']['Row']
export type Subject = Omit<RawSubject, 'category' | 'kind'> & {
  category: CategoryId
  kind: SubjectKind
}

export type PlanBlock = Database['public']['Tables']['plan_blocks']['Row']
export type ActualBlock = Database['public']['Tables']['actual_blocks']['Row']

export type PlanBlockWithSubject = PlanBlock & { subject: Subject }
export type ActualBlockWithSubject = ActualBlock & { subject: Subject }
