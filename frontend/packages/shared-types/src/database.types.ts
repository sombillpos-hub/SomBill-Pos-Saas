/**
 * Canonical Supabase PostgreSQL 16 TypeScript definitions for `public` schema
 * (migrations 20261121000001_core_schema.sql .. 20261122000008_super_admin.sql).
 *
 * Format matches `supabase gen types typescript --project-id <ref> --schema public`.
 * Refresh against live staging at any time via `npm run supabase:golive` or:
 *   npx supabase gen types typescript --project-id <ref> --schema public > frontend/packages/shared-types/src/database.types.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string;
          id: number;
          new_data: Json | null;
          old_data: Json | null;
          reason: string | null;
          restaurant_id: string;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          reason?: string | null;
          restaurant_id: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          new_data?: Json | null;
          old_data?: Json | null;
          reason?: string | null;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_logs_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      audit_reviews: {
        Row: {
          event_key: string;
          note: string | null;
          organization_id: string;
          reviewed_at: string;
          reviewed_by: string | null;
          status: string;
        };
        Insert: {
          event_key: string;
          note?: string | null;
          organization_id: string;
          reviewed_at?: string;
          reviewed_by?: string | null;
          status: string;
        };
        Update: {
          event_key?: string;
          note?: string | null;
          organization_id?: string;
          reviewed_at?: string;
          reviewed_by?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'audit_reviews_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      cash_movements: {
        Row: {
          amount: number;
          created_at: string;
          created_by: string | null;
          id: string;
          movement_type: string;
          reason: string;
          restaurant_id: string;
          shift_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          movement_type: string;
          reason: string;
          restaurant_id: string;
          shift_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          movement_type?: string;
          reason?: string;
          restaurant_id?: string;
          shift_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'cash_movements_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'cash_movements_shift_id_fkey';
            columns: ['shift_id'];
            isOneToOne: false;
            referencedRelation: 'cashier_shifts';
            referencedColumns: ['id'];
          },
        ];
      };
      cashier_shifts: {
        Row: {
          cash_difference: number | null;
          cashier_id: string;
          closed_at: string | null;
          closed_by: string | null;
          closing_notes: string | null;
          counted_cash: number | null;
          expected_cash: number | null;
          id: string;
          opened_at: string;
          opening_cash: number;
          opening_notes: string | null;
          restaurant_id: string;
          status: string;
          summary: Json | null;
        };
        Insert: {
          cash_difference?: number | null;
          cashier_id: string;
          closed_at?: string | null;
          closed_by?: string | null;
          closing_notes?: string | null;
          counted_cash?: number | null;
          expected_cash?: number | null;
          id?: string;
          opened_at?: string;
          opening_cash: number;
          opening_notes?: string | null;
          restaurant_id: string;
          status?: string;
          summary?: Json | null;
        };
        Update: {
          cash_difference?: number | null;
          cashier_id?: string;
          closed_at?: string | null;
          closed_by?: string | null;
          closing_notes?: string | null;
          counted_cash?: number | null;
          expected_cash?: number | null;
          id?: string;
          opened_at?: string;
          opening_cash?: number;
          opening_notes?: string | null;
          restaurant_id?: string;
          status?: string;
          summary?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cashier_shifts_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          archived_at: string | null;
          created_at: string;
          description: string | null;
          display_order: number;
          id: string;
          image_url: string | null;
          is_active: boolean;
          name: string;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name: string;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          description?: string | null;
          display_order?: number;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          name?: string;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          address: string | null;
          archived_at: string | null;
          created_at: string;
          email: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          archived_at?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          approved_at: string | null;
          approved_by: string | null;
          archived_at: string | null;
          attachment_path: string | null;
          category: string;
          created_at: string;
          created_by: string | null;
          description: string;
          expense_date: string;
          id: string;
          payment_method: Database['public']['Enums']['payment_method'];
          reference_number: string | null;
          rejection_reason: string | null;
          restaurant_id: string;
          status: Database['public']['Enums']['expense_status'];
          supplier_id: string | null;
          updated_at: string;
        };
        Insert: {
          amount: number;
          approved_at?: string | null;
          approved_by?: string | null;
          archived_at?: string | null;
          attachment_path?: string | null;
          category: string;
          created_at?: string;
          created_by?: string | null;
          description: string;
          expense_date?: string;
          id?: string;
          payment_method?: Database['public']['Enums']['payment_method'];
          reference_number?: string | null;
          rejection_reason?: string | null;
          restaurant_id: string;
          status?: Database['public']['Enums']['expense_status'];
          supplier_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          approved_at?: string | null;
          approved_by?: string | null;
          archived_at?: string | null;
          attachment_path?: string | null;
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          expense_date?: string;
          id?: string;
          payment_method?: Database['public']['Enums']['payment_method'];
          reference_number?: string | null;
          rejection_reason?: string | null;
          restaurant_id?: string;
          status?: Database['public']['Enums']['expense_status'];
          supplier_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_items: {
        Row: {
          archived_at: string | null;
          category: string | null;
          created_at: string;
          expiry_date: string | null;
          id: string;
          location: string | null;
          min_stock: number;
          name: string;
          quantity: number;
          restaurant_id: string;
          sku: string | null;
          supplier_id: string | null;
          unit: string;
          unit_cost: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          category?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          location?: string | null;
          min_stock?: number;
          name: string;
          quantity?: number;
          restaurant_id: string;
          sku?: string | null;
          supplier_id?: string | null;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          category?: string | null;
          created_at?: string;
          expiry_date?: string | null;
          id?: string;
          location?: string | null;
          min_stock?: number;
          name?: string;
          quantity?: number;
          restaurant_id?: string;
          sku?: string | null;
          supplier_id?: string | null;
          unit?: string;
          unit_cost?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_items_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_items_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          order_id: string | null;
          read_at: string | null;
          restaurant_id: string;
          table_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          read_at?: string | null;
          restaurant_id: string;
          table_id?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string | null;
          read_at?: string | null;
          restaurant_id?: string;
          table_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'notifications_table_id_fkey';
            columns: ['table_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_tables';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_voided: boolean;
          line_total: number;
          notes: string | null;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          restaurant_id: string;
          tax_exempt: boolean;
          unit_cost: number | null;
          unit_price: number;
          updated_at: string;
          void_reason: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_voided?: boolean;
          line_total?: never;
          notes?: string | null;
          order_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          restaurant_id: string;
          tax_exempt?: boolean;
          unit_cost?: number | null;
          unit_price: number;
          updated_at?: string;
          void_reason?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_voided?: boolean;
          line_total?: never;
          notes?: string | null;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          restaurant_id?: string;
          tax_exempt?: boolean;
          unit_cost?: number | null;
          unit_price?: number;
          updated_at?: string;
          void_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          amount_paid: number;
          amount_refunded: number;
          bill_acknowledged_at: string | null;
          bill_acknowledged_by: string | null;
          bill_requested_at: string | null;
          bill_requested_by: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          cashier_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          discount_amount: number;
          guest_count: number | null;
          id: string;
          notes: string | null;
          order_number: number;
          order_type: Database['public']['Enums']['order_type'];
          payment_status: Database['public']['Enums']['payment_status'];
          restaurant_id: string;
          status: Database['public']['Enums']['order_status'];
          stock_deducted_at: string | null;
          stock_reversed_at: string | null;
          subtotal: number;
          table_id: string | null;
          tax_amount: number;
          tax_inclusive: boolean;
          tax_rate: number;
          total: number;
          updated_at: string;
          waiter_id: string | null;
        };
        Insert: {
          amount_paid?: number;
          amount_refunded?: number;
          bill_acknowledged_at?: string | null;
          bill_acknowledged_by?: string | null;
          bill_requested_at?: string | null;
          bill_requested_by?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cashier_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          discount_amount?: number;
          guest_count?: number | null;
          id?: string;
          notes?: string | null;
          order_number?: number;
          order_type?: Database['public']['Enums']['order_type'];
          payment_status?: Database['public']['Enums']['payment_status'];
          restaurant_id: string;
          status?: Database['public']['Enums']['order_status'];
          stock_deducted_at?: string | null;
          stock_reversed_at?: string | null;
          subtotal?: number;
          table_id?: string | null;
          tax_amount?: number;
          tax_inclusive?: boolean;
          tax_rate?: number;
          total?: number;
          updated_at?: string;
          waiter_id?: string | null;
        };
        Update: {
          amount_paid?: number;
          amount_refunded?: number;
          bill_acknowledged_at?: string | null;
          bill_acknowledged_by?: string | null;
          bill_requested_at?: string | null;
          bill_requested_by?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          cashier_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          discount_amount?: number;
          guest_count?: number | null;
          id?: string;
          notes?: string | null;
          order_number?: number;
          order_type?: Database['public']['Enums']['order_type'];
          payment_status?: Database['public']['Enums']['payment_status'];
          restaurant_id?: string;
          status?: Database['public']['Enums']['order_status'];
          stock_deducted_at?: string | null;
          stock_reversed_at?: string | null;
          subtotal?: number;
          table_id?: string | null;
          tax_amount?: number;
          tax_inclusive?: boolean;
          tax_rate?: number;
          total?: number;
          updated_at?: string;
          waiter_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'orders_table_id_fkey';
            columns: ['table_id'];
            isOneToOne: false;
            referencedRelation: 'restaurant_tables';
            referencedColumns: ['id'];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: string;
          status: Database['public']['Enums']['member_status'];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role?: string;
          status?: Database['public']['Enums']['member_status'];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: string;
          status?: Database['public']['Enums']['member_status'];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'organization_members_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          license_expires_at: string | null;
          license_status: string;
          max_branches: number;
          max_staff: number;
          name: string;
          plan: string;
          settings: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          license_expires_at?: string | null;
          license_status?: string;
          max_branches?: number;
          max_staff?: number;
          name: string;
          plan?: string;
          settings?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          license_expires_at?: string | null;
          license_status?: string;
          max_branches?: number;
          max_staff?: number;
          name?: string;
          plan?: string;
          settings?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          idempotency_key: string;
          order_id: string;
          restaurant_id: string;
          result: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          idempotency_key: string;
          order_id: string;
          restaurant_id: string;
          result: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          idempotency_key?: string;
          order_id?: string;
          restaurant_id?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'payment_requests_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payment_requests_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          amount_received: number | null;
          cashier_id: string | null;
          change_given: number | null;
          created_at: string;
          id: string;
          kind: string;
          method: Database['public']['Enums']['payment_method'];
          notes: string | null;
          order_id: string;
          reference: string | null;
          refund_of: string | null;
          request_key: string | null;
          restaurant_id: string;
          shift_id: string | null;
          status: string;
          transaction_number: number | null;
          verification_note: string | null;
          verification_status: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          amount: number;
          amount_received?: number | null;
          cashier_id?: string | null;
          change_given?: number | null;
          created_at?: string;
          id?: string;
          kind?: string;
          method: Database['public']['Enums']['payment_method'];
          notes?: string | null;
          order_id: string;
          reference?: string | null;
          refund_of?: string | null;
          request_key?: string | null;
          restaurant_id: string;
          shift_id?: string | null;
          status?: string;
          transaction_number?: number | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          amount?: number;
          amount_received?: number | null;
          cashier_id?: string | null;
          change_given?: number | null;
          created_at?: string;
          id?: string;
          kind?: string;
          method?: Database['public']['Enums']['payment_method'];
          notes?: string | null;
          order_id?: string;
          reference?: string | null;
          refund_of?: string | null;
          request_key?: string | null;
          restaurant_id?: string;
          shift_id?: string | null;
          status?: string;
          transaction_number?: number | null;
          verification_note?: string | null;
          verification_status?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_refund_of_fkey';
            columns: ['refund_of'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_shift_id_fkey';
            columns: ['shift_id'];
            isOneToOne: false;
            referencedRelation: 'cashier_shifts';
            referencedColumns: ['id'];
          },
        ];
      };
      pos_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          idempotency_key: string;
          kind: string;
          order_id: string;
          restaurant_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          idempotency_key: string;
          kind: string;
          order_id: string;
          restaurant_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          idempotency_key?: string;
          kind?: string;
          order_id?: string;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'pos_requests_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pos_requests_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      product_recipe_items: {
        Row: {
          created_at: string;
          id: string;
          inventory_item_id: string;
          product_id: string;
          quantity: number;
          restaurant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inventory_item_id: string;
          product_id: string;
          quantity: number;
          restaurant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          inventory_item_id?: string;
          product_id?: string;
          quantity?: number;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'product_recipe_items_inventory_item_id_fkey';
            columns: ['inventory_item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_recipe_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_recipe_items_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          archived_at: string | null;
          barcode: string | null;
          category_id: string | null;
          cost_price: number | null;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          inventory_item_id: string | null;
          is_available: boolean;
          name: string;
          preparation_station: string;
          price: number;
          restaurant_id: string;
          sku: string | null;
          tax_category: string;
          track_stock: boolean;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          barcode?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          inventory_item_id?: string | null;
          is_available?: boolean;
          name: string;
          preparation_station?: string;
          price: number;
          restaurant_id: string;
          sku?: string | null;
          tax_category?: string;
          track_stock?: boolean;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          barcode?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          inventory_item_id?: string | null;
          is_available?: boolean;
          name?: string;
          preparation_station?: string;
          price?: number;
          restaurant_id?: string;
          sku?: string | null;
          tax_category?: string;
          track_stock?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_inventory_item_id_fkey';
            columns: ['inventory_item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'products_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          last_login_at: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id: string;
          last_login_at?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          last_login_at?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_order_items: {
        Row: {
          created_at: string;
          id: string;
          inventory_item_id: string;
          line_total: number;
          purchase_order_id: string;
          quantity_ordered: number;
          quantity_received: number;
          restaurant_id: string;
          unit_cost: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inventory_item_id: string;
          line_total?: never;
          purchase_order_id: string;
          quantity_ordered: number;
          quantity_received?: number;
          restaurant_id: string;
          unit_cost: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          inventory_item_id?: string;
          line_total?: never;
          purchase_order_id?: string;
          quantity_ordered?: number;
          quantity_received?: number;
          restaurant_id?: string;
          unit_cost?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_order_items_inventory_item_id_fkey';
            columns: ['inventory_item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_order_items_purchase_order_id_fkey';
            columns: ['purchase_order_id'];
            isOneToOne: false;
            referencedRelation: 'purchase_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_order_items_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      purchase_order_receipts: {
        Row: {
          created_at: string;
          id: string;
          idempotency_key: string;
          lines: Json;
          purchase_order_id: string;
          received_by: string | null;
          restaurant_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          idempotency_key: string;
          lines: Json;
          purchase_order_id: string;
          received_by?: string | null;
          restaurant_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          idempotency_key?: string;
          lines?: Json;
          purchase_order_id?: string;
          received_by?: string | null;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_order_receipts_purchase_order_id_fkey';
            columns: ['purchase_order_id'];
            isOneToOne: false;
            referencedRelation: 'purchase_orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_order_receipts_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      purchase_orders: {
        Row: {
          amount_paid: number;
          created_at: string;
          created_by: string | null;
          expected_date: string | null;
          id: string;
          notes: string | null;
          ordered_at: string | null;
          po_number: number;
          received_at: string | null;
          restaurant_id: string;
          status: Database['public']['Enums']['po_status'];
          subtotal: number;
          supplier_id: string;
          total: number;
          updated_at: string;
        };
        Insert: {
          amount_paid?: number;
          created_at?: string;
          created_by?: string | null;
          expected_date?: string | null;
          id?: string;
          notes?: string | null;
          ordered_at?: string | null;
          po_number?: number;
          received_at?: string | null;
          restaurant_id: string;
          status?: Database['public']['Enums']['po_status'];
          subtotal?: number;
          supplier_id: string;
          total?: number;
          updated_at?: string;
        };
        Update: {
          amount_paid?: number;
          created_at?: string;
          created_by?: string | null;
          expected_date?: string | null;
          id?: string;
          notes?: string | null;
          ordered_at?: string | null;
          po_number?: number;
          received_at?: string | null;
          restaurant_id?: string;
          status?: Database['public']['Enums']['po_status'];
          subtotal?: number;
          supplier_id?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_orders_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_orders_supplier_id_fkey';
            columns: ['supplier_id'];
            isOneToOne: false;
            referencedRelation: 'suppliers';
            referencedColumns: ['id'];
          },
        ];
      };
      receipts: {
        Row: {
          id: string;
          issued_at: string;
          issued_by: string | null;
          last_printed_at: string | null;
          last_printed_by: string | null;
          order_id: string;
          print_count: number;
          receipt_number: number;
          restaurant_id: string;
        };
        Insert: {
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          last_printed_at?: string | null;
          last_printed_by?: string | null;
          order_id: string;
          print_count?: number;
          receipt_number: number;
          restaurant_id: string;
        };
        Update: {
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          last_printed_at?: string | null;
          last_printed_by?: string | null;
          order_id?: string;
          print_count?: number;
          receipt_number?: number;
          restaurant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'receipts_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: true;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'receipts_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      refunds: {
        Row: {
          amount: number;
          approved_by: string | null;
          created_at: string;
          decided_at: string | null;
          decision_note: string | null;
          id: string;
          idempotency_key: string | null;
          items: Json;
          method: Database['public']['Enums']['payment_method'];
          order_id: string;
          payment_id: string | null;
          reason: string;
          reference: string | null;
          refund_payment_id: string | null;
          requested_by: string | null;
          restaurant_id: string;
          restock: boolean;
          shift_id: string | null;
          status: string;
        };
        Insert: {
          amount: number;
          approved_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          idempotency_key?: string | null;
          items?: Json;
          method: Database['public']['Enums']['payment_method'];
          order_id: string;
          payment_id?: string | null;
          reason: string;
          reference?: string | null;
          refund_payment_id?: string | null;
          requested_by?: string | null;
          restaurant_id: string;
          restock?: boolean;
          shift_id?: string | null;
          status?: string;
        };
        Update: {
          amount?: number;
          approved_by?: string | null;
          created_at?: string;
          decided_at?: string | null;
          decision_note?: string | null;
          id?: string;
          idempotency_key?: string | null;
          items?: Json;
          method?: Database['public']['Enums']['payment_method'];
          order_id?: string;
          payment_id?: string | null;
          reason?: string;
          reference?: string | null;
          refund_payment_id?: string | null;
          requested_by?: string | null;
          restaurant_id?: string;
          restock?: boolean;
          shift_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'refunds_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_payment_id_fkey';
            columns: ['payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_refund_payment_id_fkey';
            columns: ['refund_payment_id'];
            isOneToOne: false;
            referencedRelation: 'payments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'refunds_shift_id_fkey';
            columns: ['shift_id'];
            isOneToOne: false;
            referencedRelation: 'cashier_shifts';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_members: {
        Row: {
          created_at: string;
          id: string;
          restaurant_id: string;
          role: Database['public']['Enums']['app_role'];
          status: Database['public']['Enums']['member_status'];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          restaurant_id: string;
          role: Database['public']['Enums']['app_role'];
          status?: Database['public']['Enums']['member_status'];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          restaurant_id?: string;
          role?: Database['public']['Enums']['app_role'];
          status?: Database['public']['Enums']['member_status'];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_members_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurant_tables: {
        Row: {
          archived_at: string | null;
          capacity: number;
          created_at: string;
          floor: string;
          id: string;
          name: string | null;
          needs_cleaning: boolean;
          pos_x: number;
          pos_y: number;
          restaurant_id: string;
          section: string;
          shape: string;
          table_number: number;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          capacity?: number;
          created_at?: string;
          floor?: string;
          id?: string;
          name?: string | null;
          needs_cleaning?: boolean;
          pos_x?: number;
          pos_y?: number;
          restaurant_id: string;
          section?: string;
          shape?: string;
          table_number: number;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          capacity?: number;
          created_at?: string;
          floor?: string;
          id?: string;
          name?: string | null;
          needs_cleaning?: boolean;
          pos_x?: number;
          pos_y?: number;
          restaurant_id?: string;
          section?: string;
          shape?: string;
          table_number?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_tables_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      restaurants: {
        Row: {
          address: string | null;
          created_at: string;
          currency: string;
          email: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          order_seq: number;
          organization_id: string | null;
          phone: string | null;
          po_seq: number;
          receipt_footer: string | null;
          receipt_header: string | null;
          receipt_seq: number;
          settings: Json;
          tax_inclusive: boolean;
          tax_label: string;
          tax_rate: number;
          timezone: string;
          txn_seq: number;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          order_seq?: number;
          organization_id?: string | null;
          phone?: string | null;
          po_seq?: number;
          receipt_footer?: string | null;
          receipt_header?: string | null;
          receipt_seq?: number;
          settings?: Json;
          tax_inclusive?: boolean;
          tax_label?: string;
          tax_rate?: number;
          timezone?: string;
          txn_seq?: number;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          created_at?: string;
          currency?: string;
          email?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          order_seq?: number;
          organization_id?: string | null;
          phone?: string | null;
          po_seq?: number;
          receipt_footer?: string | null;
          receipt_header?: string | null;
          receipt_seq?: number;
          settings?: Json;
          tax_inclusive?: boolean;
          tax_label?: string;
          tax_rate?: number;
          timezone?: string;
          txn_seq?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'restaurants_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_shifts: {
        Row: {
          ended_at: string | null;
          id: string;
          restaurant_id: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          restaurant_id: string;
          started_at?: string;
          user_id: string;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          restaurant_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_shifts_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      stock_movements: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: number;
          inventory_item_id: string;
          movement_type: Database['public']['Enums']['stock_movement_type'];
          quantity_after: number;
          quantity_change: number;
          reason: string | null;
          reference_id: string | null;
          reference_type: string | null;
          restaurant_id: string;
          unit_cost: number | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          inventory_item_id: string;
          movement_type: Database['public']['Enums']['stock_movement_type'];
          quantity_after: number;
          quantity_change: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          restaurant_id: string;
          unit_cost?: number | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: never;
          inventory_item_id?: string;
          movement_type?: Database['public']['Enums']['stock_movement_type'];
          quantity_after?: number;
          quantity_change?: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          restaurant_id?: string;
          unit_cost?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'stock_movements_inventory_item_id_fkey';
            columns: ['inventory_item_id'];
            isOneToOne: false;
            referencedRelation: 'inventory_items';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'stock_movements_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      suppliers: {
        Row: {
          address: string | null;
          archived_at: string | null;
          contact_person: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          phone: string | null;
          restaurant_id: string;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          phone?: string | null;
          restaurant_id: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          archived_at?: string | null;
          contact_person?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          restaurant_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'suppliers_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
      tax_filings: {
        Row: {
          currency: string;
          filed_at: string;
          filed_by: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          period_from: string;
          period_to: string;
          reference: string | null;
          restaurant_id: string;
          tax_collected: number;
        };
        Insert: {
          currency: string;
          filed_at?: string;
          filed_by?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          period_from: string;
          period_to: string;
          reference?: string | null;
          restaurant_id: string;
          tax_collected: number;
        };
        Update: {
          currency?: string;
          filed_at?: string;
          filed_by?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          period_from?: string;
          period_to?: string;
          reference?: string | null;
          restaurant_id?: string;
          tax_collected?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'tax_filings_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tax_filings_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      table_status_v: {
        Row: {
          archived_at: string | null;
          balance: number | null;
          capacity: number | null;
          floor: string | null;
          id: string | null;
          name: string | null;
          needs_cleaning: boolean | null;
          order_id: string | null;
          order_number: number | null;
          order_started_at: string | null;
          order_total: number | null;
          pos_x: number | null;
          pos_y: number | null;
          restaurant_id: string | null;
          section: string | null;
          shape: string | null;
          status: string | null;
          table_number: number | null;
          waiter_id: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      acknowledge_bill_request: {
        Args: { p_order: string };
        Returns: undefined;
      };
      add_cash_movement: {
        Args: {
          p_amount: number;
          p_reason: string;
          p_shift: string;
          p_type: string;
        };
        Returns: string;
      };
      add_order_items: {
        Args: {
          p_idempotency_key: string;
          p_items: Json;
          p_order: string;
        };
        Returns: Json;
      };
      adjust_stock: {
        Args: {
          p_item: string;
          p_quantity: number;
          p_reason: string;
          p_type: Database['public']['Enums']['stock_movement_type'];
          p_unit_cost?: number | null;
        };
        Returns: number;
      };
      apply_discount: {
        Args: {
          p_amount: number;
          p_order: string;
          p_reason: string;
        };
        Returns: Json;
      };
      can_act_on_order: {
        Args: {
          p_restaurant: string;
          p_waiter: string | null;
        };
        Returns: boolean;
      };
      cancel_bill_request: {
        Args: { p_order: string };
        Returns: undefined;
      };
      cancel_order: {
        Args: {
          p_order: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      cashier_shift_summary: {
        Args: { p_shift: string };
        Returns: Json;
      };
      close_cashier_shift: {
        Args: {
          p_counted_cash: number;
          p_notes?: string | null;
          p_shift: string;
        };
        Returns: Json;
      };
      close_paid_order: {
        Args: { p_order: string };
        Returns: string;
      };
      create_organization: {
        Args: { p_name: string };
        Returns: string;
      };
      create_restaurant: {
        Args: {
          p_currency?: string;
          p_name: string;
          p_timezone?: string;
        };
        Returns: string;
      };
      decide_refund: {
        Args: {
          p_approve: boolean;
          p_note?: string | null;
          p_refund: string;
        };
        Returns: Json;
      };
      end_shift: {
        Args: { p_restaurant: string };
        Returns: undefined;
      };
      has_permission: {
        Args: {
          p_key: string;
          p_restaurant: string;
        };
        Returns: boolean;
      };
      has_role: {
        Args: {
          p_restaurant: string;
          p_roles: Database['public']['Enums']['app_role'][];
        };
        Returns: boolean;
      };
      is_manager: {
        Args: { p_restaurant: string };
        Returns: boolean;
      };
      is_member: {
        Args: { p_restaurant: string };
        Returns: boolean;
      };
      is_mobile_money: {
        Args: { m: Database['public']['Enums']['payment_method'] };
        Returns: boolean;
      };
      is_org_owner: {
        Args: { p_org: string };
        Returns: boolean;
      };
      is_owner_of_restaurant: {
        Args: { p_restaurant: string };
        Returns: boolean;
      };
      issue_receipt: {
        Args: { p_order: string };
        Returns: Json;
      };
      mark_receipt_printed: {
        Args: { p_receipt: string };
        Returns: number;
      };
      member_role: {
        Args: { p_restaurant: string };
        Returns: Database['public']['Enums']['app_role'] | null;
      };
      open_cashier_shift: {
        Args: {
          p_notes?: string | null;
          p_opening_cash: number;
          p_restaurant: string;
        };
        Returns: string;
      };
      open_cashier_shift_id: {
        Args: {
          p_restaurant: string;
          p_user: string;
        };
        Returns: string | null;
      };
      order_status_rank: {
        Args: { s: Database['public']['Enums']['order_status'] };
        Returns: number;
      };
      org_apply_branch_defaults: {
        Args: {
          p_fields: Json;
          p_org: string;
          p_targets: string[];
        };
        Returns: number;
      };
      org_branch_summary: {
        Args: {
          p_from: string;
          p_org: string;
          p_to: string;
        };
        Returns: {
          address: string | null;
          cancelled_count: number;
          collected: number;
          currency: string;
          discounts: number;
          gross: number;
          guests: number;
          last_order_at: string | null;
          name: string;
          net: number;
          open_cashier_shifts: number;
          open_orders: number;
          orders_count: number;
          phone: string | null;
          refunded: number;
          restaurant_id: string;
          staff_active: number;
          staff_on_duty: number;
          tables_occupied: number;
          tables_total: number;
          tax: number;
          tax_rate: number;
          timezone: string;
        }[];
      };
      org_broadcast: {
        Args: {
          p_body?: string | null;
          p_branch?: string | null;
          p_org: string;
          p_roles?: Database['public']['Enums']['app_role'][] | null;
          p_title: string;
        };
        Returns: number;
      };
      org_create_branch: {
        Args: {
          p_address?: string | null;
          p_currency?: string;
          p_name: string;
          p_org: string;
          p_phone?: string | null;
          p_tax_rate?: number;
          p_timezone?: string;
        };
        Returns: string;
      };
      org_inventory_summary: {
        Args: { p_org: string };
        Returns: {
          items: number;
          low_stock: number;
          open_po_value: number;
          open_purchase_orders: number;
          out_of_stock: number;
          restaurant_id: string;
          stock_value: number;
        }[];
      };
      org_low_stock: {
        Args: {
          p_limit?: number;
          p_org: string;
        };
        Returns: {
          item_id: string;
          min_stock: number;
          name: string;
          quantity: number;
          restaurant_id: string;
          unit: string;
        }[];
      };
      org_menu_matrix: {
        Args: { p_org: string };
        Returns: {
          category: string | null;
          is_available: boolean;
          name: string;
          price: number;
          product_id: string;
          restaurant_id: string;
        }[];
      };
      org_payment_mix: {
        Args: {
          p_from: string;
          p_org: string;
          p_to: string;
        };
        Returns: {
          amount: number;
          kind: string;
          method: string;
          restaurant_id: string;
          status: string;
          txns: number;
          verification_status: string;
        }[];
      };
      org_push_menu_item: {
        Args: {
          p_available?: boolean | null;
          p_category?: string | null;
          p_create_missing?: boolean;
          p_name: string;
          p_org: string;
          p_price?: number | null;
          p_targets: string[];
        };
        Returns: Json;
      };
      org_record_tax_filing: {
        Args: {
          p_from: string;
          p_notes?: string | null;
          p_org: string;
          p_reference?: string | null;
          p_restaurant: string;
          p_to: string;
        };
        Returns: string;
      };
      org_revenue_series: {
        Args: {
          p_bucket?: string;
          p_from: string;
          p_org: string;
          p_to: string;
        };
        Returns: {
          bucket: string;
          gross: number;
          orders: number;
          restaurant_id: string;
        }[];
      };
      org_tax_due: {
        Args: {
          p_from: string;
          p_org: string;
          p_to: string;
        };
        Returns: {
          currency: string;
          filed_at: string | null;
          filing_id: string | null;
          filing_reference: string | null;
          orders_count: number;
          restaurant_id: string;
          tax_collected: number;
          tax_label: string;
          tax_rate: number;
          taxable_sales: number;
        }[];
      };
      org_update_settings: {
        Args: {
          p_fx_rates: Json;
          p_name: string;
          p_org: string;
          p_reporting_currency: string;
        };
        Returns: undefined;
      };
      process_refund: {
        Args: {
          p_amount: number;
          p_idempotency_key?: string | null;
          p_items?: Json;
          p_method: Database['public']['Enums']['payment_method'];
          p_payment: string;
          p_reason: string;
          p_reference?: string | null;
          p_restock?: boolean;
        };
        Returns: Json;
      };
      receive_purchase_order: {
        Args: {
          p_idempotency_key: string;
          p_lines: Json;
          p_po: string;
        };
        Returns: Json;
      };
      record_payments: {
        Args: {
          p_close_order?: boolean;
          p_idempotency_key: string;
          p_order: string;
          p_payments: Json;
        };
        Returns: Json;
      };
      refund_order: {
        Args: {
          p_amount: number;
          p_method: Database['public']['Enums']['payment_method'];
          p_order: string;
          p_reason: string;
          p_restock?: boolean;
        };
        Returns: string;
      };
      request_bill: {
        Args: { p_order: string };
        Returns: undefined;
      };
      restaurant_flag: {
        Args: {
          p_default: boolean;
          p_key: string;
          p_restaurant: string;
          p_section: string;
        };
        Returns: boolean;
      };
      restaurant_number: {
        Args: {
          p_default: number;
          p_key: string;
          p_restaurant: string;
          p_section: string;
        };
        Returns: number;
      };
      review_expense: {
        Args: {
          p_approve: boolean;
          p_expense: string;
          p_reason?: string | null;
        };
        Returns: undefined;
      };
      sales_summary: {
        Args: {
          p_from: string;
          p_restaurant: string;
          p_to: string;
        };
        Returns: Json;
      };
      shares_restaurant_with: {
        Args: { p_user: string };
        Returns: boolean;
      };
      start_shift: {
        Args: { p_restaurant: string };
        Returns: string;
      };
      storage_restaurant_id: {
        Args: { p_name: string };
        Returns: string | null;
      };
      submit_pos_order: {
        Args: {
          p_customer?: string | null;
          p_discount?: number;
          p_discount_reason?: string | null;
          p_guest_count?: number | null;
          p_idempotency_key?: string | null;
          p_items: Json;
          p_notes?: string | null;
          p_order_type: Database['public']['Enums']['order_type'];
          p_restaurant: string;
          p_table?: string | null;
        };
        Returns: Json;
      };
      submit_waiter_order: {
        Args: {
          p_customer?: string | null;
          p_guest_count?: number | null;
          p_idempotency_key?: string | null;
          p_items: Json;
          p_notes?: string | null;
          p_restaurant: string;
          p_table: string;
        };
        Returns: Json;
      };
      place_qr_table_order: {
        Args: {
          p_guest_name?: string | null;
          p_items: Json;
          p_notes?: string | null;
          p_table_id: string;
        };
        Returns: Json;
      };
      call_table_waiter: {
        Args: {
          p_reason?: string | null;
          p_table_id: string;
        };
        Returns: Json;
      };
      merge_table_orders: {
        Args: {
          p_primary_table: string;
          p_secondary_tables: string[];
        };
        Returns: Json;
      };
      unmerge_table_orders: {
        Args: {
          p_primary_table: string;
        };
        Returns: Json;
      };
      transfer_table_order: {
        Args: {
          p_order: string;
          p_to_table: string;
        };
        Returns: Json;
      };
      void_order_item: {
        Args: {
          p_item: string;
          p_reason: string;
        };
        Returns: Json;
      };
      split_order_by_items: {
        Args: {
          p_items: Json;
          p_order: string;
          p_split_label?: string | null;
        };
        Returns: Json;
      };
      touch_last_login: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      transfer_stock: {
        Args: {
          p_from: string;
          p_quantity: number;
          p_reason: string;
          p_to: string;
        };
        Returns: undefined;
      };
      verify_payment: {
        Args: {
          p_approve: boolean;
          p_close_order?: boolean;
          p_note?: string | null;
          p_payment: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      app_role: 'manager' | 'cashier' | 'waiter' | 'kitchen';
      expense_status: 'pending' | 'approved' | 'rejected';
      member_status: 'active' | 'suspended';
      order_status: 'new' | 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';
      order_type: 'dine_in' | 'takeaway' | 'delivery';
      payment_method:
        'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'credit' | 'other' | 'evc_plus' | 'zaad' | 'somtel_money';
      payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded';
      po_status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
      stock_movement_type:
        'opening' | 'receive' | 'adjustment' | 'wastage' | 'transfer_in' | 'transfer_out' | 'sale' | 'sale_reversal';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views']) | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends (PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends (PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;
