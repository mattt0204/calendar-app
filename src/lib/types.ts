// Supabase DB 타입.
// 이상적으로는 `supabase gen types typescript` 로 자동 생성하지만
// MVP 는 수동 유지. schema 변경 시 동기화 필요.

import type { CategoryId } from './categories'

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name: string
          category: CategoryId
          color: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          category: CategoryId
          color?: string | null
          is_active?: boolean
        }
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      plan_blocks: {
        Row: {
          id: string
          date: string
          start_time: string
          end_time: string
          product_id: string
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          start_time: string
          end_time: string
          product_id: string
          note?: string | null
        }
        Update: Partial<Database['public']['Tables']['plan_blocks']['Insert']>
      }
      actual_blocks: {
        Row: {
          id: string
          date: string
          start_time: string
          end_time: string
          product_id: string
          note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          start_time: string
          end_time: string
          product_id: string
          note?: string | null
        }
        Update: Partial<Database['public']['Tables']['actual_blocks']['Insert']>
      }
    }
    Functions: {
      get_or_create_product: {
        Args: { p_name: string; p_category?: CategoryId }
        Returns: string
      }
    }
  }
}

export type Product = Database['public']['Tables']['products']['Row']
export type PlanBlock = Database['public']['Tables']['plan_blocks']['Row']
export type ActualBlock = Database['public']['Tables']['actual_blocks']['Row']

export type PlanBlockWithProduct = PlanBlock & { product: Product }
export type ActualBlockWithProduct = ActualBlock & { product: Product }
