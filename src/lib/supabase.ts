import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "quotr-auth",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export interface Profile {
  id: string;
  email: string;
  username: string;
  balance: number;
  balance_mxn: number;
  total_won: number;
  total_bet: number;
  bio: string | null;
  avatar_color: string;
  avatar_url: string | null;
  referral_code: string | null;
  referred_by: string | null;
  referral_count: number;
  referral_earnings_mxn: number;
  created_at: string;
  updated_at: string;
}

export interface MarketOption {
  id: string;
  market_id: string;
  label: string;
  photo_url: string | null;
  pool: number;
  percent: number;
  odds: number;
  sort_order: number;
  created_at: string;
}

export interface Market {
  id: string;
  title: string;
  subject_name: string;
  category: string;
  market_type: "binary" | "multiple" | "scalar";
  yes_odds: number;
  no_odds: number;
  yes_percent: number;
  no_percent: number;
  total_pool: number;
  bettor_count: number;
  closes_at: string;
  is_trending: boolean;
  status: "open" | "closed";
  result: "yes" | "no" | null;
  winning_option_id: string | null;
  // Scalar fields
  scalar_min: number | null;
  scalar_max: number | null;
  scalar_unit: string | null;
  scalar_result: number | null;
  // Subject photo
  subject_photo_url: string | null;
  // Context & rules
  description: string | null;
  rules: string | null;
  created_at: string;
  // Embedded from join — populated by hooks
  market_options?: MarketOption[];
}

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  amount: number;
  side: "yes" | "no" | null;
  option_id: string | null;
  odds_at_bet: number;
  potential_payout: number;
  payout_amount: number | null;
  status: "pending" | "won" | "lost";
  // Scalar fields
  scalar_low: number | null;
  scalar_high: number | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: "deposit" | "withdrawal" | "win" | "loss" | "bet";
  amount: number;
  balance_after: number;
  description: string | null;
  stripe_payment_intent_id: string | null;
  status: "pending" | "completed" | "failed";
  created_at: string;
}