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
      ab_test_events: {
        Row: {
          created_at: string
          device_type: string | null
          event_type: string
          id: string
          referrer: string | null
          session_id: string | null
          test_name: string
          variant: string
          visitor_id: string | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          event_type: string
          id?: string
          referrer?: string | null
          session_id?: string | null
          test_name: string
          variant: string
          visitor_id?: string | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          event_type?: string
          id?: string
          referrer?: string | null
          session_id?: string | null
          test_name?: string
          variant?: string
          visitor_id?: string | null
        }
        Relationships: []
      }
      achievement_badges: {
        Row: {
          badge_code: string
          badge_description: string | null
          badge_icon: string | null
          badge_name: string
          category: string
          created_at: string | null
          criteria: Json
          id: string
          is_active: boolean | null
        }
        Insert: {
          badge_code: string
          badge_description?: string | null
          badge_icon?: string | null
          badge_name: string
          category: string
          created_at?: string | null
          criteria: Json
          id?: string
          is_active?: boolean | null
        }
        Update: {
          badge_code?: string
          badge_description?: string | null
          badge_icon?: string | null
          badge_name?: string
          category?: string
          created_at?: string | null
          criteria?: Json
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
          page_path: string | null
          user_email: string
          user_type: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page_path?: string | null
          user_email: string
          user_type: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          page_path?: string | null
          user_email?: string
          user_type?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action_category: string | null
          action_type: string
          admin_email: string | null
          admin_id: string
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          target_id: string
          target_name: string | null
          target_type: string
          user_agent: string | null
        }
        Insert: {
          action_category?: string | null
          action_type: string
          admin_email?: string | null
          admin_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id: string
          target_name?: string | null
          target_type: string
          user_agent?: string | null
        }
        Update: {
          action_category?: string | null
          action_type?: string
          admin_email?: string | null
          admin_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          target_id?: string
          target_name?: string | null
          target_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_insights: {
        Row: {
          computed_at: string | null
          id: string
          insight_data: Json
          insight_type: string
          valid_until: string | null
        }
        Insert: {
          computed_at?: string | null
          id?: string
          insight_data: Json
          insight_type: string
          valid_until?: string | null
        }
        Update: {
          computed_at?: string | null
          id?: string
          insight_data?: Json
          insight_type?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      age_band_config: {
        Row: {
          age_max: number
          age_min: number
          created_at: string
          curriculum_start: string
          daily_nudge_target: string
          differentiators: Json | null
          display_name: string
          estimated_total_seasons: number
          icon: string | null
          id: string
          is_active: boolean
          parent_role: string
          primary_mode: string
          progress_pulse_interval: number | null
          season_duration_weeks: number
          session_duration_minutes: number
          sessions_per_season: number
          sessions_per_week: number
          short_description: string | null
          skill_booster_credits: number | null
          tagline: string | null
          updated_at: string
          weekly_pattern: Json | null
        }
        Insert: {
          age_max: number
          age_min: number
          created_at?: string
          curriculum_start: string
          daily_nudge_target: string
          differentiators?: Json | null
          display_name: string
          estimated_total_seasons: number
          icon?: string | null
          id: string
          is_active?: boolean
          parent_role: string
          primary_mode: string
          progress_pulse_interval?: number | null
          season_duration_weeks?: number
          session_duration_minutes: number
          sessions_per_season: number
          sessions_per_week: number
          short_description?: string | null
          skill_booster_credits?: number | null
          tagline?: string | null
          updated_at?: string
          weekly_pattern?: Json | null
        }
        Update: {
          age_max?: number
          age_min?: number
          created_at?: string
          curriculum_start?: string
          daily_nudge_target?: string
          differentiators?: Json | null
          display_name?: string
          estimated_total_seasons?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          parent_role?: string
          primary_mode?: string
          progress_pulse_interval?: number | null
          season_duration_weeks?: number
          session_duration_minutes?: number
          sessions_per_season?: number
          sessions_per_week?: number
          short_description?: string | null
          skill_booster_credits?: number | null
          tagline?: string | null
          updated_at?: string
          weekly_pattern?: Json | null
        }
        Relationships: []
      }
      agreement_config: {
        Row: {
          category: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      agreement_signing_log: {
        Row: {
          agreement_version: string
          coach_id: string
          config_snapshot: Json | null
          created_at: string | null
          id: string
          ip_address: string | null
          pdf_url: string | null
          signature_url: string | null
          signed_at: string | null
          user_agent: string | null
        }
        Insert: {
          agreement_version: string
          coach_id: string
          config_snapshot?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          pdf_url?: string | null
          signature_url?: string | null
          signed_at?: string | null
          user_agent?: string | null
        }
        Update: {
          agreement_version?: string
          coach_id?: string
          config_snapshot?: Json | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          pdf_url?: string | null
          signature_url?: string | null
          signed_at?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agreement_signing_log_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_signing_log_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_signing_log_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreement_signing_log_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      agreement_versions: {
        Row: {
          activated_at: string | null
          created_at: string | null
          deactivated_at: string | null
          description: string | null
          entity_type: string | null
          file_name: string
          file_size_bytes: number | null
          file_url: string
          id: string
          is_active: boolean | null
          title: string
          total_signatures: number | null
          uploaded_by: string | null
          uploaded_by_email: string | null
          version: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          description?: string | null
          entity_type?: string | null
          file_name: string
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_active?: boolean | null
          title: string
          total_signatures?: number | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
          version: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          deactivated_at?: string | null
          description?: string | null
          entity_type?: string | null
          file_name?: string
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_active?: boolean | null
          title?: string
          total_signatures?: number | null
          uploaded_by?: string | null
          uploaded_by_email?: string | null
          version?: string
        }
        Relationships: []
      }
      book_collection_items: {
        Row: {
          added_at: string | null
          book_id: string
          collection_id: string
          display_order: number | null
          id: string
        }
        Insert: {
          added_at?: string | null
          book_id: string
          collection_id: string
          display_order?: number | null
          id?: string
        }
        Update: {
          added_at?: string | null
          book_id?: string
          collection_id?: string
          display_order?: number | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_collection_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_popularity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_collection_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "book_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      book_collections: {
        Row: {
          age_max: number | null
          age_min: number | null
          color_hex: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          icon_emoji: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          color_hex?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          color_hex?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      book_reads: {
        Row: {
          book_id: string
          child_enjoyed: boolean | null
          child_feedback: string | null
          child_ids: string[]
          coaching_session_id: string | null
          comprehension_rating: number | null
          created_at: string | null
          duration_minutes: number | null
          engagement_rating: number | null
          group_session_id: string | null
          id: string
          notes: string | null
          read_at: string | null
          read_by_coach_id: string | null
          reading_type: string | null
        }
        Insert: {
          book_id: string
          child_enjoyed?: boolean | null
          child_feedback?: string | null
          child_ids: string[]
          coaching_session_id?: string | null
          comprehension_rating?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          engagement_rating?: number | null
          group_session_id?: string | null
          id?: string
          notes?: string | null
          read_at?: string | null
          read_by_coach_id?: string | null
          reading_type?: string | null
        }
        Update: {
          book_id?: string
          child_enjoyed?: boolean | null
          child_feedback?: string | null
          child_ids?: string[]
          coaching_session_id?: string | null
          comprehension_rating?: number | null
          created_at?: string | null
          duration_minutes?: number | null
          engagement_rating?: number | null
          group_session_id?: string | null
          id?: string
          notes?: string | null
          read_at?: string | null
          read_by_coach_id?: string | null
          reading_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_reads_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_popularity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_coaching_session_id_fkey"
            columns: ["coaching_session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_coaching_session_id_fkey"
            columns: ["coaching_session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "book_reads_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_class_registrations_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "book_reads_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "upcoming_group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_read_by_coach_id_fkey"
            columns: ["read_by_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_read_by_coach_id_fkey"
            columns: ["read_by_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_read_by_coach_id_fkey"
            columns: ["read_by_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reads_read_by_coach_id_fkey"
            columns: ["read_by_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      book_requests: {
        Row: {
          book_id: string
          child_id: string
          created_at: string | null
          id: string
          parent_id: string | null
          priority: number | null
          read_at: string | null
          read_in_group_session_id: string | null
          read_in_session_id: string | null
          request_notes: string | null
          request_type: string
          scheduled_at: string | null
          scheduled_for_group_session_id: string | null
          scheduled_for_session_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          book_id: string
          child_id: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          priority?: number | null
          read_at?: string | null
          read_in_group_session_id?: string | null
          read_in_session_id?: string | null
          request_notes?: string | null
          request_type: string
          scheduled_at?: string | null
          scheduled_for_group_session_id?: string | null
          scheduled_for_session_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          book_id?: string
          child_id?: string
          created_at?: string | null
          id?: string
          parent_id?: string | null
          priority?: number | null
          read_at?: string | null
          read_in_group_session_id?: string | null
          read_in_session_id?: string | null
          request_notes?: string | null
          request_type?: string
          scheduled_at?: string | null
          scheduled_for_group_session_id?: string | null
          scheduled_for_session_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_requests_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_popularity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "book_requests_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_read_in_group_session_id_fkey"
            columns: ["read_in_group_session_id"]
            isOneToOne: false
            referencedRelation: "group_class_registrations_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "book_requests_read_in_group_session_id_fkey"
            columns: ["read_in_group_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_read_in_group_session_id_fkey"
            columns: ["read_in_group_session_id"]
            isOneToOne: false
            referencedRelation: "upcoming_group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_read_in_session_id_fkey"
            columns: ["read_in_session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_read_in_session_id_fkey"
            columns: ["read_in_session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "book_requests_scheduled_for_group_session_id_fkey"
            columns: ["scheduled_for_group_session_id"]
            isOneToOne: false
            referencedRelation: "group_class_registrations_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "book_requests_scheduled_for_group_session_id_fkey"
            columns: ["scheduled_for_group_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_scheduled_for_group_session_id_fkey"
            columns: ["scheduled_for_group_session_id"]
            isOneToOne: false
            referencedRelation: "upcoming_group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_scheduled_for_session_id_fkey"
            columns: ["scheduled_for_session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_requests_scheduled_for_session_id_fkey"
            columns: ["scheduled_for_session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      bookings: {
        Row: {
          amount: number | null
          cal_booking_id: string | null
          child_id: string | null
          coach_id: string | null
          created_at: string | null
          end_time: string | null
          event_type: string | null
          id: string
          meeting_url: string | null
          metadata: Json | null
          notes: string | null
          paid_at: string | null
          parent_id: string | null
          payment_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          start_time: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          cal_booking_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          meeting_url?: string | null
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          parent_id?: string | null
          payment_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          cal_booking_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          end_time?: string | null
          event_type?: string | null
          id?: string
          meeting_url?: string | null
          metadata?: Json | null
          notes?: string | null
          paid_at?: string | null
          parent_id?: string | null
          payment_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          added_at: string | null
          age_max: number | null
          age_min: number | null
          author: string | null
          available_languages: string[] | null
          average_rating: number | null
          cover_image_url: string | null
          description: string | null
          difficulty_score: number | null
          estimated_session_duration: number | null
          genres: string[] | null
          id: string
          illustrator: string | null
          is_active: boolean | null
          is_available_for_coaching: boolean | null
          is_available_for_kahani_times: boolean | null
          is_featured: boolean | null
          isbn: string | null
          language: string | null
          license_type: string | null
          meta_description: string | null
          page_count: number | null
          preview_url: string | null
          published_date: string | null
          publisher: string | null
          rating_count: number | null
          reading_level: string | null
          reading_time_minutes: number | null
          skills_targeted: string[] | null
          slug: string | null
          source: string | null
          source_url: string | null
          subtitle: string | null
          summary: string | null
          themes: string[] | null
          thumbnail_url: string | null
          times_read_in_sessions: number | null
          title: string
          total_requests: number | null
          updated_at: string | null
        }
        Insert: {
          added_at?: string | null
          age_max?: number | null
          age_min?: number | null
          author?: string | null
          available_languages?: string[] | null
          average_rating?: number | null
          cover_image_url?: string | null
          description?: string | null
          difficulty_score?: number | null
          estimated_session_duration?: number | null
          genres?: string[] | null
          id?: string
          illustrator?: string | null
          is_active?: boolean | null
          is_available_for_coaching?: boolean | null
          is_available_for_kahani_times?: boolean | null
          is_featured?: boolean | null
          isbn?: string | null
          language?: string | null
          license_type?: string | null
          meta_description?: string | null
          page_count?: number | null
          preview_url?: string | null
          published_date?: string | null
          publisher?: string | null
          rating_count?: number | null
          reading_level?: string | null
          reading_time_minutes?: number | null
          skills_targeted?: string[] | null
          slug?: string | null
          source?: string | null
          source_url?: string | null
          subtitle?: string | null
          summary?: string | null
          themes?: string[] | null
          thumbnail_url?: string | null
          times_read_in_sessions?: number | null
          title: string
          total_requests?: number | null
          updated_at?: string | null
        }
        Update: {
          added_at?: string | null
          age_max?: number | null
          age_min?: number | null
          author?: string | null
          available_languages?: string[] | null
          average_rating?: number | null
          cover_image_url?: string | null
          description?: string | null
          difficulty_score?: number | null
          estimated_session_duration?: number | null
          genres?: string[] | null
          id?: string
          illustrator?: string | null
          is_active?: boolean | null
          is_available_for_coaching?: boolean | null
          is_available_for_kahani_times?: boolean | null
          is_featured?: boolean | null
          isbn?: string | null
          language?: string | null
          license_type?: string | null
          meta_description?: string | null
          page_count?: number | null
          preview_url?: string | null
          published_date?: string | null
          publisher?: string | null
          rating_count?: number | null
          reading_level?: string | null
          reading_time_minutes?: number | null
          skills_targeted?: string[] | null
          slug?: string | null
          source?: string | null
          source_url?: string | null
          subtitle?: string | null
          summary?: string | null
          themes?: string[] | null
          thumbnail_url?: string | null
          times_read_in_sessions?: number | null
          title?: string
          total_requests?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      child_daily_goals: {
        Row: {
          achieved_at: string | null
          child_id: string
          completed_activities: number | null
          completed_minutes: number | null
          created_at: string | null
          goal_date: string
          id: string
          is_achieved: boolean | null
          target_activities: number | null
          target_minutes: number | null
          treasure_claimed: boolean | null
          updated_at: string | null
          xp_bonus: number | null
        }
        Insert: {
          achieved_at?: string | null
          child_id: string
          completed_activities?: number | null
          completed_minutes?: number | null
          created_at?: string | null
          goal_date?: string
          id?: string
          is_achieved?: boolean | null
          target_activities?: number | null
          target_minutes?: number | null
          treasure_claimed?: boolean | null
          updated_at?: string | null
          xp_bonus?: number | null
        }
        Update: {
          achieved_at?: string | null
          child_id?: string
          completed_activities?: number | null
          completed_minutes?: number | null
          created_at?: string | null
          goal_date?: string
          id?: string
          is_achieved?: boolean | null
          target_activities?: number | null
          target_minutes?: number | null
          treasure_claimed?: boolean | null
          updated_at?: string | null
          xp_bonus?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "child_daily_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_daily_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      child_game_progress: {
        Row: {
          child_id: string
          content_pool_id: string | null
          correct_items: number | null
          game_engine_slug: string
          id: string
          is_perfect: boolean | null
          max_score: number
          mistakes: Json | null
          percentage: number | null
          played_at: string | null
          score: number
          time_taken_seconds: number | null
          total_items: number | null
          unit_id: string | null
          xp_earned: number | null
        }
        Insert: {
          child_id: string
          content_pool_id?: string | null
          correct_items?: number | null
          game_engine_slug: string
          id?: string
          is_perfect?: boolean | null
          max_score: number
          mistakes?: Json | null
          percentage?: number | null
          played_at?: string | null
          score: number
          time_taken_seconds?: number | null
          total_items?: number | null
          unit_id?: string | null
          xp_earned?: number | null
        }
        Update: {
          child_id?: string
          content_pool_id?: string | null
          correct_items?: number | null
          game_engine_slug?: string
          id?: string
          is_perfect?: boolean | null
          max_score?: number
          mistakes?: Json | null
          percentage?: number | null
          played_at?: string | null
          score?: number
          time_taken_seconds?: number | null
          total_items?: number | null
          unit_id?: string | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "child_game_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_game_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      child_rag_profiles: {
        Row: {
          ai_recommendations: Json | null
          ai_summary: string | null
          areas_of_improvement: string[] | null
          assessment_data: Json | null
          book_preferences: Json | null
          child_id: string
          clarity_score: number | null
          coaching_history: Json | null
          created_at: string | null
          engagement_patterns: Json | null
          fluency_score: number | null
          group_class_history: Json | null
          id: string
          is_active: boolean | null
          last_updated_at: string | null
          preferred_genres: string[] | null
          preferred_themes: string[] | null
          profile_embedding: string | null
          reading_level: string | null
          speed_score: number | null
          strengths: string[] | null
        }
        Insert: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          areas_of_improvement?: string[] | null
          assessment_data?: Json | null
          book_preferences?: Json | null
          child_id: string
          clarity_score?: number | null
          coaching_history?: Json | null
          created_at?: string | null
          engagement_patterns?: Json | null
          fluency_score?: number | null
          group_class_history?: Json | null
          id?: string
          is_active?: boolean | null
          last_updated_at?: string | null
          preferred_genres?: string[] | null
          preferred_themes?: string[] | null
          profile_embedding?: string | null
          reading_level?: string | null
          speed_score?: number | null
          strengths?: string[] | null
        }
        Update: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          areas_of_improvement?: string[] | null
          assessment_data?: Json | null
          book_preferences?: Json | null
          child_id?: string
          clarity_score?: number | null
          coaching_history?: Json | null
          created_at?: string | null
          engagement_patterns?: Json | null
          fluency_score?: number | null
          group_class_history?: Json | null
          id?: string
          is_active?: boolean | null
          last_updated_at?: string | null
          preferred_genres?: string[] | null
          preferred_themes?: string[] | null
          profile_embedding?: string | null
          reading_level?: string | null
          speed_score?: number | null
          strengths?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "child_rag_profiles_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_rag_profiles_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      child_skill_progress: {
        Row: {
          child_id: string
          created_at: string | null
          current_level: number | null
          id: string
          last_assessed_at: string | null
          notes: string | null
          sessions_worked_on: number | null
          skill_code: string
          updated_at: string | null
        }
        Insert: {
          child_id: string
          created_at?: string | null
          current_level?: number | null
          id?: string
          last_assessed_at?: string | null
          notes?: string | null
          sessions_worked_on?: number | null
          skill_code: string
          updated_at?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string | null
          current_level?: number | null
          id?: string
          last_assessed_at?: string | null
          notes?: string | null
          sessions_worked_on?: number | null
          skill_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "child_skill_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_skill_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      children: {
        Row: {
          age: number | null
          age_band: string | null
          alumni_expires_at: string | null
          alumni_since: string | null
          assessment_completed_at: string | null
          assessment_wpm: number | null
          assigned_coach_id: string | null
          assigned_to: string | null
          attendance_rate: number | null
          avatar_url: string | null
          best_time_of_day: string | null
          board: string | null
          certificate_email_sent_at: string | null
          challenges: string[] | null
          child_name: string | null
          coach_id: string | null
          coupon_code_used: string | null
          created_at: string | null
          current_confidence_level: number | null
          current_reading_level: number | null
          current_streak: number | null
          custom_coach_split: number | null
          custom_yestoryd_split: number | null
          data_archived_at: string | null
          devices_available: string[] | null
          discovery_call_id: string | null
          dob: string | null
          enrolled_at: string | null
          enrollment_status: string | null
          favorite_topics: string[] | null
          goals_capture_method: string | null
          goals_captured_at: string | null
          goals_message_sent: boolean | null
          goals_message_sent_at: string | null
          grade: string | null
          homework_completion_rate: number | null
          hot_lead_alerted_at: string | null
          id: string
          is_enrolled: boolean | null
          languages_at_home: string[] | null
          last_contacted_at: string | null
          last_session_date: string | null
          last_session_focus: string | null
          last_session_summary: string | null
          last_task_completed_date: string | null
          latest_assessment_score: number | null
          lead_notes: string | null
          lead_score: number | null
          lead_score_updated_at: string | null
          lead_source: string | null
          lead_source_coach_id: string | null
          lead_status: string | null
          learning_challenges: string[] | null
          learning_needs: string[] | null
          learning_profile: Json | null
          learning_style: string | null
          longest_streak: number | null
          lost_at: string | null
          lost_reason: string | null
          mini_challenge_completed: boolean | null
          mini_challenge_data: Json | null
          motivators: string[] | null
          name: string | null
          next_followup_at: string | null
          notes: string | null
          parent_concerns: string | null
          parent_email: string | null
          parent_expectations: string | null
          parent_goals: string[] | null
          parent_id: string | null
          parent_name: string | null
          parent_phone: string | null
          parent_primary_goal: string | null
          parent_stated_goals: string | null
          phonics_focus: string | null
          primary_focus_area: string | null
          prior_reading_exposure: string | null
          program_end_date: string | null
          program_number: number | null
          program_start_date: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          reading_rank: string | null
          reading_rank_emoji: string | null
          referral_code: string | null
          referral_code_used: string | null
          referred_by_parent_id: string | null
          renewal_likelihood: string | null
          school_name: string | null
          sessions_completed: number | null
          status: string | null
          struggling_phonemes: string[] | null
          subscription_status: string | null
          total_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          age_band?: string | null
          alumni_expires_at?: string | null
          alumni_since?: string | null
          assessment_completed_at?: string | null
          assessment_wpm?: number | null
          assigned_coach_id?: string | null
          assigned_to?: string | null
          attendance_rate?: number | null
          avatar_url?: string | null
          best_time_of_day?: string | null
          board?: string | null
          certificate_email_sent_at?: string | null
          challenges?: string[] | null
          child_name?: string | null
          coach_id?: string | null
          coupon_code_used?: string | null
          created_at?: string | null
          current_confidence_level?: number | null
          current_reading_level?: number | null
          current_streak?: number | null
          custom_coach_split?: number | null
          custom_yestoryd_split?: number | null
          data_archived_at?: string | null
          devices_available?: string[] | null
          discovery_call_id?: string | null
          dob?: string | null
          enrolled_at?: string | null
          enrollment_status?: string | null
          favorite_topics?: string[] | null
          goals_capture_method?: string | null
          goals_captured_at?: string | null
          goals_message_sent?: boolean | null
          goals_message_sent_at?: string | null
          grade?: string | null
          homework_completion_rate?: number | null
          hot_lead_alerted_at?: string | null
          id?: string
          is_enrolled?: boolean | null
          languages_at_home?: string[] | null
          last_contacted_at?: string | null
          last_session_date?: string | null
          last_session_focus?: string | null
          last_session_summary?: string | null
          last_task_completed_date?: string | null
          latest_assessment_score?: number | null
          lead_notes?: string | null
          lead_score?: number | null
          lead_score_updated_at?: string | null
          lead_source?: string | null
          lead_source_coach_id?: string | null
          lead_status?: string | null
          learning_challenges?: string[] | null
          learning_needs?: string[] | null
          learning_profile?: Json | null
          learning_style?: string | null
          longest_streak?: number | null
          lost_at?: string | null
          lost_reason?: string | null
          mini_challenge_completed?: boolean | null
          mini_challenge_data?: Json | null
          motivators?: string[] | null
          name?: string | null
          next_followup_at?: string | null
          notes?: string | null
          parent_concerns?: string | null
          parent_email?: string | null
          parent_expectations?: string | null
          parent_goals?: string[] | null
          parent_id?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_primary_goal?: string | null
          parent_stated_goals?: string | null
          phonics_focus?: string | null
          primary_focus_area?: string | null
          prior_reading_exposure?: string | null
          program_end_date?: string | null
          program_number?: number | null
          program_start_date?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reading_rank?: string | null
          reading_rank_emoji?: string | null
          referral_code?: string | null
          referral_code_used?: string | null
          referred_by_parent_id?: string | null
          renewal_likelihood?: string | null
          school_name?: string | null
          sessions_completed?: number | null
          status?: string | null
          struggling_phonemes?: string[] | null
          subscription_status?: string | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          age_band?: string | null
          alumni_expires_at?: string | null
          alumni_since?: string | null
          assessment_completed_at?: string | null
          assessment_wpm?: number | null
          assigned_coach_id?: string | null
          assigned_to?: string | null
          attendance_rate?: number | null
          avatar_url?: string | null
          best_time_of_day?: string | null
          board?: string | null
          certificate_email_sent_at?: string | null
          challenges?: string[] | null
          child_name?: string | null
          coach_id?: string | null
          coupon_code_used?: string | null
          created_at?: string | null
          current_confidence_level?: number | null
          current_reading_level?: number | null
          current_streak?: number | null
          custom_coach_split?: number | null
          custom_yestoryd_split?: number | null
          data_archived_at?: string | null
          devices_available?: string[] | null
          discovery_call_id?: string | null
          dob?: string | null
          enrolled_at?: string | null
          enrollment_status?: string | null
          favorite_topics?: string[] | null
          goals_capture_method?: string | null
          goals_captured_at?: string | null
          goals_message_sent?: boolean | null
          goals_message_sent_at?: string | null
          grade?: string | null
          homework_completion_rate?: number | null
          hot_lead_alerted_at?: string | null
          id?: string
          is_enrolled?: boolean | null
          languages_at_home?: string[] | null
          last_contacted_at?: string | null
          last_session_date?: string | null
          last_session_focus?: string | null
          last_session_summary?: string | null
          last_task_completed_date?: string | null
          latest_assessment_score?: number | null
          lead_notes?: string | null
          lead_score?: number | null
          lead_score_updated_at?: string | null
          lead_source?: string | null
          lead_source_coach_id?: string | null
          lead_status?: string | null
          learning_challenges?: string[] | null
          learning_needs?: string[] | null
          learning_profile?: Json | null
          learning_style?: string | null
          longest_streak?: number | null
          lost_at?: string | null
          lost_reason?: string | null
          mini_challenge_completed?: boolean | null
          mini_challenge_data?: Json | null
          motivators?: string[] | null
          name?: string | null
          next_followup_at?: string | null
          notes?: string | null
          parent_concerns?: string | null
          parent_email?: string | null
          parent_expectations?: string | null
          parent_goals?: string[] | null
          parent_id?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          parent_primary_goal?: string | null
          parent_stated_goals?: string | null
          phonics_focus?: string | null
          primary_focus_area?: string | null
          prior_reading_exposure?: string | null
          program_end_date?: string | null
          program_number?: number | null
          program_start_date?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          reading_rank?: string | null
          reading_rank_emoji?: string | null
          referral_code?: string | null
          referral_code_used?: string | null
          referred_by_parent_id?: string | null
          renewal_likelihood?: string | null
          school_name?: string | null
          sessions_completed?: number | null
          status?: string | null
          struggling_phonemes?: string[] | null
          subscription_status?: string | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_age_band_fkey"
            columns: ["age_band"]
            isOneToOne: false
            referencedRelation: "age_band_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "coach_discovery_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls_need_followup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls_pending_assignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_referred_by_parent_id_fkey"
            columns: ["referred_by_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_applications: {
        Row: {
          aadhaar_verified: boolean | null
          agreement_sent_at: string | null
          agreement_signed_at: string | null
          agreement_url: string | null
          ai_assessment_completed_at: string | null
          ai_assessment_started_at: string | null
          ai_category_scores: Json | null
          ai_red_flags: string[] | null
          ai_responses: Json | null
          ai_score_breakdown: Json | null
          ai_total_score: number | null
          audio_ai_analysis: Json | null
          audio_ai_score: number | null
          audio_duration_seconds: number | null
          audio_statement_url: string | null
          audio_transcript: string | null
          certifications_text: string | null
          city: string
          coach_id: string | null
          country: string | null
          created_at: string | null
          credential_urls: string[] | null
          current_occupation: string | null
          email: string
          experience_years: string | null
          google_event_id: string | null
          google_id: string | null
          google_meet_link: string | null
          id: string
          interview_completed_at: string | null
          interview_feedback: Json | null
          interview_notes: string | null
          interview_outcome: string | null
          interview_scheduled_at: string | null
          interview_score: number | null
          name: string
          phone: string
          qualification: string | null
          qualification_checklist: Json | null
          rejection_reason: string | null
          resume_url: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string | null
          why_join: string | null
        }
        Insert: {
          aadhaar_verified?: boolean | null
          agreement_sent_at?: string | null
          agreement_signed_at?: string | null
          agreement_url?: string | null
          ai_assessment_completed_at?: string | null
          ai_assessment_started_at?: string | null
          ai_category_scores?: Json | null
          ai_red_flags?: string[] | null
          ai_responses?: Json | null
          ai_score_breakdown?: Json | null
          ai_total_score?: number | null
          audio_ai_analysis?: Json | null
          audio_ai_score?: number | null
          audio_duration_seconds?: number | null
          audio_statement_url?: string | null
          audio_transcript?: string | null
          certifications_text?: string | null
          city: string
          coach_id?: string | null
          country?: string | null
          created_at?: string | null
          credential_urls?: string[] | null
          current_occupation?: string | null
          email: string
          experience_years?: string | null
          google_event_id?: string | null
          google_id?: string | null
          google_meet_link?: string | null
          id?: string
          interview_completed_at?: string | null
          interview_feedback?: Json | null
          interview_notes?: string | null
          interview_outcome?: string | null
          interview_scheduled_at?: string | null
          interview_score?: number | null
          name: string
          phone: string
          qualification?: string | null
          qualification_checklist?: Json | null
          rejection_reason?: string | null
          resume_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          why_join?: string | null
        }
        Update: {
          aadhaar_verified?: boolean | null
          agreement_sent_at?: string | null
          agreement_signed_at?: string | null
          agreement_url?: string | null
          ai_assessment_completed_at?: string | null
          ai_assessment_started_at?: string | null
          ai_category_scores?: Json | null
          ai_red_flags?: string[] | null
          ai_responses?: Json | null
          ai_score_breakdown?: Json | null
          ai_total_score?: number | null
          audio_ai_analysis?: Json | null
          audio_ai_score?: number | null
          audio_duration_seconds?: number | null
          audio_statement_url?: string | null
          audio_transcript?: string | null
          certifications_text?: string | null
          city?: string
          coach_id?: string | null
          country?: string | null
          created_at?: string | null
          credential_urls?: string[] | null
          current_occupation?: string | null
          email?: string
          experience_years?: string | null
          google_event_id?: string | null
          google_id?: string | null
          google_meet_link?: string | null
          id?: string
          interview_completed_at?: string | null
          interview_feedback?: Json | null
          interview_notes?: string | null
          interview_outcome?: string | null
          interview_scheduled_at?: string | null
          interview_score?: number | null
          name?: string
          phone?: string
          qualification?: string | null
          qualification_checklist?: Json | null
          rejection_reason?: string | null
          resume_url?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
          why_join?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_applications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_applications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_applications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_applications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_assignment_status: {
        Row: {
          assignment_id: string | null
          child_id: string | null
          completed_at: string | null
          id: string
          notified_at: string | null
          reminder_sent: boolean | null
          result_id: string | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          assignment_id?: string | null
          child_id?: string | null
          completed_at?: string | null
          id?: string
          notified_at?: string | null
          reminder_sent?: boolean | null
          result_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          assignment_id?: string | null
          child_id?: string | null
          completed_at?: string | null
          id?: string
          notified_at?: string | null
          reminder_sent?: boolean | null
          result_id?: string | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_assignment_status_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "coach_triggered_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignment_status_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_assignment_status_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          affected_sessions: number | null
          backup_coach_id: string | null
          coach_id: string
          created_at: string | null
          end_date: string
          id: string
          notify_parents: boolean | null
          reason: string | null
          resolution_type: string | null
          start_date: string
          status: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          affected_sessions?: number | null
          backup_coach_id?: string | null
          coach_id: string
          created_at?: string | null
          end_date: string
          id?: string
          notify_parents?: boolean | null
          reason?: string | null
          resolution_type?: string | null
          start_date: string
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          affected_sessions?: number | null
          backup_coach_id?: string | null
          coach_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          notify_parents?: boolean | null
          reason?: string | null
          resolution_type?: string | null
          start_date?: string
          status?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_backup_coach_id_fkey"
            columns: ["backup_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_backup_coach_id_fkey"
            columns: ["backup_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_backup_coach_id_fkey"
            columns: ["backup_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_backup_coach_id_fkey"
            columns: ["backup_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability_slots: {
        Row: {
          coach_id: string
          created_at: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_available: boolean | null
          max_bookings_per_slot: number | null
          notes: string | null
          slot_type: string | null
          specific_date: string | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_available?: boolean | null
          max_bookings_per_slot?: number | null
          notes?: string | null
          slot_type?: string | null
          specific_date?: string | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_available?: boolean | null
          max_bookings_per_slot?: number | null
          notes?: string | null
          slot_type?: string | null
          specific_date?: string | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_slots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_slots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_slots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_slots_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_earnings: {
        Row: {
          child_id: string | null
          coach_amount: number
          coach_id: string | null
          created_at: string | null
          enrollment_amount: number
          id: string
          paid_at: string | null
          split_type: string | null
          status: string | null
          yestoryd_amount: number
        }
        Insert: {
          child_id?: string | null
          coach_amount: number
          coach_id?: string | null
          created_at?: string | null
          enrollment_amount: number
          id?: string
          paid_at?: string | null
          split_type?: string | null
          status?: string | null
          yestoryd_amount: number
        }
        Update: {
          child_id?: string | null
          coach_amount?: number
          coach_id?: string | null
          created_at?: string | null
          enrollment_amount?: number
          id?: string
          paid_at?: string | null
          split_type?: string | null
          status?: string | null
          yestoryd_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "coach_earnings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_earnings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "coach_earnings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_earnings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_earnings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_earnings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_groups: {
        Row: {
          badge_color: string | null
          coach_cost_percent: number
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          is_internal: boolean | null
          lead_cost_percent: number
          name: string
          platform_fee_percent: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          badge_color?: string | null
          coach_cost_percent?: number
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          is_internal?: boolean | null
          lead_cost_percent?: number
          name: string
          platform_fee_percent?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          badge_color?: string | null
          coach_cost_percent?: number
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          is_internal?: boolean | null
          lead_cost_percent?: number
          name?: string
          platform_fee_percent?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      coach_payouts: {
        Row: {
          bank_transfer_date: string | null
          bank_transfer_proof_url: string | null
          bank_transfer_status: string | null
          bank_utr_number: string | null
          child_id: string | null
          child_name: string | null
          coach_id: string
          created_at: string | null
          enrollment_revenue_id: string
          failure_reason: string | null
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          payout_month: number
          payout_type: string
          processed_at: string | null
          razorpay_payout_id: string | null
          razorpay_status: string | null
          reconciled_at: string | null
          reconciled_by: string | null
          scheduled_date: string
          status: string | null
          tds_amount: number | null
          updated_at: string | null
          utr_number: string | null
        }
        Insert: {
          bank_transfer_date?: string | null
          bank_transfer_proof_url?: string | null
          bank_transfer_status?: string | null
          bank_utr_number?: string | null
          child_id?: string | null
          child_name?: string | null
          coach_id: string
          created_at?: string | null
          enrollment_revenue_id: string
          failure_reason?: string | null
          gross_amount: number
          id?: string
          net_amount: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payout_month: number
          payout_type: string
          processed_at?: string | null
          razorpay_payout_id?: string | null
          razorpay_status?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          scheduled_date: string
          status?: string | null
          tds_amount?: number | null
          updated_at?: string | null
          utr_number?: string | null
        }
        Update: {
          bank_transfer_date?: string | null
          bank_transfer_proof_url?: string | null
          bank_transfer_status?: string | null
          bank_utr_number?: string | null
          child_id?: string | null
          child_name?: string | null
          coach_id?: string
          created_at?: string | null
          enrollment_revenue_id?: string
          failure_reason?: string | null
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payout_month?: number
          payout_type?: string
          processed_at?: string | null
          razorpay_payout_id?: string | null
          razorpay_status?: string | null
          reconciled_at?: string | null
          reconciled_by?: string | null
          scheduled_date?: string
          status?: string | null
          tds_amount?: number | null
          updated_at?: string | null
          utr_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_payouts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_payouts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "coach_payouts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_payouts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_payouts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_payouts_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_payouts_enrollment_revenue_id_fkey"
            columns: ["enrollment_revenue_id"]
            isOneToOne: false
            referencedRelation: "enrollment_revenue"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_reassignment_log: {
        Row: {
          actual_end_date: string | null
          created_at: string | null
          enrollment_id: string | null
          expected_end_date: string | null
          id: string
          is_temporary: boolean | null
          new_coach_id: string | null
          original_coach_id: string | null
          reason: string | null
          start_date: string | null
        }
        Insert: {
          actual_end_date?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          expected_end_date?: string | null
          id?: string
          is_temporary?: boolean | null
          new_coach_id?: string | null
          original_coach_id?: string | null
          reason?: string | null
          start_date?: string | null
        }
        Update: {
          actual_end_date?: string | null
          created_at?: string | null
          enrollment_id?: string | null
          expected_end_date?: string | null
          id?: string
          is_temporary?: boolean | null
          new_coach_id?: string | null
          original_coach_id?: string | null
          reason?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_reassignment_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reassignment_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reassignment_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_reassignment_log_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      coach_schedule_rules: {
        Row: {
          applies_to: string | null
          coach_id: string
          created_at: string | null
          created_by: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_active: boolean | null
          priority: number | null
          reason: string | null
          rule_type: string
          scope: string
          session_types: Json | null
          specific_date: string | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          applies_to?: string | null
          coach_id: string
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          reason?: string | null
          rule_type: string
          scope: string
          session_types?: Json | null
          specific_date?: string | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          applies_to?: string | null
          coach_id?: string
          created_at?: string | null
          created_by?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          reason?: string | null
          rule_type?: string
          scope?: string
          session_types?: Json | null
          specific_date?: string | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_schedule_rules_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_schedule_rules_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_schedule_rules_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_schedule_rules_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_scores: {
        Row: {
          calculated_at: string | null
          child_improvement_score: number | null
          children_coached: number | null
          coach_id: string
          communication_score: number | null
          created_at: string | null
          data_review_score: number | null
          id: string
          month: string
          no_shows: number | null
          parent_nps: number | null
          punctuality_score: number | null
          session_completion_rate: number | null
          sessions_cancelled: number | null
          sessions_completed: number | null
          tier: string | null
          total_score: number | null
        }
        Insert: {
          calculated_at?: string | null
          child_improvement_score?: number | null
          children_coached?: number | null
          coach_id: string
          communication_score?: number | null
          created_at?: string | null
          data_review_score?: number | null
          id?: string
          month: string
          no_shows?: number | null
          parent_nps?: number | null
          punctuality_score?: number | null
          session_completion_rate?: number | null
          sessions_cancelled?: number | null
          sessions_completed?: number | null
          tier?: string | null
          total_score?: number | null
        }
        Update: {
          calculated_at?: string | null
          child_improvement_score?: number | null
          children_coached?: number | null
          coach_id?: string
          communication_score?: number | null
          created_at?: string | null
          data_review_score?: number | null
          id?: string
          month?: string
          no_shows?: number | null
          parent_nps?: number | null
          punctuality_score?: number | null
          session_completion_rate?: number | null
          sessions_cancelled?: number | null
          sessions_completed?: number | null
          tier?: string | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_scores_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_scores_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_scores_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_scores_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_specializations: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          proficiency_level: number | null
          specialization_type: string
          specialization_value: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          proficiency_level?: number | null
          specialization_type: string
          specialization_value: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          proficiency_level?: number | null
          specialization_type?: string
          specialization_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_specializations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_specializations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_specializations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_specializations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_tier_changes: {
        Row: {
          changed_by: string | null
          coach_id: string
          created_at: string | null
          email_sent: boolean | null
          id: string
          is_promotion: boolean | null
          new_tier: string
          old_tier: string | null
          reason: string | null
          whatsapp_sent: boolean | null
        }
        Insert: {
          changed_by?: string | null
          coach_id: string
          created_at?: string | null
          email_sent?: boolean | null
          id?: string
          is_promotion?: boolean | null
          new_tier: string
          old_tier?: string | null
          reason?: string | null
          whatsapp_sent?: boolean | null
        }
        Update: {
          changed_by?: string | null
          coach_id?: string
          created_at?: string | null
          email_sent?: boolean | null
          id?: string
          is_promotion?: boolean | null
          new_tier?: string
          old_tier?: string | null
          reason?: string | null
          whatsapp_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_tier_changes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tier_changes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tier_changes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_tier_changes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_triggered_assessments: {
        Row: {
          assessment_id: string | null
          assessment_type: string
          broadcast_to_all: boolean | null
          child_ids: string[] | null
          coach_id: string | null
          completed_count: number | null
          created_at: string | null
          due_date: string | null
          id: string
          message: string | null
          sent_at: string | null
          total_count: number | null
          trigger_type: string
        }
        Insert: {
          assessment_id?: string | null
          assessment_type: string
          broadcast_to_all?: boolean | null
          child_ids?: string[] | null
          coach_id?: string | null
          completed_count?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          total_count?: number | null
          trigger_type: string
        }
        Update: {
          assessment_id?: string | null
          assessment_type?: string
          broadcast_to_all?: boolean | null
          child_ids?: string[] | null
          coach_id?: string | null
          completed_count?: number | null
          created_at?: string | null
          due_date?: string | null
          id?: string
          message?: string | null
          sent_at?: string | null
          total_count?: number | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_triggered_assessments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_triggered_assessments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_triggered_assessments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_triggered_assessments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          aadhaar_last_four: string | null
          accepts_early_morning: boolean | null
          accepts_night: boolean | null
          agreement_ip_address: string | null
          agreement_pdf_url: string | null
          agreement_signature_url: string | null
          agreement_signed_at: string | null
          agreement_url: string | null
          agreement_user_agent: string | null
          agreement_version: string | null
          agreement_version_id: string | null
          application_id: string | null
          avatar_url: string | null
          avg_rating: number | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          bio: string | null
          buffer_minutes: number | null
          cal_event_type_id: number | null
          cal_username: string | null
          can_mentor: boolean | null
          certifications: string[] | null
          city: string | null
          coach_split_percentage: number | null
          completed_sessions_with_logs: number | null
          created_at: string | null
          current_children: number | null
          current_score: number | null
          current_students: number | null
          current_tier: string | null
          email: string
          exit_date: string | null
          exit_initiated_by: string | null
          exit_reason: string | null
          exit_status: string | null
          group_id: string | null
          gst_number: string | null
          hourly_rate: number | null
          id: string
          is_accepting_new: boolean | null
          is_active: boolean | null
          is_available: boolean | null
          is_featured: boolean | null
          last_assigned_at: string | null
          last_seen_at: string | null
          lifetime_earnings: number | null
          max_children: number | null
          max_sessions_per_day: number | null
          max_students: number | null
          name: string
          notes: string | null
          onboarding_complete: boolean | null
          orientation_completed_at: string | null
          pan_number: string | null
          payout_enabled: boolean | null
          phone: string | null
          photo_url: string | null
          razorpay_contact_id: string | null
          razorpay_fund_account_id: string | null
          referral_code: string | null
          referral_link: string | null
          skill_tags: string[] | null
          slot_grid_minutes: number | null
          slug: string | null
          specializations: string[] | null
          status: string | null
          tax_id_type: string | null
          tds_cumulative_fy: number | null
          timezone: string | null
          total_children_coached: number | null
          total_login_count: number | null
          total_sessions_completed: number | null
          training_completed_at: string | null
          updated_at: string | null
          upi_id: string | null
          user_id: string | null
          verified_at: string | null
          verified_by: string | null
          whatsapp_number: string | null
          years_experience: number | null
          yestoryd_split_percentage: number | null
        }
        Insert: {
          aadhaar_last_four?: string | null
          accepts_early_morning?: boolean | null
          accepts_night?: boolean | null
          agreement_ip_address?: string | null
          agreement_pdf_url?: string | null
          agreement_signature_url?: string | null
          agreement_signed_at?: string | null
          agreement_url?: string | null
          agreement_user_agent?: string | null
          agreement_version?: string | null
          agreement_version_id?: string | null
          application_id?: string | null
          avatar_url?: string | null
          avg_rating?: number | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bio?: string | null
          buffer_minutes?: number | null
          cal_event_type_id?: number | null
          cal_username?: string | null
          can_mentor?: boolean | null
          certifications?: string[] | null
          city?: string | null
          coach_split_percentage?: number | null
          completed_sessions_with_logs?: number | null
          created_at?: string | null
          current_children?: number | null
          current_score?: number | null
          current_students?: number | null
          current_tier?: string | null
          email: string
          exit_date?: string | null
          exit_initiated_by?: string | null
          exit_reason?: string | null
          exit_status?: string | null
          group_id?: string | null
          gst_number?: string | null
          hourly_rate?: number | null
          id?: string
          is_accepting_new?: boolean | null
          is_active?: boolean | null
          is_available?: boolean | null
          is_featured?: boolean | null
          last_assigned_at?: string | null
          last_seen_at?: string | null
          lifetime_earnings?: number | null
          max_children?: number | null
          max_sessions_per_day?: number | null
          max_students?: number | null
          name: string
          notes?: string | null
          onboarding_complete?: boolean | null
          orientation_completed_at?: string | null
          pan_number?: string | null
          payout_enabled?: boolean | null
          phone?: string | null
          photo_url?: string | null
          razorpay_contact_id?: string | null
          razorpay_fund_account_id?: string | null
          referral_code?: string | null
          referral_link?: string | null
          skill_tags?: string[] | null
          slot_grid_minutes?: number | null
          slug?: string | null
          specializations?: string[] | null
          status?: string | null
          tax_id_type?: string | null
          tds_cumulative_fy?: number | null
          timezone?: string | null
          total_children_coached?: number | null
          total_login_count?: number | null
          total_sessions_completed?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          upi_id?: string | null
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          whatsapp_number?: string | null
          years_experience?: number | null
          yestoryd_split_percentage?: number | null
        }
        Update: {
          aadhaar_last_four?: string | null
          accepts_early_morning?: boolean | null
          accepts_night?: boolean | null
          agreement_ip_address?: string | null
          agreement_pdf_url?: string | null
          agreement_signature_url?: string | null
          agreement_signed_at?: string | null
          agreement_url?: string | null
          agreement_user_agent?: string | null
          agreement_version?: string | null
          agreement_version_id?: string | null
          application_id?: string | null
          avatar_url?: string | null
          avg_rating?: number | null
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_ifsc?: string | null
          bank_name?: string | null
          bio?: string | null
          buffer_minutes?: number | null
          cal_event_type_id?: number | null
          cal_username?: string | null
          can_mentor?: boolean | null
          certifications?: string[] | null
          city?: string | null
          coach_split_percentage?: number | null
          completed_sessions_with_logs?: number | null
          created_at?: string | null
          current_children?: number | null
          current_score?: number | null
          current_students?: number | null
          current_tier?: string | null
          email?: string
          exit_date?: string | null
          exit_initiated_by?: string | null
          exit_reason?: string | null
          exit_status?: string | null
          group_id?: string | null
          gst_number?: string | null
          hourly_rate?: number | null
          id?: string
          is_accepting_new?: boolean | null
          is_active?: boolean | null
          is_available?: boolean | null
          is_featured?: boolean | null
          last_assigned_at?: string | null
          last_seen_at?: string | null
          lifetime_earnings?: number | null
          max_children?: number | null
          max_sessions_per_day?: number | null
          max_students?: number | null
          name?: string
          notes?: string | null
          onboarding_complete?: boolean | null
          orientation_completed_at?: string | null
          pan_number?: string | null
          payout_enabled?: boolean | null
          phone?: string | null
          photo_url?: string | null
          razorpay_contact_id?: string | null
          razorpay_fund_account_id?: string | null
          referral_code?: string | null
          referral_link?: string | null
          skill_tags?: string[] | null
          slot_grid_minutes?: number | null
          slug?: string | null
          specializations?: string[] | null
          status?: string | null
          tax_id_type?: string | null
          tds_cumulative_fy?: number | null
          timezone?: string | null
          total_children_coached?: number | null
          total_login_count?: number | null
          total_sessions_completed?: number | null
          training_completed_at?: string | null
          updated_at?: string | null
          upi_id?: string | null
          user_id?: string | null
          verified_at?: string | null
          verified_by?: string | null
          whatsapp_number?: string | null
          years_experience?: number | null
          yestoryd_split_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "coach_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "coach_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      coaching_tips: {
        Row: {
          applicable_ages: string | null
          applicable_scenarios: string[] | null
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          source: string | null
          subcategory: string | null
          tip_content: string
          title: string
          usage_count: number | null
        }
        Insert: {
          applicable_ages?: string | null
          applicable_scenarios?: string[] | null
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source?: string | null
          subcategory?: string | null
          tip_content: string
          title: string
          usage_count?: number | null
        }
        Update: {
          applicable_ages?: string | null
          applicable_scenarios?: string[] | null
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          source?: string | null
          subcategory?: string | null
          tip_content?: string
          title?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      communication_analytics: {
        Row: {
          created_at: string | null
          date: string
          email_opened: number | null
          email_sent: number | null
          id: string
          in_app_created: number | null
          in_app_read: number | null
          push_clicked: number | null
          push_failed: number | null
          push_sent: number | null
          sms_cost: number | null
          sms_sent: number | null
          total_cost: number | null
          updated_at: string | null
          whatsapp_cost: number | null
          whatsapp_marketing_sent: number | null
          whatsapp_sent: number | null
          whatsapp_utility_sent: number | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          email_opened?: number | null
          email_sent?: number | null
          id?: string
          in_app_created?: number | null
          in_app_read?: number | null
          push_clicked?: number | null
          push_failed?: number | null
          push_sent?: number | null
          sms_cost?: number | null
          sms_sent?: number | null
          total_cost?: number | null
          updated_at?: string | null
          whatsapp_cost?: number | null
          whatsapp_marketing_sent?: number | null
          whatsapp_sent?: number | null
          whatsapp_utility_sent?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          email_opened?: number | null
          email_sent?: number | null
          id?: string
          in_app_created?: number | null
          in_app_read?: number | null
          push_clicked?: number | null
          push_failed?: number | null
          push_sent?: number | null
          sms_cost?: number | null
          sms_sent?: number | null
          total_cost?: number | null
          updated_at?: string | null
          whatsapp_cost?: number | null
          whatsapp_marketing_sent?: number | null
          whatsapp_sent?: number | null
          whatsapp_utility_sent?: number | null
        }
        Relationships: []
      }
      communication_logs: {
        Row: {
          context_data: Json | null
          created_at: string | null
          email_sent: boolean | null
          error_message: string | null
          id: string
          recipient_email: string | null
          recipient_id: string | null
          recipient_phone: string | null
          recipient_type: string
          sent_at: string | null
          sms_sent: boolean | null
          template_code: string
          wa_sent: boolean | null
        }
        Insert: {
          context_data?: Json | null
          created_at?: string | null
          email_sent?: boolean | null
          error_message?: string | null
          id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type: string
          sent_at?: string | null
          sms_sent?: boolean | null
          template_code: string
          wa_sent?: boolean | null
        }
        Update: {
          context_data?: Json | null
          created_at?: string | null
          email_sent?: boolean | null
          error_message?: string | null
          id?: string
          recipient_email?: string | null
          recipient_id?: string | null
          recipient_phone?: string | null
          recipient_type?: string
          sent_at?: string | null
          sms_sent?: boolean | null
          template_code?: string
          wa_sent?: boolean | null
        }
        Relationships: []
      }
      communication_preferences: {
        Row: {
          channels_enabled: Json | null
          created_at: string | null
          daily_digest: boolean | null
          digest_time: string | null
          id: string
          quiet_hours_enabled: boolean | null
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string | null
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          channels_enabled?: Json | null
          created_at?: string | null
          daily_digest?: boolean | null
          digest_time?: string | null
          id?: string
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          channels_enabled?: Json | null
          created_at?: string | null
          daily_digest?: boolean | null
          digest_time?: string | null
          id?: string
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string | null
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      communication_queue: {
        Row: {
          created_at: string | null
          created_by: string | null
          error_message: string | null
          id: string
          last_attempt_at: string | null
          log_id: string | null
          max_attempts: number | null
          next_attempt_at: string | null
          priority: string | null
          processed_at: string | null
          recipient_id: string
          recipient_type: string
          related_entity_id: string | null
          related_entity_type: string | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
          template_code: string
          variables: Json
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          log_id?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: string | null
          processed_at?: string | null
          recipient_id: string
          recipient_type: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
          template_code: string
          variables: Json
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          log_id?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          priority?: string | null
          processed_at?: string | null
          recipient_id?: string
          recipient_type?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
          template_code?: string
          variables?: Json
        }
        Relationships: []
      }
      communication_templates: {
        Row: {
          channels: Json | null
          cost_tier: string | null
          created_at: string | null
          created_by: string | null
          delay_minutes: number | null
          description: string | null
          email_body_html: string | null
          email_sendgrid_template_id: string | null
          email_subject: string | null
          id: string
          in_app_config: Json | null
          is_active: boolean | null
          journey: string | null
          meta_category: string | null
          name: string
          notes: string | null
          priority: number | null
          push_config: Json | null
          recipient_type: string
          required_variables: string[] | null
          respect_window: boolean | null
          routing_rules: Json | null
          send_window_end: string | null
          send_window_start: string | null
          sms_body: string | null
          stage: string | null
          template_code: string
          updated_at: string | null
          use_email: boolean | null
          use_sms: boolean | null
          use_whatsapp: boolean | null
          wa_approved: boolean | null
          wa_template_category: string | null
          wa_template_name: string | null
          wa_variables: string[] | null
        }
        Insert: {
          channels?: Json | null
          cost_tier?: string | null
          created_at?: string | null
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          email_body_html?: string | null
          email_sendgrid_template_id?: string | null
          email_subject?: string | null
          id?: string
          in_app_config?: Json | null
          is_active?: boolean | null
          journey?: string | null
          meta_category?: string | null
          name: string
          notes?: string | null
          priority?: number | null
          push_config?: Json | null
          recipient_type: string
          required_variables?: string[] | null
          respect_window?: boolean | null
          routing_rules?: Json | null
          send_window_end?: string | null
          send_window_start?: string | null
          sms_body?: string | null
          stage?: string | null
          template_code: string
          updated_at?: string | null
          use_email?: boolean | null
          use_sms?: boolean | null
          use_whatsapp?: boolean | null
          wa_approved?: boolean | null
          wa_template_category?: string | null
          wa_template_name?: string | null
          wa_variables?: string[] | null
        }
        Update: {
          channels?: Json | null
          cost_tier?: string | null
          created_at?: string | null
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          email_body_html?: string | null
          email_sendgrid_template_id?: string | null
          email_subject?: string | null
          id?: string
          in_app_config?: Json | null
          is_active?: boolean | null
          journey?: string | null
          meta_category?: string | null
          name?: string
          notes?: string | null
          priority?: number | null
          push_config?: Json | null
          recipient_type?: string
          required_variables?: string[] | null
          respect_window?: boolean | null
          routing_rules?: Json | null
          send_window_end?: string | null
          send_window_start?: string | null
          sms_body?: string | null
          stage?: string | null
          template_code?: string
          updated_at?: string | null
          use_email?: boolean | null
          use_sms?: boolean | null
          use_whatsapp?: boolean | null
          wa_approved?: boolean | null
          wa_template_category?: string | null
          wa_template_name?: string | null
          wa_variables?: string[] | null
        }
        Relationships: []
      }
      completion_certificates: {
        Row: {
          certificate_number: string
          certificate_url: string | null
          child_id: string
          child_name: string
          coach_id: string | null
          coach_name: string
          coaching_sessions_completed: number
          created_at: string | null
          downloaded_at: string | null
          email_sent_at: string | null
          enrollment_id: string
          final_assessment: Json
          id: string
          improvement_data: Json
          initial_assessment: Json
          issued_at: string | null
          parent_checkins_completed: number
          program_end_date: string
          program_start_date: string
          progress_report_url: string | null
          report_content: Json | null
          shared_at: string | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          certificate_number: string
          certificate_url?: string | null
          child_id: string
          child_name: string
          coach_id?: string | null
          coach_name: string
          coaching_sessions_completed?: number
          created_at?: string | null
          downloaded_at?: string | null
          email_sent_at?: string | null
          enrollment_id: string
          final_assessment: Json
          id?: string
          improvement_data: Json
          initial_assessment: Json
          issued_at?: string | null
          parent_checkins_completed?: number
          program_end_date: string
          program_start_date: string
          progress_report_url?: string | null
          report_content?: Json | null
          shared_at?: string | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          certificate_number?: string
          certificate_url?: string | null
          child_id?: string
          child_name?: string
          coach_id?: string | null
          coach_name?: string
          coaching_sessions_completed?: number
          created_at?: string | null
          downloaded_at?: string | null
          email_sent_at?: string | null
          enrollment_id?: string
          final_assessment?: Json
          id?: string
          improvement_data?: Json
          initial_assessment?: Json
          issued_at?: string | null
          parent_checkins_completed?: number
          program_end_date?: string
          program_start_date?: string
          progress_report_url?: string | null
          report_content?: Json | null
          shared_at?: string | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "completion_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "completion_certificates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "completion_certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          child_id: string | null
          coupon_discount: number
          coupon_id: string
          credit_amount_awarded: number | null
          credit_applied: number | null
          credit_awarded_to_parent_id: string | null
          discount_capped: boolean | null
          elearning_subscription_id: string | null
          enrollment_id: string | null
          final_amount: number
          group_class_registration_id: string | null
          id: string
          lead_source: string | null
          original_amount: number
          parent_id: string
          product_type: string
          total_discount: number
          used_at: string | null
        }
        Insert: {
          child_id?: string | null
          coupon_discount?: number
          coupon_id: string
          credit_amount_awarded?: number | null
          credit_applied?: number | null
          credit_awarded_to_parent_id?: string | null
          discount_capped?: boolean | null
          elearning_subscription_id?: string | null
          enrollment_id?: string | null
          final_amount: number
          group_class_registration_id?: string | null
          id?: string
          lead_source?: string | null
          original_amount: number
          parent_id: string
          product_type: string
          total_discount: number
          used_at?: string | null
        }
        Update: {
          child_id?: string | null
          coupon_discount?: number
          coupon_id?: string
          credit_amount_awarded?: number | null
          credit_applied?: number | null
          credit_awarded_to_parent_id?: string | null
          discount_capped?: boolean | null
          elearning_subscription_id?: string | null
          enrollment_id?: string | null
          final_amount?: number
          group_class_registration_id?: string | null
          id?: string
          lead_source?: string | null
          original_amount?: number
          parent_id?: string
          product_type?: string
          total_discount?: number
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_credit_awarded_to_parent_id_fkey"
            columns: ["credit_awarded_to_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "coupon_usages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_uses: {
        Row: {
          coupon_id: string | null
          created_at: string | null
          discount_amount: number | null
          id: string
          order_id: string | null
          user_email: string
        }
        Insert: {
          coupon_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          order_id?: string | null
          user_email: string
        }
        Update: {
          coupon_id?: string | null
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          order_id?: string | null
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applicable_to: string[] | null
          coach_id: string | null
          code: string
          coupon_type: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_type: string | null
          discount_value: number | null
          first_enrollment_only: boolean | null
          id: string
          is_active: boolean | null
          max_discount: number | null
          max_uses: number | null
          min_order_value: number | null
          notes: string | null
          parent_id: string | null
          per_user_limit: number | null
          referrer_type: string | null
          successful_conversions: number | null
          title: string | null
          total_discount_given: number | null
          total_referrals: number | null
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applicable_to?: string[] | null
          coach_id?: string | null
          code: string
          coupon_type: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          first_enrollment_only?: boolean | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          max_uses?: number | null
          min_order_value?: number | null
          notes?: string | null
          parent_id?: string | null
          per_user_limit?: number | null
          referrer_type?: string | null
          successful_conversions?: number | null
          title?: string | null
          total_discount_given?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applicable_to?: string[] | null
          coach_id?: string | null
          code?: string
          coupon_type?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          first_enrollment_only?: boolean | null
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          max_uses?: number | null
          min_order_value?: number | null
          notes?: string | null
          parent_id?: string | null
          per_user_limit?: number | null
          referrer_type?: string | null
          successful_conversions?: number | null
          title?: string | null
          total_discount_given?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_logs: {
        Row: {
          created_at: string | null
          cron_name: string
          error_message: string | null
          id: string
          run_at: string | null
          success: boolean | null
          summary: Json | null
        }
        Insert: {
          created_at?: string | null
          cron_name: string
          error_message?: string | null
          id?: string
          run_at?: string | null
          success?: boolean | null
          summary?: Json | null
        }
        Update: {
          created_at?: string | null
          cron_name?: string
          error_message?: string | null
          id?: string
          run_at?: string | null
          success?: boolean | null
          summary?: Json | null
        }
        Relationships: []
      }
      curriculum_template: {
        Row: {
          duration_minutes: number
          id: number
          is_auto_scheduled: boolean | null
          is_group: boolean | null
          preferred_time_slot: string | null
          session_title: string | null
          session_type: string
          week_number: number
        }
        Insert: {
          duration_minutes: number
          id?: number
          is_auto_scheduled?: boolean | null
          is_group?: boolean | null
          preferred_time_slot?: string | null
          session_title?: string | null
          session_type: string
          week_number: number
        }
        Update: {
          duration_minutes?: number
          id?: number
          is_auto_scheduled?: boolean | null
          is_group?: boolean | null
          preferred_time_slot?: string | null
          session_title?: string | null
          session_type?: string
          week_number?: number
        }
        Relationships: []
      }
      discovery_calls: {
        Row: {
          assessment_feedback: string | null
          assessment_id: string | null
          assessment_score: number | null
          assessment_wpm: number | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_coach_id: string | null
          assignment_type: string | null
          booking_source: string | null
          cal_booking_id: number | null
          cal_booking_uid: string | null
          cal_event_type_id: number | null
          call_completed: boolean | null
          call_outcome: string | null
          child_age: number | null
          child_id: string | null
          child_name: string
          completed_at: string | null
          completed_by: string | null
          concerns: string | null
          converted_at: string | null
          converted_to_enrollment: boolean | null
          created_at: string | null
          enrollment_id: string | null
          follow_up_date: string | null
          follow_up_notes: string | null
          followup_count: number | null
          followup_sent_at: string | null
          google_calendar_event_id: string | null
          google_meet_link: string | null
          id: string
          likelihood: string | null
          meeting_url: string | null
          objections: string | null
          parent_email: string
          parent_goals: string[] | null
          parent_name: string
          parent_phone: string | null
          payment_link: string | null
          payment_link_send_count: number | null
          payment_link_sent_at: string | null
          payment_link_sent_by: string | null
          questionnaire: Json | null
          request_id: string | null
          scheduled_at: string | null
          slot_date: string | null
          slot_time: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          assessment_feedback?: string | null
          assessment_id?: string | null
          assessment_score?: number | null
          assessment_wpm?: number | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_coach_id?: string | null
          assignment_type?: string | null
          booking_source?: string | null
          cal_booking_id?: number | null
          cal_booking_uid?: string | null
          cal_event_type_id?: number | null
          call_completed?: boolean | null
          call_outcome?: string | null
          child_age?: number | null
          child_id?: string | null
          child_name: string
          completed_at?: string | null
          completed_by?: string | null
          concerns?: string | null
          converted_at?: string | null
          converted_to_enrollment?: boolean | null
          created_at?: string | null
          enrollment_id?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          followup_count?: number | null
          followup_sent_at?: string | null
          google_calendar_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          likelihood?: string | null
          meeting_url?: string | null
          objections?: string | null
          parent_email: string
          parent_goals?: string[] | null
          parent_name: string
          parent_phone?: string | null
          payment_link?: string | null
          payment_link_send_count?: number | null
          payment_link_sent_at?: string | null
          payment_link_sent_by?: string | null
          questionnaire?: Json | null
          request_id?: string | null
          scheduled_at?: string | null
          slot_date?: string | null
          slot_time?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          assessment_feedback?: string | null
          assessment_id?: string | null
          assessment_score?: number | null
          assessment_wpm?: number | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_coach_id?: string | null
          assignment_type?: string | null
          booking_source?: string | null
          cal_booking_id?: number | null
          cal_booking_uid?: string | null
          cal_event_type_id?: number | null
          call_completed?: boolean | null
          call_outcome?: string | null
          child_age?: number | null
          child_id?: string | null
          child_name?: string
          completed_at?: string | null
          completed_by?: string | null
          concerns?: string | null
          converted_at?: string | null
          converted_to_enrollment?: boolean | null
          created_at?: string | null
          enrollment_id?: string | null
          follow_up_date?: string | null
          follow_up_notes?: string | null
          followup_count?: number | null
          followup_sent_at?: string | null
          google_calendar_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          likelihood?: string | null
          meeting_url?: string | null
          objections?: string | null
          parent_email?: string
          parent_goals?: string[] | null
          parent_name?: string
          parent_phone?: string | null
          payment_link?: string | null
          payment_link_send_count?: number | null
          payment_link_sent_at?: string | null
          payment_link_sent_by?: string | null
          questionnaire?: Json | null
          request_id?: string | null
          scheduled_at?: string | null
          slot_date?: string | null
          slot_time?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      el_badges: {
        Row: {
          badge_context: string | null
          coins_reward: number | null
          created_at: string | null
          criteria_extra: Json | null
          criteria_type: string
          criteria_value: number
          description: string | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          order_index: number | null
          rarity: string | null
          slug: string
          xp_reward: number | null
        }
        Insert: {
          badge_context?: string | null
          coins_reward?: number | null
          created_at?: string | null
          criteria_extra?: Json | null
          criteria_type: string
          criteria_value: number
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          order_index?: number | null
          rarity?: string | null
          slug: string
          xp_reward?: number | null
        }
        Update: {
          badge_context?: string | null
          coins_reward?: number | null
          created_at?: string | null
          criteria_extra?: Json | null
          criteria_type?: string
          criteria_value?: number
          description?: string | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          rarity?: string | null
          slug?: string
          xp_reward?: number | null
        }
        Relationships: []
      }
      el_child_avatars: {
        Row: {
          avatar_color: string | null
          avatar_name: string | null
          avatar_type: string
          child_id: string | null
          created_at: string | null
          evolution_level: number | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_color?: string | null
          avatar_name?: string | null
          avatar_type?: string
          child_id?: string | null
          created_at?: string | null
          evolution_level?: number | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          avatar_color?: string | null
          avatar_name?: string | null
          avatar_type?: string
          child_id?: string | null
          created_at?: string | null
          evolution_level?: number | null
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_avatars_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_avatars_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      el_child_badges: {
        Row: {
          badge_id: string | null
          child_id: string | null
          earned_at: string | null
          earned_context: string | null
          id: string
        }
        Insert: {
          badge_id?: string | null
          child_id?: string | null
          earned_at?: string | null
          earned_context?: string | null
          id?: string
        }
        Update: {
          badge_id?: string | null
          child_id?: string | null
          earned_at?: string | null
          earned_context?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "el_child_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "el_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_badges_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_badges_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      el_child_gamification: {
        Row: {
          child_id: string | null
          created_at: string | null
          current_level: number | null
          current_streak_days: number | null
          games_played: number | null
          games_won: number | null
          group_class_streak: number | null
          group_class_total_attended: number | null
          id: string
          last_activity_date: string | null
          last_group_class_date: string | null
          longest_streak_days: number | null
          perfect_quiz_count: number | null
          perfect_scores: number | null
          total_coins: number | null
          total_games_completed: number | null
          total_perfect_scores: number | null
          total_quizzes_completed: number | null
          total_readings_completed: number | null
          total_time_minutes: number | null
          total_units_completed: number | null
          total_videos_completed: number | null
          total_xp: number | null
          units_completed: number | null
          updated_at: string | null
          videos_watched: number | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          current_level?: number | null
          current_streak_days?: number | null
          games_played?: number | null
          games_won?: number | null
          group_class_streak?: number | null
          group_class_total_attended?: number | null
          id?: string
          last_activity_date?: string | null
          last_group_class_date?: string | null
          longest_streak_days?: number | null
          perfect_quiz_count?: number | null
          perfect_scores?: number | null
          total_coins?: number | null
          total_games_completed?: number | null
          total_perfect_scores?: number | null
          total_quizzes_completed?: number | null
          total_readings_completed?: number | null
          total_time_minutes?: number | null
          total_units_completed?: number | null
          total_videos_completed?: number | null
          total_xp?: number | null
          units_completed?: number | null
          updated_at?: string | null
          videos_watched?: number | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          current_level?: number | null
          current_streak_days?: number | null
          games_played?: number | null
          games_won?: number | null
          group_class_streak?: number | null
          group_class_total_attended?: number | null
          id?: string
          last_activity_date?: string | null
          last_group_class_date?: string | null
          longest_streak_days?: number | null
          perfect_quiz_count?: number | null
          perfect_scores?: number | null
          total_coins?: number | null
          total_games_completed?: number | null
          total_perfect_scores?: number | null
          total_quizzes_completed?: number | null
          total_readings_completed?: number | null
          total_time_minutes?: number | null
          total_units_completed?: number | null
          total_videos_completed?: number | null
          total_xp?: number | null
          units_completed?: number | null
          updated_at?: string | null
          videos_watched?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_gamification_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_gamification_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      el_child_identity: {
        Row: {
          best_learning_time: string | null
          child_id: string | null
          created_at: string | null
          favorite_animal: string | null
          favorite_character: string | null
          favorite_color: string | null
          favorite_food: string | null
          id: string
          interests: Json | null
          last_updated_by: string | null
          nickname: string | null
          pet_name: string | null
          pet_type: string | null
          preferred_session_length: string | null
          updated_at: string | null
        }
        Insert: {
          best_learning_time?: string | null
          child_id?: string | null
          created_at?: string | null
          favorite_animal?: string | null
          favorite_character?: string | null
          favorite_color?: string | null
          favorite_food?: string | null
          id?: string
          interests?: Json | null
          last_updated_by?: string | null
          nickname?: string | null
          pet_name?: string | null
          pet_type?: string | null
          preferred_session_length?: string | null
          updated_at?: string | null
        }
        Update: {
          best_learning_time?: string | null
          child_id?: string | null
          created_at?: string | null
          favorite_animal?: string | null
          favorite_character?: string | null
          favorite_color?: string | null
          favorite_food?: string | null
          id?: string
          interests?: Json | null
          last_updated_by?: string | null
          nickname?: string | null
          pet_name?: string | null
          pet_type?: string | null
          preferred_session_length?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_identity_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_identity_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      el_child_unit_progress: {
        Row: {
          badge_earned: boolean | null
          best_game_score: number | null
          best_score: number | null
          child_id: string | null
          coins_earned: number | null
          completed_at: string | null
          completion_percentage: number | null
          created_at: string | null
          current_step: number | null
          games_passed: number | null
          games_played: number | null
          id: string
          interval_days: number | null
          last_activity_at: string | null
          next_review_at: string | null
          overall_mastery_percent: number | null
          quiz_score: number | null
          review_count: number | null
          sequence_shown: Json | null
          started_at: string | null
          status: string | null
          step_progress: Json | null
          total_xp_earned: number | null
          unit_id: string | null
          unlocked_at: string | null
          updated_at: string | null
          video_watch_percent: number | null
          xp_earned: number | null
        }
        Insert: {
          badge_earned?: boolean | null
          best_game_score?: number | null
          best_score?: number | null
          child_id?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          games_passed?: number | null
          games_played?: number | null
          id?: string
          interval_days?: number | null
          last_activity_at?: string | null
          next_review_at?: string | null
          overall_mastery_percent?: number | null
          quiz_score?: number | null
          review_count?: number | null
          sequence_shown?: Json | null
          started_at?: string | null
          status?: string | null
          step_progress?: Json | null
          total_xp_earned?: number | null
          unit_id?: string | null
          unlocked_at?: string | null
          updated_at?: string | null
          video_watch_percent?: number | null
          xp_earned?: number | null
        }
        Update: {
          badge_earned?: boolean | null
          best_game_score?: number | null
          best_score?: number | null
          child_id?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          games_passed?: number | null
          games_played?: number | null
          id?: string
          interval_days?: number | null
          last_activity_at?: string | null
          next_review_at?: string | null
          overall_mastery_percent?: number | null
          quiz_score?: number | null
          review_count?: number | null
          sequence_shown?: Json | null
          started_at?: string | null
          status?: string | null
          step_progress?: Json | null
          total_xp_earned?: number | null
          unit_id?: string | null
          unlocked_at?: string | null
          updated_at?: string | null
          video_watch_percent?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_unit_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_unit_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "el_child_unit_progress_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "el_learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      el_child_video_progress: {
        Row: {
          best_quiz_score: number | null
          child_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          is_completed: boolean | null
          quiz_attempted: boolean | null
          quiz_attempts: number | null
          quiz_completed_at: string | null
          quiz_passed: boolean | null
          quiz_score: number | null
          times_watched: number | null
          unit_id: string | null
          updated_at: string | null
          video_id: string | null
          watch_percent: number | null
          watch_time_seconds: number | null
          xp_earned: number | null
        }
        Insert: {
          best_quiz_score?: number | null
          child_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          quiz_attempted?: boolean | null
          quiz_attempts?: number | null
          quiz_completed_at?: string | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          times_watched?: number | null
          unit_id?: string | null
          updated_at?: string | null
          video_id?: string | null
          watch_percent?: number | null
          watch_time_seconds?: number | null
          xp_earned?: number | null
        }
        Update: {
          best_quiz_score?: number | null
          child_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          quiz_attempted?: boolean | null
          quiz_attempts?: number | null
          quiz_completed_at?: string | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          times_watched?: number | null
          unit_id?: string | null
          updated_at?: string | null
          video_id?: string | null
          watch_percent?: number | null
          watch_time_seconds?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_video_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_video_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "el_child_video_progress_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "el_learning_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "el_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      el_content_items: {
        Row: {
          arc_stage: string | null
          asset_format: string | null
          asset_url: string | null
          child_label: string | null
          coach_guidance: string | null
          content_type: string
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          embedding: string | null
          id: string
          intelligence_tags: Json | null
          is_active: boolean | null
          is_placeholder: boolean | null
          metadata: Json | null
          parent_instruction: string | null
          search_text: string | null
          standards_alignment: Json | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          yrl_level: string | null
        }
        Insert: {
          arc_stage?: string | null
          asset_format?: string | null
          asset_url?: string | null
          child_label?: string | null
          coach_guidance?: string | null
          content_type: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          embedding?: string | null
          id?: string
          intelligence_tags?: Json | null
          is_active?: boolean | null
          is_placeholder?: boolean | null
          metadata?: Json | null
          parent_instruction?: string | null
          search_text?: string | null
          standards_alignment?: Json | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          yrl_level?: string | null
        }
        Update: {
          arc_stage?: string | null
          asset_format?: string | null
          asset_url?: string | null
          child_label?: string | null
          coach_guidance?: string | null
          content_type?: string
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty_level?: string | null
          embedding?: string | null
          id?: string
          intelligence_tags?: Json | null
          is_active?: boolean | null
          is_placeholder?: boolean | null
          metadata?: Json | null
          parent_instruction?: string | null
          search_text?: string | null
          standards_alignment?: Json | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          yrl_level?: string | null
        }
        Relationships: []
      }
      el_content_tags: {
        Row: {
          content_item_id: string
          created_at: string | null
          id: string
          is_primary: boolean | null
          relevance_score: number | null
          skill_id: string
          sub_skill_tag: string | null
        }
        Insert: {
          content_item_id: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          relevance_score?: number | null
          skill_id: string
          sub_skill_tag?: string | null
        }
        Update: {
          content_item_id?: string
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          relevance_score?: number | null
          skill_id?: string
          sub_skill_tag?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "el_content_tags_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "el_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_content_tags_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "v_content_with_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_content_tags_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "el_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      el_game_content: {
        Row: {
          content_data: Json
          created_at: string | null
          difficulty: number | null
          game_engine_id: string | null
          id: string
          is_active: boolean | null
          is_challenge: boolean | null
          is_practice: boolean | null
          is_warmup: boolean | null
          skill_id: string | null
        }
        Insert: {
          content_data: Json
          created_at?: string | null
          difficulty?: number | null
          game_engine_id?: string | null
          id?: string
          is_active?: boolean | null
          is_challenge?: boolean | null
          is_practice?: boolean | null
          is_warmup?: boolean | null
          skill_id?: string | null
        }
        Update: {
          content_data?: Json
          created_at?: string | null
          difficulty?: number | null
          game_engine_id?: string | null
          id?: string
          is_active?: boolean | null
          is_challenge?: boolean | null
          is_practice?: boolean | null
          is_warmup?: boolean | null
          skill_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "el_game_content_game_engine_id_fkey"
            columns: ["game_engine_id"]
            isOneToOne: false
            referencedRelation: "el_game_engines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_game_content_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "el_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      el_game_engines: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          game_type: string
          icon: string | null
          id: string
          instructions: string | null
          is_active: boolean | null
          max_age: number | null
          min_age: number | null
          name: string
          points_per_correct: number | null
          points_per_wrong: number | null
          slug: string
          time_limit_seconds: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          game_type: string
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          max_age?: number | null
          min_age?: number | null
          name: string
          points_per_correct?: number | null
          points_per_wrong?: number | null
          slug: string
          time_limit_seconds?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          game_type?: string
          icon?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean | null
          max_age?: number | null
          min_age?: number | null
          name?: string
          points_per_correct?: number | null
          points_per_wrong?: number | null
          slug?: string
          time_limit_seconds?: number | null
        }
        Relationships: []
      }
      el_game_sessions: {
        Row: {
          accuracy_percent: number | null
          child_id: string | null
          coins_earned: number | null
          completed_at: string | null
          correct_count: number | null
          created_at: string | null
          game_content_id: string | null
          game_engine_id: string | null
          id: string
          max_score: number | null
          mistakes: Json | null
          passed: boolean | null
          score: number | null
          skill_id: string | null
          started_at: string | null
          time_spent_seconds: number | null
          total_count: number | null
          unit_id: string | null
          was_completed: boolean | null
          wrong_count: number | null
          xp_earned: number | null
        }
        Insert: {
          accuracy_percent?: number | null
          child_id?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          correct_count?: number | null
          created_at?: string | null
          game_content_id?: string | null
          game_engine_id?: string | null
          id?: string
          max_score?: number | null
          mistakes?: Json | null
          passed?: boolean | null
          score?: number | null
          skill_id?: string | null
          started_at?: string | null
          time_spent_seconds?: number | null
          total_count?: number | null
          unit_id?: string | null
          was_completed?: boolean | null
          wrong_count?: number | null
          xp_earned?: number | null
        }
        Update: {
          accuracy_percent?: number | null
          child_id?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          correct_count?: number | null
          created_at?: string | null
          game_content_id?: string | null
          game_engine_id?: string | null
          id?: string
          max_score?: number | null
          mistakes?: Json | null
          passed?: boolean | null
          score?: number | null
          skill_id?: string | null
          started_at?: string | null
          time_spent_seconds?: number | null
          total_count?: number | null
          unit_id?: string | null
          was_completed?: boolean | null
          wrong_count?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_game_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_game_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "el_game_sessions_game_content_id_fkey"
            columns: ["game_content_id"]
            isOneToOne: false
            referencedRelation: "el_game_content"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_game_sessions_game_engine_id_fkey"
            columns: ["game_engine_id"]
            isOneToOne: false
            referencedRelation: "el_game_engines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_game_sessions_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "el_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_game_sessions_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "el_learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      el_learning_units: {
        Row: {
          activity_count: number | null
          arc_stage: string | null
          badge_slug: string | null
          coach_guidance: Json | null
          coins_reward: number | null
          color_hex: string | null
          content_code: string | null
          created_at: string | null
          description: string | null
          difficulty: string | null
          display_order: number | null
          embedding: string | null
          estimated_minutes: number | null
          game_types: string[] | null
          goal_area: string | null
          icon_emoji: string | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_mini_challenge: boolean | null
          level: number | null
          max_age: number | null
          min_age: number | null
          min_mastery_percent: number | null
          name: string
          order_index: number | null
          parent_instruction: string | null
          prerequisite_unit_ids: string[] | null
          published_at: string | null
          quest_description: string | null
          quest_title: string | null
          sequence: Json | null
          skill_id: string | null
          slug: string | null
          status: string | null
          sub_skill_tag: string | null
          tags: string[] | null
          thumbnail_url: string | null
          updated_at: string | null
          video_ids: string[] | null
          video_url: string | null
          world_theme: string | null
          xp_reward: number | null
        }
        Insert: {
          activity_count?: number | null
          arc_stage?: string | null
          badge_slug?: string | null
          coach_guidance?: Json | null
          coins_reward?: number | null
          color_hex?: string | null
          content_code?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          display_order?: number | null
          embedding?: string | null
          estimated_minutes?: number | null
          game_types?: string[] | null
          goal_area?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_mini_challenge?: boolean | null
          level?: number | null
          max_age?: number | null
          min_age?: number | null
          min_mastery_percent?: number | null
          name: string
          order_index?: number | null
          parent_instruction?: string | null
          prerequisite_unit_ids?: string[] | null
          published_at?: string | null
          quest_description?: string | null
          quest_title?: string | null
          sequence?: Json | null
          skill_id?: string | null
          slug?: string | null
          status?: string | null
          sub_skill_tag?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_ids?: string[] | null
          video_url?: string | null
          world_theme?: string | null
          xp_reward?: number | null
        }
        Update: {
          activity_count?: number | null
          arc_stage?: string | null
          badge_slug?: string | null
          coach_guidance?: Json | null
          coins_reward?: number | null
          color_hex?: string | null
          content_code?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          display_order?: number | null
          embedding?: string | null
          estimated_minutes?: number | null
          game_types?: string[] | null
          goal_area?: string | null
          icon_emoji?: string | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_mini_challenge?: boolean | null
          level?: number | null
          max_age?: number | null
          min_age?: number | null
          min_mastery_percent?: number | null
          name?: string
          order_index?: number | null
          parent_instruction?: string | null
          prerequisite_unit_ids?: string[] | null
          published_at?: string | null
          quest_description?: string | null
          quest_title?: string | null
          sequence?: Json | null
          skill_id?: string | null
          slug?: string | null
          status?: string | null
          sub_skill_tag?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          updated_at?: string | null
          video_ids?: string[] | null
          video_url?: string | null
          world_theme?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_learning_units_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "el_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      el_modules: {
        Row: {
          created_at: string | null
          description: string | null
          estimated_hours: number | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number
          slug: string
          stage_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index: number
          slug: string
          stage_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          estimated_hours?: number | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number
          slug?: string
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "el_modules_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "el_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      el_skills: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: number | null
          estimated_minutes: number | null
          id: string
          is_active: boolean | null
          module_id: string | null
          name: string
          order_index: number
          scope: string | null
          skill_tag: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          module_id?: string | null
          name: string
          order_index: number
          scope?: string | null
          skill_tag: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          estimated_minutes?: number | null
          id?: string
          is_active?: boolean | null
          module_id?: string | null
          name?: string
          order_index?: number
          scope?: string | null
          skill_tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "el_skills_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "el_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      el_stages: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          max_age: number
          min_age: number
          name: string
          order_index: number
          slug: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_age: number
          min_age: number
          name: string
          order_index: number
          slug: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          max_age?: number
          min_age?: number
          name?: string
          order_index?: number
          slug?: string
        }
        Relationships: []
      }
      el_unit_content: {
        Row: {
          content_item_id: string
          created_at: string | null
          display_order: number | null
          id: string
          is_required: boolean | null
          notes: string | null
          unit_id: string
        }
        Insert: {
          content_item_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          notes?: string | null
          unit_id: string
        }
        Update: {
          content_item_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_required?: boolean | null
          notes?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "el_unit_content_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "el_content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_unit_content_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "v_content_with_skills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_unit_content_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "el_learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      el_videos: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          description: string | null
          difficulty: number | null
          display_order: number | null
          duration_seconds: number | null
          has_quiz: boolean | null
          id: string
          is_active: boolean | null
          is_free: boolean | null
          is_intro: boolean | null
          is_placeholder: boolean | null
          key_concepts: string[] | null
          module_id: string | null
          order_index: number | null
          skill_id: string | null
          slug: string | null
          status: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          video_id: string | null
          video_source: string | null
          video_type: string | null
          video_url: string | null
          xp_reward: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          display_order?: number | null
          duration_seconds?: number | null
          has_quiz?: boolean | null
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          is_intro?: boolean | null
          is_placeholder?: boolean | null
          key_concepts?: string[] | null
          module_id?: string | null
          order_index?: number | null
          skill_id?: string | null
          slug?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          video_id?: string | null
          video_source?: string | null
          video_type?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          description?: string | null
          difficulty?: number | null
          display_order?: number | null
          duration_seconds?: number | null
          has_quiz?: boolean | null
          id?: string
          is_active?: boolean | null
          is_free?: boolean | null
          is_intro?: boolean | null
          is_placeholder?: boolean | null
          key_concepts?: string[] | null
          module_id?: string | null
          order_index?: number | null
          skill_id?: string | null
          slug?: string | null
          status?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          video_id?: string | null
          video_source?: string | null
          video_type?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_videos_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "el_skills"
            referencedColumns: ["id"]
          },
        ]
      }
      el_worksheets: {
        Row: {
          asset_format: string | null
          asset_url: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          page_count: number | null
          thumbnail_url: string | null
          title: string
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          asset_format?: string | null
          asset_url: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          page_count?: number | null
          thumbnail_url?: string | null
          title: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          asset_format?: string | null
          asset_url?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          page_count?: number | null
          thumbnail_url?: string | null
          title?: string
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "el_worksheets_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "el_learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_events: {
        Row: {
          created_at: string | null
          enrollment_id: string
          event_data: Json | null
          event_type: string
          id: string
          triggered_by: string
          triggered_by_id: string | null
        }
        Insert: {
          created_at?: string | null
          enrollment_id: string
          event_data?: Json | null
          event_type: string
          id?: string
          triggered_by?: string
          triggered_by_id?: string | null
        }
        Update: {
          created_at?: string | null
          enrollment_id?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          triggered_by?: string
          triggered_by_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      enrollment_revenue: {
        Row: {
          coach_cost_amount: number
          coach_group_id: string | null
          coach_group_name: string | null
          coaching_coach_id: string
          config_snapshot: Json
          created_at: string | null
          enrollment_id: string
          id: string
          lead_bonus_coach_id: string | null
          lead_cost_amount: number
          lead_source: string
          lead_source_coach_id: string | null
          net_retained_by_platform: number
          net_to_coach: number
          net_to_lead_source: number
          platform_fee_amount: number
          status: string | null
          tds_amount: number | null
          tds_applicable: boolean | null
          tds_rate_applied: number | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          coach_cost_amount: number
          coach_group_id?: string | null
          coach_group_name?: string | null
          coaching_coach_id: string
          config_snapshot: Json
          created_at?: string | null
          enrollment_id: string
          id?: string
          lead_bonus_coach_id?: string | null
          lead_cost_amount: number
          lead_source: string
          lead_source_coach_id?: string | null
          net_retained_by_platform: number
          net_to_coach: number
          net_to_lead_source: number
          platform_fee_amount: number
          status?: string | null
          tds_amount?: number | null
          tds_applicable?: boolean | null
          tds_rate_applied?: number | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          coach_cost_amount?: number
          coach_group_id?: string | null
          coach_group_name?: string | null
          coaching_coach_id?: string
          config_snapshot?: Json
          created_at?: string | null
          enrollment_id?: string
          id?: string
          lead_bonus_coach_id?: string | null
          lead_cost_amount?: number
          lead_source?: string
          lead_source_coach_id?: string | null
          net_retained_by_platform?: number
          net_to_coach?: number
          net_to_lead_source?: number
          platform_fee_amount?: number
          status?: string | null
          tds_amount?: number | null
          tds_applicable?: boolean | null
          tds_rate_applied?: number | null
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_revenue_coach_group_id_fkey"
            columns: ["coach_group_id"]
            isOneToOne: false
            referencedRelation: "coach_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_coaching_coach_id_fkey"
            columns: ["coaching_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_coaching_coach_id_fkey"
            columns: ["coaching_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_coaching_coach_id_fkey"
            columns: ["coaching_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_coaching_coach_id_fkey"
            columns: ["coaching_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_bonus_coach_id_fkey"
            columns: ["lead_bonus_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_bonus_coach_id_fkey"
            columns: ["lead_bonus_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_bonus_coach_id_fkey"
            columns: ["lead_bonus_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_bonus_coach_id_fkey"
            columns: ["lead_bonus_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_revenue_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_terminations: {
        Row: {
          coach_settlement_amount: number
          created_at: string | null
          created_by: string
          enrollment_id: string
          id: string
          original_amount: number
          platform_retention: number
          razorpay_payment_id: string
          razorpay_refund_id: string | null
          refund_amount: number
          refund_completed_at: string | null
          refund_failure_reason: string | null
          refund_initiated_at: string | null
          refund_status: string | null
          sessions_completed: number
          sessions_remaining: number
          sessions_total: number
          terminated_by: string
          termination_notes: string | null
          termination_reason: string
          updated_at: string | null
        }
        Insert: {
          coach_settlement_amount: number
          created_at?: string | null
          created_by: string
          enrollment_id: string
          id?: string
          original_amount: number
          platform_retention: number
          razorpay_payment_id: string
          razorpay_refund_id?: string | null
          refund_amount: number
          refund_completed_at?: string | null
          refund_failure_reason?: string | null
          refund_initiated_at?: string | null
          refund_status?: string | null
          sessions_completed: number
          sessions_remaining: number
          sessions_total: number
          terminated_by: string
          termination_notes?: string | null
          termination_reason: string
          updated_at?: string | null
        }
        Update: {
          coach_settlement_amount?: number
          created_at?: string | null
          created_by?: string
          enrollment_id?: string
          id?: string
          original_amount?: number
          platform_retention?: number
          razorpay_payment_id?: string
          razorpay_refund_id?: string | null
          refund_amount?: number
          refund_completed_at?: string | null
          refund_failure_reason?: string | null
          refund_initiated_at?: string | null
          refund_status?: string | null
          sessions_completed?: number
          sessions_remaining?: number
          sessions_total?: number
          terminated_by?: string
          termination_notes?: string | null
          termination_reason?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_terminations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_terminations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_terminations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_terminations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          actual_start_date: string | null
          age_band: string | null
          amount: number | null
          at_risk: boolean | null
          at_risk_reason: string | null
          certificate_id: string | null
          certificate_number: string | null
          child_id: string | null
          coach_assigned_by: string | null
          coach_id: string | null
          coach_settlement: number | null
          completed_at: string | null
          completion_alert_sent_at: string | null
          completion_triggered_at: string | null
          consecutive_no_shows: number | null
          continuation_deadline: string | null
          coupon_code_used: string | null
          coupon_discount_amount: number | null
          coupon_id: string | null
          created_at: string | null
          credit_used: number | null
          discount_amount: number | null
          enrollment_type: string | null
          extension_count: number | null
          final_assessment_completed_at: string | null
          id: string
          is_continuation: boolean | null
          is_paused: boolean | null
          last_alert_sent_at: string | null
          lead_source: string | null
          lead_source_coach_id: string | null
          max_reschedules: number | null
          no_show_count: number | null
          nps_score: number | null
          nps_submitted_at: string | null
          original_amount: number | null
          original_coach_id: string | null
          original_end_date: string | null
          original_program_end: string | null
          parent_id: string | null
          pause_count: number | null
          pause_end_date: string | null
          pause_reason: string | null
          pause_start_date: string | null
          payment_id: string | null
          platform_settlement: number | null
          preference_days: Json | null
          preference_start_date: string | null
          preference_start_type: string | null
          preference_time_bucket: string | null
          preferred_day: number | null
          preferred_time: string | null
          previous_enrollment_id: string | null
          product_id: string | null
          program_end: string | null
          program_start: string | null
          referral_code_used: string | null
          referred_by_parent_id: string | null
          refund_amount: number | null
          remedial_sessions_max: number | null
          remedial_sessions_used: number | null
          renewal_offered_at: string | null
          renewal_status: string | null
          renewed_from_enrollment_id: string | null
          requested_start_date: string | null
          reschedules_used: number | null
          risk_level: string | null
          schedule_confirmed: boolean | null
          schedule_confirmed_at: string | null
          schedule_confirmed_by: string | null
          season_number: number
          session_duration_minutes: number | null
          sessions_cancelled_count: number | null
          sessions_completed: number | null
          sessions_per_week: number | null
          sessions_purchased: number | null
          sessions_remaining: number | null
          sessions_rescheduled_count: number | null
          sessions_scheduled: number | null
          starter_completed_at: string | null
          starter_enrollment_id: string | null
          status: string | null
          terminated_at: string | null
          terminated_by: string | null
          termination_reason: string | null
          total_no_shows: number | null
          total_pause_days: number | null
          total_sessions: number | null
          updated_at: string | null
        }
        Insert: {
          actual_start_date?: string | null
          age_band?: string | null
          amount?: number | null
          at_risk?: boolean | null
          at_risk_reason?: string | null
          certificate_id?: string | null
          certificate_number?: string | null
          child_id?: string | null
          coach_assigned_by?: string | null
          coach_id?: string | null
          coach_settlement?: number | null
          completed_at?: string | null
          completion_alert_sent_at?: string | null
          completion_triggered_at?: string | null
          consecutive_no_shows?: number | null
          continuation_deadline?: string | null
          coupon_code_used?: string | null
          coupon_discount_amount?: number | null
          coupon_id?: string | null
          created_at?: string | null
          credit_used?: number | null
          discount_amount?: number | null
          enrollment_type?: string | null
          extension_count?: number | null
          final_assessment_completed_at?: string | null
          id?: string
          is_continuation?: boolean | null
          is_paused?: boolean | null
          last_alert_sent_at?: string | null
          lead_source?: string | null
          lead_source_coach_id?: string | null
          max_reschedules?: number | null
          no_show_count?: number | null
          nps_score?: number | null
          nps_submitted_at?: string | null
          original_amount?: number | null
          original_coach_id?: string | null
          original_end_date?: string | null
          original_program_end?: string | null
          parent_id?: string | null
          pause_count?: number | null
          pause_end_date?: string | null
          pause_reason?: string | null
          pause_start_date?: string | null
          payment_id?: string | null
          platform_settlement?: number | null
          preference_days?: Json | null
          preference_start_date?: string | null
          preference_start_type?: string | null
          preference_time_bucket?: string | null
          preferred_day?: number | null
          preferred_time?: string | null
          previous_enrollment_id?: string | null
          product_id?: string | null
          program_end?: string | null
          program_start?: string | null
          referral_code_used?: string | null
          referred_by_parent_id?: string | null
          refund_amount?: number | null
          remedial_sessions_max?: number | null
          remedial_sessions_used?: number | null
          renewal_offered_at?: string | null
          renewal_status?: string | null
          renewed_from_enrollment_id?: string | null
          requested_start_date?: string | null
          reschedules_used?: number | null
          risk_level?: string | null
          schedule_confirmed?: boolean | null
          schedule_confirmed_at?: string | null
          schedule_confirmed_by?: string | null
          season_number?: number
          session_duration_minutes?: number | null
          sessions_cancelled_count?: number | null
          sessions_completed?: number | null
          sessions_per_week?: number | null
          sessions_purchased?: number | null
          sessions_remaining?: number | null
          sessions_rescheduled_count?: number | null
          sessions_scheduled?: number | null
          starter_completed_at?: string | null
          starter_enrollment_id?: string | null
          status?: string | null
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          total_no_shows?: number | null
          total_pause_days?: number | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_start_date?: string | null
          age_band?: string | null
          amount?: number | null
          at_risk?: boolean | null
          at_risk_reason?: string | null
          certificate_id?: string | null
          certificate_number?: string | null
          child_id?: string | null
          coach_assigned_by?: string | null
          coach_id?: string | null
          coach_settlement?: number | null
          completed_at?: string | null
          completion_alert_sent_at?: string | null
          completion_triggered_at?: string | null
          consecutive_no_shows?: number | null
          continuation_deadline?: string | null
          coupon_code_used?: string | null
          coupon_discount_amount?: number | null
          coupon_id?: string | null
          created_at?: string | null
          credit_used?: number | null
          discount_amount?: number | null
          enrollment_type?: string | null
          extension_count?: number | null
          final_assessment_completed_at?: string | null
          id?: string
          is_continuation?: boolean | null
          is_paused?: boolean | null
          last_alert_sent_at?: string | null
          lead_source?: string | null
          lead_source_coach_id?: string | null
          max_reschedules?: number | null
          no_show_count?: number | null
          nps_score?: number | null
          nps_submitted_at?: string | null
          original_amount?: number | null
          original_coach_id?: string | null
          original_end_date?: string | null
          original_program_end?: string | null
          parent_id?: string | null
          pause_count?: number | null
          pause_end_date?: string | null
          pause_reason?: string | null
          pause_start_date?: string | null
          payment_id?: string | null
          platform_settlement?: number | null
          preference_days?: Json | null
          preference_start_date?: string | null
          preference_start_type?: string | null
          preference_time_bucket?: string | null
          preferred_day?: number | null
          preferred_time?: string | null
          previous_enrollment_id?: string | null
          product_id?: string | null
          program_end?: string | null
          program_start?: string | null
          referral_code_used?: string | null
          referred_by_parent_id?: string | null
          refund_amount?: number | null
          remedial_sessions_max?: number | null
          remedial_sessions_used?: number | null
          renewal_offered_at?: string | null
          renewal_status?: string | null
          renewed_from_enrollment_id?: string | null
          requested_start_date?: string | null
          reschedules_used?: number | null
          risk_level?: string | null
          schedule_confirmed?: boolean | null
          schedule_confirmed_at?: string | null
          schedule_confirmed_by?: string | null
          season_number?: number
          session_duration_minutes?: number | null
          sessions_cancelled_count?: number | null
          sessions_completed?: number | null
          sessions_per_week?: number | null
          sessions_purchased?: number | null
          sessions_remaining?: number | null
          sessions_rescheduled_count?: number | null
          sessions_scheduled?: number | null
          starter_completed_at?: string | null
          starter_enrollment_id?: string | null
          status?: string | null
          terminated_at?: string | null
          terminated_by?: string | null
          termination_reason?: string | null
          total_no_shows?: number | null
          total_pause_days?: number | null
          total_sessions?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_age_band_fkey"
            columns: ["age_band"]
            isOneToOne: false
            referencedRelation: "age_band_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "completion_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_previous_enrollment_id_fkey"
            columns: ["previous_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_previous_enrollment_id_fkey"
            columns: ["previous_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_previous_enrollment_id_fkey"
            columns: ["previous_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_previous_enrollment_id_fkey"
            columns: ["previous_enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "enrollments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pricing_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_referred_by_parent_id_fkey"
            columns: ["referred_by_parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_renewed_from_enrollment_id_fkey"
            columns: ["renewed_from_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_renewed_from_enrollment_id_fkey"
            columns: ["renewed_from_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_renewed_from_enrollment_id_fkey"
            columns: ["renewed_from_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_renewed_from_enrollment_id_fkey"
            columns: ["renewed_from_enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "enrollments_starter_enrollment_id_fkey"
            columns: ["starter_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_starter_enrollment_id_fkey"
            columns: ["starter_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_starter_enrollment_id_fkey"
            columns: ["starter_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_starter_enrollment_id_fkey"
            columns: ["starter_enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      failed_payments: {
        Row: {
          amount: number | null
          attempt_count: number | null
          booking_id: string | null
          converted_at: string | null
          created_at: string | null
          error_code: string | null
          error_description: string | null
          id: string
          notified: boolean | null
          parent_email: string | null
          razorpay_order_id: string
          razorpay_payment_id: string
        }
        Insert: {
          amount?: number | null
          attempt_count?: number | null
          booking_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_description?: string | null
          id?: string
          notified?: boolean | null
          parent_email?: string | null
          razorpay_order_id: string
          razorpay_payment_id: string
        }
        Update: {
          amount?: number | null
          attempt_count?: number | null
          booking_id?: string | null
          converted_at?: string | null
          created_at?: string | null
          error_code?: string | null
          error_description?: string | null
          id?: string
          notified?: boolean | null
          parent_email?: string | null
          razorpay_order_id?: string
          razorpay_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "failed_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          flag_key: string
          flag_value: boolean | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          flag_key: string
          flag_value?: boolean | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          flag_key?: string
          flag_value?: boolean | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      group_class_blueprints: {
        Row: {
          age_band: string
          avg_instructor_rating: number | null
          class_type_id: string
          content_refs: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          guided_questions: Json | null
          id: string
          individual_moment_config: Json
          name: string
          quiz_refs: Json | null
          segments: Json
          skill_tags: Json | null
          status: string | null
          times_used: number | null
          total_duration_minutes: number | null
          updated_at: string | null
        }
        Insert: {
          age_band: string
          avg_instructor_rating?: number | null
          class_type_id: string
          content_refs?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          guided_questions?: Json | null
          id?: string
          individual_moment_config: Json
          name: string
          quiz_refs?: Json | null
          segments: Json
          skill_tags?: Json | null
          status?: string | null
          times_used?: number | null
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Update: {
          age_band?: string
          avg_instructor_rating?: number | null
          class_type_id?: string
          content_refs?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          guided_questions?: Json | null
          id?: string
          individual_moment_config?: Json
          name?: string
          quiz_refs?: Json | null
          segments?: Json
          skill_tags?: Json | null
          status?: string | null
          times_used?: number | null
          total_duration_minutes?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_class_blueprints_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "group_class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_blueprints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_blueprints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_blueprints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_blueprints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_class_certificates: {
        Row: {
          certificate_number: string | null
          certificate_url: string | null
          child_id: string
          created_at: string | null
          delivered: boolean | null
          group_session_id: string
          id: string
          registration_id: string
          sent_at: string | null
          sent_via: string | null
        }
        Insert: {
          certificate_number?: string | null
          certificate_url?: string | null
          child_id: string
          created_at?: string | null
          delivered?: boolean | null
          group_session_id: string
          id?: string
          registration_id: string
          sent_at?: string | null
          sent_via?: string | null
        }
        Update: {
          certificate_number?: string | null
          certificate_url?: string | null
          child_id?: string
          created_at?: string | null
          delivered?: boolean | null
          group_session_id?: string
          id?: string
          registration_id?: string
          sent_at?: string | null
          sent_via?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_class_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "group_class_certificates_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_class_registrations_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "group_class_certificates_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_certificates_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "upcoming_group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_certificates_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "group_session_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_class_coupons: {
        Row: {
          applies_to_class_types: string[] | null
          code: string
          created_at: string | null
          created_by: string | null
          current_uses: number | null
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          is_enrolled_only: boolean | null
          is_first_class_only: boolean | null
          is_single_use: boolean | null
          max_uses_per_child: number | null
          max_uses_total: number | null
          min_purchase_amount: number | null
          name: string
          updated_at: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_class_types?: string[] | null
          code: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          is_enrolled_only?: boolean | null
          is_first_class_only?: boolean | null
          is_single_use?: boolean | null
          max_uses_per_child?: number | null
          max_uses_total?: number | null
          min_purchase_amount?: number | null
          name: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_class_types?: string[] | null
          code?: string
          created_at?: string | null
          created_by?: string | null
          current_uses?: number | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          is_enrolled_only?: boolean | null
          is_first_class_only?: boolean | null
          is_single_use?: boolean | null
          max_uses_per_child?: number | null
          max_uses_total?: number | null
          min_purchase_amount?: number | null
          name?: string
          updated_at?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      group_class_types: {
        Row: {
          age_max: number | null
          age_min: number | null
          color_hex: string | null
          created_at: string | null
          default_instructor_split_percent: number | null
          description: string | null
          display_order: number | null
          duration_minutes: number
          features: Json | null
          icon_emoji: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          learning_outcomes: Json | null
          max_participants: number | null
          min_participants: number | null
          name: string
          price_inr: number
          requires_book: boolean | null
          skill_tags: Json | null
          slug: string
          tagline: string | null
          typical_days: string[] | null
          typical_times: string[] | null
          updated_at: string | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          color_hex?: string | null
          created_at?: string | null
          default_instructor_split_percent?: number | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number
          features?: Json | null
          icon_emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          learning_outcomes?: Json | null
          max_participants?: number | null
          min_participants?: number | null
          name: string
          price_inr?: number
          requires_book?: boolean | null
          skill_tags?: Json | null
          slug: string
          tagline?: string | null
          typical_days?: string[] | null
          typical_times?: string[] | null
          updated_at?: string | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          color_hex?: string | null
          created_at?: string | null
          default_instructor_split_percent?: number | null
          description?: string | null
          display_order?: number | null
          duration_minutes?: number
          features?: Json | null
          icon_emoji?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          learning_outcomes?: Json | null
          max_participants?: number | null
          min_participants?: number | null
          name?: string
          price_inr?: number
          requires_book?: boolean | null
          skill_tags?: Json | null
          slug?: string
          tagline?: string | null
          typical_days?: string[] | null
          typical_times?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      group_class_waitlist: {
        Row: {
          child_id: string
          created_at: string | null
          group_session_id: string
          id: string
          notification_expires_at: string | null
          notified_at: string | null
          parent_id: string | null
          position: number
          promoted_at: string | null
          promoted_to_registration_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          child_id: string
          created_at?: string | null
          group_session_id: string
          id?: string
          notification_expires_at?: string | null
          notified_at?: string | null
          parent_id?: string | null
          position: number
          promoted_at?: string | null
          promoted_to_registration_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string | null
          group_session_id?: string
          id?: string
          notification_expires_at?: string | null
          notified_at?: string | null
          parent_id?: string | null
          position?: number
          promoted_at?: string | null
          promoted_to_registration_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_class_waitlist_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_waitlist_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "group_class_waitlist_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_class_registrations_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "group_class_waitlist_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_waitlist_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "upcoming_group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_waitlist_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_waitlist_promoted_to_registration_id_fkey"
            columns: ["promoted_to_registration_id"]
            isOneToOne: false
            referencedRelation: "group_session_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_session_participants: {
        Row: {
          amount_original: number | null
          amount_paid: number | null
          attendance_marked_at: string | null
          attendance_marked_by: string | null
          attendance_status: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          certificate_sent: boolean | null
          certificate_sent_at: string | null
          child_id: string | null
          coupon_code_used: string | null
          coupon_id: string | null
          discount_amount: number | null
          group_session_id: string | null
          id: string
          is_enrolled_free: boolean | null
          paid_at: string | null
          parent_id: string | null
          participation_notes: string | null
          participation_rating: number | null
          payment_status: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          refund_amount: number | null
          refund_status: string | null
          registration_date: string | null
          response_submitted_at: string | null
          updated_at: string | null
        }
        Insert: {
          amount_original?: number | null
          amount_paid?: number | null
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_status?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_sent?: boolean | null
          certificate_sent_at?: string | null
          child_id?: string | null
          coupon_code_used?: string | null
          coupon_id?: string | null
          discount_amount?: number | null
          group_session_id?: string | null
          id?: string
          is_enrolled_free?: boolean | null
          paid_at?: string | null
          parent_id?: string | null
          participation_notes?: string | null
          participation_rating?: number | null
          payment_status?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          refund_amount?: number | null
          refund_status?: string | null
          registration_date?: string | null
          response_submitted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_original?: number | null
          amount_paid?: number | null
          attendance_marked_at?: string | null
          attendance_marked_by?: string | null
          attendance_status?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          certificate_sent?: boolean | null
          certificate_sent_at?: string | null
          child_id?: string | null
          coupon_code_used?: string | null
          coupon_id?: string | null
          discount_amount?: number | null
          group_session_id?: string | null
          id?: string
          is_enrolled_free?: boolean | null
          paid_at?: string | null
          parent_id?: string | null
          participation_notes?: string | null
          participation_rating?: number | null
          payment_status?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          refund_amount?: number | null
          refund_status?: string | null
          registration_date?: string | null
          response_submitted_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_session_participants_attendance_marked_by_fkey"
            columns: ["attendance_marked_by"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_attendance_marked_by_fkey"
            columns: ["attendance_marked_by"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_attendance_marked_by_fkey"
            columns: ["attendance_marked_by"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_attendance_marked_by_fkey"
            columns: ["attendance_marked_by"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "group_session_participants_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "group_class_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_class_registrations_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "group_session_participants_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_group_session_id_fkey"
            columns: ["group_session_id"]
            isOneToOne: false
            referencedRelation: "upcoming_group_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_session_participants_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      group_sessions: {
        Row: {
          age_max: number | null
          age_min: number | null
          blueprint_id: string | null
          book_id: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          class_type_id: string | null
          coach_id: string | null
          completed_at: string | null
          created_at: string | null
          current_participants: number | null
          description: string | null
          duration_minutes: number
          google_calendar_event_id: string | null
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          instructor_id: string | null
          instructor_split_percent: number | null
          max_participants: number | null
          notes: string | null
          price_inr: number | null
          recall_bot_id: string | null
          registration_deadline: string | null
          scheduled_date: string
          scheduled_time: string
          session_type: string
          status: string | null
          title: string
          updated_at: string | null
          waitlist_enabled: boolean | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          blueprint_id?: string | null
          book_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          class_type_id?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_participants?: number | null
          description?: string | null
          duration_minutes: number
          google_calendar_event_id?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          instructor_id?: string | null
          instructor_split_percent?: number | null
          max_participants?: number | null
          notes?: string | null
          price_inr?: number | null
          recall_bot_id?: string | null
          registration_deadline?: string | null
          scheduled_date: string
          scheduled_time: string
          session_type: string
          status?: string | null
          title: string
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          blueprint_id?: string | null
          book_id?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          class_type_id?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          current_participants?: number | null
          description?: string | null
          duration_minutes?: number
          google_calendar_event_id?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          instructor_id?: string | null
          instructor_split_percent?: number | null
          max_participants?: number | null
          notes?: string | null
          price_inr?: number | null
          recall_bot_id?: string | null
          registration_deadline?: string | null
          scheduled_date?: string
          scheduled_time?: string
          session_type?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          waitlist_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "group_sessions_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "group_class_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_popularity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_class_type_id_fkey"
            columns: ["class_type_id"]
            isOneToOne: false
            referencedRelation: "group_class_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_sessions_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_assignments: {
        Row: {
          assigned_at: string | null
          child_id: string
          coach_feedback: string | null
          coach_id: string
          completed_at: string | null
          completion_quality: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          parent_helped: boolean | null
          passage_id: string | null
          session_id: string | null
          status: string | null
          time_spent_minutes: number | null
          topic: string
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          child_id: string
          coach_feedback?: string | null
          coach_id: string
          completed_at?: string | null
          completion_quality?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_helped?: boolean | null
          passage_id?: string | null
          session_id?: string | null
          status?: string | null
          time_spent_minutes?: number | null
          topic: string
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          child_id?: string
          coach_feedback?: string | null
          coach_id?: string
          completed_at?: string | null
          completion_quality?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          parent_helped?: boolean | null
          passage_id?: string | null
          session_id?: string | null
          status?: string | null
          time_spent_minutes?: number | null
          topic?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "homework_assignments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "homework_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_passage_id_fkey"
            columns: ["passage_id"]
            isOneToOne: false
            referencedRelation: "reading_passages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_assignments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          action_url: string | null
          body: string
          created_at: string | null
          dismissed_at: string | null
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          metadata: Json | null
          notification_type: string | null
          read_at: string | null
          title: string
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          action_url?: string | null
          body: string
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          metadata?: Json | null
          notification_type?: string | null
          read_at?: string | null
          title: string
          updated_at?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          action_url?: string | null
          body?: string
          created_at?: string | null
          dismissed_at?: string | null
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          metadata?: Json | null
          notification_type?: string | null
          read_at?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          child_id: string | null
          created_at: string | null
          direction: string | null
          duration_minutes: number | null
          id: string
          logged_by: string
          next_action: string | null
          next_followup_at: string | null
          outcome: string | null
          parent_id: string | null
          status: string | null
          summary: string
          type: string
          updated_at: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_minutes?: number | null
          id?: string
          logged_by: string
          next_action?: string | null
          next_followup_at?: string | null
          outcome?: string | null
          parent_id?: string | null
          status?: string | null
          summary: string
          type: string
          updated_at?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_minutes?: number | null
          id?: string
          logged_by?: string
          next_action?: string | null
          next_followup_at?: string | null
          outcome?: string | null
          parent_id?: string | null
          status?: string | null
          summary?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "interactions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_waitlist: {
        Row: {
          child_age: number | null
          child_name: string | null
          converted_at: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          notes: string | null
          notified_at: string | null
          phone: string
          product_slug: string
          source: string | null
          status: string | null
        }
        Insert: {
          child_age?: number | null
          child_name?: string | null
          converted_at?: string | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          notified_at?: string | null
          phone: string
          product_slug: string
          source?: string | null
          status?: string | null
        }
        Update: {
          child_age?: number | null
          child_name?: string | null
          converted_at?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          notified_at?: string | null
          phone?: string
          product_slug?: string
          source?: string | null
          status?: string | null
        }
        Relationships: []
      }
      lead_status_history: {
        Row: {
          changed_by: string
          child_id: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          to_status: string
        }
        Insert: {
          changed_by: string
          child_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string
          child_id?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_status_history_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      learning_events: {
        Row: {
          ai_summary: string | null
          child_id: string
          coach_id: string | null
          content_for_embedding: string | null
          created_at: string | null
          created_by: string | null
          data: Json
          embedding: string | null
          event_data: Json | null
          event_date: string | null
          event_subtype: string | null
          event_type: string
          id: string
          session_id: string | null
          tldv_recording_url: string | null
          tldv_transcript: string | null
          updated_at: string | null
          voice_note_transcript: string | null
          voice_note_url: string | null
        }
        Insert: {
          ai_summary?: string | null
          child_id: string
          coach_id?: string | null
          content_for_embedding?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json
          embedding?: string | null
          event_data?: Json | null
          event_date?: string | null
          event_subtype?: string | null
          event_type: string
          id?: string
          session_id?: string | null
          tldv_recording_url?: string | null
          tldv_transcript?: string | null
          updated_at?: string | null
          voice_note_transcript?: string | null
          voice_note_url?: string | null
        }
        Update: {
          ai_summary?: string | null
          child_id?: string
          coach_id?: string | null
          content_for_embedding?: string | null
          created_at?: string | null
          created_by?: string | null
          data?: Json
          embedding?: string | null
          event_data?: Json | null
          event_date?: string | null
          event_subtype?: string | null
          event_type?: string
          id?: string
          session_id?: string | null
          tldv_recording_url?: string | null
          tldv_transcript?: string | null
          updated_at?: string | null
          voice_note_transcript?: string | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "learning_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          child_id: string
          created_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          id: string
          is_flagged: boolean | null
          is_read: boolean | null
          message_text: string
          message_type: string | null
          read_at: string | null
          sender_id: string
          sender_type: string
          updated_at: string | null
        }
        Insert: {
          attachment_url?: string | null
          child_id: string
          created_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          is_read?: boolean | null
          message_text: string
          message_type?: string | null
          read_at?: string | null
          sender_id: string
          sender_type: string
          updated_at?: string | null
        }
        Update: {
          attachment_url?: string | null
          child_id?: string
          created_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean | null
          is_read?: boolean | null
          message_text?: string
          message_type?: string | null
          read_at?: string | null
          sender_id?: string
          sender_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      nps_responses: {
        Row: {
          category: string | null
          child_id: string
          child_name: string | null
          coach_id: string | null
          coach_rating: number | null
          content_rating: number | null
          created_at: string | null
          enrollment_id: string
          feedback: string | null
          google_review_clicked: boolean | null
          google_review_requested: boolean | null
          google_review_url: string | null
          highlight: string | null
          id: string
          improvement_suggestions: string | null
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          platform_rating: number | null
          score: number
          submitted_at: string | null
          testimonial: string | null
          testimonial_approved: boolean | null
          testimonial_consent: boolean | null
        }
        Insert: {
          category?: string | null
          child_id: string
          child_name?: string | null
          coach_id?: string | null
          coach_rating?: number | null
          content_rating?: number | null
          created_at?: string | null
          enrollment_id: string
          feedback?: string | null
          google_review_clicked?: boolean | null
          google_review_requested?: boolean | null
          google_review_url?: string | null
          highlight?: string | null
          id?: string
          improvement_suggestions?: string | null
          parent_email?: string | null
          parent_id?: string | null
          parent_name?: string | null
          platform_rating?: number | null
          score: number
          submitted_at?: string | null
          testimonial?: string | null
          testimonial_approved?: boolean | null
          testimonial_consent?: boolean | null
        }
        Update: {
          category?: string | null
          child_id?: string
          child_name?: string | null
          coach_id?: string | null
          coach_rating?: number | null
          content_rating?: number | null
          created_at?: string | null
          enrollment_id?: string
          feedback?: string | null
          google_review_clicked?: boolean | null
          google_review_requested?: boolean | null
          google_review_url?: string | null
          highlight?: string | null
          id?: string
          improvement_suggestions?: string | null
          parent_email?: string | null
          parent_id?: string | null
          parent_name?: string | null
          platform_rating?: number | null
          score?: number
          submitted_at?: string | null
          testimonial?: string | null
          testimonial_approved?: boolean | null
          testimonial_consent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "nps_responses_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "nps_responses_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nps_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "nps_responses_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_calls: {
        Row: {
          child_id: string | null
          coach_id: string | null
          completed_at: string | null
          created_at: string | null
          duration_minutes: number | null
          enrollment_id: string | null
          google_event_id: string | null
          google_meet_link: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          recall_bot_id: string | null
          requested_at: string | null
          scheduled_at: string | null
          status: string | null
        }
        Insert: {
          child_id?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          recall_bot_id?: string | null
          requested_at?: string | null
          scheduled_at?: string | null
          status?: string | null
        }
        Update: {
          child_id?: string | null
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          enrollment_id?: string | null
          google_event_id?: string | null
          google_meet_link?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          recall_bot_id?: string | null
          requested_at?: string | null
          scheduled_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "parent_calls_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_calls_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      parent_communications: {
        Row: {
          action_items: string[] | null
          child_id: string
          coach_id: string | null
          communication_type: string
          created_at: string | null
          direction: string
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          sentiment: string | null
          session_id: string | null
          summary: string
          topics_discussed: string[] | null
        }
        Insert: {
          action_items?: string[] | null
          child_id: string
          coach_id?: string | null
          communication_type: string
          created_at?: string | null
          direction: string
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          sentiment?: string | null
          session_id?: string | null
          summary: string
          topics_discussed?: string[] | null
        }
        Update: {
          action_items?: string[] | null
          child_id?: string
          coach_id?: string | null
          communication_type?: string
          created_at?: string | null
          direction?: string
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          sentiment?: string | null
          session_id?: string | null
          summary?: string
          topics_discussed?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_communications_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "parent_communications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_communications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      parent_daily_tasks: {
        Row: {
          child_id: string
          completed_at: string | null
          created_at: string
          description: string
          duration_minutes: number | null
          enrollment_id: string | null
          id: string
          is_completed: boolean
          linked_skill: string | null
          linked_template_code: string | null
          task_date: string
          title: string
        }
        Insert: {
          child_id: string
          completed_at?: string | null
          created_at?: string
          description: string
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string
          is_completed?: boolean
          linked_skill?: string | null
          linked_template_code?: string | null
          task_date: string
          title: string
        }
        Update: {
          child_id?: string
          completed_at?: string | null
          created_at?: string
          description?: string
          duration_minutes?: number | null
          enrollment_id?: string | null
          id?: string
          is_completed?: boolean
          linked_skill?: string | null
          linked_template_code?: string | null
          task_date?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_daily_tasks_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_daily_tasks_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "parent_daily_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_daily_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_daily_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_daily_tasks_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      parents: {
        Row: {
          created_at: string | null
          email: string
          id: string
          last_seen_at: string | null
          name: string | null
          notification_preferences: Json | null
          phone: string | null
          referral_code: string | null
          referral_credit_balance: number | null
          referral_credit_expires_at: string | null
          total_credit_earned: number | null
          total_login_count: number | null
          total_referrals: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          last_seen_at?: string | null
          name?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          referral_code?: string | null
          referral_credit_balance?: number | null
          referral_credit_expires_at?: string | null
          total_credit_earned?: number | null
          total_login_count?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          last_seen_at?: string | null
          name?: string | null
          notification_preferences?: Json | null
          phone?: string | null
          referral_code?: string | null
          referral_credit_balance?: number | null
          referral_credit_expires_at?: string | null
          total_credit_earned?: number | null
          total_login_count?: number | null
          total_referrals?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      payment_retry_tokens: {
        Row: {
          booking_id: string | null
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          booking_id?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          booking_id?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_retry_tokens_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          captured_at: string | null
          child_id: string | null
          coach_id: string | null
          coupon_code: string | null
          created_at: string | null
          currency: string | null
          discount_amount: number | null
          failure_reason: string | null
          id: string
          original_amount: number | null
          package_type: string | null
          parent_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          source: string | null
          status: string | null
        }
        Insert: {
          amount: number
          captured_at?: string | null
          child_id?: string | null
          coach_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          failure_reason?: string | null
          id?: string
          original_amount?: number | null
          package_type?: string | null
          parent_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          captured_at?: string | null
          child_id?: string | null
          coach_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          discount_amount?: number | null
          failure_reason?: string | null
          id?: string
          original_amount?: number | null
          package_type?: string | null
          parent_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_assessments: {
        Row: {
          ai_provider_used: string | null
          audio_data: string
          audio_url: string | null
          child_age: number
          child_name: string
          created_at: string
          error_message: string | null
          id: string
          lead_source: string | null
          lead_source_coach_id: string | null
          parent_email: string
          parent_name: string | null
          parent_phone: string | null
          passage: string
          processed_at: string | null
          referral_code_used: string | null
          result: Json | null
          retry_count: number
          status: string
        }
        Insert: {
          ai_provider_used?: string | null
          audio_data: string
          audio_url?: string | null
          child_age: number
          child_name: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_source?: string | null
          lead_source_coach_id?: string | null
          parent_email: string
          parent_name?: string | null
          parent_phone?: string | null
          passage: string
          processed_at?: string | null
          referral_code_used?: string | null
          result?: Json | null
          retry_count?: number
          status?: string
        }
        Update: {
          ai_provider_used?: string | null
          audio_data?: string
          audio_url?: string | null
          child_age?: number
          child_name?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_source?: string | null
          lead_source_coach_id?: string | null
          parent_email?: string
          parent_name?: string | null
          parent_phone?: string | null
          passage?: string
          processed_at?: string | null
          referral_code_used?: string | null
          result?: Json | null
          retry_count?: number
          status?: string
        }
        Relationships: []
      }
      phone_backup_20260117: {
        Row: {
          id: string | null
          phone: string | null
          tbl: string | null
        }
        Insert: {
          id?: string | null
          phone?: string | null
          tbl?: string | null
        }
        Update: {
          id?: string | null
          phone?: string | null
          tbl?: string | null
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          checkin_duration_mins: number | null
          checkin_week_schedule: Json | null
          coaching_duration_mins: number | null
          coaching_week_schedule: Json | null
          created_at: string | null
          currency: string | null
          description: string | null
          discount_label: string | null
          discounted_price: number
          display_order: number | null
          duration_checkin_mins: number | null
          duration_coaching_mins: number | null
          duration_months: number | null
          duration_skill_mins: number | null
          duration_weeks: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_locked: boolean | null
          is_visible: boolean | null
          lock_message: string | null
          name: string
          offer_valid_until: string | null
          original_price: number
          phase_number: number | null
          product_type: string | null
          sessions_checkin: number | null
          sessions_coaching: number | null
          sessions_included: number | null
          sessions_skill_building: number | null
          skill_building_duration_mins: number | null
          slug: string
          updated_at: string | null
          week_range: string | null
        }
        Insert: {
          checkin_duration_mins?: number | null
          checkin_week_schedule?: Json | null
          coaching_duration_mins?: number | null
          coaching_week_schedule?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          discount_label?: string | null
          discounted_price: number
          display_order?: number | null
          duration_checkin_mins?: number | null
          duration_coaching_mins?: number | null
          duration_months?: number | null
          duration_skill_mins?: number | null
          duration_weeks?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_locked?: boolean | null
          is_visible?: boolean | null
          lock_message?: string | null
          name: string
          offer_valid_until?: string | null
          original_price: number
          phase_number?: number | null
          product_type?: string | null
          sessions_checkin?: number | null
          sessions_coaching?: number | null
          sessions_included?: number | null
          sessions_skill_building?: number | null
          skill_building_duration_mins?: number | null
          slug: string
          updated_at?: string | null
          week_range?: string | null
        }
        Update: {
          checkin_duration_mins?: number | null
          checkin_week_schedule?: Json | null
          coaching_duration_mins?: number | null
          coaching_week_schedule?: Json | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          discount_label?: string | null
          discounted_price?: number
          display_order?: number | null
          duration_checkin_mins?: number | null
          duration_coaching_mins?: number | null
          duration_months?: number | null
          duration_skill_mins?: number | null
          duration_weeks?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_locked?: boolean | null
          is_visible?: boolean | null
          lock_message?: string | null
          name?: string
          offer_valid_until?: string | null
          original_price?: number
          phase_number?: number | null
          product_type?: string | null
          sessions_checkin?: number | null
          sessions_coaching?: number | null
          sessions_included?: number | null
          sessions_skill_building?: number | null
          skill_building_duration_mins?: number | null
          slug?: string
          updated_at?: string | null
          week_range?: string | null
        }
        Relationships: []
      }
      proactive_notifications: {
        Row: {
          channel: string
          child_id: string | null
          coach_id: string | null
          created_at: string | null
          id: string
          message_sent: string | null
          notification_type: string
          recipient_email: string | null
          recipient_phone: string | null
          recipient_role: string
          sent_at: string | null
          session_id: string | null
          status: string | null
          trigger_data: Json | null
          trigger_reason: string | null
        }
        Insert: {
          channel: string
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          id?: string
          message_sent?: string | null
          notification_type: string
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_role: string
          sent_at?: string | null
          session_id?: string | null
          status?: string | null
          trigger_data?: Json | null
          trigger_reason?: string | null
        }
        Update: {
          channel?: string
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          id?: string
          message_sent?: string | null
          notification_type?: string
          recipient_email?: string | null
          recipient_phone?: string | null
          recipient_role?: string
          sent_at?: string | null
          session_id?: string | null
          status?: string | null
          trigger_data?: Json | null
          trigger_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proactive_notifications_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_notifications_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "proactive_notifications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_notifications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_notifications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_notifications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      processed_webhooks: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          processed_at: string | null
          request_id: string | null
          webhook_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          processed_at?: string | null
          request_id?: string | null
          webhook_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          request_id?: string | null
          webhook_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          browser: string | null
          created_at: string | null
          device_type: string | null
          endpoint: string
          error_count: number | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          p256dh_key: string
          updated_at: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          auth_key: string
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          endpoint: string
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key: string
          updated_at?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          auth_key?: string
          browser?: string | null
          created_at?: string | null
          device_type?: string | null
          endpoint?: string
          error_count?: number | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          p256dh_key?: string
          updated_at?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          answers: Json | null
          child_id: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          questions: Json | null
          quiz_id: string | null
          quiz_type: string | null
          score: number | null
          session_id: string | null
          time_taken_seconds: number | null
          total: number | null
        }
        Insert: {
          answers?: Json | null
          child_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          questions?: Json | null
          quiz_id?: string | null
          quiz_type?: string | null
          score?: number | null
          session_id?: string | null
          time_taken_seconds?: number | null
          total?: number | null
        }
        Update: {
          answers?: Json | null
          child_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          questions?: Json | null
          quiz_id?: string | null
          quiz_type?: string | null
          score?: number | null
          session_id?: string | null
          time_taken_seconds?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quiz_bank"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      quiz_bank: {
        Row: {
          age_group: string | null
          age_max: number | null
          age_min: number | null
          created_at: string | null
          difficulty_level: string | null
          id: string
          is_active: boolean | null
          passing_score: number | null
          questions: Json
          skills_assessed: string[] | null
          subtopic: string | null
          time_limit_minutes: number | null
          title: string | null
          topic: string
        }
        Insert: {
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          created_at?: string | null
          difficulty_level?: string | null
          id?: string
          is_active?: boolean | null
          passing_score?: number | null
          questions: Json
          skills_assessed?: string[] | null
          subtopic?: string | null
          time_limit_minutes?: number | null
          title?: string | null
          topic: string
        }
        Update: {
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          created_at?: string | null
          difficulty_level?: string | null
          id?: string
          is_active?: boolean | null
          passing_score?: number | null
          questions?: Json
          skills_assessed?: string[] | null
          subtopic?: string | null
          time_limit_minutes?: number | null
          title?: string | null
          topic?: string
        }
        Relationships: []
      }
      rai_chat_feedback: {
        Row: {
          child_id: string | null
          created_at: string | null
          id: string
          intent: string | null
          model: string | null
          rai_response: string
          rating: string
          user_id: string
          user_query: string
          user_role: string
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          model?: string | null
          rai_response: string
          rating: string
          user_id: string
          user_query: string
          user_role: string
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          model?: string | null
          rai_response?: string
          rating?: string
          user_id?: string
          user_query?: string
          user_role?: string
        }
        Relationships: []
      }
      re_enrollment_nudges: {
        Row: {
          channel: string | null
          child_id: string
          created_at: string
          enrollment_id: string
          id: string
          nudge_number: number
          scheduled_for: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          channel?: string | null
          child_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          nudge_number: number
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          channel?: string | null
          child_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          nudge_number?: number
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "re_enrollment_nudges_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_enrollment_nudges_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "re_enrollment_nudges_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_enrollment_nudges_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_enrollment_nudges_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "re_enrollment_nudges_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      reading_goals: {
        Row: {
          achieved_at: string | null
          baseline_value: number | null
          child_id: string
          coach_id: string | null
          created_at: string | null
          current_value: number | null
          goal_description: string | null
          goal_title: string
          goal_type: string
          id: string
          status: string | null
          target_date: string | null
          target_metric: string | null
          target_value: number | null
          updated_at: string | null
        }
        Insert: {
          achieved_at?: string | null
          baseline_value?: number | null
          child_id: string
          coach_id?: string | null
          created_at?: string | null
          current_value?: number | null
          goal_description?: string | null
          goal_title: string
          goal_type: string
          id?: string
          status?: string | null
          target_date?: string | null
          target_metric?: string | null
          target_value?: number | null
          updated_at?: string | null
        }
        Update: {
          achieved_at?: string | null
          baseline_value?: number | null
          child_id?: string
          coach_id?: string | null
          created_at?: string | null
          current_value?: number | null
          goal_description?: string | null
          goal_title?: string
          goal_type?: string
          id?: string
          status?: string | null
          target_date?: string | null
          target_metric?: string | null
          target_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_goals_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "reading_goals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_goals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_goals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_goals_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_passages: {
        Row: {
          age_max: number | null
          age_min: number | null
          content: string
          created_at: string | null
          difficulty_level: number
          genre: string | null
          id: string
          is_active: boolean | null
          skills_targeted: string[] | null
          source: string | null
          theme: string | null
          title: string
          word_count: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          content: string
          created_at?: string | null
          difficulty_level: number
          genre?: string | null
          id?: string
          is_active?: boolean | null
          skills_targeted?: string[] | null
          source?: string | null
          theme?: string | null
          title: string
          word_count?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          content?: string
          created_at?: string | null
          difficulty_level?: number
          genre?: string | null
          id?: string
          is_active?: boolean | null
          skills_targeted?: string[] | null
          source?: string | null
          theme?: string | null
          title?: string
          word_count?: number | null
        }
        Relationships: []
      }
      reading_ranks: {
        Row: {
          badge_color: string
          celebration_message: string
          created_at: string | null
          emoji: string
          encouragement_message: string
          id: string
          max_score: number
          min_score: number
          rank_name: string
          sort_order: number
        }
        Insert: {
          badge_color: string
          celebration_message: string
          created_at?: string | null
          emoji: string
          encouragement_message: string
          id?: string
          max_score: number
          min_score: number
          rank_name: string
          sort_order: number
        }
        Update: {
          badge_color?: string
          celebration_message?: string
          created_at?: string | null
          emoji?: string
          encouragement_message?: string
          id?: string
          max_score?: number
          min_score?: number
          rank_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      reading_skills: {
        Row: {
          age_appropriate_from: number | null
          age_appropriate_to: number | null
          category: string
          common_issues: string | null
          created_at: string | null
          description: string | null
          difficulty_order: number | null
          id: string
          practice_activities: string[] | null
          skill_code: string
          skill_name: string
          subcategory: string | null
          teaching_tips: string | null
        }
        Insert: {
          age_appropriate_from?: number | null
          age_appropriate_to?: number | null
          category: string
          common_issues?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_order?: number | null
          id?: string
          practice_activities?: string[] | null
          skill_code: string
          skill_name: string
          subcategory?: string | null
          teaching_tips?: string | null
        }
        Update: {
          age_appropriate_from?: number | null
          age_appropriate_to?: number | null
          category?: string
          common_issues?: string | null
          created_at?: string | null
          description?: string | null
          difficulty_order?: number | null
          id?: string
          practice_activities?: string[] | null
          skill_code?: string
          skill_name?: string
          subcategory?: string | null
          teaching_tips?: string | null
        }
        Relationships: []
      }
      recall_bot_sessions: {
        Row: {
          actual_join_time: string | null
          audio_url: string | null
          bot_id: string
          child_id: string | null
          coach_id: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          id: string
          last_status_change: string | null
          leave_time: string | null
          meeting_url: string | null
          metadata: Json | null
          processing_completed_at: string | null
          recording_url: string | null
          scheduled_join_time: string | null
          session_id: string | null
          status: string | null
          status_history: Json | null
          transcript_url: string | null
          updated_at: string | null
        }
        Insert: {
          actual_join_time?: string | null
          audio_url?: string | null
          bot_id: string
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_status_change?: string | null
          leave_time?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          processing_completed_at?: string | null
          recording_url?: string | null
          scheduled_join_time?: string | null
          session_id?: string | null
          status?: string | null
          status_history?: Json | null
          transcript_url?: string | null
          updated_at?: string | null
        }
        Update: {
          actual_join_time?: string | null
          audio_url?: string | null
          bot_id?: string
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          id?: string
          last_status_change?: string | null
          leave_time?: string | null
          meeting_url?: string | null
          metadata?: Json | null
          processing_completed_at?: string | null
          recording_url?: string | null
          scheduled_join_time?: string | null
          session_id?: string | null
          status?: string | null
          status_history?: Json | null
          transcript_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recall_bot_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_bot_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "recall_bot_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_bot_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_bot_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_bot_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_bot_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_bot_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      recall_reconciliation_logs: {
        Row: {
          bot_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          session_id: string | null
          status: string | null
        }
        Insert: {
          bot_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          session_id?: string | null
          status?: string | null
        }
        Update: {
          bot_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          session_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recall_reconciliation_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recall_reconciliation_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      referral_credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          coupon_usage_id: string | null
          created_at: string | null
          description: string
          elearning_subscription_id: string | null
          enrollment_id: string | null
          group_class_registration_id: string | null
          id: string
          parent_id: string
          referred_child_id: string | null
          type: string
        }
        Insert: {
          amount: number
          balance_after: number
          coupon_usage_id?: string | null
          created_at?: string | null
          description: string
          elearning_subscription_id?: string | null
          enrollment_id?: string | null
          group_class_registration_id?: string | null
          id?: string
          parent_id: string
          referred_child_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          balance_after?: number
          coupon_usage_id?: string | null
          created_at?: string | null
          description?: string
          elearning_subscription_id?: string | null
          enrollment_id?: string | null
          group_class_registration_id?: string | null
          id?: string
          parent_id?: string
          referred_child_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_credit_transactions_coupon_usage_id_fkey"
            columns: ["coupon_usage_id"]
            isOneToOne: false
            referencedRelation: "coupon_usages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credit_transactions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "referral_credit_transactions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credit_transactions_referred_child_id_fkey"
            columns: ["referred_child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_credit_transactions_referred_child_id_fkey"
            columns: ["referred_child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      referral_visits: {
        Row: {
          coach_id: string | null
          converted: boolean | null
          converted_child_id: string | null
          created_at: string | null
          id: string
          landing_page: string | null
          referral_code: string
          user_agent: string | null
          visitor_ip: string | null
        }
        Insert: {
          coach_id?: string | null
          converted?: boolean | null
          converted_child_id?: string | null
          created_at?: string | null
          id?: string
          landing_page?: string | null
          referral_code: string
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Update: {
          coach_id?: string | null
          converted?: boolean | null
          converted_child_id?: string | null
          created_at?: string | null
          id?: string
          landing_page?: string | null
          referral_code?: string
          user_agent?: string | null
          visitor_ip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_visits_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_visits_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_visits_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_visits_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_visits_converted_child_id_fkey"
            columns: ["converted_child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_visits_converted_child_id_fkey"
            columns: ["converted_child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      revenue_split_config: {
        Row: {
          coach_cost_percent: number
          created_at: string | null
          created_by: string | null
          effective_from: string
          id: string
          is_active: boolean | null
          lead_cost_percent: number
          notes: string | null
          payout_day_of_month: number | null
          payout_frequency: string
          platform_fee_percent: number
          tds_rate_percent: number
          tds_threshold_annual: number
          updated_at: string | null
        }
        Insert: {
          coach_cost_percent?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean | null
          lead_cost_percent?: number
          notes?: string | null
          payout_day_of_month?: number | null
          payout_frequency?: string
          platform_fee_percent?: number
          tds_rate_percent?: number
          tds_threshold_annual?: number
          updated_at?: string | null
        }
        Update: {
          coach_cost_percent?: number
          created_at?: string | null
          created_by?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean | null
          lead_cost_percent?: number
          notes?: string | null
          payout_day_of_month?: number | null
          payout_frequency?: string
          platform_fee_percent?: number
          tds_rate_percent?: number
          tds_threshold_annual?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      scheduled_sessions: {
        Row: {
          action_items: string | null
          adherence_details: Json | null
          adherence_score: number | null
          ai_analysis: Json | null
          ai_summary: string | null
          attendance_count: number | null
          attendance_summary: Json | null
          audio_storage_path: string | null
          audio_url: string | null
          book_id: string | null
          bot_error_at: string | null
          bot_error_reason: string | null
          breakthrough_moment: string | null
          cal_booking_id: string | null
          child_id: string | null
          child_reading_clip_path: string | null
          coach_id: string | null
          coach_notes: string | null
          coach_reminder_1h_sent: boolean | null
          coach_reminder_1h_sent_at: string | null
          coach_reminder_24h_sent: boolean | null
          coach_reminder_24h_sent_at: string | null
          coach_voice_note_path: string | null
          companion_panel_completed: boolean | null
          completed_at: string | null
          completion_nudge_sent_at: string | null
          concern_details: string | null
          concerns_noted: string | null
          concerns_raised: string[] | null
          confidence_level: number | null
          created_at: string | null
          duration_minutes: number
          duration_seconds: number | null
          engagement_level: number | null
          enrollment_id: string | null
          escalate_to_admin: boolean | null
          failure_reason: string | null
          feedback_submitted_at: string | null
          flag_reason: string | null
          flagged_for_attention: boolean | null
          focus_area: string | null
          follow_up_date: string | null
          follow_up_needed: boolean | null
          google_event_id: string | null
          google_meet_link: string | null
          home_helpers: string[] | null
          home_practice_frequency: string | null
          homework_assigned: boolean | null
          homework_description: string | null
          homework_due_date: string | null
          homework_topic: string | null
          id: string
          is_diagnostic: boolean
          is_group_session: boolean | null
          is_makeup_session: boolean | null
          last_attempt_at: string | null
          next_retry_at: string | null
          next_session_focus: string[] | null
          no_show_detected_at: string | null
          no_show_reason: string | null
          offline_approved_at: string | null
          offline_approved_by: string | null
          offline_location: string | null
          offline_location_type: string | null
          offline_reason_detail: string | null
          offline_request_reason: string | null
          offline_request_status: string | null
          parent_change_status: string | null
          parent_communication_needed: boolean | null
          parent_feedback: string | null
          parent_sees_progress: string | null
          parent_sentiment: string | null
          parent_summary: string | null
          parent_update_needed: boolean | null
          parent_update_sent_at: string | null
          partial_reason: string | null
          prep_content_ids: string[] | null
          prep_notes: string | null
          progress_rating: number | null
          quiz_assigned: boolean | null
          quiz_assigned_id: string | null
          quiz_topic: string | null
          rating_overall: number | null
          recall_bot_id: string | null
          recall_status: string | null
          recording_processed_at: string | null
          recording_url: string | null
          remedial_trigger_source: string | null
          reminder_sent: boolean | null
          report_deadline: string | null
          report_late: boolean | null
          report_submitted_at: string | null
          request_id: string | null
          scheduled_date: string
          scheduled_time: string
          scheduling_attempts: number | null
          session_highlights: Json | null
          session_mode: string
          session_notes: string | null
          session_number: number | null
          session_started_at: string | null
          session_struggles: Json | null
          session_subtype: string | null
          session_template_id: string | null
          session_timer_seconds: number | null
          session_title: string | null
          session_type: string
          skills_improved: string[] | null
          skills_need_work: string[] | null
          skills_worked_on: string[] | null
          slot_match_type: string | null
          started_at: string | null
          status: string | null
          title: string | null
          tldv_ai_summary: string | null
          tldv_meeting_id: string | null
          tldv_processed_at: string | null
          tldv_recording_url: string | null
          tldv_transcript: string | null
          transcript: string | null
          transcript_status: string | null
          updated_at: string | null
          video_expires_at: string | null
          video_url: string | null
          voice_note_transcript: string | null
          voice_note_url: string | null
          week_number: number | null
        }
        Insert: {
          action_items?: string | null
          adherence_details?: Json | null
          adherence_score?: number | null
          ai_analysis?: Json | null
          ai_summary?: string | null
          attendance_count?: number | null
          attendance_summary?: Json | null
          audio_storage_path?: string | null
          audio_url?: string | null
          book_id?: string | null
          bot_error_at?: string | null
          bot_error_reason?: string | null
          breakthrough_moment?: string | null
          cal_booking_id?: string | null
          child_id?: string | null
          child_reading_clip_path?: string | null
          coach_id?: string | null
          coach_notes?: string | null
          coach_reminder_1h_sent?: boolean | null
          coach_reminder_1h_sent_at?: string | null
          coach_reminder_24h_sent?: boolean | null
          coach_reminder_24h_sent_at?: string | null
          coach_voice_note_path?: string | null
          companion_panel_completed?: boolean | null
          completed_at?: string | null
          completion_nudge_sent_at?: string | null
          concern_details?: string | null
          concerns_noted?: string | null
          concerns_raised?: string[] | null
          confidence_level?: number | null
          created_at?: string | null
          duration_minutes: number
          duration_seconds?: number | null
          engagement_level?: number | null
          enrollment_id?: string | null
          escalate_to_admin?: boolean | null
          failure_reason?: string | null
          feedback_submitted_at?: string | null
          flag_reason?: string | null
          flagged_for_attention?: boolean | null
          focus_area?: string | null
          follow_up_date?: string | null
          follow_up_needed?: boolean | null
          google_event_id?: string | null
          google_meet_link?: string | null
          home_helpers?: string[] | null
          home_practice_frequency?: string | null
          homework_assigned?: boolean | null
          homework_description?: string | null
          homework_due_date?: string | null
          homework_topic?: string | null
          id?: string
          is_diagnostic?: boolean
          is_group_session?: boolean | null
          is_makeup_session?: boolean | null
          last_attempt_at?: string | null
          next_retry_at?: string | null
          next_session_focus?: string[] | null
          no_show_detected_at?: string | null
          no_show_reason?: string | null
          offline_approved_at?: string | null
          offline_approved_by?: string | null
          offline_location?: string | null
          offline_location_type?: string | null
          offline_reason_detail?: string | null
          offline_request_reason?: string | null
          offline_request_status?: string | null
          parent_change_status?: string | null
          parent_communication_needed?: boolean | null
          parent_feedback?: string | null
          parent_sees_progress?: string | null
          parent_sentiment?: string | null
          parent_summary?: string | null
          parent_update_needed?: boolean | null
          parent_update_sent_at?: string | null
          partial_reason?: string | null
          prep_content_ids?: string[] | null
          prep_notes?: string | null
          progress_rating?: number | null
          quiz_assigned?: boolean | null
          quiz_assigned_id?: string | null
          quiz_topic?: string | null
          rating_overall?: number | null
          recall_bot_id?: string | null
          recall_status?: string | null
          recording_processed_at?: string | null
          recording_url?: string | null
          remedial_trigger_source?: string | null
          reminder_sent?: boolean | null
          report_deadline?: string | null
          report_late?: boolean | null
          report_submitted_at?: string | null
          request_id?: string | null
          scheduled_date: string
          scheduled_time: string
          scheduling_attempts?: number | null
          session_highlights?: Json | null
          session_mode?: string
          session_notes?: string | null
          session_number?: number | null
          session_started_at?: string | null
          session_struggles?: Json | null
          session_subtype?: string | null
          session_template_id?: string | null
          session_timer_seconds?: number | null
          session_title?: string | null
          session_type: string
          skills_improved?: string[] | null
          skills_need_work?: string[] | null
          skills_worked_on?: string[] | null
          slot_match_type?: string | null
          started_at?: string | null
          status?: string | null
          title?: string | null
          tldv_ai_summary?: string | null
          tldv_meeting_id?: string | null
          tldv_processed_at?: string | null
          tldv_recording_url?: string | null
          tldv_transcript?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
          video_expires_at?: string | null
          video_url?: string | null
          voice_note_transcript?: string | null
          voice_note_url?: string | null
          week_number?: number | null
        }
        Update: {
          action_items?: string | null
          adherence_details?: Json | null
          adherence_score?: number | null
          ai_analysis?: Json | null
          ai_summary?: string | null
          attendance_count?: number | null
          attendance_summary?: Json | null
          audio_storage_path?: string | null
          audio_url?: string | null
          book_id?: string | null
          bot_error_at?: string | null
          bot_error_reason?: string | null
          breakthrough_moment?: string | null
          cal_booking_id?: string | null
          child_id?: string | null
          child_reading_clip_path?: string | null
          coach_id?: string | null
          coach_notes?: string | null
          coach_reminder_1h_sent?: boolean | null
          coach_reminder_1h_sent_at?: string | null
          coach_reminder_24h_sent?: boolean | null
          coach_reminder_24h_sent_at?: string | null
          coach_voice_note_path?: string | null
          companion_panel_completed?: boolean | null
          completed_at?: string | null
          completion_nudge_sent_at?: string | null
          concern_details?: string | null
          concerns_noted?: string | null
          concerns_raised?: string[] | null
          confidence_level?: number | null
          created_at?: string | null
          duration_minutes?: number
          duration_seconds?: number | null
          engagement_level?: number | null
          enrollment_id?: string | null
          escalate_to_admin?: boolean | null
          failure_reason?: string | null
          feedback_submitted_at?: string | null
          flag_reason?: string | null
          flagged_for_attention?: boolean | null
          focus_area?: string | null
          follow_up_date?: string | null
          follow_up_needed?: boolean | null
          google_event_id?: string | null
          google_meet_link?: string | null
          home_helpers?: string[] | null
          home_practice_frequency?: string | null
          homework_assigned?: boolean | null
          homework_description?: string | null
          homework_due_date?: string | null
          homework_topic?: string | null
          id?: string
          is_diagnostic?: boolean
          is_group_session?: boolean | null
          is_makeup_session?: boolean | null
          last_attempt_at?: string | null
          next_retry_at?: string | null
          next_session_focus?: string[] | null
          no_show_detected_at?: string | null
          no_show_reason?: string | null
          offline_approved_at?: string | null
          offline_approved_by?: string | null
          offline_location?: string | null
          offline_location_type?: string | null
          offline_reason_detail?: string | null
          offline_request_reason?: string | null
          offline_request_status?: string | null
          parent_change_status?: string | null
          parent_communication_needed?: boolean | null
          parent_feedback?: string | null
          parent_sees_progress?: string | null
          parent_sentiment?: string | null
          parent_summary?: string | null
          parent_update_needed?: boolean | null
          parent_update_sent_at?: string | null
          partial_reason?: string | null
          prep_content_ids?: string[] | null
          prep_notes?: string | null
          progress_rating?: number | null
          quiz_assigned?: boolean | null
          quiz_assigned_id?: string | null
          quiz_topic?: string | null
          rating_overall?: number | null
          recall_bot_id?: string | null
          recall_status?: string | null
          recording_processed_at?: string | null
          recording_url?: string | null
          remedial_trigger_source?: string | null
          reminder_sent?: boolean | null
          report_deadline?: string | null
          report_late?: boolean | null
          report_submitted_at?: string | null
          request_id?: string | null
          scheduled_date?: string
          scheduled_time?: string
          scheduling_attempts?: number | null
          session_highlights?: Json | null
          session_mode?: string
          session_notes?: string | null
          session_number?: number | null
          session_started_at?: string | null
          session_struggles?: Json | null
          session_subtype?: string | null
          session_template_id?: string | null
          session_timer_seconds?: number | null
          session_title?: string | null
          session_type?: string
          skills_improved?: string[] | null
          skills_need_work?: string[] | null
          skills_worked_on?: string[] | null
          slot_match_type?: string | null
          started_at?: string | null
          status?: string | null
          title?: string | null
          tldv_ai_summary?: string | null
          tldv_meeting_id?: string | null
          tldv_processed_at?: string | null
          tldv_recording_url?: string | null
          tldv_transcript?: string | null
          transcript?: string | null
          transcript_status?: string | null
          updated_at?: string | null
          video_expires_at?: string | null
          video_url?: string | null
          voice_note_transcript?: string | null
          voice_note_url?: string | null
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "book_popularity"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "scheduled_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "scheduled_sessions_session_template_id_fkey"
            columns: ["session_template_id"]
            isOneToOne: false
            referencedRelation: "session_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduling_queue: {
        Row: {
          assigned_to: string | null
          attempts_made: number | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          session_id: string | null
          status: string | null
        }
        Insert: {
          assigned_to?: string | null
          attempts_made?: number | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string | null
        }
        Update: {
          assigned_to?: string | null
          attempts_made?: number | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          session_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduling_queue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_queue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_queue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_queue_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "scheduling_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduling_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      season_learning_plans: {
        Row: {
          adapted_from: string | null
          adapted_reason: string | null
          child_id: string
          coach_notes: string | null
          created_at: string
          difficulty_level: number | null
          id: string
          season_roadmap_id: string
          session_template_id: string | null
          skill_focus: string | null
          status: string
          week_number: number
        }
        Insert: {
          adapted_from?: string | null
          adapted_reason?: string | null
          child_id: string
          coach_notes?: string | null
          created_at?: string
          difficulty_level?: number | null
          id?: string
          season_roadmap_id: string
          session_template_id?: string | null
          skill_focus?: string | null
          status?: string
          week_number: number
        }
        Update: {
          adapted_from?: string | null
          adapted_reason?: string | null
          child_id?: string
          coach_notes?: string | null
          created_at?: string
          difficulty_level?: number | null
          id?: string
          season_roadmap_id?: string
          session_template_id?: string | null
          skill_focus?: string | null
          status?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_learning_plans_adapted_from_fkey"
            columns: ["adapted_from"]
            isOneToOne: false
            referencedRelation: "season_learning_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_learning_plans_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_learning_plans_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "season_learning_plans_season_roadmap_id_fkey"
            columns: ["season_roadmap_id"]
            isOneToOne: false
            referencedRelation: "season_roadmaps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_learning_plans_session_template_id_fkey"
            columns: ["session_template_id"]
            isOneToOne: false
            referencedRelation: "session_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      season_roadmaps: {
        Row: {
          child_id: string
          completed_at: string | null
          created_at: string
          enrollment_id: string | null
          estimated_sessions: number | null
          focus_area: string
          id: string
          milestone_description: string
          season_name: string
          season_number: number
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          child_id: string
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string | null
          estimated_sessions?: number | null
          focus_area: string
          id?: string
          milestone_description: string
          season_name: string
          season_number: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string | null
          estimated_sessions?: number | null
          focus_area?: string
          id?: string
          milestone_description?: string
          season_name?: string
          season_number?: number
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_roadmaps_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_roadmaps_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "season_roadmaps_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_roadmaps_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_roadmaps_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "season_roadmaps_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      session_activity_log: {
        Row: {
          activity_index: number
          activity_name: string
          activity_purpose: string | null
          actual_duration_seconds: number | null
          coach_note: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          planned_duration_minutes: number | null
          session_id: string
          source: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          activity_index: number
          activity_name: string
          activity_purpose?: string | null
          actual_duration_seconds?: number | null
          coach_note?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          planned_duration_minutes?: number | null
          session_id: string
          source?: string | null
          started_at?: string | null
          status: string
        }
        Update: {
          activity_index?: number
          activity_name?: string
          activity_purpose?: string | null
          actual_duration_seconds?: number | null
          coach_note?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          planned_duration_minutes?: number | null
          session_id?: string
          source?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_activity_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_activity_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_change_requests: {
        Row: {
          change_type: string
          child_id: string | null
          created_at: string | null
          enrollment_id: string
          hours_notice: number | null
          id: string
          initiated_by: string
          original_datetime: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          reason_category: string | null
          rejection_reason: string | null
          requested_new_datetime: string | null
          session_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          change_type: string
          child_id?: string | null
          created_at?: string | null
          enrollment_id: string
          hours_notice?: number | null
          id?: string
          initiated_by: string
          original_datetime: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          reason_category?: string | null
          rejection_reason?: string | null
          requested_new_datetime?: string | null
          session_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          change_type?: string
          child_id?: string | null
          created_at?: string | null
          enrollment_id?: string
          hours_notice?: number | null
          id?: string
          initiated_by?: string
          original_datetime?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          reason_category?: string | null
          rejection_reason?: string | null
          requested_new_datetime?: string | null
          session_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_change_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_change_requests_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "session_change_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_change_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_change_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_change_requests_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_change_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_change_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_duration_rules: {
        Row: {
          created_at: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          max_age: number
          min_age: number
          session_type: string | null
        }
        Insert: {
          created_at?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean | null
          max_age: number
          min_age: number
          session_type?: string | null
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          max_age?: number
          min_age?: number
          session_type?: string | null
        }
        Relationships: []
      }
      session_holds: {
        Row: {
          child_id: string | null
          coach_id: string
          converted_to_session_id: string | null
          created_at: string | null
          duration_minutes: number
          expires_at: string | null
          held_at: string | null
          id: string
          parent_email: string | null
          session_type: string | null
          slot_date: string
          slot_time: string
          status: string | null
        }
        Insert: {
          child_id?: string | null
          coach_id: string
          converted_to_session_id?: string | null
          created_at?: string | null
          duration_minutes: number
          expires_at?: string | null
          held_at?: string | null
          id?: string
          parent_email?: string | null
          session_type?: string | null
          slot_date: string
          slot_time: string
          status?: string | null
        }
        Update: {
          child_id?: string | null
          coach_id?: string
          converted_to_session_id?: string | null
          created_at?: string | null
          duration_minutes?: number
          expires_at?: string | null
          held_at?: string | null
          id?: string
          parent_email?: string | null
          session_type?: string | null
          slot_date?: string
          slot_time?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_holds_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_holds_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "session_holds_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_holds_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_holds_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_holds_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      session_incidents: {
        Row: {
          admin_notes: string | null
          child_id: string | null
          coach_id: string
          coach_response: string | null
          created_at: string | null
          detected_at: string
          id: string
          incident_type: string
          parent_communication_notes: string | null
          parent_notified_at: string | null
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          response_received_at: string | null
          score_penalty: number | null
          session_id: string
        }
        Insert: {
          admin_notes?: string | null
          child_id?: string | null
          coach_id: string
          coach_response?: string | null
          created_at?: string | null
          detected_at: string
          id?: string
          incident_type: string
          parent_communication_notes?: string | null
          parent_notified_at?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_received_at?: string | null
          score_penalty?: number | null
          session_id: string
        }
        Update: {
          admin_notes?: string | null
          child_id?: string | null
          coach_id?: string
          coach_response?: string | null
          created_at?: string | null
          detected_at?: string
          id?: string
          incident_type?: string
          parent_communication_notes?: string | null
          parent_notified_at?: string | null
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          response_received_at?: string | null
          score_penalty?: number | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_incidents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_incidents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "session_incidents_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_incidents_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_incidents_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_incidents_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_incidents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_incidents_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_notes: {
        Row: {
          areas_to_improve: string | null
          child_id: string | null
          coach_id: string | null
          created_at: string | null
          highlights: string | null
          homework_assigned: string | null
          id: string
          notes: string
          parent_feedback: string | null
          session_id: string | null
          updated_at: string | null
        }
        Insert: {
          areas_to_improve?: string | null
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          highlights?: string | null
          homework_assigned?: string | null
          id?: string
          notes: string
          parent_feedback?: string | null
          session_id?: string | null
          updated_at?: string | null
        }
        Update: {
          areas_to_improve?: string | null
          child_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          highlights?: string | null
          homework_assigned?: string | null
          id?: string
          notes?: string
          parent_feedback?: string | null
          session_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "session_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scheduled_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session_recording_status"
            referencedColumns: ["session_id"]
          },
        ]
      }
      session_templates: {
        Row: {
          activity_flow: Json | null
          age_band: string
          coach_prep_notes: string | null
          created_at: string
          created_by: string
          description: string | null
          difficulty_level: number
          duration_minutes: number
          id: string
          is_active: boolean
          is_diagnostic: boolean
          is_season_finale: boolean
          materials_needed: string[] | null
          parent_involvement: string | null
          prerequisites: string[] | null
          recommended_order: number | null
          skill_dimensions: string[]
          template_code: string
          title: string
          updated_at: string
        }
        Insert: {
          activity_flow?: Json | null
          age_band: string
          coach_prep_notes?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          difficulty_level: number
          duration_minutes: number
          id?: string
          is_active?: boolean
          is_diagnostic?: boolean
          is_season_finale?: boolean
          materials_needed?: string[] | null
          parent_involvement?: string | null
          prerequisites?: string[] | null
          recommended_order?: number | null
          skill_dimensions?: string[]
          template_code: string
          title: string
          updated_at?: string
        }
        Update: {
          activity_flow?: Json | null
          age_band?: string
          coach_prep_notes?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          difficulty_level?: number
          duration_minutes?: number
          id?: string
          is_active?: boolean
          is_diagnostic?: boolean
          is_season_finale?: boolean
          materials_needed?: string[] | null
          parent_involvement?: string | null
          prerequisites?: string[] | null
          recommended_order?: number | null
          skill_dimensions?: string[]
          template_code?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_templates_age_band_fkey"
            columns: ["age_band"]
            isOneToOne: false
            referencedRelation: "age_band_config"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          ab_test_enabled: boolean | null
          ab_test_name: string | null
          ab_test_split: number | null
          category: string
          description: string | null
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          ab_test_enabled?: boolean | null
          ab_test_name?: string | null
          ab_test_split?: number | null
          category: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          ab_test_enabled?: boolean | null
          ab_test_name?: string | null
          ab_test_split?: number | null
          category?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      skill_tags_master: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          tag_name: string
          tag_slug: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          tag_name: string
          tag_slug: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          tag_name?: string
          tag_slug?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          child_name: string | null
          coach_name: string | null
          created_at: string | null
          description: string
          id: string
          priority: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string | null
          subject: string | null
          ticket_number: string | null
          updated_at: string | null
          user_email: string
          user_name: string | null
          user_type: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          child_name?: string | null
          coach_name?: string | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          user_email: string
          user_name?: string | null
          user_type: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          child_name?: string | null
          coach_name?: string | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
          subject?: string | null
          ticket_number?: string | null
          updated_at?: string | null
          user_email?: string
          user_name?: string | null
          user_type?: string
        }
        Relationships: []
      }
      system_schedule_defaults: {
        Row: {
          created_at: string | null
          day_of_week: number
          description: string | null
          end_time: string
          id: string
          is_available: boolean | null
          start_time: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: number
          description?: string | null
          end_time: string
          id?: string
          is_available?: boolean | null
          start_time: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number
          description?: string | null
          end_time?: string
          id?: string
          is_available?: boolean | null
          start_time?: string
        }
        Relationships: []
      }
      tds_ledger: {
        Row: {
          challan_number: string | null
          coach_id: string
          coach_name: string | null
          coach_pan: string | null
          created_at: string | null
          deposit_date: string | null
          deposited: boolean | null
          financial_year: string
          gross_amount: number
          id: string
          payout_id: string | null
          quarter: string
          section: string | null
          tds_amount: number
          tds_rate: number
          updated_at: string | null
        }
        Insert: {
          challan_number?: string | null
          coach_id: string
          coach_name?: string | null
          coach_pan?: string | null
          created_at?: string | null
          deposit_date?: string | null
          deposited?: boolean | null
          financial_year: string
          gross_amount: number
          id?: string
          payout_id?: string | null
          quarter: string
          section?: string | null
          tds_amount: number
          tds_rate: number
          updated_at?: string | null
        }
        Update: {
          challan_number?: string | null
          coach_id?: string
          coach_name?: string | null
          coach_pan?: string | null
          created_at?: string | null
          deposit_date?: string | null
          deposited?: boolean | null
          financial_year?: string
          gross_amount?: number
          id?: string
          payout_id?: string | null
          quarter?: string
          section?: string | null
          tds_amount?: number
          tds_rate?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tds_ledger_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tds_ledger_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tds_ledger_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tds_ledger_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tds_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "coach_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      termination_logs: {
        Row: {
          amount_paid: number | null
          child_id: string | null
          coach_id: string | null
          coach_settlement: number | null
          created_at: string | null
          enrollment_id: string | null
          id: string
          platform_settlement: number | null
          refund_amount: number | null
          sessions_completed: number | null
          sessions_remaining: number | null
          terminated_by: string | null
          termination_reason: string | null
        }
        Insert: {
          amount_paid?: number | null
          child_id?: string | null
          coach_id?: string | null
          coach_settlement?: number | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          platform_settlement?: number | null
          refund_amount?: number | null
          sessions_completed?: number | null
          sessions_remaining?: number | null
          terminated_by?: string | null
          termination_reason?: string | null
        }
        Update: {
          amount_paid?: number | null
          child_id?: string | null
          coach_id?: string | null
          coach_settlement?: number | null
          created_at?: string | null
          enrollment_id?: string | null
          id?: string
          platform_settlement?: number | null
          refund_amount?: number | null
          sessions_completed?: number | null
          sessions_remaining?: number | null
          terminated_by?: string | null
          termination_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "termination_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termination_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "termination_logs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termination_logs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termination_logs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "termination_logs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          child_age: number | null
          child_name: string | null
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          is_featured: boolean | null
          parent_location: string | null
          parent_name: string
          rating: number | null
          testimonial_text: string
          updated_at: string | null
        }
        Insert: {
          child_age?: number | null
          child_name?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          parent_location?: string | null
          parent_name: string
          rating?: number | null
          testimonial_text: string
          updated_at?: string | null
        }
        Update: {
          child_age?: number | null
          child_name?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          parent_location?: string | null
          parent_name?: string
          rating?: number | null
          testimonial_text?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      time_buckets: {
        Row: {
          default_enabled: boolean | null
          display_name: string
          emoji: string | null
          end_hour: number
          id: string
          name: string
          sort_order: number | null
          start_hour: number
        }
        Insert: {
          default_enabled?: boolean | null
          display_name: string
          emoji?: string | null
          end_hour: number
          id?: string
          name: string
          sort_order?: number | null
          start_hour: number
        }
        Update: {
          default_enabled?: boolean | null
          display_name?: string
          emoji?: string | null
          end_hour?: number
          id?: string
          name?: string
          sort_order?: number | null
          start_hour?: number
        }
        Relationships: []
      }
      verification_tokens: {
        Row: {
          attempts: number | null
          created_at: string | null
          expires_at: string
          id: string
          identifier: string
          identifier_type: string
          max_attempts: number | null
          purpose: string
          token_hash: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          identifier: string
          identifier_type: string
          max_attempts?: number | null
          purpose: string
          token_hash: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          identifier?: string
          identifier_type?: string
          max_attempts?: number | null
          purpose?: string
          token_hash?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      video_quizzes: {
        Row: {
          correct_option_id: string
          created_at: string | null
          display_order: number
          explanation: string | null
          id: string
          options: Json
          points: number | null
          question_text: string
          question_type: string | null
          updated_at: string | null
          video_id: string | null
        }
        Insert: {
          correct_option_id: string
          created_at?: string | null
          display_order?: number
          explanation?: string | null
          id?: string
          options: Json
          points?: number | null
          question_text: string
          question_type?: string | null
          updated_at?: string | null
          video_id?: string | null
        }
        Update: {
          correct_option_id?: string
          created_at?: string | null
          display_order?: number
          explanation?: string | null
          id?: string
          options?: Json
          points?: number | null
          question_text?: string
          question_type?: string | null
          updated_at?: string | null
          video_id?: string | null
        }
        Relationships: []
      }
      video_watch_sessions: {
        Row: {
          child_id: string | null
          device_type: string | null
          end_position_seconds: number | null
          id: string
          pauses: number | null
          replays: number | null
          seeks: number | null
          session_end: string | null
          session_start: string | null
          start_position_seconds: number | null
          user_agent: string | null
          video_id: string | null
        }
        Insert: {
          child_id?: string | null
          device_type?: string | null
          end_position_seconds?: number | null
          id?: string
          pauses?: number | null
          replays?: number | null
          seeks?: number | null
          session_end?: string | null
          session_start?: string | null
          start_position_seconds?: number | null
          user_agent?: string | null
          video_id?: string | null
        }
        Update: {
          child_id?: string | null
          device_type?: string | null
          end_position_seconds?: number | null
          id?: string
          pauses?: number | null
          replays?: number | null
          seeks?: number | null
          session_end?: string | null
          session_start?: string | null
          start_position_seconds?: number | null
          user_agent?: string | null
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_watch_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_watch_sessions_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      wa_lead_conversations: {
        Row: {
          assigned_agent: string | null
          child_id: string | null
          collected_data: Json
          consent_given: boolean
          consent_given_at: string | null
          created_at: string
          current_state: string
          discovery_call_id: string | null
          id: string
          is_bot_active: boolean
          last_message_at: string
          lead_score: number
          phone_number: string
          updated_at: string
        }
        Insert: {
          assigned_agent?: string | null
          child_id?: string | null
          collected_data?: Json
          consent_given?: boolean
          consent_given_at?: string | null
          created_at?: string
          current_state?: string
          discovery_call_id?: string | null
          id?: string
          is_bot_active?: boolean
          last_message_at?: string
          lead_score?: number
          phone_number: string
          updated_at?: string
        }
        Update: {
          assigned_agent?: string | null
          child_id?: string | null
          collected_data?: Json
          consent_given?: boolean
          consent_given_at?: string | null
          created_at?: string
          current_state?: string
          discovery_call_id?: string | null
          id?: string
          is_bot_active?: boolean
          last_message_at?: string
          lead_score?: number
          phone_number?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wa_lead_conversations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_lead_conversations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "wa_lead_conversations_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "coach_discovery_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_lead_conversations_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_lead_conversations_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls_need_followup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_lead_conversations_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls_pending_assignment"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_lead_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          direction: string
          id: string
          message_type: string
          metadata: Json | null
          sender_type: string
          wa_message_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          direction: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_type: string
          wa_message_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          direction?: string
          id?: string
          message_type?: string
          metadata?: Json | null
          sender_type?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_lead_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_lead_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      wa_leads: {
        Row: {
          child_age: number | null
          child_id: string | null
          child_name: string | null
          city: string | null
          conversation_id: string | null
          created_at: string
          discovery_call_id: string | null
          enrollment_id: string | null
          id: string
          lead_score: number
          notes: string | null
          parent_name: string | null
          phone_number: string
          reading_concerns: string | null
          school: string | null
          source: string
          status: string
          updated_at: string
          urgency: string | null
        }
        Insert: {
          child_age?: number | null
          child_id?: string | null
          child_name?: string | null
          city?: string | null
          conversation_id?: string | null
          created_at?: string
          discovery_call_id?: string | null
          enrollment_id?: string | null
          id?: string
          lead_score?: number
          notes?: string | null
          parent_name?: string | null
          phone_number: string
          reading_concerns?: string | null
          school?: string | null
          source?: string
          status?: string
          updated_at?: string
          urgency?: string | null
        }
        Update: {
          child_age?: number | null
          child_id?: string | null
          child_name?: string | null
          city?: string | null
          conversation_id?: string | null
          created_at?: string
          discovery_call_id?: string | null
          enrollment_id?: string | null
          id?: string
          lead_score?: number
          notes?: string | null
          parent_name?: string | null
          phone_number?: string
          reading_concerns?: string | null
          school?: string | null
          source?: string
          status?: string
          updated_at?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wa_leads_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "wa_leads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "wa_lead_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "coach_discovery_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls_need_followup"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_discovery_call_id_fkey"
            columns: ["discovery_call_id"]
            isOneToOne: false
            referencedRelation: "discovery_calls_pending_assignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pause_ending"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments_pending_start"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wa_leads_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      wcpm_benchmarks: {
        Row: {
          assessment_period: string
          created_at: string | null
          grade_level: number
          id: string
          percentile_10: number | null
          percentile_25: number | null
          percentile_50: number | null
          percentile_75: number | null
          percentile_90: number | null
          source: string | null
          year: number | null
        }
        Insert: {
          assessment_period: string
          created_at?: string | null
          grade_level: number
          id?: string
          percentile_10?: number | null
          percentile_25?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          source?: string | null
          year?: number | null
        }
        Update: {
          assessment_period?: string
          created_at?: string | null
          grade_level?: number
          id?: string
          percentile_10?: number | null
          percentile_25?: number | null
          percentile_50?: number | null
          percentile_75?: number | null
          percentile_90?: number | null
          source?: string | null
          year?: number | null
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string
          template: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          template: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          template?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      xp_levels: {
        Row: {
          icon: string | null
          level: number
          perks: Json | null
          title: string | null
          xp_required: number
        }
        Insert: {
          icon?: string | null
          level: number
          perks?: Json | null
          title?: string | null
          xp_required: number
        }
        Update: {
          icon?: string | null
          level?: number
          perks?: Json | null
          title?: string | null
          xp_required?: number
        }
        Relationships: []
      }
    }
    Views: {
      badge_definitions: {
        Row: {
          coins_reward: number | null
          created_at: string | null
          criteria_extra: Json | null
          criteria_type: string | null
          criteria_value: number | null
          description: string | null
          icon: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          name: string | null
          order_index: number | null
          rarity: string | null
          slug: string | null
          xp_reward: number | null
        }
        Insert: {
          coins_reward?: number | null
          created_at?: string | null
          criteria_extra?: Json | null
          criteria_type?: string | null
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          name?: string | null
          order_index?: number | null
          rarity?: string | null
          slug?: string | null
          xp_reward?: number | null
        }
        Update: {
          coins_reward?: number | null
          created_at?: string | null
          criteria_extra?: Json | null
          criteria_type?: string | null
          criteria_value?: number | null
          description?: string | null
          icon?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          name?: string | null
          order_index?: number | null
          rarity?: string | null
          slug?: string | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      book_popularity: {
        Row: {
          age_max: number | null
          age_min: number | null
          author: string | null
          average_rating: number | null
          cover_image_url: string | null
          id: string | null
          popularity_score: number | null
          reading_level: string | null
          times_read_in_sessions: number | null
          title: string | null
          total_requests: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          author?: string | null
          average_rating?: number | null
          cover_image_url?: string | null
          id?: string | null
          popularity_score?: never
          reading_level?: string | null
          times_read_in_sessions?: number | null
          title?: string | null
          total_requests?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          author?: string | null
          average_rating?: number | null
          cover_image_url?: string | null
          id?: string | null
          popularity_score?: never
          reading_level?: string | null
          times_read_in_sessions?: number | null
          title?: string | null
          total_requests?: number | null
        }
        Relationships: []
      }
      child_badges: {
        Row: {
          badge_id: string | null
          child_id: string | null
          earned_at: string | null
          earned_context: string | null
          id: string | null
        }
        Insert: {
          badge_id?: string | null
          child_id?: string | null
          earned_at?: string | null
          earned_context?: string | null
          id?: string | null
        }
        Update: {
          badge_id?: string | null
          child_id?: string | null
          earned_at?: string | null
          earned_context?: string | null
          id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badge_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "el_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_badges_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_badges_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      child_gamification: {
        Row: {
          child_id: string | null
          created_at: string | null
          current_level: number | null
          current_streak_days: number | null
          games_played: number | null
          games_won: number | null
          id: string | null
          last_activity_date: string | null
          longest_streak_days: number | null
          perfect_quiz_count: number | null
          perfect_scores: number | null
          total_coins: number | null
          total_games_completed: number | null
          total_perfect_scores: number | null
          total_quizzes_completed: number | null
          total_readings_completed: number | null
          total_time_minutes: number | null
          total_units_completed: number | null
          total_videos_completed: number | null
          total_xp: number | null
          units_completed: number | null
          updated_at: string | null
          videos_watched: number | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          current_level?: number | null
          current_streak_days?: number | null
          games_played?: number | null
          games_won?: number | null
          id?: string | null
          last_activity_date?: string | null
          longest_streak_days?: number | null
          perfect_quiz_count?: number | null
          perfect_scores?: number | null
          total_coins?: number | null
          total_games_completed?: number | null
          total_perfect_scores?: number | null
          total_quizzes_completed?: number | null
          total_readings_completed?: number | null
          total_time_minutes?: number | null
          total_units_completed?: number | null
          total_videos_completed?: number | null
          total_xp?: number | null
          units_completed?: number | null
          updated_at?: string | null
          videos_watched?: number | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          current_level?: number | null
          current_streak_days?: number | null
          games_played?: number | null
          games_won?: number | null
          id?: string | null
          last_activity_date?: string | null
          longest_streak_days?: number | null
          perfect_quiz_count?: number | null
          perfect_scores?: number | null
          total_coins?: number | null
          total_games_completed?: number | null
          total_perfect_scores?: number | null
          total_quizzes_completed?: number | null
          total_readings_completed?: number | null
          total_time_minutes?: number | null
          total_units_completed?: number | null
          total_videos_completed?: number | null
          total_xp?: number | null
          units_completed?: number | null
          updated_at?: string | null
          videos_watched?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_gamification_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_gamification_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: true
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      child_unit_progress: {
        Row: {
          badge_earned: boolean | null
          best_game_score: number | null
          best_score: number | null
          child_id: string | null
          coins_earned: number | null
          completed_at: string | null
          completion_percentage: number | null
          created_at: string | null
          current_step: number | null
          games_passed: number | null
          games_played: number | null
          id: string | null
          interval_days: number | null
          last_activity_at: string | null
          next_review_at: string | null
          overall_mastery_percent: number | null
          quiz_score: number | null
          review_count: number | null
          sequence_shown: Json | null
          started_at: string | null
          status: string | null
          step_progress: Json | null
          total_xp_earned: number | null
          unit_id: string | null
          unlocked_at: string | null
          updated_at: string | null
          video_watch_percent: number | null
          xp_earned: number | null
        }
        Insert: {
          badge_earned?: boolean | null
          best_game_score?: number | null
          best_score?: number | null
          child_id?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          games_passed?: number | null
          games_played?: number | null
          id?: string | null
          interval_days?: number | null
          last_activity_at?: string | null
          next_review_at?: string | null
          overall_mastery_percent?: number | null
          quiz_score?: number | null
          review_count?: number | null
          sequence_shown?: Json | null
          started_at?: string | null
          status?: string | null
          step_progress?: Json | null
          total_xp_earned?: number | null
          unit_id?: string | null
          unlocked_at?: string | null
          updated_at?: string | null
          video_watch_percent?: number | null
          xp_earned?: number | null
        }
        Update: {
          badge_earned?: boolean | null
          best_game_score?: number | null
          best_score?: number | null
          child_id?: string | null
          coins_earned?: number | null
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          games_passed?: number | null
          games_played?: number | null
          id?: string | null
          interval_days?: number | null
          last_activity_at?: string | null
          next_review_at?: string | null
          overall_mastery_percent?: number | null
          quiz_score?: number | null
          review_count?: number | null
          sequence_shown?: Json | null
          started_at?: string | null
          status?: string | null
          step_progress?: Json | null
          total_xp_earned?: number | null
          unit_id?: string | null
          unlocked_at?: string | null
          updated_at?: string | null
          video_watch_percent?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_unit_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_unit_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "el_child_unit_progress_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "el_learning_units"
            referencedColumns: ["id"]
          },
        ]
      }
      child_video_progress: {
        Row: {
          best_quiz_score: number | null
          child_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string | null
          is_completed: boolean | null
          quiz_attempted: boolean | null
          quiz_attempts: number | null
          quiz_completed_at: string | null
          quiz_passed: boolean | null
          quiz_score: number | null
          times_watched: number | null
          unit_id: string | null
          updated_at: string | null
          video_id: string | null
          watch_percent: number | null
          watch_time_seconds: number | null
          xp_earned: number | null
        }
        Insert: {
          best_quiz_score?: number | null
          child_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string | null
          is_completed?: boolean | null
          quiz_attempted?: boolean | null
          quiz_attempts?: number | null
          quiz_completed_at?: string | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          times_watched?: number | null
          unit_id?: string | null
          updated_at?: string | null
          video_id?: string | null
          watch_percent?: number | null
          watch_time_seconds?: number | null
          xp_earned?: number | null
        }
        Update: {
          best_quiz_score?: number | null
          child_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string | null
          is_completed?: boolean | null
          quiz_attempted?: boolean | null
          quiz_attempts?: number | null
          quiz_completed_at?: string | null
          quiz_passed?: boolean | null
          quiz_score?: number | null
          times_watched?: number | null
          unit_id?: string | null
          updated_at?: string | null
          video_id?: string | null
          watch_percent?: number | null
          watch_time_seconds?: number | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "el_child_video_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_video_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "el_child_video_progress_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "el_learning_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "el_child_video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "el_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_activity_summary: {
        Row: {
          activity_status: string | null
          email: string | null
          id: string | null
          is_available: boolean | null
          last_seen_at: string | null
          name: string | null
          total_login_count: number | null
        }
        Insert: {
          activity_status?: never
          email?: string | null
          id?: string | null
          is_available?: boolean | null
          last_seen_at?: string | null
          name?: string | null
          total_login_count?: number | null
        }
        Update: {
          activity_status?: never
          email?: string | null
          id?: string | null
          is_available?: boolean | null
          last_seen_at?: string | null
          name?: string | null
          total_login_count?: number | null
        }
        Relationships: []
      }
      coach_discovery_calls: {
        Row: {
          assessment_feedback: string | null
          assessment_id: string | null
          assessment_score: number | null
          assessment_wpm: number | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_coach_id: string | null
          cal_booking_id: number | null
          cal_booking_uid: string | null
          cal_event_type_id: number | null
          child_age: number | null
          child_id: string | null
          child_name: string | null
          coach_email: string | null
          coach_name: string | null
          converted_at: string | null
          converted_to_enrollment: boolean | null
          created_at: string | null
          enrollment_id: string | null
          followup_count: number | null
          followup_sent_at: string | null
          id: string | null
          meeting_url: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          payment_link: string | null
          payment_link_sent_at: string | null
          questionnaire: Json | null
          scheduled_at: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      coach_workload: {
        Row: {
          active_enrollments: number | null
          available_slots: number | null
          current_students: number | null
          email: string | null
          has_upcoming_unavailability: boolean | null
          id: string | null
          is_active: boolean | null
          is_available: boolean | null
          max_students: number | null
          name: string | null
        }
        Insert: {
          active_enrollments?: never
          available_slots?: never
          current_students?: number | null
          email?: string | null
          has_upcoming_unavailability?: never
          id?: string | null
          is_active?: boolean | null
          is_available?: boolean | null
          max_students?: number | null
          name?: string | null
        }
        Update: {
          active_enrollments?: never
          available_slots?: never
          current_students?: number | null
          email?: string | null
          has_upcoming_unavailability?: never
          id?: string | null
          is_active?: boolean | null
          is_available?: boolean | null
          max_students?: number | null
          name?: string | null
        }
        Relationships: []
      }
      coaches_with_groups: {
        Row: {
          aadhaar_last_four: string | null
          agreement_ip_address: string | null
          agreement_pdf_url: string | null
          agreement_signature_url: string | null
          agreement_signed_at: string | null
          agreement_url: string | null
          agreement_user_agent: string | null
          agreement_version: string | null
          agreement_version_id: string | null
          application_id: string | null
          avatar_url: string | null
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_ifsc: string | null
          bank_name: string | null
          bio: string | null
          cal_event_type_id: number | null
          cal_username: string | null
          can_mentor: boolean | null
          certifications: string[] | null
          city: string | null
          coach_cost_percent: number | null
          coach_split_percentage: number | null
          created_at: string | null
          current_children: number | null
          current_score: number | null
          current_students: number | null
          current_tier: string | null
          email: string | null
          group_badge_color: string | null
          group_display_name: string | null
          group_id: string | null
          group_name: string | null
          gst_number: string | null
          hourly_rate: number | null
          id: string | null
          is_accepting_new: boolean | null
          is_active: boolean | null
          is_available: boolean | null
          is_featured: boolean | null
          is_internal: boolean | null
          last_seen_at: string | null
          lead_cost_percent: number | null
          lifetime_earnings: number | null
          max_children: number | null
          max_students: number | null
          name: string | null
          notes: string | null
          onboarding_complete: boolean | null
          orientation_completed_at: string | null
          pan_number: string | null
          payout_enabled: boolean | null
          phone: string | null
          photo_url: string | null
          platform_fee_percent: number | null
          razorpay_contact_id: string | null
          razorpay_fund_account_id: string | null
          referral_code: string | null
          referral_link: string | null
          slug: string | null
          specializations: string[] | null
          tax_id_type: string | null
          tds_cumulative_fy: number | null
          total_children_coached: number | null
          total_login_count: number | null
          total_sessions_completed: number | null
          training_completed_at: string | null
          updated_at: string | null
          upi_id: string | null
          whatsapp_number: string | null
          yestoryd_split_percentage: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coaches_agreement_version_id_fkey"
            columns: ["agreement_version_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "coach_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coaches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "coach_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funnel_metrics: {
        Row: {
          assessment_to_call_pct: number | null
          call_completion_pct: number | null
          call_to_enrollment_pct: number | null
          calls_booked: number | null
          calls_completed: number | null
          calls_no_show: number | null
          enrolled: number | null
          total_assessments: number | null
        }
        Relationships: []
      }
      discovery_calls_need_followup: {
        Row: {
          assessment_feedback: string | null
          assessment_id: string | null
          assessment_score: number | null
          assessment_wpm: number | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_coach_id: string | null
          cal_booking_id: number | null
          cal_booking_uid: string | null
          cal_event_type_id: number | null
          child_age: number | null
          child_id: string | null
          child_name: string | null
          coach_name: string | null
          converted_at: string | null
          converted_to_enrollment: boolean | null
          created_at: string | null
          enrollment_id: string | null
          followup_count: number | null
          followup_sent_at: string | null
          hours_since_payment_link: number | null
          id: string | null
          meeting_url: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          payment_link: string | null
          payment_link_sent_at: string | null
          questionnaire: Json | null
          scheduled_at: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      discovery_calls_pending_assignment: {
        Row: {
          assessment_feedback: string | null
          assessment_id: string | null
          assessment_score: number | null
          assessment_wpm: number | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_coach_id: string | null
          cal_booking_id: number | null
          cal_booking_uid: string | null
          cal_event_type_id: number | null
          child_age: number | null
          child_id: string | null
          child_name: string | null
          coach_name: string | null
          converted_at: string | null
          converted_to_enrollment: boolean | null
          created_at: string | null
          enrollment_id: string | null
          followup_count: number | null
          followup_sent_at: string | null
          id: string | null
          meeting_url: string | null
          parent_email: string | null
          parent_name: string | null
          parent_phone: string | null
          payment_link: string | null
          payment_link_sent_at: string | null
          questionnaire: Json | null
          scheduled_at: string | null
          source: string | null
          status: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_assigned_coach_id_fkey"
            columns: ["assigned_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_calls_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
        ]
      }
      enrollments_pause_ending: {
        Row: {
          actual_start_date: string | null
          amount: number | null
          child_id: string | null
          child_name: string | null
          coach_assigned_by: string | null
          coach_email: string | null
          coach_id: string | null
          coach_name: string | null
          coach_settlement: number | null
          created_at: string | null
          id: string | null
          is_paused: boolean | null
          lead_source: string | null
          lead_source_coach_id: string | null
          original_coach_id: string | null
          original_end_date: string | null
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          parent_phone: string | null
          pause_count: number | null
          pause_end_date: string | null
          pause_reason: string | null
          pause_start_date: string | null
          payment_id: string | null
          platform_settlement: number | null
          preferred_day: number | null
          preferred_time: string | null
          program_end: string | null
          program_start: string | null
          referral_code_used: string | null
          refund_amount: number | null
          requested_start_date: string | null
          schedule_confirmed: boolean | null
          schedule_confirmed_at: string | null
          schedule_confirmed_by: string | null
          sessions_completed: number | null
          sessions_remaining: number | null
          status: string | null
          terminated_at: string | null
          terminated_by: string | null
          termination_reason: string | null
          total_pause_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments_pending_start: {
        Row: {
          actual_start_date: string | null
          amount: number | null
          child_age: number | null
          child_id: string | null
          child_name: string | null
          coach_assigned_by: string | null
          coach_email: string | null
          coach_id: string | null
          coach_name: string | null
          coach_settlement: number | null
          created_at: string | null
          id: string | null
          is_paused: boolean | null
          lead_source: string | null
          lead_source_coach_id: string | null
          original_coach_id: string | null
          original_end_date: string | null
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          parent_phone: string | null
          pause_count: number | null
          pause_end_date: string | null
          pause_reason: string | null
          pause_start_date: string | null
          payment_id: string | null
          platform_settlement: number | null
          preferred_day: number | null
          preferred_time: string | null
          program_end: string | null
          program_start: string | null
          referral_code_used: string | null
          refund_amount: number | null
          requested_start_date: string | null
          schedule_confirmed: boolean | null
          schedule_confirmed_at: string | null
          schedule_confirmed_by: string | null
          sessions_completed: number | null
          sessions_remaining: number | null
          status: string | null
          terminated_at: string | null
          terminated_by: string | null
          termination_reason: string | null
          total_pause_days: number | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_remedial_eligibility"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_lead_source_coach_id_fkey"
            columns: ["lead_source_coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
        ]
      }
      group_class_registrations_summary: {
        Row: {
          attended_count: number | null
          enrolled_free_count: number | null
          paid_count: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          session_id: string | null
          session_title: string | null
          total_registrations: number | null
          total_revenue: number | null
        }
        Relationships: []
      }
      session_intelligence_summary: {
        Row: {
          avg_duration_minutes: number | null
          bot_errors: number | null
          coach_no_shows: number | null
          completed: number | null
          completion_rate: number | null
          flagged_sessions: number | null
          no_shows: number | null
          partial_sessions: number | null
          total_sessions: number | null
          week_start: string | null
        }
        Relationships: []
      }
      session_recording_status: {
        Row: {
          bot_id: string | null
          bot_status: string | null
          child_name: string | null
          coach_name: string | null
          duration_seconds: number | null
          error_message: string | null
          recording_url: string | null
          scheduled_date: string | null
          scheduled_time: string | null
          session_id: string | null
          session_status: string | null
          session_type: string | null
        }
        Relationships: []
      }
      support_ticket_summary: {
        Row: {
          count: number | null
          newest_ticket: string | null
          oldest_ticket: string | null
          priority: string | null
          status: string | null
          user_type: string | null
        }
        Relationships: []
      }
      upcoming_group_sessions: {
        Row: {
          age_max: number | null
          age_min: number | null
          book_cover: string | null
          book_title: string | null
          class_type_name: string | null
          class_type_slug: string | null
          color_hex: string | null
          current_participants: number | null
          duration_minutes: number | null
          google_meet_link: string | null
          icon_emoji: string | null
          id: string | null
          instructor_name: string | null
          instructor_photo: string | null
          max_participants: number | null
          price_inr: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          spots_available: number | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      v_content_with_skills: {
        Row: {
          arc_stage: string | null
          asset_format: string | null
          asset_url: string | null
          child_label: string | null
          coach_guidance: string | null
          content_type: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty_level: string | null
          embedding: string | null
          id: string | null
          intelligence_tags: Json | null
          is_active: boolean | null
          is_placeholder: boolean | null
          metadata: Json | null
          parent_instruction: string | null
          search_text: string | null
          skills: Json | null
          standards_alignment: Json | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string | null
          yrl_level: string | null
        }
        Relationships: []
      }
      v_remedial_eligibility: {
        Row: {
          child_id: string | null
          child_name: string | null
          coach_email: string | null
          coach_id: string | null
          coach_name: string | null
          enrollment_id: string | null
          parent_email: string | null
          parent_phone: string | null
          remedial_remaining: number | null
          remedial_sessions_max: number | null
          remedial_sessions_used: number | null
          remedial_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_activity_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coach_workload"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches_with_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      verification_rate_limit: {
        Row: {
          identifier: string | null
          identifier_type: string | null
          tokens_last_hour: number | null
        }
        Relationships: []
      }
      waitlist_stats: {
        Row: {
          converted: number | null
          first_signup: string | null
          latest_signup: string | null
          notified: number | null
          pending: number | null
          product_slug: string | null
          total_signups: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_agreement_version: {
        Args: { version_id: string }
        Returns: undefined
      }
      add_xp: {
        Args: { p_child_id: string; p_xp_amount: number }
        Returns: undefined
      }
      award_referral_credit: {
        Args: {
          p_enrollment_id: string
          p_referred_child_id: string
          p_referring_parent_id: string
        }
        Returns: number
      }
      award_xp: {
        Args: {
          p_activity_type: string
          p_child_id: string
          p_xp_amount: number
        }
        Returns: {
          level_title: string
          new_level: number
          new_total_xp: number
        }[]
      }
      calculate_coach_match_score: {
        Args: { child_needs: string[]; coach_tags: string[] }
        Returns: number
      }
      calculate_coach_tier: { Args: { score: number }; Returns: string }
      calculate_discount: {
        Args: {
          p_coupon_discount: number
          p_credit_available: number
          p_max_discount_percent?: number
          p_original_amount: number
        }
        Returns: {
          coupon_discount: number
          credit_applied: number
          credit_remaining: number
          final_amount: number
          total_discount: number
          was_capped: boolean
        }[]
      }
      calculate_group_class_price: {
        Args: {
          p_base_price: number
          p_child_id?: string
          p_coupon_code?: string
        }
        Returns: {
          coupon_applied: string
          discount_amount: number
          final_price: number
          original_price: number
        }[]
      }
      calculate_homework_rate: { Args: { p_child_id: string }; Returns: number }
      calculate_level_from_xp: { Args: { xp: number }; Returns: number }
      calculate_next_review: {
        Args: {
          p_ease_factor: number
          p_interval_days: number
          p_quality: number
          p_review_count: number
        }
        Returns: {
          new_ease: number
          new_interval: number
          next_review: string
        }[]
      }
      check_completion_eligibility: {
        Args: { p_enrollment_id: string }
        Returns: {
          checkins_completed: number
          coaching_completed: number
          eligible: boolean
          reason: string
        }[]
      }
      cleanup_expired_tokens: { Args: never; Returns: undefined }
      decrement_coupon_usage: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      extend_program: {
        Args: { p_days?: number; p_enrollment_id: string }
        Returns: Json
      }
      generate_certificate_number: { Args: never; Returns: string }
      generate_embedding_content: {
        Args: { p_event_data: Json; p_event_type: string }
        Returns: string
      }
      generate_parent_referral_code: {
        Args: { p_parent_id: string; p_parent_name: string }
        Returns: string
      }
      generate_referral_code: { Args: { coach_name: string }; Returns: string }
      get_active_agreement: {
        Args: never
        Returns: {
          activated_at: string
          entity_type: string
          file_url: string
          id: string
          title: string
          version: string
        }[]
      }
      get_active_revenue_config: {
        Args: never
        Returns: {
          coach_cost_percent: number
          created_at: string | null
          created_by: string | null
          effective_from: string
          id: string
          is_active: boolean | null
          lead_cost_percent: number
          notes: string | null
          payout_day_of_month: number | null
          payout_frequency: string
          platform_fee_percent: number
          tds_rate_percent: number
          tds_threshold_annual: number
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "revenue_split_config"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_age_band_config: {
        Args: { child_age: number }
        Returns: {
          band_id: string
          estimated_total_seasons: number
          parent_role: string
          primary_mode: string
          session_duration_minutes: number
          sessions_per_season: number
          sessions_per_week: number
        }[]
      }
      get_agreement_config: { Args: never; Returns: Json }
      get_agreement_config_by_category: { Args: { cat: string }; Returns: Json }
      get_auto_apply_coupon: {
        Args: { p_child_id: string }
        Returns: {
          coupon_code: string
          coupon_id: string
          discount_percent: number
        }[]
      }
      get_available_coaches: {
        Args: never
        Returns: {
          available_slots: number
          current_children: number
          current_tier: string
          id: string
          max_children: number
          name: string
        }[]
      }
      get_best_available_coach: {
        Args: { p_exclude_coach_id?: string }
        Returns: string
      }
      get_coach_available_slots: {
        Args: { p_coach_id: string; p_date: string }
        Returns: {
          end_time: string
          is_blocked: boolean
          slot_type: string
          start_time: string
        }[]
      }
      get_coach_students_events: {
        Args: { coach_uuid: string; event_limit?: number }
        Returns: {
          ai_summary: string
          child_id: string
          child_name: string
          data: Json
          event_date: string
          event_type: string
          id: string
        }[]
      }
      get_completed_session_counts: {
        Args: { enrollment_ids: string[] }
        Returns: {
          count: number
          enrollment_id: string
        }[]
      }
      get_financial_year: { Args: { check_date?: string }; Returns: string }
      get_funnel_stats: {
        Args: { end_date?: string; start_date?: string }
        Returns: {
          assessment_to_call_pct: number
          assessments: number
          call_completion_pct: number
          call_to_enrollment_pct: number
          calls_booked: number
          calls_completed: number
          calls_no_show: number
          enrolled: number
        }[]
      }
      get_latest_insight: { Args: { p_insight_type: string }; Returns: Json }
      get_quarter: { Args: { check_date?: string }; Returns: string }
      get_reading_rank: {
        Args: { score: number }
        Returns: {
          celebration_message: string
          emoji: string
          encouragement_message: string
          rank_name: string
        }[]
      }
      get_session_duration: {
        Args: { p_child_age: number; p_session_type?: string }
        Returns: number
      }
      get_session_stats: {
        Args: { days_back?: number }
        Returns: {
          avg_duration: number
          bot_error_sessions: number
          coach_no_show_sessions: number
          completed_sessions: number
          completion_rate: number
          no_show_sessions: number
          partial_sessions: number
          total_sessions: number
        }[]
      }
      get_setting: { Args: { setting_key: string }; Returns: Json }
      get_trending_books: {
        Args: { p_age_max?: number; p_age_min?: number; p_limit?: number }
        Returns: {
          author: string
          book_id: string
          times_read: number
          title: string
          total_requests: number
        }[]
      }
      get_unread_notification_count: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: number
      }
      has_active_push_subscription: {
        Args: { p_user_id: string; p_user_type: string }
        Returns: boolean
      }
      hybrid_match_learning_events: {
        Args: {
          filter_child_id?: string
          filter_coach_id?: string
          filter_date_from?: string
          filter_date_to?: string
          filter_event_type?: string
          filter_keywords?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          ai_summary: string
          child_id: string
          coach_id: string
          content_for_embedding: string
          event_data: Json
          event_date: string
          event_type: string
          final_score: number
          id: string
          keyword_boost: number
          similarity: number
        }[]
      }
      increment_coupon_usage: {
        Args: { p_coupon_id: string }
        Returns: undefined
      }
      increment_sessions_completed: {
        Args: { child_id_param: string }
        Returns: undefined
      }
      is_child_enrolled: { Args: { p_child_id: string }; Returns: boolean }
      is_coach_at_capacity: { Args: { p_coach_id: string }; Returns: boolean }
      is_feature_enabled: { Args: { flag: string }; Returns: boolean }
      is_unit_unlocked: {
        Args: { p_child_id: string; p_unit_id: string }
        Returns: boolean
      }
      log_enrollment_event: {
        Args: {
          p_enrollment_id: string
          p_event_data?: Json
          p_event_type: string
          p_triggered_by?: string
          p_triggered_by_id?: string
        }
        Returns: string
      }
      match_content_units: {
        Args: {
          filter_arc_stage?: string
          filter_max_age?: number
          filter_min_age?: number
          filter_skill_id?: string
          filter_tags?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          arc_stage: string
          coach_guidance: Json
          content_code: string
          description: string
          difficulty: string
          id: string
          max_age: number
          min_age: number
          name: string
          parent_instruction: string
          similarity: number
          skill_id: string
          skill_name: string
          tags: string[]
          video_count: number
          worksheet_count: number
        }[]
      }
      match_learning_events: {
        Args: {
          filter_child_id?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          ai_summary: string
          child_id: string
          created_at: string
          data: Json
          event_date: string
          event_type: string
          id: string
          similarity: number
        }[]
      }
      process_payout_batch: {
        Args: {
          p_admin_email: string
          p_payment_method: string
          p_payment_reference: string
          p_payout_ids: string[]
        }
        Returns: Json
      }
      refresh_leaderboard: { Args: never; Returns: undefined }
      release_expired_holds: { Args: never; Returns: number }
      search_content_items: {
        Args: {
          filter_arc_stage?: string
          filter_content_type?: string
          filter_skill_id?: string
          filter_yrl_level?: string
          match_count?: number
          query_embedding: string
          query_text?: string
          similarity_threshold?: number
        }
        Returns: {
          arc_stage: string
          asset_format: string
          asset_url: string
          child_label: string
          coach_guidance: string
          combined_score: number
          content_type: string
          description: string
          difficulty_level: string
          id: string
          intelligence_tags: Json
          metadata: Json
          parent_instruction: string
          semantic_score: number
          skills: Json
          text_score: number
          thumbnail_url: string
          title: string
          yrl_level: string
        }[]
      }
      sync_children_enrollment_status: { Args: never; Returns: undefined }
      update_communication_analytics: {
        Args: { p_action?: string; p_channel: string; p_cost?: number }
        Returns: undefined
      }
      update_daily_goal_progress: {
        Args: {
          p_activities_delta?: number
          p_child_id: string
          p_minutes_delta?: number
        }
        Returns: {
          achieved_at: string | null
          child_id: string
          completed_activities: number | null
          completed_minutes: number | null
          created_at: string | null
          goal_date: string
          id: string
          is_achieved: boolean | null
          target_activities: number | null
          target_minutes: number | null
          treasure_claimed: boolean | null
          updated_at: string | null
          xp_bonus: number | null
        }
        SetofOptions: {
          from: "*"
          to: "child_daily_goals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_streak: {
        Args: { p_child_id: string }
        Returns: {
          current_streak: number
          streak_bonus: number
          streak_broken: boolean
        }[]
      }
      xp_for_next_level: { Args: { current_level: number }; Returns: number }
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
