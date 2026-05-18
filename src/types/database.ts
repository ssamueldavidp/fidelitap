export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string
          owner_id: string
          name: string
          email: string
          plan: 'free' | 'basic' | 'pro' | 'premium'
          subscription_status: 'active' | 'past_due' | 'canceled'
          wompi_customer_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          email: string
          plan?: 'free' | 'basic' | 'pro' | 'premium'
          subscription_status?: 'active' | 'past_due' | 'canceled'
          wompi_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          email?: string
          plan?: 'free' | 'basic' | 'pro' | 'premium'
          subscription_status?: 'active' | 'past_due' | 'canceled'
          wompi_customer_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_cards: {
        Row: {
          id: string
          business_id: string
          name: string
          stamps_required: number
          benefit_description: string
          design_config: Json
          is_active: boolean
          slug: string
          deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          business_id: string
          name: string
          stamps_required: number
          benefit_description: string
          design_config?: Json
          is_active?: boolean
          slug?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          business_id?: string
          name?: string
          stamps_required?: number
          benefit_description?: string
          design_config?: Json
          is_active?: boolean
          slug?: string
          deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          email: string
          name: string
          phone: string | null
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          phone?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          phone?: string | null
          created_at?: string
        }
        Relationships: []
      }
      customer_cards: {
        Row: {
          id: string
          customer_id: string
          loyalty_card_id: string
          unique_code: string
          current_stamps: number
          is_complete: boolean
          times_completed: number
          wallet_pass_serial: string | null
          wallet_auth_token: string | null
          apple_pass_url: string | null
          google_pass_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          loyalty_card_id: string
          unique_code: string
          current_stamps?: number
          is_complete?: boolean
          times_completed?: number
          wallet_pass_serial?: string | null
          wallet_auth_token?: string | null
          apple_pass_url?: string | null
          google_pass_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          loyalty_card_id?: string
          unique_code?: string
          current_stamps?: number
          is_complete?: boolean
          times_completed?: number
          wallet_pass_serial?: string | null
          wallet_auth_token?: string | null
          apple_pass_url?: string | null
          google_pass_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      stamp_events: {
        Row: {
          id: string
          customer_card_id: string
          business_id: string
          stamped_by: string
          scan_token: string
          ip_address: string | null
          device_fingerprint: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_card_id: string
          business_id: string
          stamped_by: string
          scan_token: string
          ip_address?: string | null
          device_fingerprint?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_card_id?: string
          business_id?: string
          stamped_by?: string
          scan_token?: string
          ip_address?: string | null
          device_fingerprint?: string | null
          created_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          slug: string
          price_cop: number
          max_loyalty_cards: number | null
          max_customers: number | null
          features: Json
          is_active: boolean
        }
        Insert: {
          id?: string
          name: string
          slug: string
          price_cop: number
          max_loyalty_cards?: number | null
          max_customers?: number | null
          features?: Json
          is_active?: boolean
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          price_cop?: number
          max_loyalty_cards?: number | null
          max_customers?: number | null
          features?: Json
          is_active?: boolean
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Helpers para tablas individuales
export type Business = Database['public']['Tables']['businesses']['Row']
export type BusinessInsert = Database['public']['Tables']['businesses']['Insert']
export type BusinessUpdate = Database['public']['Tables']['businesses']['Update']

export type LoyaltyCard = Database['public']['Tables']['loyalty_cards']['Row']
export type LoyaltyCardInsert = Database['public']['Tables']['loyalty_cards']['Insert']

export type Customer = Database['public']['Tables']['customers']['Row']
export type CustomerInsert = Database['public']['Tables']['customers']['Insert']

export type CustomerCard = Database['public']['Tables']['customer_cards']['Row']
export type CustomerCardInsert = Database['public']['Tables']['customer_cards']['Insert']

export type StampEvent = Database['public']['Tables']['stamp_events']['Row']
export type StampEventInsert = Database['public']['Tables']['stamp_events']['Insert']

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

// Design config de tarjeta con tipos fuertes
export interface CardDesignConfig {
  color: string
  bg_type: 'solid' | 'gradient' | 'image'
  bg_value: string
  bg_image_url: string | null
  stamp_icon: string
  font: 'default' | 'rounded' | 'mono'
}

// Plan slugs
export type PlanSlug = 'free' | 'basic' | 'pro' | 'premium'
