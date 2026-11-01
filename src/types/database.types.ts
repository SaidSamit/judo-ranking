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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      athletes: {
        Row: {
          belt: Database["public"]["Enums"]["kyu_dan_grade"] | null
          birth_date: string
          club_id: string | null
          created_at: string
          created_by_org_id: string | null
          first_name: string
          gender: string
          id: string
          last_name: string
          nationality: string
          rut_dni: string
          updated_at: string
        }
        Insert: {
          belt?: Database["public"]["Enums"]["kyu_dan_grade"] | null
          birth_date: string
          club_id?: string | null
          created_at?: string
          created_by_org_id?: string | null
          first_name: string
          gender: string
          id?: string
          last_name: string
          nationality?: string
          rut_dni: string
          updated_at?: string
        }
        Update: {
          belt?: Database["public"]["Enums"]["kyu_dan_grade"] | null
          birth_date?: string
          club_id?: string | null
          created_at?: string
          created_by_org_id?: string | null
          first_name?: string
          gender?: string
          id?: string
          last_name?: string
          nationality?: string
          rut_dni?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athletes_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_created_by_org_id_fkey"
            columns: ["created_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_state: Json
          before_state: Json
          created_at: string
          id: string
          match_id: string | null
          organization_id: string
          performed_by_station_id: string | null
          performed_by_user_id: string | null
          reason: string
        }
        Insert: {
          action: string
          after_state: Json
          before_state: Json
          created_at?: string
          id?: string
          match_id?: string | null
          organization_id: string
          performed_by_station_id?: string | null
          performed_by_user_id?: string | null
          reason: string
        }
        Update: {
          action?: string
          after_state?: Json
          before_state?: Json
          created_at?: string
          id?: string
          match_id?: string | null
          organization_id?: string
          performed_by_station_id?: string | null
          performed_by_user_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_performed_by_station_id_fkey"
            columns: ["performed_by_station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          age_group: string
          assigned_tatami_number: number | null
          bracket_type: string
          created_at: string
          gender: string
          id: string
          is_official: boolean
          match_duration_seconds: number
          max_weight: number | null
          min_weight: number | null
          name: string
          organization_id: string
          tournament_id: string
        }
        Insert: {
          age_group: string
          assigned_tatami_number?: number | null
          bracket_type?: string
          created_at?: string
          gender: string
          id?: string
          is_official?: boolean
          match_duration_seconds?: number
          max_weight?: number | null
          min_weight?: number | null
          name: string
          organization_id: string
          tournament_id: string
        }
        Update: {
          age_group?: string
          assigned_tatami_number?: number | null
          bracket_type?: string
          created_at?: string
          gender?: string
          id?: string
          is_official?: boolean
          match_duration_seconds?: number
          max_weight?: number | null
          min_weight?: number | null
          name?: string
          organization_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tournament_id_fkey"
            columns: ["tournament_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      clubs: {
        Row: {
          city: string | null
          created_at: string
          created_by_org_id: string | null
          id: string
          name: string
          short_code: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_by_org_id?: string | null
          id?: string
          name: string
          short_code?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_by_org_id?: string | null
          id?: string
          name?: string
          short_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clubs_created_by_org_id_fkey"
            columns: ["created_by_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leagues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leagues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          action: string
          created_at: string
          created_by_station_id: string | null
          id: string
          is_undone: boolean
          match_id: string
          match_time: string
          match_time_seconds: number
          organization_id: string
          payload: Json
          sequence_number: number
          target: string | null
          undone_by_event_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by_station_id?: string | null
          id?: string
          is_undone?: boolean
          match_id: string
          match_time: string
          match_time_seconds: number
          organization_id: string
          payload?: Json
          sequence_number: number
          target?: string | null
          undone_by_event_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by_station_id?: string | null
          id?: string
          is_undone?: boolean
          match_id?: string
          match_time?: string
          match_time_seconds?: number
          organization_id?: string
          payload?: Json
          sequence_number?: number
          target?: string | null
          undone_by_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_events_created_by_station_id_fkey"
            columns: ["created_by_station_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "match_events_undone_by_event_id_fkey"
            columns: ["undone_by_event_id"]
            isOneToOne: false
            referencedRelation: "match_events"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          active_osaekomi_color:
            | Database["public"]["Enums"]["combatant_color"]
            | null
          blue_athlete_id: string | null
          blue_ippon: number
          blue_shido: number
          blue_wazaari: number
          blue_yuko: number
          category_id: string
          created_at: string
          current_match_time_seconds: number
          ended_at: string | null
          hansoku_type: Database["public"]["Enums"]["hansoku_type"] | null
          id: string
          is_golden_score: boolean
          loser_next_match_id: string | null
          loser_next_match_slot: string | null
          match_number: number
          next_match_id: string | null
          next_match_slot: string | null
          organization_id: string
          osaekomi_seconds: number
          round: string
          started_at: string | null
          status: Database["public"]["Enums"]["match_status"]
          tatami_number: number
          tournament_id: string
          updated_at: string
          version: number
          white_athlete_id: string | null
          white_ippon: number
          white_shido: number
          white_wazaari: number
          white_yuko: number
          win_reason: string | null
          winner_id: string | null
        }
        Insert: {
          active_osaekomi_color?:
            | Database["public"]["Enums"]["combatant_color"]
            | null
          blue_athlete_id?: string | null
          blue_ippon?: number
          blue_shido?: number
          blue_wazaari?: number
          blue_yuko?: number
          category_id: string
          created_at?: string
          current_match_time_seconds?: number
          ended_at?: string | null
          hansoku_type?: Database["public"]["Enums"]["hansoku_type"] | null
          id?: string
          is_golden_score?: boolean
          loser_next_match_id?: string | null
          loser_next_match_slot?: string | null
          match_number: number
          next_match_id?: string | null
          next_match_slot?: string | null
          organization_id: string
          osaekomi_seconds?: number
          round?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tatami_number: number
          tournament_id: string
          updated_at?: string
          version?: number
          white_athlete_id?: string | null
          white_ippon?: number
          white_shido?: number
          white_wazaari?: number
          white_yuko?: number
          win_reason?: string | null
          winner_id?: string | null
        }
        Update: {
          active_osaekomi_color?:
            | Database["public"]["Enums"]["combatant_color"]
            | null
          blue_athlete_id?: string | null
          blue_ippon?: number
          blue_shido?: number
          blue_wazaari?: number
          blue_yuko?: number
          category_id?: string
          created_at?: string
          current_match_time_seconds?: number
          ended_at?: string | null
          hansoku_type?: Database["public"]["Enums"]["hansoku_type"] | null
          id?: string
          is_golden_score?: boolean
          loser_next_match_id?: string | null
          loser_next_match_slot?: string | null
          match_number?: number
          next_match_id?: string | null
          next_match_slot?: string | null
          organization_id?: string
          osaekomi_seconds?: number
          round?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["match_status"]
          tatami_number?: number
          tournament_id?: string
          updated_at?: string
          version?: number
          white_athlete_id?: string | null
          white_ippon?: number
          white_shido?: number
          white_wazaari?: number
          white_yuko?: number
          win_reason?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_blue_athlete_id_fkey"
            columns: ["blue_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_category_id_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "matches_loser_next_match_fk"
            columns: ["loser_next_match_id", "tournament_id", "category_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id", "tournament_id", "category_id"]
          },
          {
            foreignKeyName: "matches_next_match_fk"
            columns: ["next_match_id", "tournament_id", "category_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id", "tournament_id", "category_id"]
          },
          {
            foreignKeyName: "matches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_tournament_id_fkey"
            columns: ["tournament_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "matches_white_athlete_id_fkey"
            columns: ["white_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      point_templates: {
        Row: {
          bronze_points: number
          created_at: string
          fifth_points: number
          gold_points: number
          id: string
          name: string
          organization_id: string
          participation_points: number
          requires_win_to_score: boolean
          seventh_points: number
          silver_points: number
          tier: Database["public"]["Enums"]["point_tier"]
        }
        Insert: {
          bronze_points?: number
          created_at?: string
          fifth_points?: number
          gold_points?: number
          id?: string
          name: string
          organization_id: string
          participation_points?: number
          requires_win_to_score?: boolean
          seventh_points?: number
          silver_points?: number
          tier?: Database["public"]["Enums"]["point_tier"]
        }
        Update: {
          bronze_points?: number
          created_at?: string
          fifth_points?: number
          gold_points?: number
          id?: string
          name?: string
          organization_id?: string
          participation_points?: number
          requires_win_to_score?: boolean
          seventh_points?: number
          silver_points?: number
          tier?: Database["public"]["Enums"]["point_tier"]
        }
        Relationships: [
          {
            foreignKeyName: "point_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          club_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          club_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          club_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_points: {
        Row: {
          awarded_at: string
          current_points: number
          degradation_phase: Database["public"]["Enums"]["degradation_phase"]
          expires_at: string
          id: string
          is_valid: boolean
          organization_id: string
          original_points: number
          phase_50_at: string
          tournament_id: string
          wallet_id: string
        }
        Insert: {
          awarded_at?: string
          current_points: number
          degradation_phase?: Database["public"]["Enums"]["degradation_phase"]
          expires_at: string
          id?: string
          is_valid?: boolean
          organization_id: string
          original_points: number
          phase_50_at: string
          tournament_id: string
          wallet_id: string
        }
        Update: {
          awarded_at?: string
          current_points?: number
          degradation_phase?: Database["public"]["Enums"]["degradation_phase"]
          expires_at?: string
          id?: string
          is_valid?: boolean
          organization_id?: string
          original_points?: number
          phase_50_at?: string
          tournament_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_points_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_points_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_points_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "ranking_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_wallets: {
        Row: {
          athlete_id: string
          category_division: string
          created_at: string
          frozen_at: string | null
          id: string
          league_id: string
          organization_id: string
          status: Database["public"]["Enums"]["wallet_status"]
          total_points: number
          updated_at: string
        }
        Insert: {
          athlete_id: string
          category_division: string
          created_at?: string
          frozen_at?: string | null
          id?: string
          league_id: string
          organization_id: string
          status?: Database["public"]["Enums"]["wallet_status"]
          total_points?: number
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          category_division?: string
          created_at?: string
          frozen_at?: string | null
          id?: string
          league_id?: string
          organization_id?: string
          status?: Database["public"]["Enums"]["wallet_status"]
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_wallets_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_wallets_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_wallets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          organization_id: string
          pin_code: string | null
          pin_hash: string
          slug: string
          tatami_number: number | null
          tournament_id: string | null
          type: Database["public"]["Enums"]["station_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name: string
          organization_id: string
          pin_code?: string | null
          pin_hash: string
          slug: string
          tatami_number?: number | null
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["station_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          organization_id?: string
          pin_code?: string | null
          pin_hash?: string
          slug?: string
          tatami_number?: number | null
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["station_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_registrations: {
        Row: {
          actual_weight: number | null
          athlete_id: string
          category_id: string
          club_id: string | null
          created_at: string
          final_standing: number | null
          id: string
          matches_won_count: number
          organization_id: string
          registered_weight: number | null
          tournament_id: string
          updated_at: string
          weigh_in_at: string | null
          weigh_in_by_user_id: string | null
          weigh_in_status: Database["public"]["Enums"]["weigh_in_status"]
        }
        Insert: {
          actual_weight?: number | null
          athlete_id: string
          category_id: string
          club_id?: string | null
          created_at?: string
          final_standing?: number | null
          id?: string
          matches_won_count?: number
          organization_id: string
          registered_weight?: number | null
          tournament_id: string
          updated_at?: string
          weigh_in_at?: string | null
          weigh_in_by_user_id?: string | null
          weigh_in_status?: Database["public"]["Enums"]["weigh_in_status"]
        }
        Update: {
          actual_weight?: number | null
          athlete_id?: string
          category_id?: string
          club_id?: string | null
          created_at?: string
          final_standing?: number | null
          id?: string
          matches_won_count?: number
          organization_id?: string
          registered_weight?: number | null
          tournament_id?: string
          updated_at?: string
          weigh_in_at?: string | null
          weigh_in_by_user_id?: string | null
          weigh_in_status?: Database["public"]["Enums"]["weigh_in_status"]
        }
        Relationships: [
          {
            foreignKeyName: "tournament_registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_category_id_fkey"
            columns: ["category_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "tournament_registrations_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_registrations_tournament_id_fkey"
            columns: ["tournament_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      tournaments: {
        Row: {
          config: Json
          created_at: string
          end_date: string
          id: string
          league_id: string | null
          location: string | null
          name: string
          organization_id: string
          point_template_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["tournament_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          end_date: string
          id?: string
          league_id?: string | null
          location?: string | null
          name: string
          organization_id: string
          point_template_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          end_date?: string
          id?: string
          league_id?: string | null
          location?: string | null
          name?: string
          organization_id?: string
          point_template_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["tournament_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournaments_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournaments_point_template_id_fkey"
            columns: ["point_template_id"]
            isOneToOne: false
            referencedRelation: "point_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_organization_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      sync_offline_match: {
        Args: { p_events: Json; p_final_state: Json; p_match_id: string }
        Returns: Json
      }
    }
    Enums: {
      combatant_color: "WHITE" | "BLUE"
      degradation_phase: "PHASE_100" | "PHASE_50" | "EXPIRED_0"
      hansoku_type: "TECHNICAL" | "DISCIPLINARY"
      kyu_dan_grade:
        | "6_KYU"
        | "5_KYU"
        | "4_KYU"
        | "3_KYU"
        | "2_KYU"
        | "1_KYU"
        | "1_DAN"
        | "2_DAN"
        | "3_DAN"
        | "4_DAN"
        | "5_DAN"
        | "6_DAN"
        | "7_DAN"
        | "8_DAN"
        | "9_DAN"
        | "10_DAN"
      match_status:
        | "SCHEDULED"
        | "ONGOING"
        | "PAUSED"
        | "FINISHED"
        | "CANCELLED"
        | "PENDING"
      point_tier: "NATIONAL_G1" | "REGIONAL_G2" | "FRIENDLY"
      station_type: "TATAMI_TABLE" | "WARMUP_DISPLAY" | "WEIGH_IN"
      tournament_status:
        | "DRAFT"
        | "PENDING_APPROVAL"
        | "ACTIVE"
        | "FINISHED"
        | "CANCELLED"
      user_role:
        | "ADMIN"
        | "CLUB_DELEGATE"
        | "STATION"
        | "UNASSIGNED"
        | "SUPER_ADMIN"
        | "ORG_ADMIN"
        | "TABLE_OFFICIAL"
      wallet_status: "ACTIVE" | "FROZEN" | "CLOSED"
      weigh_in_status: "PENDING" | "PASSED" | "DSQ" | "DNS"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      combatant_color: ["WHITE", "BLUE"],
      degradation_phase: ["PHASE_100", "PHASE_50", "EXPIRED_0"],
      hansoku_type: ["TECHNICAL", "DISCIPLINARY"],
      kyu_dan_grade: [
        "6_KYU",
        "5_KYU",
        "4_KYU",
        "3_KYU",
        "2_KYU",
        "1_KYU",
        "1_DAN",
        "2_DAN",
        "3_DAN",
        "4_DAN",
        "5_DAN",
        "6_DAN",
        "7_DAN",
        "8_DAN",
        "9_DAN",
        "10_DAN",
      ],
      match_status: [
        "SCHEDULED",
        "ONGOING",
        "PAUSED",
        "FINISHED",
        "CANCELLED",
        "PENDING",
      ],
      point_tier: ["NATIONAL_G1", "REGIONAL_G2", "FRIENDLY"],
      station_type: ["TATAMI_TABLE", "WARMUP_DISPLAY", "WEIGH_IN"],
      tournament_status: [
        "DRAFT",
        "PENDING_APPROVAL",
        "ACTIVE",
        "FINISHED",
        "CANCELLED",
      ],
      user_role: [
        "ADMIN",
        "CLUB_DELEGATE",
        "STATION",
        "UNASSIGNED",
        "SUPER_ADMIN",
        "ORG_ADMIN",
        "TABLE_OFFICIAL",
      ],
      wallet_status: ["ACTIVE", "FROZEN", "CLOSED"],
      weigh_in_status: ["PENDING", "PASSED", "DSQ", "DNS"],
    },
  },
} as const
