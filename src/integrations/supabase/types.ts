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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      business_profile: {
        Row: {
          address: string | null
          city: string | null
          closing_time: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          opening_time: string | null
          phone: string | null
          state: string | null
          timezone: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          closing_time?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          closing_time?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          opening_time?: string | null
          phone?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          channel: string
          created_at: string
          description: string
          id: string
          message_template: string
          name: string
          scheduled_at: string | null
          segment_filters: Json
          segment_type: string
          sent_at: string | null
          stats_clicked: number
          stats_delivered: number
          stats_opened: number
          stats_sent: number
          status: string
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          description?: string
          id?: string
          message_template?: string
          name: string
          scheduled_at?: string | null
          segment_filters?: Json
          segment_type?: string
          sent_at?: string | null
          stats_clicked?: number
          stats_delivered?: number
          stats_opened?: number
          stats_sent?: number
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          description?: string
          id?: string
          message_template?: string
          name?: string
          scheduled_at?: string | null
          segment_filters?: Json
          segment_type?: string
          sent_at?: string | null
          stats_clicked?: number
          stats_delivered?: number
          stats_opened?: number
          stats_sent?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          balance: number
          city: string | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          id: string
          last_name: string
          notes: string | null
          phone: string
          state: string | null
          ls_customer_id: string | null
          updated_at: string
          user_id: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          balance?: number
          city?: string | null
          created_at?: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          id?: string
          last_name: string
          notes?: string | null
          phone?: string
          state?: string | null
          ls_customer_id?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          balance?: number
          city?: string | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          id?: string
          last_name?: string
          notes?: string | null
          phone?: string
          state?: string | null
          ls_customer_id?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      deworming_records: {
        Row: {
          created_at: string
          date_administered: string
          dog_id: string
          dog_name: string
          id: string
          next_dose_date: string | null
          notes: string | null
          product_name: string
          product_type: string
          veterinarian: string | null
          weight_at_time: number | null
        }
        Insert: {
          created_at?: string
          date_administered?: string
          dog_id: string
          dog_name: string
          id?: string
          next_dose_date?: string | null
          notes?: string | null
          product_name: string
          product_type?: string
          veterinarian?: string | null
          weight_at_time?: number | null
        }
        Update: {
          created_at?: string
          date_administered?: string
          dog_id?: string
          dog_name?: string
          id?: string
          next_dose_date?: string | null
          notes?: string | null
          product_name?: string
          product_type?: string
          veterinarian?: string | null
          weight_at_time?: number | null
        }
        Relationships: []
      }
      dog_temperament: {
        Row: {
          aggression_level: number
          anxiety_level: number
          behavioral_alerts: string | null
          created_at: string
          dog_id: string
          dog_name: string
          energy_level: number
          general_notes: string | null
          id: string
          last_evaluation_date: string | null
          noise_sensitivity: number
          prey_drive: number
          sociability_dogs: number
          sociability_people: number
          trainability: number
          updated_at: string
        }
        Insert: {
          aggression_level?: number
          anxiety_level?: number
          behavioral_alerts?: string | null
          created_at?: string
          dog_id: string
          dog_name: string
          energy_level?: number
          general_notes?: string | null
          id?: string
          last_evaluation_date?: string | null
          noise_sensitivity?: number
          prey_drive?: number
          sociability_dogs?: number
          sociability_people?: number
          trainability?: number
          updated_at?: string
        }
        Update: {
          aggression_level?: number
          anxiety_level?: number
          behavioral_alerts?: string | null
          created_at?: string
          dog_id?: string
          dog_name?: string
          energy_level?: number
          general_notes?: string | null
          id?: string
          last_evaluation_date?: string | null
          noise_sensitivity?: number
          prey_drive?: number
          sociability_dogs?: number
          sociability_people?: number
          trainability?: number
          updated_at?: string
        }
        Relationships: []
      }
      dogs: {
        Row: {
          behavior_notes: string | null
          birth_date: string | null
          breed: string
          color: string | null
          created_at: string
          customer_id: string
          gender: string
          id: string
          is_neutered: boolean
          is_aggressive: boolean
          has_allergies: boolean
          on_medication: boolean
          medical_notes: string | null
          microchip_number: string | null
          name: string
          notes: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          behavior_notes?: string | null
          birth_date?: string | null
          breed: string
          color?: string | null
          created_at?: string
          customer_id: string
          gender?: string
          id?: string
          is_neutered?: boolean
          is_aggressive?: boolean
          has_allergies?: boolean
          on_medication?: boolean
          medical_notes?: string | null
          microchip_number?: string | null
          name: string
          notes?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          behavior_notes?: string | null
          birth_date?: string | null
          breed?: string
          color?: string | null
          created_at?: string
          customer_id?: string
          gender?: string
          id?: string
          is_neutered?: boolean
          is_aggressive?: boolean
          has_allergies?: boolean
          on_medication?: boolean
          medical_notes?: string | null
          microchip_number?: string | null
          name?: string
          notes?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dogs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_units: {
        Row: {
          assigned_dog_id: string | null
          assigned_dog_name: string | null
          assignment_end: string | null
          assignment_start: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          position_index: number
          status: string
          unit_type: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          assigned_dog_id?: string | null
          assigned_dog_name?: string | null
          assignment_end?: string | null
          assignment_start?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          position_index?: number
          status?: string
          unit_type?: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          assigned_dog_id?: string | null
          assigned_dog_name?: string | null
          assignment_end?: string | null
          assignment_start?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          position_index?: number
          status?: string
          unit_type?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_units_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "facility_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_zones: {
        Row: {
          capacity: number
          color: string
          created_at: string
          height: number
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          width: number
          x: number
          y: number
          zone_type: string
        }
        Insert: {
          capacity?: number
          color?: string
          created_at?: string
          height?: number
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          width?: number
          x?: number
          y?: number
          zone_type?: string
        }
        Update: {
          capacity?: number
          color?: string
          created_at?: string
          height?: number
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          width?: number
          x?: number
          y?: number
          zone_type?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string
          discount: number
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          reservation_id: string | null
          status: string
          ls_order_id: string | null
          ls_payment_id: string | null
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          discount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
          ls_order_id?: string | null
          ls_payment_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          discount?: number
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
          ls_order_id?: string | null
          ls_payment_id?: string | null
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      medical_conditions: {
        Row: {
          condition_name: string
          condition_type: string
          created_at: string
          diagnosed_date: string | null
          dog_id: string
          dog_name: string
          id: string
          notes: string | null
          resolved_date: string | null
          severity: string
          status: string
          treatment: string | null
          updated_at: string
        }
        Insert: {
          condition_name: string
          condition_type?: string
          created_at?: string
          diagnosed_date?: string | null
          dog_id: string
          dog_name: string
          id?: string
          notes?: string | null
          resolved_date?: string | null
          severity?: string
          status?: string
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          condition_name?: string
          condition_type?: string
          created_at?: string
          diagnosed_date?: string | null
          dog_id?: string
          dog_name?: string
          id?: string
          notes?: string | null
          resolved_date?: string | null
          severity?: string
          status?: string
          treatment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      medical_history: {
        Row: {
          blood_pressure: string | null
          body_condition_score: number | null
          created_at: string
          diagnosis: string | null
          dog_id: string
          dog_name: string
          heart_rate: number | null
          id: string
          next_appointment: string | null
          notes: string | null
          prescription: string | null
          reason: string | null
          record_date: string
          record_type: string
          respiratory_rate: number | null
          temperature: number | null
          treatment: string | null
          updated_at: string
          veterinarian: string | null
          weight: number | null
        }
        Insert: {
          blood_pressure?: string | null
          body_condition_score?: number | null
          created_at?: string
          diagnosis?: string | null
          dog_id: string
          dog_name: string
          heart_rate?: number | null
          id?: string
          next_appointment?: string | null
          notes?: string | null
          prescription?: string | null
          reason?: string | null
          record_date?: string
          record_type?: string
          respiratory_rate?: number | null
          temperature?: number | null
          treatment?: string | null
          updated_at?: string
          veterinarian?: string | null
          weight?: number | null
        }
        Update: {
          blood_pressure?: string | null
          body_condition_score?: number | null
          created_at?: string
          diagnosis?: string | null
          dog_id?: string
          dog_name?: string
          heart_rate?: number | null
          id?: string
          next_appointment?: string | null
          notes?: string | null
          prescription?: string | null
          reason?: string | null
          record_date?: string
          record_type?: string
          respiratory_rate?: number | null
          temperature?: number | null
          treatment?: string | null
          updated_at?: string
          veterinarian?: string | null
          weight?: number | null
        }
        Relationships: []
      }
      notices: {
        Row: {
          auto_generated: boolean
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          is_dismissed: boolean
          is_read: boolean
          message: string
          severity: string
          suggested_actions: Json
          title: string
        }
        Insert: {
          auto_generated?: boolean
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message: string
          severity?: string
          suggested_actions?: Json
          title: string
        }
        Update: {
          auto_generated?: boolean
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          is_dismissed?: boolean
          is_read?: boolean
          message?: string
          severity?: string
          suggested_actions?: Json
          title?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          name: string
          notes: string | null
          price: number
          purchase_date: string
          remaining_credits: number
          service_type: string
          status: string
          ls_order_id: string | null
          ls_variant_id: string | null
          total_credits: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          name: string
          notes?: string | null
          price?: number
          purchase_date?: string
          remaining_credits?: number
          service_type?: string
          status?: string
          ls_order_id?: string | null
          ls_variant_id?: string | null
          total_credits?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          name?: string
          notes?: string | null
          price?: number
          purchase_date?: string
          remaining_credits?: number
          service_type?: string
          status?: string
          ls_order_id?: string | null
          ls_variant_id?: string | null
          total_credits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id: string
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_cards: {
        Row: {
          appetite: number
          areas_to_improve: string | null
          created_at: string
          dog_id: string
          dog_name: string
          energy_level: number
          highlights: string | null
          id: string
          is_sent: boolean
          notes: string | null
          obedience: number
          overall_score: number
          photos: string[] | null
          sent_at: string | null
          service_type: string
          session_date: string
          socialization: number
          trainer_id: string | null
          updated_at: string
        }
        Insert: {
          appetite?: number
          areas_to_improve?: string | null
          created_at?: string
          dog_id: string
          dog_name: string
          energy_level?: number
          highlights?: string | null
          id?: string
          is_sent?: boolean
          notes?: string | null
          obedience?: number
          overall_score?: number
          photos?: string[] | null
          sent_at?: string | null
          service_type?: string
          session_date?: string
          socialization?: number
          trainer_id?: string | null
          updated_at?: string
        }
        Update: {
          appetite?: number
          areas_to_improve?: string | null
          created_at?: string
          dog_id?: string
          dog_name?: string
          energy_level?: number
          highlights?: string | null
          id?: string
          is_sent?: boolean
          notes?: string | null
          obedience?: number
          overall_score?: number
          photos?: string[] | null
          sent_at?: string | null
          service_type?: string
          session_date?: string
          socialization?: number
          trainer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_cards_trainer_id_fkey"
            columns: ["trainer_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          customer_id: string
          dog_id: string
          end_date: string
          id: string
          location_id: string | null
          notes: string | null
          rejection_reason: string | null
          service_name: string
          service_type: string
          staff_id: string | null
          start_date: string
          status: string
          total_price: number
          updated_at: string
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          customer_id: string
          dog_id: string
          end_date: string
          id?: string
          location_id?: string | null
          notes?: string | null
          rejection_reason?: string | null
          service_name?: string
          service_type?: string
          staff_id?: string | null
          start_date: string
          status?: string
          total_price?: number
          updated_at?: string
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          customer_id?: string
          dog_id?: string
          end_date?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          rejection_reason?: string | null
          service_name?: string
          service_type?: string
          staff_id?: string | null
          start_date?: string
          status?: string
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          phone: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          phone?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          phone?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vaccination_schedule: {
        Row: {
          batch_number: string | null
          created_at: string
          date_administered: string
          dog_id: string
          dog_name: string
          id: string
          next_dose_date: string | null
          notes: string | null
          status: string
          vaccine_name: string
          vaccine_type: string
          veterinarian: string | null
        }
        Insert: {
          batch_number?: string | null
          created_at?: string
          date_administered?: string
          dog_id: string
          dog_name: string
          id?: string
          next_dose_date?: string | null
          notes?: string | null
          status?: string
          vaccine_name: string
          vaccine_type?: string
          veterinarian?: string | null
        }
        Update: {
          batch_number?: string | null
          created_at?: string
          date_administered?: string
          dog_id?: string
          dog_name?: string
          id?: string
          next_dose_date?: string | null
          notes?: string | null
          status?: string
          vaccine_name?: string
          vaccine_type?: string
          veterinarian?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_expiring_packages: { Args: never; Returns: undefined }
      check_overdue_invoices: { Args: never; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "front_desk" | "trainer" | "manager"
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
  public: {
    Enums: {
      app_role: ["admin", "front_desk", "trainer", "manager"],
    },
  },
} as const
