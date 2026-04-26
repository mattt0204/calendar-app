// supabase-js 가 기대하는 Database shape 는 자동 생성으로 두고 (database.types.ts),
// 여기는 frontend helper 만. category 는 CHECK constraint 가 보장하는 union 으로 narrow.
//
// 재생성: supabase gen types typescript --linked > src/lib/database.types.ts

import type { Database } from './database.types'
import type { CategoryId } from './categories'

export type { Database }

type RawProduct = Database['public']['Tables']['products']['Row']
export type Product = Omit<RawProduct, 'category'> & { category: CategoryId }

export type PlanBlock = Database['public']['Tables']['plan_blocks']['Row']
export type ActualBlock = Database['public']['Tables']['actual_blocks']['Row']

export type PlanBlockWithProduct = PlanBlock & { product: Product }
export type ActualBlockWithProduct = ActualBlock & { product: Product }
