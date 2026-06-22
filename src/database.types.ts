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
        Relationships: []
      }
      app_settings: {
        Row: { key: string; updated_at: string; value: Json }
        Insert: { key: string; updated_at?: string; value: Json }
        Update: { key?: string; updated_at?: string; value?: Json }
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
        Relationships: []
      }
      articles: {
        Row: {
          category: string
          created_at: string
          generated_by: string
          id: string
          intro: string
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
          published_at?: string
          source_account?: string | null
          source_tags?: string[]
          source_url?: string | null
          thumbnail_url?: string
          title?: string
        }
        Relationships: []
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
          updated_at?: string | null
        }
        Relationships: []
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
        Relationships: []
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
    }
    Views: { [_ in never]: never }
    Functions: {
      can_access_consultation: { Args: { cons_id: string }; Returns: boolean }
      is_system_admin: { Args: never; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
