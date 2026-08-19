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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          phone?: string | null
          state?: string | null
          timezone?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profile_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: string
          created_at: string
          description: string
          id: string
          message_template: string
          name: string
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean
          last_name: string
          ls_customer_id: string | null
          notes: string | null
          organization_id: string | null
          phone: string
          state: string | null
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
          is_active?: boolean
          last_name: string
          ls_customer_id?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string
          state?: string | null
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
          is_active?: boolean
          last_name?: string
          ls_customer_id?: string | null
          notes?: string | null
          organization_id?: string | null
          phone?: string
          state?: string | null
          updated_at?: string
          user_id?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          product_name?: string
          product_type?: string
          veterinarian?: string | null
          weight_at_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deworming_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_allergies: {
        Row: {
          allergen: string
          created_at: string
          dog_id: string
          id: string
          organization_id: string
          reaction: string | null
          severity: string | null
          type: string
          updated_at: string
        }
        Insert: {
          allergen: string
          created_at?: string
          dog_id: string
          id?: string
          organization_id: string
          reaction?: string | null
          severity?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          allergen?: string
          created_at?: string
          dog_id?: string
          id?: string
          organization_id?: string
          reaction?: string | null
          severity?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_allergies_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dog_allergies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dog_medications: {
        Row: {
          created_at: string
          dog_id: string
          dose: string | null
          duration_days: number | null
          end_date: string | null
          frequency: string | null
          id: string
          name: string
          organization_id: string
          route: string | null
          start_date: string | null
          updated_at: string
          with_food: boolean
        }
        Insert: {
          created_at?: string
          dog_id: string
          dose?: string | null
          duration_days?: number | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name: string
          organization_id: string
          route?: string | null
          start_date?: string | null
          updated_at?: string
          with_food?: boolean
        }
        Update: {
          created_at?: string
          dog_id?: string
          dose?: string | null
          duration_days?: number | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name?: string
          organization_id?: string
          route?: string | null
          start_date?: string | null
          updated_at?: string
          with_food?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "dog_medications_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dog_medications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          prey_drive?: number
          sociability_dogs?: number
          sociability_people?: number
          trainability?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dog_temperament_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dogs: {
        Row: {
          aggression_details: Json | null
          behavior_notes: string | null
          birth_date: string | null
          breed: string
          color: string | null
          created_at: string
          customer_id: string
          feeding: Json | null
          gender: string
          has_allergies: boolean
          id: string
          is_active: boolean
          is_aggressive: boolean
          is_neutered: boolean
          medical_notes: string | null
          microchip_number: string | null
          name: string
          notes: string | null
          on_medication: boolean
          organization_id: string | null
          photo_url: string | null
          preferred_unit_id: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          aggression_details?: Json | null
          behavior_notes?: string | null
          birth_date?: string | null
          breed: string
          color?: string | null
          created_at?: string
          customer_id: string
          feeding?: Json | null
          gender?: string
          has_allergies?: boolean
          id?: string
          is_active?: boolean
          is_aggressive?: boolean
          is_neutered?: boolean
          medical_notes?: string | null
          microchip_number?: string | null
          name: string
          notes?: string | null
          on_medication?: boolean
          organization_id?: string | null
          photo_url?: string | null
          preferred_unit_id?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          aggression_details?: Json | null
          behavior_notes?: string | null
          birth_date?: string | null
          breed?: string
          color?: string | null
          created_at?: string
          customer_id?: string
          feeding?: Json | null
          gender?: string
          has_allergies?: boolean
          id?: string
          is_active?: boolean
          is_aggressive?: boolean
          is_neutered?: boolean
          medical_notes?: string | null
          microchip_number?: string | null
          name?: string
          notes?: string | null
          on_medication?: boolean
          organization_id?: string | null
          photo_url?: string | null
          preferred_unit_id?: string | null
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
          {
            foreignKeyName: "dogs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dogs_preferred_unit_id_fkey"
            columns: ["preferred_unit_id"]
            isOneToOne: false
            referencedRelation: "facility_units"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_units: {
        Row: {
          assigned_dog_id: string | null
          assigned_dog_name: string | null
          assigned_reservation_id: string | null
          assignment_end: string | null
          assignment_start: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          position_index: number
          status: string
          unit_type: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          assigned_dog_id?: string | null
          assigned_dog_name?: string | null
          assigned_reservation_id?: string | null
          assignment_end?: string | null
          assignment_start?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          position_index?: number
          status?: string
          unit_type?: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          assigned_dog_id?: string | null
          assigned_dog_name?: string | null
          assigned_reservation_id?: string | null
          assignment_end?: string | null
          assignment_start?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          position_index?: number
          status?: string
          unit_type?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_units_assigned_reservation_id_fkey"
            columns: ["assigned_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          sort_order?: number
          updated_at?: string
          width?: number
          x?: number
          y?: number
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_zones_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          organization_id: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          organization_id?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "invoice_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          ls_order_id: string | null
          ls_payment_id: string | null
          notes: string | null
          organization_id: string | null
          paid_at: string | null
          payment_method: string | null
          reservation_id: string | null
          status: string
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
          ls_order_id?: string | null
          ls_payment_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
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
          ls_order_id?: string | null
          ls_payment_id?: string | null
          notes?: string | null
          organization_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          status?: string
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
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          resolved_date?: string | null
          severity?: string
          status?: string
          treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "medical_conditions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "medical_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          severity?: string
          suggested_actions?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          closing_time: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          ls_customer_id: string | null
          ls_subscription_id: string | null
          name: string
          opening_time: string | null
          owner_id: string | null
          phone: string | null
          service_types: Json
          slug: string
          subscription_status: string
          timezone: string | null
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          closing_time?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          ls_customer_id?: string | null
          ls_subscription_id?: string | null
          name: string
          opening_time?: string | null
          owner_id?: string | null
          phone?: string | null
          service_types?: Json
          slug: string
          subscription_status?: string
          timezone?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          closing_time?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          ls_customer_id?: string | null
          ls_subscription_id?: string | null
          name?: string
          opening_time?: string | null
          owner_id?: string | null
          phone?: string | null
          service_types?: Json
          slug?: string
          subscription_status?: string
          timezone?: string | null
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      package_credit_log: {
        Row: {
          action: string
          created_at: string
          credits_after: number
          credits_before: number
          id: string
          organization_id: string
          package_id: string
          reason: string | null
          reservation_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          credits_after: number
          credits_before: number
          id?: string
          organization_id: string
          package_id: string
          reason?: string | null
          reservation_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          credits_after?: number
          credits_before?: number
          id?: string
          organization_id?: string
          package_id?: string
          reason?: string | null
          reservation_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "package_credit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_credit_log_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "package_credit_log_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      packages: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          ls_order_id: string | null
          ls_variant_id: string | null
          name: string
          notes: string | null
          organization_id: string | null
          price: number
          purchase_date: string
          remaining_credits: number
          service_type: string
          status: string
          total_credits: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          ls_order_id?: string | null
          ls_variant_id?: string | null
          name: string
          notes?: string | null
          organization_id?: string | null
          price?: number
          purchase_date?: string
          remaining_credits?: number
          service_type?: string
          status?: string
          total_credits?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          ls_order_id?: string | null
          ls_variant_id?: string | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          price?: number
          purchase_date?: string
          remaining_credits?: number
          service_type?: string
          status?: string
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
          {
            foreignKeyName: "packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhooks: {
        Row: {
          event_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          processed_at?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
        }
        Relationships: []
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
            foreignKeyName: "report_cards_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
            foreignKeyName: "reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "facility_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          phone: string | null
          profile_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          specialty: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          organization_id?: string | null
          phone?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          organization_id?: string | null
          phone?: string | null
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          specialty?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_staff_id: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          dog_id: string | null
          due_at: string | null
          id: string
          notes: string | null
          organization_id: string
          photos: string[] | null
          priority: string
          report_data: Json | null
          status: string
          title: string
          type: string
          updated_at: string
          zone_id: string | null
        }
        Insert: {
          assignee_staff_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          dog_id?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          photos?: string[] | null
          priority?: string
          report_data?: Json | null
          status?: string
          title: string
          type: string
          updated_at?: string
          zone_id?: string | null
        }
        Update: {
          assignee_staff_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          dog_id?: string | null
          due_at?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          photos?: string[] | null
          priority?: string
          report_data?: Json | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_staff_id_fkey"
            columns: ["assignee_staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_dog_id_fkey"
            columns: ["dog_id"]
            isOneToOne: false
            referencedRelation: "dogs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "facility_zones"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          status?: string
          vaccine_name?: string
          vaccine_type?: string
          veterinarian?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccination_schedule_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: Json }
      check_expiring_packages: { Args: never; Returns: undefined }
      check_expiring_packages_all_orgs: { Args: never; Returns: undefined }
      check_in_reservation: {
        Args: { p_notes?: string; p_reservation_id: string; p_unit_id: string }
        Returns: undefined
      }
      check_out_reservation: {
        Args: { p_reservation_id: string }
        Returns: undefined
      }
      check_overdue_invoices: { Args: never; Returns: undefined }
      check_overdue_invoices_all_orgs: { Args: never; Returns: undefined }
      complete_checkout: {
        Args: {
          p_notes?: string
          p_package_id?: string
          p_payment_method: string
          p_reservation_id: string
        }
        Returns: Json
      }
      create_organization: {
        Args: { p_name: string; p_slug: string }
        Returns: Json
      }
      create_reservation: {
        Args: {
          p_customer_id: string
          p_dog_id: string
          p_end: string
          p_notes?: string
          p_service_name: string
          p_service_type: string
          p_staff_id?: string
          p_start: string
          p_total_price: number
        }
        Returns: string
      }
      deduct_package_credit: {
        Args: { p_package_id: string; p_reason?: string }
        Returns: number
      }
      get_active_org_ids: { Args: never; Returns: string[] }
      get_admin_org_ids: { Args: never; Returns: string[] }
      get_clinical_writer_org_ids: { Args: never; Returns: string[] }
      get_finance_writer_org_ids: { Args: never; Returns: string[] }
      get_inactive_customer_ids: {
        Args: { p_days?: number; p_organization_id: string }
        Returns: string[]
      }
      get_invitation_by_token: { Args: { p_token: string }; Returns: Json }
      get_my_first_org_slug: { Args: never; Returns: string }
      get_my_staff_ids: { Args: never; Returns: string[] }
      get_onboarding_status: { Args: { p_org_id: string }; Returns: Json }
      get_reportcard_writer_org_ids: { Args: never; Returns: string[] }
      get_scheduler_org_ids: { Args: never; Returns: string[] }
      get_user_org_ids: { Args: never; Returns: string[] }
      is_org_admin: { Args: { p_org: string }; Returns: boolean }
      recompute_customer_balance: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      remove_demo_data: { Args: { p_org_id: string }; Returns: undefined }
      seed_demo_data: { Args: { p_org_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "front_desk" | "worker" | "manager"
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
    Enums: {
      app_role: ["admin", "front_desk", "worker", "manager"],
    },
  },
} as const

