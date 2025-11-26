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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      anonymous_scans: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string
          last_scan_at: string | null
          scan_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address: string
          last_scan_at?: string | null
          scan_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string
          last_scan_at?: string | null
          scan_count?: number | null
        }
        Relationships: []
      }
      auto_alert_settings: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          id: string
          last_scan_at: string | null
          scan_frequency: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_scan_at?: string | null
          scan_frequency?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          last_scan_at?: string | null
          scan_frequency?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      beat_fingerprints: {
        Row: {
          album: string | null
          album_cover_url: string | null
          apple_music_id: string | null
          apple_music_url: string | null
          artist: string
          audio_duration_ms: number | null
          confidence_score: number | null
          created_at: string | null
          fingerprint_hash: string
          id: string
          isrc: string | null
          match_count: number | null
          mfcc_features: Json | null
          popularity: number | null
          preview_url: string | null
          release_date: string | null
          song_title: string
          source: string | null
          spotify_id: string | null
          spotify_url: string | null
          updated_at: string | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          album?: string | null
          album_cover_url?: string | null
          apple_music_id?: string | null
          apple_music_url?: string | null
          artist: string
          audio_duration_ms?: number | null
          confidence_score?: number | null
          created_at?: string | null
          fingerprint_hash: string
          id?: string
          isrc?: string | null
          match_count?: number | null
          mfcc_features?: Json | null
          popularity?: number | null
          preview_url?: string | null
          release_date?: string | null
          song_title: string
          source?: string | null
          spotify_id?: string | null
          spotify_url?: string | null
          updated_at?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          album?: string | null
          album_cover_url?: string | null
          apple_music_id?: string | null
          apple_music_url?: string | null
          artist?: string
          audio_duration_ms?: number | null
          confidence_score?: number | null
          created_at?: string | null
          fingerprint_hash?: string
          id?: string
          isrc?: string | null
          match_count?: number | null
          mfcc_features?: Json | null
          popularity?: number | null
          preview_url?: string | null
          release_date?: string | null
          song_title?: string
          source?: string | null
          spotify_id?: string | null
          spotify_url?: string | null
          updated_at?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      beat_matches: {
        Row: {
          album: string | null
          album_cover_url: string | null
          apple_music_id: string | null
          apple_music_url: string | null
          artist: string
          beat_id: string
          confidence: number | null
          id: string
          identified_at: string | null
          popularity: number | null
          preview_url: string | null
          release_date: string | null
          share_url: string | null
          song_title: string
          source: string
          spotify_id: string | null
          spotify_url: string | null
          youtube_id: string | null
          youtube_url: string | null
        }
        Insert: {
          album?: string | null
          album_cover_url?: string | null
          apple_music_id?: string | null
          apple_music_url?: string | null
          artist: string
          beat_id: string
          confidence?: number | null
          id?: string
          identified_at?: string | null
          popularity?: number | null
          preview_url?: string | null
          release_date?: string | null
          share_url?: string | null
          song_title: string
          source: string
          spotify_id?: string | null
          spotify_url?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Update: {
          album?: string | null
          album_cover_url?: string | null
          apple_music_id?: string | null
          apple_music_url?: string | null
          artist?: string
          beat_id?: string
          confidence?: number | null
          id?: string
          identified_at?: string | null
          popularity?: number | null
          preview_url?: string | null
          release_date?: string | null
          share_url?: string | null
          song_title?: string
          source?: string
          spotify_id?: string | null
          spotify_url?: string | null
          youtube_id?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beat_matches_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_notifications: {
        Row: {
          beat_id: string
          created_at: string | null
          id: string
          match_id: string
          notified_at: string | null
          read: boolean | null
          user_id: string
        }
        Insert: {
          beat_id: string
          created_at?: string | null
          id?: string
          match_id: string
          notified_at?: string | null
          read?: boolean | null
          user_id: string
        }
        Update: {
          beat_id?: string
          created_at?: string | null
          id?: string
          match_id?: string
          notified_at?: string | null
          read?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beat_notifications_beat_id_fkey"
            columns: ["beat_id"]
            isOneToOne: false
            referencedRelation: "beats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beat_notifications_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "beat_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      beats: {
        Row: {
          file_name: string
          file_size: number
          id: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          file_name: string
          file_size: number
          id?: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          file_name?: string
          file_size?: number
          id?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          status: string
          subject: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          status?: string
          subject: string
          type: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          status?: string
          subject?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      missing_link_reports: {
        Row: {
          album: string | null
          apple_music_id: string | null
          artist: string
          beat_match_id: string | null
          id: string
          reported_at: string
          reported_platform: string
          song_title: string
          spotify_id: string | null
          user_id: string
          youtube_id: string | null
        }
        Insert: {
          album?: string | null
          apple_music_id?: string | null
          artist: string
          beat_match_id?: string | null
          id?: string
          reported_at?: string
          reported_platform: string
          song_title: string
          spotify_id?: string | null
          user_id: string
          youtube_id?: string | null
        }
        Update: {
          album?: string | null
          apple_music_id?: string | null
          artist?: string
          beat_match_id?: string | null
          id?: string
          reported_at?: string
          reported_platform?: string
          song_title?: string
          spotify_id?: string | null
          user_id?: string
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "missing_link_reports_beat_match_id_fkey"
            columns: ["beat_match_id"]
            isOneToOne: false
            referencedRelation: "beat_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          has_seen_onboarding: boolean | null
          id: string
          logo_url: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          has_seen_onboarding?: boolean | null
          id: string
          logo_url?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          has_seen_onboarding?: boolean | null
          id?: string
          logo_url?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          identifier: string
          request_count: number
          updated_at: string | null
          window_start: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          identifier: string
          request_count?: number
          updated_at?: string | null
          window_start?: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          identifier?: string
          request_count?: number
          updated_at?: string | null
          window_start?: string
        }
        Relationships: []
      }
      scan_usage: {
        Row: {
          created_at: string | null
          id: string
          scan_count: number
          scan_date: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          scan_count?: number
          scan_date?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          scan_count?: number
          scan_date?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scan_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          features: Json
          id: string
          name: string
          price_monthly: number
          scans_per_day: number | null
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string | null
          features?: Json
          id?: string
          name: string
          price_monthly: number
          scans_per_day?: number | null
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string | null
          features?: Json
          id?: string
          name?: string
          price_monthly?: number
          scans_per_day?: number | null
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_anonymous_scans: { Args: never; Returns: undefined }
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      get_scan_usage: {
        Args: { _user_id: string }
        Returns: {
          scan_count: number
          scans_per_day: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_fingerprint_match_count: {
        Args: { fingerprint_id: string }
        Returns: undefined
      }
      increment_scan_count: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
