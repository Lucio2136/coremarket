import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface PublicProfile {
  id: string;
  username: string;
  avatar_color: string;
  avatar_url: string | null;
  total_won: number;
  total_bet: number;
  created_at: string;
}

export interface PublicBet {
  id: string;
  side: "yes" | "no";
  amount: number;
  potential_payout: number;
  status: "pending" | "won" | "lost";
  created_at: string;
  odds_at_bet: number;
  markets: { title: string; subject_name: string } | null;
}

export function usePublicProfile(username: string | undefined) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [bets, setBets]       = useState<PublicBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);

    const run = async () => {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id, username, avatar_color, avatar_url, total_won, total_bet, created_at")
        .eq("username", username)
        .single();

      if (profErr || !prof) {
        setError("Usuario no encontrado");
        setLoading(false);
        return;
      }
      setProfile(prof as PublicProfile);

      const { data: betsData } = await supabase
        .from("bets")
        .select("id, side, amount, potential_payout, status, created_at, odds_at_bet, markets(title, subject_name)")
        .eq("user_id", prof.id)
        .order("created_at", { ascending: false })
        .limit(20);

      setBets((betsData as PublicBet[]) ?? []);
      setLoading(false);
    };

    run();
  }, [username]);

  return { profile, bets, loading, error };
}
