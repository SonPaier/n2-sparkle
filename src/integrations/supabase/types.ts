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
      breaks: {
        Row: {
          break_date: string
          column_id: string
          created_at: string
          end_time: string
          id: string
          instance_id: string
          note: string | null
          start_time: string
        }
        Insert: {
          break_date: string
          column_id: string
          created_at?: string
          end_time: string
          id?: string
          instance_id: string
          note?: string | null
          start_time: string
        }
        Update: {
          break_date?: string
          column_id?: string
          created_at?: string
          end_time?: string
          id?: string
          instance_id?: string
          note?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "breaks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "calendar_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_columns: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          id: string
          instance_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          instance_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_columns_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_item_services: {
        Row: {
          calendar_item_id: string
          created_at: string
          custom_price: number | null
          id: string
          instance_id: string
          quantity: number
          service_id: string
        }
        Insert: {
          calendar_item_id: string
          created_at?: string
          custom_price?: number | null
          id?: string
          instance_id: string
          quantity?: number
          service_id: string
        }
        Update: {
          calendar_item_id?: string
          created_at?: string
          custom_price?: number | null
          id?: string
          instance_id?: string
          quantity?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_item_services_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_item_services_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_item_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "unified_services"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_items: {
        Row: {
          admin_notes: string | null
          assigned_employee_ids: string[] | null
          column_id: string | null
          created_at: string
          created_by: string | null
          customer_address_id: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          end_date: string | null
          end_time: string | null
          id: string
          instance_id: string
          item_date: string | null
          media_items: Json | null
          order_number: string | null
          payment_status: string | null
          photo_urls: Json | null
          price: number | null
          priority: number
          project_id: string | null
          stage_number: number | null
          start_time: string | null
          status: string
          title: string
          updated_at: string
          work_ended_at: string | null
          work_started_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          assigned_employee_ids?: string[] | null
          column_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_id?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          instance_id: string
          item_date?: string | null
          media_items?: Json | null
          order_number?: string | null
          payment_status?: string | null
          photo_urls?: Json | null
          price?: number | null
          priority?: number
          project_id?: string | null
          stage_number?: number | null
          start_time?: string | null
          status?: string
          title: string
          updated_at?: string
          work_ended_at?: string | null
          work_started_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          assigned_employee_ids?: string[] | null
          column_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_address_id?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          instance_id?: string
          item_date?: string | null
          media_items?: Json | null
          order_number?: string | null
          payment_status?: string | null
          photo_urls?: Json | null
          price?: number | null
          priority?: number
          project_id?: string | null
          stage_number?: number | null
          start_time?: string | null
          status?: string
          title?: string
          updated_at?: string
          work_ended_at?: string | null
          work_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "calendar_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string | null
          contact_person: string | null
          contact_phone: string | null
          contacts: Json | null
          country_code: string | null
          created_at: string
          customer_id: string
          id: string
          instance_id: string
          is_default: boolean | null
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          postal_code: string | null
          region: string | null
          sort_order: number | null
          street: string | null
          street_line2: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json | null
          country_code?: string | null
          created_at?: string
          customer_id: string
          id?: string
          instance_id: string
          is_default?: boolean | null
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          sort_order?: number | null
          street?: string | null
          street_line2?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          contacts?: Json | null
          country_code?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          instance_id?: string
          is_default?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          sort_order?: number | null
          street?: string | null
          street_line2?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          instance_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          instance_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_categories_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_category_assignments: {
        Row: {
          category_id: string
          created_at: string
          customer_id: string
          id: string
          instance_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          customer_id: string
          id?: string
          instance_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_category_assignments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "customer_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_category_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_category_assignments_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sms_notifications: {
        Row: {
          calendar_item_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string
          id: string
          instance_id: string
          months_after: number
          notification_template_id: string
          scheduled_date: string
          sent_at: string | null
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          calendar_item_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone: string
          id?: string
          instance_id: string
          months_after: number
          notification_template_id: string
          scheduled_date: string
          sent_at?: string | null
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          calendar_item_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          instance_id?: string
          months_after?: number
          notification_template_id?: string
          scheduled_date?: string
          sent_at?: string | null
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sms_notifications_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sms_notifications_notification_template_id_fkey"
            columns: ["notification_template_id"]
            isOneToOne: false
            referencedRelation: "sms_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          additional_contacts: Json | null
          address: string | null
          billing_city: string | null
          billing_country_code: string | null
          billing_postal_code: string | null
          billing_region: string | null
          billing_street: string | null
          billing_street_line2: string | null
          company: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          country_code: string | null
          created_at: string
          default_currency: string | null
          email: string | null
          id: string
          instance_id: string
          name: string
          nip: string | null
          notes: string | null
          phone: string | null
          sales_notes: string | null
          short_name: string | null
          source: string | null
          updated_at: string
          vat_eu_number: string | null
        }
        Insert: {
          additional_contacts?: Json | null
          address?: string | null
          billing_city?: string | null
          billing_country_code?: string | null
          billing_postal_code?: string | null
          billing_region?: string | null
          billing_street?: string | null
          billing_street_line2?: string | null
          company?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string | null
          email?: string | null
          id?: string
          instance_id: string
          name: string
          nip?: string | null
          notes?: string | null
          phone?: string | null
          sales_notes?: string | null
          short_name?: string | null
          source?: string | null
          updated_at?: string
          vat_eu_number?: string | null
        }
        Update: {
          additional_contacts?: Json | null
          address?: string | null
          billing_city?: string | null
          billing_country_code?: string | null
          billing_postal_code?: string | null
          billing_region?: string | null
          billing_street?: string | null
          billing_street_line2?: string | null
          company?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          country_code?: string | null
          created_at?: string
          default_currency?: string | null
          email?: string | null
          id?: string
          instance_id?: string
          name?: string
          nip?: string | null
          notes?: string | null
          phone?: string | null
          sales_notes?: string | null
          short_name?: string | null
          source?: string | null
          updated_at?: string
          vat_eu_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_user_settings: {
        Row: {
          created_at: string
          id: string
          instance_id: string
          updated_at: string
          user_id: string
          view_mode: string
          visible_sections: Json
        }
        Insert: {
          created_at?: string
          id?: string
          instance_id: string
          updated_at?: string
          user_id: string
          view_mode?: string
          visible_sections?: Json
        }
        Update: {
          created_at?: string
          id?: string
          instance_id?: string
          updated_at?: string
          user_id?: string
          view_mode?: string
          visible_sections?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_user_settings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_calendar_configs: {
        Row: {
          active: boolean
          allowed_actions: Json
          column_ids: string[]
          created_at: string
          id: string
          instance_id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
          visible_fields: Json
        }
        Insert: {
          active?: boolean
          allowed_actions?: Json
          column_ids?: string[]
          created_at?: string
          id?: string
          instance_id: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id: string
          visible_fields?: Json
        }
        Update: {
          active?: boolean
          allowed_actions?: Json
          column_ids?: string[]
          created_at?: string
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          visible_fields?: Json
        }
        Relationships: [
          {
            foreignKeyName: "employee_calendar_configs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_days_off: {
        Row: {
          created_at: string
          date_from: string
          date_to: string
          day_off_type: string
          employee_id: string
          id: string
          instance_id: string
        }
        Insert: {
          created_at?: string
          date_from: string
          date_to: string
          day_off_type?: string
          employee_id: string
          id?: string
          instance_id: string
        }
        Update: {
          created_at?: string
          date_from?: string
          date_to?: string
          day_off_type?: string
          employee_id?: string
          id?: string
          instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_days_off_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_days_off_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          instance_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          instance_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          instance_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_permissions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          active: boolean
          created_at: string
          hourly_rate: number | null
          id: string
          instance_id: string
          linked_user_id: string | null
          name: string
          photo_url: string | null
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          hourly_rate?: number | null
          id?: string
          instance_id: string
          linked_user_id?: string | null
          name: string
          photo_url?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          hourly_rate?: number | null
          id?: string
          instance_id?: string
          linked_user_id?: string | null
          name?: string
          photo_url?: string | null
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instance_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          instance_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          instance_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          instance_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "instance_features_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      instances: {
        Row: {
          active: boolean
          address: string | null
          address_city: string | null
          address_lat: number | null
          address_lng: number | null
          address_postal_code: string | null
          address_street: string | null
          bank_account_number: string | null
          bank_name: string | null
          blik_phone: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          protocol_email_template: string | null
          reservation_phone: string | null
          short_name: string | null
          slug: string
          updated_at: string
          website: string | null
          working_hours: Json | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          address_city?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_postal_code?: string | null
          address_street?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          blik_phone?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          protocol_email_template?: string | null
          reservation_phone?: string | null
          short_name?: string | null
          slug: string
          updated_at?: string
          website?: string | null
          working_hours?: Json | null
        }
        Update: {
          active?: boolean
          address?: string | null
          address_city?: string | null
          address_lat?: number | null
          address_lng?: number | null
          address_postal_code?: string | null
          address_street?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          blik_phone?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          protocol_email_template?: string | null
          reservation_phone?: string | null
          short_name?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
          working_hours?: Json | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          buyer_email: string | null
          buyer_name: string | null
          buyer_tax_no: string | null
          calendar_item_id: string | null
          created_at: string | null
          currency: string | null
          customer_id: string | null
          external_client_id: string | null
          external_invoice_id: string | null
          id: string
          instance_id: string
          invoice_number: string | null
          issue_date: string | null
          kind: string | null
          notes: string | null
          oid: string | null
          payment_to: string | null
          pdf_url: string | null
          positions: Json | null
          provider: string
          sell_date: string | null
          status: string | null
          total_gross: number | null
          updated_at: string | null
        }
        Insert: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_tax_no?: string | null
          calendar_item_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          external_client_id?: string | null
          external_invoice_id?: string | null
          id?: string
          instance_id: string
          invoice_number?: string | null
          issue_date?: string | null
          kind?: string | null
          notes?: string | null
          oid?: string | null
          payment_to?: string | null
          pdf_url?: string | null
          positions?: Json | null
          provider: string
          sell_date?: string | null
          status?: string | null
          total_gross?: number | null
          updated_at?: string | null
        }
        Update: {
          buyer_email?: string | null
          buyer_name?: string | null
          buyer_tax_no?: string | null
          calendar_item_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_id?: string | null
          external_client_id?: string | null
          external_invoice_id?: string | null
          id?: string
          instance_id?: string
          invoice_number?: string | null
          issue_date?: string | null
          kind?: string | null
          notes?: string | null
          oid?: string | null
          payment_to?: string | null
          pdf_url?: string | null
          positions?: Json | null
          provider?: string
          sell_date?: string | null
          status?: string | null
          total_gross?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      invoicing_settings: {
        Row: {
          active: boolean | null
          auto_send_email: boolean | null
          created_at: string | null
          default_currency: string | null
          default_document_kind: string | null
          default_payment_days: number | null
          default_vat_rate: number | null
          instance_id: string
          provider: string | null
          provider_config: Json | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          auto_send_email?: boolean | null
          created_at?: string | null
          default_currency?: string | null
          default_document_kind?: string | null
          default_payment_days?: number | null
          default_vat_rate?: number | null
          instance_id: string
          provider?: string | null
          provider_config?: Json | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          auto_send_email?: boolean | null
          created_at?: string | null
          default_currency?: string | null
          default_document_kind?: string | null
          default_payment_days?: number | null
          default_vat_rate?: number | null
          instance_id?: string
          provider?: string | null
          provider_config?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoicing_settings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          calendar_item_id: string | null
          created_at: string
          description: string | null
          id: string
          instance_id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          calendar_item_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          calendar_item_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          instance_id: string | null
          is_blocked: boolean
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          instance_id?: string | null
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          instance_id?: string | null
          is_blocked?: boolean
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          customer_address_id: string | null
          customer_id: string | null
          description: string | null
          id: string
          instance_id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_address_id?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          instance_id: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_address_id?: string | null
          customer_id?: string | null
          description?: string | null
          id?: string
          instance_id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      protocols: {
        Row: {
          calendar_item_id: string | null
          created_at: string
          created_by_user_id: string | null
          customer_address_id: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_nip: string | null
          customer_phone: string | null
          customer_signature: string | null
          id: string
          instance_id: string
          notes: string | null
          photo_urls: Json | null
          prepared_by: string | null
          protocol_date: string
          protocol_time: string | null
          protocol_type: string
          public_token: string
          status: string
          updated_at: string
        }
        Insert: {
          calendar_item_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_address_id?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_nip?: string | null
          customer_phone?: string | null
          customer_signature?: string | null
          id?: string
          instance_id: string
          notes?: string | null
          photo_urls?: Json | null
          prepared_by?: string | null
          protocol_date: string
          protocol_time?: string | null
          protocol_type?: string
          public_token?: string
          status?: string
          updated_at?: string
        }
        Update: {
          calendar_item_id?: string | null
          created_at?: string
          created_by_user_id?: string | null
          customer_address_id?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_nip?: string | null
          customer_phone?: string | null
          customer_signature?: string | null
          id?: string
          instance_id?: string
          notes?: string | null
          photo_urls?: Json | null
          prepared_by?: string | null
          protocol_date?: string
          protocol_time?: string | null
          protocol_type?: string
          public_token?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocols_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_customer_address_id_fkey"
            columns: ["customer_address_id"]
            isOneToOne: false
            referencedRelation: "customer_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocols_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          instance_id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth?: string
          created_at?: string
          endpoint: string
          id?: string
          instance_id: string
          p256dh?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          instance_id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_types: {
        Row: {
          active: boolean
          created_at: string
          id: string
          instance_id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          instance_id: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          instance_id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_types_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          assigned_employee_id: string | null
          assigned_user_id: string | null
          created_at: string
          customer_id: string | null
          days_before: number
          deadline: string
          id: string
          instance_id: string
          is_recurring: boolean
          name: string
          notes: string | null
          notification_sent: boolean
          notification_sent_at: string | null
          notify_customer_email: boolean
          notify_customer_sms: boolean
          notify_email: boolean
          notify_sms: boolean
          recurring_type: string | null
          recurring_value: number | null
          reminder_type_id: string | null
          status: string
          updated_at: string
          visible_for_employee: boolean
        }
        Insert: {
          assigned_employee_id?: string | null
          assigned_user_id?: string | null
          created_at?: string
          customer_id?: string | null
          days_before?: number
          deadline: string
          id?: string
          instance_id: string
          is_recurring?: boolean
          name: string
          notes?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          notify_customer_email?: boolean
          notify_customer_sms?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          recurring_type?: string | null
          recurring_value?: number | null
          reminder_type_id?: string | null
          status?: string
          updated_at?: string
          visible_for_employee?: boolean
        }
        Update: {
          assigned_employee_id?: string | null
          assigned_user_id?: string | null
          created_at?: string
          customer_id?: string | null
          days_before?: number
          deadline?: string
          id?: string
          instance_id?: string
          is_recurring?: boolean
          name?: string
          notes?: string | null
          notification_sent?: boolean
          notification_sent_at?: string | null
          notify_customer_email?: boolean
          notify_customer_sms?: boolean
          notify_email?: boolean
          notify_sms?: boolean
          recurring_type?: string | null
          recurring_value?: number | null
          reminder_type_id?: string | null
          status?: string
          updated_at?: string
          visible_for_employee?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_reminder_type_id_fkey"
            columns: ["reminder_type_id"]
            isOneToOne: false
            referencedRelation: "reminder_types"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          calendar_item_id: string | null
          created_at: string
          id: string
          instance_id: string
          message: string
          message_type: string
          phone: string
          sent_by: string | null
          status: string
        }
        Insert: {
          calendar_item_id?: string | null
          created_at?: string
          id?: string
          instance_id: string
          message: string
          message_type: string
          phone: string
          sent_by?: string | null
          status?: string
        }
        Update: {
          calendar_item_id?: string | null
          created_at?: string
          id?: string
          instance_id?: string
          message?: string
          message_type?: string
          phone?: string
          sent_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_calendar_item_id_fkey"
            columns: ["calendar_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_logs_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_notification_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          instance_id: string
          items: Json | null
          name: string
          sms_template: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          instance_id: string
          items?: Json | null
          name: string
          sms_template?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string
          items?: Json | null
          name?: string
          sms_template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_notification_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_payment_templates: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          instance_id: string
          sms_body: string
          template_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id: string
          sms_body?: string
          template_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id?: string
          sms_body?: string
          template_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_payment_templates_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string
          employee_id: string
          end_time: string | null
          entry_date: string
          entry_number: number
          entry_type: string
          id: string
          instance_id: string
          is_auto_closed: boolean
          start_time: string | null
          total_minutes: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          end_time?: string | null
          entry_date: string
          entry_number?: number
          entry_type?: string
          id?: string
          instance_id: string
          is_auto_closed?: boolean
          start_time?: string | null
          total_minutes?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          end_time?: string | null
          entry_date?: string
          entry_number?: number
          entry_type?: string
          id?: string
          instance_id?: string
          is_auto_closed?: boolean
          start_time?: string | null
          total_minutes?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entry_audit_log: {
        Row: {
          change_type: string
          changed_by: string | null
          created_at: string
          employee_id: string
          entry_date: string
          id: string
          instance_id: string
          new_end_time: string | null
          new_start_time: string | null
          new_total_minutes: number | null
          old_end_time: string | null
          old_start_time: string | null
          old_total_minutes: number | null
          time_entry_id: string | null
        }
        Insert: {
          change_type: string
          changed_by?: string | null
          created_at?: string
          employee_id: string
          entry_date: string
          id?: string
          instance_id: string
          new_end_time?: string | null
          new_start_time?: string | null
          new_total_minutes?: number | null
          old_end_time?: string | null
          old_start_time?: string | null
          old_total_minutes?: number | null
          time_entry_id?: string | null
        }
        Update: {
          change_type?: string
          changed_by?: string | null
          created_at?: string
          employee_id?: string
          entry_date?: string
          id?: string
          instance_id?: string
          new_end_time?: string | null
          new_start_time?: string | null
          new_total_minutes?: number | null
          old_end_time?: string | null
          old_start_time?: string | null
          old_total_minutes?: number | null
          time_entry_id?: string | null
        }
        Relationships: []
      }
      unified_categories: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          instance_id: string
          name: string
          prices_are_net: boolean
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instance_id: string
          name: string
          prices_are_net?: boolean
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          instance_id?: string
          name?: string
          prices_are_net?: boolean
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_categories_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      unified_services: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          instance_id: string
          is_popular: boolean
          metadata: Json | null
          name: string
          notification_template_id: string | null
          price: number | null
          prices_are_net: boolean
          short_name: string | null
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instance_id: string
          is_popular?: boolean
          metadata?: Json | null
          name: string
          notification_template_id?: string | null
          price?: number | null
          prices_are_net?: boolean
          short_name?: string | null
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          instance_id?: string
          is_popular?: boolean
          metadata?: Json | null
          name?: string
          notification_template_id?: string | null
          price?: number | null
          prices_are_net?: boolean
          short_name?: string | null
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unified_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "unified_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_services_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unified_services_notification_template_id_fkey"
            columns: ["notification_template_id"]
            isOneToOne: false
            referencedRelation: "sms_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          hall_id: string | null
          id: string
          instance_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          hall_id?: string | null
          id?: string
          instance_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          hall_id?: string | null
          id?: string
          instance_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
      workers_settings: {
        Row: {
          instance_id: string
          overtime_enabled: boolean
          report_frequency: string
          settlement_type: string
          standard_hours_per_day: number
          start_stop_enabled: boolean
          time_calculation_mode: string
          time_input_mode: string
        }
        Insert: {
          instance_id: string
          overtime_enabled?: boolean
          report_frequency?: string
          settlement_type?: string
          standard_hours_per_day?: number
          start_stop_enabled?: boolean
          time_calculation_mode?: string
          time_input_mode?: string
        }
        Update: {
          instance_id?: string
          overtime_enabled?: boolean
          report_frequency?: string
          settlement_type?: string
          standard_hours_per_day?: number
          start_stop_enabled?: boolean
          time_calculation_mode?: string
          time_input_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "workers_settings_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: true
            referencedRelation: "instances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_instance_admin_user_ids: {
        Args: { _instance_id: string }
        Returns: {
          user_id: string
        }[]
      }
      has_employee_permission: {
        Args: { _feature_key: string; _instance_id: string; _user_id: string }
        Returns: boolean
      }
      has_instance_role: {
        Args: {
          _instance_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_blocked: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "user" | "employee" | "hall" | "sales"
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
      app_role: ["super_admin", "admin", "user", "employee", "hall", "sales"],
    },
  },
} as const
