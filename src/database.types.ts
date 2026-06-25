// Supabase の public スキーマから自動生成した型(DB契約の単一ソース)。
// アプリ(001)とエンジン(002)が同じDBを共有するため、手書き型のドリフトを防ぐ目的で導入。
//
// 再生成方法(どちらか):
//   - Supabase CLI: `supabase gen types typescript --project-id fivuugemqpcpmjaqllpj > src/database.types.ts`
//   - Supabase MCP の generate_typescript_types
// スキーマ(migration)を変更したら必ず再生成すること。
//
// このファイルは手で編集しない。

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
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_id: string
          builder_id: string
          created_at: string
          id: string
          metadata: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id: string
          builder_id: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string
          builder_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_builder_id_fkey"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "builders"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      article_parts: {
        Row: {
          article_id: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          material_id: string | null
          sort_order: number
        }
        Insert: {
          article_id: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          material_id?: string | null
          sort_order?: number
        }
        Update: {
          article_id?: string
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          material_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "article_parts_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_parts_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          category: string
          created_at: string
          generated_by: string
          id: string
          intro: string
          media_type: number | null
          published_at: string
          source_account: string | null
          source_tags: string[]
          source_url: string | null
          thumbnail_url: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          generated_by?: string
          id?: string
          intro?: string
          media_type?: number | null
          published_at?: string
          source_account?: string | null
          source_tags?: string[]
          source_url?: string | null
          thumbnail_url?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          generated_by?: string
          id?: string
          intro?: string
          media_type?: number | null
          published_at?: string
          source_account?: string | null
          source_tags?: string[]
          source_url?: string | null
          thumbnail_url?: string
          title?: string
        }
        Relationships: []
      }
      builder_staff: {
        Row: {
          builder_id: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          role: string
          user_id: string | null
        }
        Insert: {
          builder_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          role?: string
          user_id?: string | null
        }
        Update: {
          builder_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "builder_staff_builder_id_fkey"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "builders"
            referencedColumns: ["id"]
          },
        ]
      }
      builders: {
        Row: {
          capital: string | null
          catchcopy: string | null
          company_name: string
          construction_area: string[] | null
          construction_records: string | null
          contact_phone: string | null
          created_at: string | null
          description: string | null
          employee_count: string | null
          establishment: string | null
          homepage_url: string | null
          id: string
          instagram_handle: string | null
          is_active: boolean | null
          location: string | null
          logo_url: string | null
          main_image_url: string | null
          monthly_fee: number | null
          price_per_tsubo_range: string | null
          spec_floors: string[] | null
          spec_hobby: string[] | null
          spec_lifestyle: string[] | null
          spec_materials: string[] | null
          spec_performance: string[] | null
          spec_price_range: string[] | null
          spec_support: string[] | null
          spec_taste: string[] | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          supported_methods: string[] | null
          suumo_url: string | null
          trial_ends_at: string | null
          warranty_period: string | null
        }
        Insert: {
          capital?: string | null
          catchcopy?: string | null
          company_name: string
          construction_area?: string[] | null
          construction_records?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          employee_count?: string | null
          establishment?: string | null
          homepage_url?: string | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean | null
          location?: string | null
          logo_url?: string | null
          main_image_url?: string | null
          monthly_fee?: number | null
          price_per_tsubo_range?: string | null
          spec_floors?: string[] | null
          spec_hobby?: string[] | null
          spec_lifestyle?: string[] | null
          spec_materials?: string[] | null
          spec_performance?: string[] | null
          spec_price_range?: string[] | null
          spec_support?: string[] | null
          spec_taste?: string[] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          supported_methods?: string[] | null
          suumo_url?: string | null
          trial_ends_at?: string | null
          warranty_period?: string | null
        }
        Update: {
          capital?: string | null
          catchcopy?: string | null
          company_name?: string
          construction_area?: string[] | null
          construction_records?: string | null
          contact_phone?: string | null
          created_at?: string | null
          description?: string | null
          employee_count?: string | null
          establishment?: string | null
          homepage_url?: string | null
          id?: string
          instagram_handle?: string | null
          is_active?: boolean | null
          location?: string | null
          logo_url?: string | null
          main_image_url?: string | null
          monthly_fee?: number | null
          price_per_tsubo_range?: string | null
          spec_floors?: string[] | null
          spec_hobby?: string[] | null
          spec_lifestyle?: string[] | null
          spec_materials?: string[] | null
          spec_performance?: string[] | null
          spec_price_range?: string[] | null
          spec_support?: string[] | null
          spec_taste?: string[] | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          supported_methods?: string[] | null
          suumo_url?: string | null
          trial_ends_at?: string | null
          warranty_period?: string | null
        }
        Relationships: []
      }
      client_builder_matches: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          builder_id: string | null
          client_id: string | null
          id: string
          matched_at: string | null
          property_id: string | null
          status: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          builder_id?: string | null
          client_id?: string | null
          id?: string
          matched_at?: string | null
          property_id?: string | null
          status?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          builder_id?: string | null
          client_id?: string | null
          id?: string
          matched_at?: string | null
          property_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_builder_matches_builder_id_fkey"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "builders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_builder_matches_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      client_diagnoses: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          ceiling_height_cm: number | null
          client_id: string | null
          created_at: string | null
          current_issue: string | null
          id: string
          kitchen_height_cm: number | null
          post_stay_notes: string | null
          preferred_area: string | null
          preferred_floor_area_sqm: number | null
          priority_performance: boolean | null
          requirements_seen_at: string | null
          updated_at: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          ceiling_height_cm?: number | null
          client_id?: string | null
          created_at?: string | null
          current_issue?: string | null
          id?: string
          kitchen_height_cm?: number | null
          post_stay_notes?: string | null
          preferred_area?: string | null
          preferred_floor_area_sqm?: number | null
          priority_performance?: boolean | null
          requirements_seen_at?: string | null
          updated_at?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          ceiling_height_cm?: number | null
          client_id?: string | null
          created_at?: string | null
          current_issue?: string | null
          id?: string
          kitchen_height_cm?: number | null
          post_stay_notes?: string | null
          preferred_area?: string | null
          preferred_floor_area_sqm?: number | null
          priority_performance?: boolean | null
          requirements_seen_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_kartes: {
        Row: {
          created_at: string
          current_stage: number
          id: string
          match_id: string
          signed_at: string | null
          staff_id: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_stage?: number
          id?: string
          match_id: string
          signed_at?: string | null
          staff_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_stage?: number
          id?: string
          match_id?: string
          signed_at?: string | null
          staff_id?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_kartes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "client_builder_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_kartes_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "builder_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          created_at: string | null
          id: string
          match_id: string | null
          notes: string | null
          proposed_by: string | null
          proposed_date: string | null
          proposed_notes: string | null
          scheduled_at: string | null
          staff_id: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          notes?: string | null
          proposed_by?: string | null
          proposed_date?: string | null
          proposed_notes?: string | null
          scheduled_at?: string | null
          staff_id?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          notes?: string | null
          proposed_by?: string | null
          proposed_date?: string | null
          proposed_notes?: string | null
          scheduled_at?: string | null
          staff_id?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "client_builder_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "builder_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          match_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "client_builder_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_scraps: {
        Row: {
          article_category: string | null
          article_id: string | null
          article_title: string
          bullet_text: string
          created_at: string | null
          id: string
          is_hidden: boolean | null
          section_title: string
          source_account: string | null
          source_url: string
          thumbnail_url: string | null
          user_id: string
        }
        Insert: {
          article_category?: string | null
          article_id?: string | null
          article_title: string
          bullet_text: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          section_title: string
          source_account?: string | null
          source_url: string
          thumbnail_url?: string | null
          user_id: string
        }
        Update: {
          article_category?: string | null
          article_id?: string | null
          article_title?: string
          bullet_text?: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          section_title?: string
          source_account?: string | null
          source_url?: string
          thumbnail_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_scraps_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          article_id: string | null
          brand: string
          caption: string
          category: string
          confidence: number
          created_at: string
          id: string
          image_url: string
          model_number: string
          product_name: string
        }
        Insert: {
          article_id?: string | null
          brand: string
          caption?: string
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          image_url?: string
          model_number?: string
          product_name: string
        }
        Update: {
          article_id?: string | null
          brand?: string
          caption?: string
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          image_url?: string
          model_number?: string
          product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_minutes: {
        Row: {
          ai_summary: string | null
          audio_url: string | null
          client_signed_at: string | null
          consultation_id: string
          created_at: string
          id: string
          pdf_url: string | null
          recorded_by: string | null
          recording_status: string
          transcript: string | null
          updated_at: string
        }
        Insert: {
          ai_summary?: string | null
          audio_url?: string | null
          client_signed_at?: string | null
          consultation_id: string
          created_at?: string
          id?: string
          pdf_url?: string | null
          recorded_by?: string | null
          recording_status?: string
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          ai_summary?: string | null
          audio_url?: string | null
          client_signed_at?: string | null
          consultation_id?: string
          created_at?: string
          id?: string
          pdf_url?: string | null
          recorded_by?: string | null
          recording_status?: string
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message_type: string | null
          metadata: Json | null
          sender_id: string | null
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          sender_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string | null
          metadata?: Json | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          company_progress: Json | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          is_system_admin: boolean
          phone: string | null
          profile: Json | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          company_progress?: Json | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          is_system_admin?: boolean
          phone?: string | null
          profile?: Json | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          company_progress?: Json | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          is_system_admin?: boolean
          phone?: string | null
          profile?: Json | null
          role?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          address: string
          area_sqm: number | null
          bathrooms: number | null
          bedrooms: number | null
          booking_url: string | null
          builder_id: string | null
          c_value: number | null
          catchcopy: string | null
          city: string
          construction_method: string | null
          created_at: string | null
          description: string | null
          id: string
          images: string[] | null
          instagram_url: string | null
          max_guests: number | null
          prefecture: string
          price_per_tsubo: number | null
          property_name: string
          property_type: string
          spec_floors: string[] | null
          spec_hobby: string[] | null
          spec_lifestyle: string[] | null
          spec_materials: string[] | null
          spec_performance: string[] | null
          spec_taste: string[] | null
          status: string | null
          stay_available: boolean | null
          ua_value: number | null
        }
        Insert: {
          address: string
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          booking_url?: string | null
          builder_id?: string | null
          c_value?: number | null
          catchcopy?: string | null
          city: string
          construction_method?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          instagram_url?: string | null
          max_guests?: number | null
          prefecture: string
          price_per_tsubo?: number | null
          property_name: string
          property_type?: string
          spec_floors?: string[] | null
          spec_hobby?: string[] | null
          spec_lifestyle?: string[] | null
          spec_materials?: string[] | null
          spec_performance?: string[] | null
          spec_taste?: string[] | null
          status?: string | null
          stay_available?: boolean | null
          ua_value?: number | null
        }
        Update: {
          address?: string
          area_sqm?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          booking_url?: string | null
          builder_id?: string | null
          c_value?: number | null
          catchcopy?: string | null
          city?: string
          construction_method?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          instagram_url?: string | null
          max_guests?: number | null
          prefecture?: string
          price_per_tsubo?: number | null
          property_name?: string
          property_type?: string
          spec_floors?: string[] | null
          spec_hobby?: string[] | null
          spec_lifestyle?: string[] | null
          spec_materials?: string[] | null
          spec_performance?: string[] | null
          spec_taste?: string[] | null
          status?: string | null
          stay_available?: boolean | null
          ua_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_builder_id_fkey"
            columns: ["builder_id"]
            isOneToOne: false
            referencedRelation: "builders"
            referencedColumns: ["id"]
          },
        ]
      }
      requirement_decisions: {
        Row: {
          client_id: string
          element_key: string
          id: string
          status: string
          updated_at: string
          value: string | null
        }
        Insert: {
          client_id: string
          element_key: string
          id?: string
          status?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          client_id?: string
          element_key?: string
          id?: string
          status?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      scraping_rules: {
        Row: {
          created_at: string | null
          id: string
          ignore_keywords: string[] | null
          is_active: boolean | null
          media_types: number[] | null
          min_comments: number | null
          min_likes: number | null
          name: string
          require_keywords: string[] | null
          target_type: string
          target_value: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ignore_keywords?: string[] | null
          is_active?: boolean | null
          media_types?: number[] | null
          min_comments?: number | null
          min_likes?: number | null
          name: string
          require_keywords?: string[] | null
          target_type: string
          target_value: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ignore_keywords?: string[] | null
          is_active?: boolean | null
          media_types?: number[] | null
          min_comments?: number | null
          min_likes?: number | null
          name?: string
          require_keywords?: string[] | null
          target_type?: string
          target_value?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      scraps: {
        Row: {
          brand: string
          caption: string
          category: string
          id: string
          image_url: string
          model_number: string
          product_name: string
          saved_at: string
          status: string
          trend_item_id: string
          user_id: string
        }
        Insert: {
          brand?: string
          caption?: string
          category?: string
          id?: string
          image_url?: string
          model_number?: string
          product_name?: string
          saved_at?: string
          status?: string
          trend_item_id: string
          user_id: string
        }
        Update: {
          brand?: string
          caption?: string
          category?: string
          id?: string
          image_url?: string
          model_number?: string
          product_name?: string
          saved_at?: string
          status?: string
          trend_item_id?: string
          user_id?: string
        }
        Relationships: []
      }
      upload_scraps: {
        Row: {
          ai_summary: string | null
          ai_tags: Json
          id: string
          image_url: string
          intent_point: string | null
          intent_tags: Json
          saved_at: string
          source: string
          status: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          ai_tags?: Json
          id?: string
          image_url?: string
          intent_point?: string | null
          intent_tags?: Json
          saved_at?: string
          source?: string
          status?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          ai_tags?: Json
          id?: string
          image_url?: string
          intent_point?: string | null
          intent_tags?: Json
          saved_at?: string
          source?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          area: string
          created_at: string
          email: string
          id: string
          name: string
          source: string | null
          timeline: string
        }
        Insert: {
          area: string
          created_at?: string
          email: string
          id?: string
          name: string
          source?: string | null
          timeline: string
        }
        Update: {
          area?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          source?: string | null
          timeline?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_consultation: { Args: { cons_id: string }; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
