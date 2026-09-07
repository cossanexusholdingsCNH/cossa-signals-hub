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
      academy_articles: {
        Row: {
          author_id: string | null
          category_id: string | null
          content: string | null
          created_at: string
          id: string
          level: string | null
          published: boolean
          reading_minutes: number | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          level?: string | null
          published?: boolean
          reading_minutes?: number | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          category_id?: string | null
          content?: string | null
          created_at?: string
          id?: string
          level?: string | null
          published?: boolean
          reading_minutes?: number | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_articles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "academy_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      alert_preferences: {
        Row: {
          channel_email: boolean
          channel_in_app: boolean
          channel_push: boolean
          channel_telegram: boolean
          channel_whatsapp: boolean
          created_at: string
          high_confidence_signal: boolean
          id: string
          instrument_becomes_active: boolean
          new_signal: boolean
          regime_change: boolean
          signal_invalidated: boolean
          stop_loss_hit: boolean
          target_hit: boolean
          telegram_handle: string | null
          updated_at: string
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_push?: boolean
          channel_telegram?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          high_confidence_signal?: boolean
          id?: string
          instrument_becomes_active?: boolean
          new_signal?: boolean
          regime_change?: boolean
          signal_invalidated?: boolean
          stop_loss_hit?: boolean
          target_hit?: boolean
          telegram_handle?: string | null
          updated_at?: string
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          channel_email?: boolean
          channel_in_app?: boolean
          channel_push?: boolean
          channel_telegram?: boolean
          channel_whatsapp?: boolean
          created_at?: string
          high_confidence_signal?: boolean
          id?: string
          instrument_becomes_active?: boolean
          new_signal?: boolean
          regime_change?: boolean
          signal_invalidated?: boolean
          stop_loss_hit?: boolean
          target_hit?: boolean
          telegram_handle?: string | null
          updated_at?: string
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor: string | null
          actor_label: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          updated_at: string
        }
        Insert: {
          action: string
          actor?: string | null
          actor_label?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          updated_at?: string
        }
        Update: {
          action?: string
          actor?: string | null
          actor_label?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      data_health: {
        Row: {
          created_at: string
          id: string
          instrument_id: string | null
          is_demo: boolean
          last_received_at: string | null
          latency_ms: number | null
          provider: string
          status: Database["public"]["Enums"]["data_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument_id?: string | null
          is_demo?: boolean
          last_received_at?: string | null
          latency_ms?: number | null
          provider: string
          status?: Database["public"]["Enums"]["data_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument_id?: string | null
          is_demo?: boolean
          last_received_at?: string | null
          latency_ms?: number | null
          provider?: string
          status?: Database["public"]["Enums"]["data_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_health_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          category: string
          created_at: string
          current_price: number | null
          data_source: string | null
          description: string | null
          display_name: string
          enabled: boolean
          id: string
          is_demo: boolean
          last_data_at: string | null
          market_characteristics: string | null
          market_status: string
          minimum_sample_required: number
          provider: string
          risk_rating: Database["public"]["Enums"]["risk_rating"]
          symbol: string
          timeframe_default: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          asset_class: Database["public"]["Enums"]["asset_class"]
          category: string
          created_at?: string
          current_price?: number | null
          data_source?: string | null
          description?: string | null
          display_name: string
          enabled?: boolean
          id?: string
          is_demo?: boolean
          last_data_at?: string | null
          market_characteristics?: string | null
          market_status?: string
          minimum_sample_required?: number
          provider?: string
          risk_rating?: Database["public"]["Enums"]["risk_rating"]
          symbol: string
          timeframe_default?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          asset_class?: Database["public"]["Enums"]["asset_class"]
          category?: string
          created_at?: string
          current_price?: number | null
          data_source?: string | null
          description?: string | null
          display_name?: string
          enabled?: boolean
          id?: string
          is_demo?: boolean
          last_data_at?: string | null
          market_characteristics?: string | null
          market_status?: string
          minimum_sample_required?: number
          provider?: string
          risk_rating?: Database["public"]["Enums"]["risk_rating"]
          symbol?: string
          timeframe_default?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: []
      }
      market_regimes: {
        Row: {
          confidence_score: number | null
          created_at: string
          detected_at: string
          expires_at: string | null
          id: string
          instrument_id: string
          is_demo: boolean
          regime: Database["public"]["Enums"]["regime_type"]
          timeframe: string
          updated_at: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          detected_at?: string
          expires_at?: string | null
          id?: string
          instrument_id: string
          is_demo?: boolean
          regime?: Database["public"]["Enums"]["regime_type"]
          timeframe?: string
          updated_at?: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          detected_at?: string
          expires_at?: string | null
          id?: string
          instrument_id?: string
          is_demo?: boolean
          regime?: Database["public"]["Enums"]["regime_type"]
          timeframe?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_regimes_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          created_at: string
          enabled: boolean
          features_used: string[]
          id: string
          model_type: string
          name: string
          performance_summary: Json | null
          test_period: string | null
          training_period: string | null
          updated_at: string
          validation_status: Database["public"]["Enums"]["validation_status"]
          version: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          features_used?: string[]
          id?: string
          model_type: string
          name: string
          performance_summary?: Json | null
          test_period?: string | null
          training_period?: string | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          version?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          features_used?: string[]
          id?: string
          model_type?: string
          name?: string
          performance_summary?: Json | null
          test_period?: string | null
          training_period?: string | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          version?: string
        }
        Relationships: []
      }
      performance_snapshots: {
        Row: {
          average_loss: number | null
          average_win: number | null
          avg_rr_ratio: number | null
          avg_signal_duration_minutes: number | null
          beats_benchmark: boolean | null
          benchmark_return_pct: number | null
          break_even: number
          calculated_at: string
          created_at: string
          id: string
          instrument_id: string | null
          is_demo: boolean
          losses: number
          max_drawdown: number | null
          mode: Database["public"]["Enums"]["signal_mode"]
          period: string | null
          profit_factor: number | null
          sample_reliable: boolean
          sharpe_ratio: number | null
          strategy_id: string | null
          timeframe: string | null
          total_return_pct: number | null
          total_trades: number
          updated_at: string
          win_rate: number | null
          wins: number
        }
        Insert: {
          average_loss?: number | null
          average_win?: number | null
          avg_rr_ratio?: number | null
          avg_signal_duration_minutes?: number | null
          beats_benchmark?: boolean | null
          benchmark_return_pct?: number | null
          break_even?: number
          calculated_at?: string
          created_at?: string
          id?: string
          instrument_id?: string | null
          is_demo?: boolean
          losses?: number
          max_drawdown?: number | null
          mode?: Database["public"]["Enums"]["signal_mode"]
          period?: string | null
          profit_factor?: number | null
          sample_reliable?: boolean
          sharpe_ratio?: number | null
          strategy_id?: string | null
          timeframe?: string | null
          total_return_pct?: number | null
          total_trades?: number
          updated_at?: string
          win_rate?: number | null
          wins?: number
        }
        Update: {
          average_loss?: number | null
          average_win?: number | null
          avg_rr_ratio?: number | null
          avg_signal_duration_minutes?: number | null
          beats_benchmark?: boolean | null
          benchmark_return_pct?: number | null
          break_even?: number
          calculated_at?: string
          created_at?: string
          id?: string
          instrument_id?: string | null
          is_demo?: boolean
          losses?: number
          max_drawdown?: number | null
          mode?: Database["public"]["Enums"]["signal_mode"]
          period?: string | null
          profit_factor?: number | null
          sample_reliable?: boolean
          sharpe_ratio?: number | null
          strategy_id?: string | null
          timeframe?: string | null
          total_return_pct?: number | null
          total_trades?: number
          updated_at?: string
          win_rate?: number | null
          wins?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_snapshots_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_snapshots_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_controls: {
        Row: {
          alerts_enabled: boolean
          created_at: string
          emergency_message: string | null
          id: string
          maintenance_mode: boolean
          minimum_sample_size: number
          signals_enabled: boolean
          stale_threshold_seconds: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          alerts_enabled?: boolean
          created_at?: string
          emergency_message?: string | null
          id?: string
          maintenance_mode?: boolean
          minimum_sample_size?: number
          signals_enabled?: boolean
          stale_threshold_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          alerts_enabled?: boolean
          created_at?: string
          emergency_message?: string | null
          id?: string
          maintenance_mode?: boolean
          minimum_sample_size?: number
          signals_enabled?: boolean
          stale_threshold_seconds?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_login_at: string | null
          phone: string | null
          preferred_currency: string
          privacy_accepted_at: string | null
          risk_disclosure_accepted: boolean
          subscription_status: string
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_login_at?: string | null
          phone?: string | null
          preferred_currency?: string
          privacy_accepted_at?: string | null
          risk_disclosure_accepted?: boolean
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          phone?: string | null
          preferred_currency?: string
          privacy_accepted_at?: string | null
          risk_disclosure_accepted?: boolean
          subscription_status?: string
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      risk_checks: {
        Row: {
          checks: Json
          created_at: string
          id: string
          notes: string | null
          overall_status: Database["public"]["Enums"]["risk_gate_status"]
          signal_id: string
          updated_at: string
        }
        Insert: {
          checks?: Json
          created_at?: string
          id?: string
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["risk_gate_status"]
          signal_id: string
          updated_at?: string
        }
        Update: {
          checks?: Json
          created_at?: string
          id?: string
          notes?: string | null
          overall_status?: Database["public"]["Enums"]["risk_gate_status"]
          signal_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_checks_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      service_heartbeats: {
        Row: {
          created_at: string
          id: string
          is_demo: boolean
          last_heartbeat: string | null
          message: string | null
          metadata: Json | null
          service_name: string
          status: Database["public"]["Enums"]["data_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_demo?: boolean
          last_heartbeat?: string | null
          message?: string | null
          metadata?: Json | null
          service_name: string
          status?: Database["public"]["Enums"]["data_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_demo?: boolean
          last_heartbeat?: string | null
          message?: string | null
          metadata?: Json | null
          service_name?: string
          status?: Database["public"]["Enums"]["data_status"]
          updated_at?: string
        }
        Relationships: []
      }
      signal_indicators: {
        Row: {
          created_at: string
          direction: Database["public"]["Enums"]["indicator_direction"]
          id: string
          indicator_display: string | null
          indicator_name: string
          indicator_value: number | null
          interpretation: string | null
          signal_id: string
          timeframe: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          created_at?: string
          direction?: Database["public"]["Enums"]["indicator_direction"]
          id?: string
          indicator_display?: string | null
          indicator_name: string
          indicator_value?: number | null
          interpretation?: string | null
          signal_id: string
          timeframe?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          created_at?: string
          direction?: Database["public"]["Enums"]["indicator_direction"]
          id?: string
          indicator_display?: string | null
          indicator_name?: string
          indicator_value?: number | null
          interpretation?: string | null
          signal_id?: string
          timeframe?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "signal_indicators_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      signal_votes: {
        Row: {
          agent_name: string
          confidence: number | null
          created_at: string
          id: string
          reason: string | null
          signal_id: string
          updated_at: string
          vote: Database["public"]["Enums"]["agent_vote"]
        }
        Insert: {
          agent_name: string
          confidence?: number | null
          created_at?: string
          id?: string
          reason?: string | null
          signal_id: string
          updated_at?: string
          vote: Database["public"]["Enums"]["agent_vote"]
        }
        Update: {
          agent_name?: string
          confidence?: number | null
          created_at?: string
          id?: string
          reason?: string | null
          signal_id?: string
          updated_at?: string
          vote?: Database["public"]["Enums"]["agent_vote"]
        }
        Relationships: [
          {
            foreignKeyName: "signal_votes_signal_id_fkey"
            columns: ["signal_id"]
            isOneToOne: false
            referencedRelation: "signals"
            referencedColumns: ["id"]
          },
        ]
      }
      signals: {
        Row: {
          ai_bearish_evidence: string | null
          ai_bullish_evidence: string | null
          ai_market_context: string | null
          ai_recommendation:
            | Database["public"]["Enums"]["recommendation_type"]
            | null
          ai_risk_explanation: string | null
          ai_summary: string | null
          ai_uncertainty: string | null
          calculated_at: string | null
          closed_at: string | null
          confidence_breakdown: Json | null
          confidence_grade:
            | Database["public"]["Enums"]["confidence_grade"]
            | null
          confidence_score: number | null
          created_at: string
          current_price: number | null
          data_timestamp: string | null
          direction: Database["public"]["Enums"]["signal_direction"]
          entry_price: number | null
          entry_zone_high: number | null
          entry_zone_low: number | null
          expires_at: string | null
          failure_risk: string | null
          historical_sample_size: number | null
          id: string
          instrument_id: string
          invalidation_reason: string | null
          is_demo: boolean
          market_regime: Database["public"]["Enums"]["regime_type"]
          mode: Database["public"]["Enums"]["signal_mode"]
          model_id: string | null
          model_version: string | null
          no_trade_reasons: string[]
          opened_at: string
          realized_return_pct: number | null
          risk_rating: Database["public"]["Enums"]["risk_rating"]
          risk_reward_ratio: number | null
          signal_quality_score: number | null
          signal_reason: string | null
          source: string | null
          source_version: string | null
          status: Database["public"]["Enums"]["signal_status"]
          stop_loss: number | null
          strategy_id: string | null
          strategy_name: string | null
          strategy_version: string | null
          take_profit_1: number | null
          take_profit_2: number | null
          take_profit_3: number | null
          timeframe: string
          unrealized_return_pct: number | null
          updated_at: string
          validation_status: Database["public"]["Enums"]["validation_status"]
        }
        Insert: {
          ai_bearish_evidence?: string | null
          ai_bullish_evidence?: string | null
          ai_market_context?: string | null
          ai_recommendation?:
            | Database["public"]["Enums"]["recommendation_type"]
            | null
          ai_risk_explanation?: string | null
          ai_summary?: string | null
          ai_uncertainty?: string | null
          calculated_at?: string | null
          closed_at?: string | null
          confidence_breakdown?: Json | null
          confidence_grade?:
            | Database["public"]["Enums"]["confidence_grade"]
            | null
          confidence_score?: number | null
          created_at?: string
          current_price?: number | null
          data_timestamp?: string | null
          direction?: Database["public"]["Enums"]["signal_direction"]
          entry_price?: number | null
          entry_zone_high?: number | null
          entry_zone_low?: number | null
          expires_at?: string | null
          failure_risk?: string | null
          historical_sample_size?: number | null
          id?: string
          instrument_id: string
          invalidation_reason?: string | null
          is_demo?: boolean
          market_regime?: Database["public"]["Enums"]["regime_type"]
          mode?: Database["public"]["Enums"]["signal_mode"]
          model_id?: string | null
          model_version?: string | null
          no_trade_reasons?: string[]
          opened_at?: string
          realized_return_pct?: number | null
          risk_rating?: Database["public"]["Enums"]["risk_rating"]
          risk_reward_ratio?: number | null
          signal_quality_score?: number | null
          signal_reason?: string | null
          source?: string | null
          source_version?: string | null
          status?: Database["public"]["Enums"]["signal_status"]
          stop_loss?: number | null
          strategy_id?: string | null
          strategy_name?: string | null
          strategy_version?: string | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe?: string
          unrealized_return_pct?: number | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Update: {
          ai_bearish_evidence?: string | null
          ai_bullish_evidence?: string | null
          ai_market_context?: string | null
          ai_recommendation?:
            | Database["public"]["Enums"]["recommendation_type"]
            | null
          ai_risk_explanation?: string | null
          ai_summary?: string | null
          ai_uncertainty?: string | null
          calculated_at?: string | null
          closed_at?: string | null
          confidence_breakdown?: Json | null
          confidence_grade?:
            | Database["public"]["Enums"]["confidence_grade"]
            | null
          confidence_score?: number | null
          created_at?: string
          current_price?: number | null
          data_timestamp?: string | null
          direction?: Database["public"]["Enums"]["signal_direction"]
          entry_price?: number | null
          entry_zone_high?: number | null
          entry_zone_low?: number | null
          expires_at?: string | null
          failure_risk?: string | null
          historical_sample_size?: number | null
          id?: string
          instrument_id?: string
          invalidation_reason?: string | null
          is_demo?: boolean
          market_regime?: Database["public"]["Enums"]["regime_type"]
          mode?: Database["public"]["Enums"]["signal_mode"]
          model_id?: string | null
          model_version?: string | null
          no_trade_reasons?: string[]
          opened_at?: string
          realized_return_pct?: number | null
          risk_rating?: Database["public"]["Enums"]["risk_rating"]
          risk_reward_ratio?: number | null
          signal_quality_score?: number | null
          signal_reason?: string | null
          source?: string | null
          source_version?: string | null
          status?: Database["public"]["Enums"]["signal_status"]
          stop_loss?: number | null
          strategy_id?: string | null
          strategy_name?: string | null
          strategy_version?: string | null
          take_profit_1?: number | null
          take_profit_2?: number | null
          take_profit_3?: number | null
          timeframe?: string
          unrealized_return_pct?: number | null
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "signals_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signals_strategy_id_fkey"
            columns: ["strategy_id"]
            isOneToOne: false
            referencedRelation: "strategies"
            referencedColumns: ["id"]
          },
        ]
      }
      strategies: {
        Row: {
          applicable_instruments: string[]
          applicable_timeframes: string[]
          created_at: string
          description: string | null
          enabled: boolean
          id: string
          is_demo: boolean
          minimum_trades: number
          name: string
          strategy_family: string
          updated_at: string
          validation_status: Database["public"]["Enums"]["validation_status"]
          version: string
        }
        Insert: {
          applicable_instruments?: string[]
          applicable_timeframes?: string[]
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_demo?: boolean
          minimum_trades?: number
          name: string
          strategy_family: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          version?: string
        }
        Update: {
          applicable_instruments?: string[]
          applicable_timeframes?: string[]
          created_at?: string
          description?: string | null
          enabled?: boolean
          id?: string
          is_demo?: boolean
          minimum_trades?: number
          name?: string
          strategy_family?: string
          updated_at?: string
          validation_status?: Database["public"]["Enums"]["validation_status"]
          version?: string
        }
        Relationships: []
      }
      subscription_tiers: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          enabled: boolean
          entitlements: Json
          features: string[]
          id: string
          name: string
          price_monthly: number
          sort_order: number
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          enabled?: boolean
          entitlements?: Json
          features?: string[]
          id?: string
          name: string
          price_monthly?: number
          sort_order?: number
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          enabled?: boolean
          entitlements?: Json
          features?: string[]
          id?: string
          name?: string
          price_monthly?: number
          sort_order?: number
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          provider: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          provider?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist_items: {
        Row: {
          created_at: string
          id: string
          instrument_id: string
          updated_at: string
          watchlist_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          instrument_id: string
          updated_at?: string
          watchlist_id: string
        }
        Update: {
          created_at?: string
          id?: string
          instrument_id?: string
          updated_at?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      agent_vote: "buy" | "sell" | "neutral" | "reject"
      app_role: "super_admin" | "admin" | "analyst" | "support" | "user"
      asset_class:
        | "forex"
        | "synthetic_index"
        | "index"
        | "equity"
        | "commodity"
      confidence_grade: "low" | "moderate" | "strong" | "high"
      data_status: "healthy" | "delayed" | "stale" | "offline"
      indicator_direction: "bullish" | "bearish" | "neutral"
      recommendation_type:
        | "strong_setup"
        | "moderate_setup"
        | "weak_setup"
        | "wait"
        | "avoid"
      regime_type:
        | "trending_up"
        | "trending_down"
        | "ranging"
        | "high_volatility"
        | "low_volatility"
        | "spike_risk"
        | "reset_window"
        | "breakout"
        | "unstable"
        | "unknown"
      risk_gate_status: "approved" | "caution" | "rejected"
      risk_rating: "low" | "moderate" | "high" | "extreme"
      signal_direction: "buy" | "sell" | "neutral" | "wait" | "no_trade"
      signal_mode: "research" | "backtest" | "paper" | "live_verified"
      signal_status:
        | "pending"
        | "active"
        | "target_1_hit"
        | "target_2_hit"
        | "target_3_hit"
        | "closed_win"
        | "closed_loss"
        | "break_even"
        | "expired"
        | "cancelled"
        | "invalidated"
      subscription_tier: "free" | "basic" | "pro"
      validation_status:
        | "experimental"
        | "backtested"
        | "validation_pending"
        | "paper_trading"
        | "paper_validated"
        | "live_verified"
        | "paused"
        | "rejected"
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
      agent_vote: ["buy", "sell", "neutral", "reject"],
      app_role: ["super_admin", "admin", "analyst", "support", "user"],
      asset_class: ["forex", "synthetic_index", "index", "equity", "commodity"],
      confidence_grade: ["low", "moderate", "strong", "high"],
      data_status: ["healthy", "delayed", "stale", "offline"],
      indicator_direction: ["bullish", "bearish", "neutral"],
      recommendation_type: [
        "strong_setup",
        "moderate_setup",
        "weak_setup",
        "wait",
        "avoid",
      ],
      regime_type: [
        "trending_up",
        "trending_down",
        "ranging",
        "high_volatility",
        "low_volatility",
        "spike_risk",
        "reset_window",
        "breakout",
        "unstable",
        "unknown",
      ],
      risk_gate_status: ["approved", "caution", "rejected"],
      risk_rating: ["low", "moderate", "high", "extreme"],
      signal_direction: ["buy", "sell", "neutral", "wait", "no_trade"],
      signal_mode: ["research", "backtest", "paper", "live_verified"],
      signal_status: [
        "pending",
        "active",
        "target_1_hit",
        "target_2_hit",
        "target_3_hit",
        "closed_win",
        "closed_loss",
        "break_even",
        "expired",
        "cancelled",
        "invalidated",
      ],
      subscription_tier: ["free", "basic", "pro"],
      validation_status: [
        "experimental",
        "backtested",
        "validation_pending",
        "paper_trading",
        "paper_validated",
        "live_verified",
        "paused",
        "rejected",
      ],
    },
  },
} as const
