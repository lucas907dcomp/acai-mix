export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
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
      employee_consumptions: {
        Row: {
          id: string
          user_id: string
          location_id: string
          amount: number
          description: string | null
          consumed_at: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          location_id: string
          amount: number
          description?: string | null
          consumed_at?: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          location_id?: string
          amount?: number
          description?: string | null
          consumed_at?: string
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_consumptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_consumptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          address: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          address?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number
          old_price: number
          product_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price: number
          product_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_by: string | null
          id: string
          location_id: string | null
          name: string
          price_per_gram: number
          product_type: string
          sort_order: number
          unit_price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_by?: string | null
          id?: string
          location_id?: string | null
          name: string
          price_per_gram: number
          product_type?: string
          sort_order?: number
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_by?: string | null
          id?: string
          location_id?: string | null
          name?: string
          price_per_gram?: number
          product_type?: string
          sort_order?: number
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          amount_received: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          change_returned: number | null
          combined_items: Json | null
          combined_order_name: string | null
          created_at: string
          created_offline: boolean
          has_casquinha: boolean
          id: string
          is_combined: boolean
          location_id: string
          payment_method: string
          price_per_gram: number
          product_id: string | null
          quantity: number
          shift_id: string
          status: string
          sync_reconciled: boolean
          synced_at: string | null
          weight_grams: number | null
          weight_source: string
        }
        Insert: {
          amount: number
          amount_received?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          change_returned?: number | null
          combined_items?: Json | null
          combined_order_name?: string | null
          created_at?: string
          created_offline?: boolean
          has_casquinha?: boolean
          id: string
          is_combined?: boolean
          location_id: string
          payment_method: string
          price_per_gram: number
          product_id?: string | null
          quantity?: number
          shift_id: string
          status?: string
          sync_reconciled?: boolean
          synced_at?: string | null
          weight_grams?: number | null
          weight_source: string
        }
        Update: {
          amount?: number
          amount_received?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          change_returned?: number | null
          combined_items?: Json | null
          combined_order_name?: string | null
          created_at?: string
          created_offline?: boolean
          has_casquinha?: boolean
          id?: string
          is_combined?: boolean
          location_id?: string
          payment_method?: string
          price_per_gram?: number
          product_id?: string | null
          quantity?: number
          shift_id?: string
          status?: string
          sync_reconciled?: boolean
          synced_at?: string | null
          weight_grams?: number | null
          weight_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_sales_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shift_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          id: string
          location_id: string
          opened_at: string
          opened_by: string
          sale_count: number
          shift_number: number
          status: string
          total_card: number
          total_cash: number
          total_pix: number
          total_sales: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          location_id: string
          opened_at?: string
          opened_by: string
          sale_count?: number
          shift_number: number
          status?: string
          total_card?: number
          total_cash?: number
          total_pix?: number
          total_sales?: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          location_id?: string
          opened_at?: string
          opened_by?: string
          sale_count?: number
          shift_number?: number
          status?: string
          total_card?: number
          total_cash?: number
          total_pix?: number
          total_sales?: number
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          location_id: string | null
          role: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          location_id?: string | null
          role: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          location_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      daily_summary: {
        Row: {
          avg_ticket: number | null
          location_id: string | null
          sale_date: string | null
          total_amount: number | null
          total_card: number | null
          total_cash: number | null
          total_pix: number | null
          total_sales: number | null
          total_shifts: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_summary: {
        Row: {
          avg_ticket: number | null
          closed_at: string | null
          duration_minutes: number | null
          id: string | null
          location_id: string | null
          opened_at: string | null
          opened_by: string | null
          shift_number: number | null
          status: string | null
          total_amount: number | null
          total_card: number | null
          total_cash: number | null
          total_pix: number | null
          total_sales: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sales_summary: {
        Row: {
          location_id: string | null
          product_id: string | null
          product_name: string | null
          product_type: string | null
          total_amount: number | null
          total_quantity: number | null
          total_sales: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_cancel_sale: { Args: { p_sale_id: string }; Returns: boolean }
      fn_is_admin_of_location: { Args: { loc_id: string }; Returns: boolean }
      get_my_location_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
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
