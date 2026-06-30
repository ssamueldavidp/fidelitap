export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      businesses: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          latitude: number | null
          longitude: number | null
          mp_payer_email: string | null
          mp_preapproval_id: string | null
          name: string
          owner_id: string
          plan: string
          poster_bg_color: string
          poster_bg_image_url: string | null
          stamp_cooldown_seconds: number
          subscription_end_date: string | null
          subscription_status: string
          updated_at: string
          wompi_customer_id: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mp_payer_email?: string | null
          mp_preapproval_id?: string | null
          name: string
          owner_id: string
          plan?: string
          poster_bg_color?: string
          poster_bg_image_url?: string | null
          stamp_cooldown_seconds?: number
          subscription_end_date?: string | null
          subscription_status?: string
          updated_at?: string
          wompi_customer_id?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          mp_payer_email?: string | null
          mp_preapproval_id?: string | null
          name?: string
          owner_id?: string
          plan?: string
          poster_bg_color?: string
          poster_bg_image_url?: string | null
          stamp_cooldown_seconds?: number
          subscription_end_date?: string | null
          subscription_status?: string
          updated_at?: string
          wompi_customer_id?: string | null
        }
        Relationships: []
      }
      customer_cards: {
        Row: {
          apple_pass_url: string | null
          created_at: string
          current_stamps: number
          customer_id: string
          google_pass_url: string | null
          id: string
          is_complete: boolean
          loyalty_card_id: string
          status: string
          times_completed: number
          unique_code: string
          updated_at: string
          wallet_auth_token: string | null
          wallet_pass_serial: string | null
        }
        Insert: {
          apple_pass_url?: string | null
          created_at?: string
          current_stamps?: number
          customer_id: string
          google_pass_url?: string | null
          id?: string
          is_complete?: boolean
          loyalty_card_id: string
          status?: string
          times_completed?: number
          unique_code: string
          updated_at?: string
          wallet_auth_token?: string | null
          wallet_pass_serial?: string | null
        }
        Update: {
          apple_pass_url?: string | null
          created_at?: string
          current_stamps?: number
          customer_id?: string
          google_pass_url?: string | null
          id?: string
          is_complete?: boolean
          loyalty_card_id?: string
          status?: string
          times_completed?: number
          unique_code?: string
          updated_at?: string
          wallet_auth_token?: string | null
          wallet_pass_serial?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_cards_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_cards_loyalty_card_id_fkey"
            columns: ["loyalty_card_id"]
            isOneToOne: false
            referencedRelation: "loyalty_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birthday: string | null
          city: string | null
          created_at: string
          email: string
          gender: string | null
          id: string
          marketing_consent: boolean
          name: string
          phone: string | null
        }
        Insert: {
          birthday?: string | null
          city?: string | null
          created_at?: string
          email: string
          gender?: string | null
          id?: string
          marketing_consent?: boolean
          name: string
          phone?: string | null
        }
        Update: {
          birthday?: string | null
          city?: string | null
          created_at?: string
          email?: string
          gender?: string | null
          id?: string
          marketing_consent?: boolean
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      device_registrations: {
        Row: {
          created_at: string | null
          device_library_identifier: string
          id: string
          pass_type_identifier: string
          push_token: string
          serial_number: string
        }
        Insert: {
          created_at?: string | null
          device_library_identifier: string
          id?: string
          pass_type_identifier: string
          push_token: string
          serial_number: string
        }
        Update: {
          created_at?: string | null
          device_library_identifier?: string
          id?: string
          pass_type_identifier?: string
          push_token?: string
          serial_number?: string
        }
        Relationships: []
      }
      loyalty_cards: {
        Row: {
          benefit_description: string
          business_id: string
          created_at: string
          deleted_at: string | null
          design_config: Json
          id: string
          is_active: boolean
          name: string
          poster_reward_text: string | null
          slug: string
          stamps_required: number
          updated_at: string
        }
        Insert: {
          benefit_description: string
          business_id: string
          created_at?: string
          deleted_at?: string | null
          design_config?: Json
          id?: string
          is_active?: boolean
          name: string
          poster_reward_text?: string | null
          slug: string
          stamps_required: number
          updated_at?: string
        }
        Update: {
          benefit_description?: string
          business_id?: string
          created_at?: string
          deleted_at?: string | null
          design_config?: Json
          id?: string
          is_active?: boolean
          name?: string
          poster_reward_text?: string | null
          slug?: string
          stamps_required?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_cards_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          amount_cop: number | null
          business_id: string
          created_at: string
          event_type: string
          id: string
          mp_payment_id: string | null
          mp_preapproval_id: string | null
          plan_slug: string | null
          raw_payload: Json | null
          status: string | null
        }
        Insert: {
          amount_cop?: number | null
          business_id: string
          created_at?: string
          event_type: string
          id?: string
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          plan_slug?: string | null
          raw_payload?: Json | null
          status?: string | null
        }
        Update: {
          amount_cop?: number | null
          business_id?: string
          created_at?: string
          event_type?: string
          id?: string
          mp_payment_id?: string | null
          mp_preapproval_id?: string | null
          plan_slug?: string | null
          raw_payload?: Json | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      stamp_events: {
        Row: {
          business_id: string
          created_at: string
          customer_card_id: string
          device_fingerprint: string | null
          id: string
          ip_address: unknown
          scan_token: string
          stamped_by: string
          type: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_card_id: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          scan_token: string
          stamped_by: string
          type?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_card_id?: string
          device_fingerprint?: string | null
          id?: string
          ip_address?: unknown
          scan_token?: string
          stamped_by?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "stamp_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stamp_events_customer_card_id_fkey"
            columns: ["customer_card_id"]
            isOneToOne: false
            referencedRelation: "customer_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          features: Json
          id: string
          is_active: boolean
          max_customers: number | null
          max_loyalty_cards: number | null
          name: string
          price_cop: number
          slug: string
        }
        Insert: {
          features?: Json
          id?: string
          is_active?: boolean
          max_customers?: number | null
          max_loyalty_cards?: number | null
          name: string
          price_cop: number
          slug: string
        }
        Update: {
          features?: Json
          id?: string
          is_active?: boolean
          max_customers?: number | null
          max_loyalty_cards?: number | null
          name?: string
          price_cop?: number
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_stamp: { Args: { p_card_id: string }; Returns: Json }
      claim_reward: { Args: { p_card_id: string }; Returns: Json }
      get_business_metrics: { Args: { p_business_id: string }; Returns: Json }
      get_customers_list: {
        Args: { p_business_id: string; p_card_id?: string; p_q?: string }
        Returns: {
          card_name: string
          current_stamps: number
          customer_id: string
          customer_name: string
          last_visit: string
          loyalty_card_id: string
          stamps_required: number
          times_completed: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const


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

export type DeviceRegistration = Database['public']['Tables']['device_registrations']['Row']

export type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

// Design config de tarjeta con tipos fuertes
export interface CardDesignConfig {
  color: string
  bg_type: 'solid' | 'gradient' | 'image'
  bg_value: string
  bg_image_url: string | null
  stamp_icon: string
  font: 'default' | 'rounded' | 'mono'
  style: 'clean' | 'modern' | 'luxury' | 'editorial' | 'minimal'
  bg_mode: 'light' | 'dark'
  logo_url: string | null
}

export type CardStyle = CardDesignConfig['style']

export type PlanSlug = 'free' | 'basic' | 'pro' | 'premium'
