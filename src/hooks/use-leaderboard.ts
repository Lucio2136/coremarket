import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface LeaderboardEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  avatar_color: string | null;
  total_won: number;
  total_bet: number;
}

export function useLeaderboard(limit = 50) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("profiles")
      .select("id, username, avatar_url, avatar_color, total_won, total_bet")
      .order("total_won", { ascending: false })
      .limit(limit)
      .then(({ data, error: err }) => {
        if (err) { setError(err.message); return; }
        setEntries((data ?? []) as LeaderboardEntry[]);
      })
      .finally(() => setLoading(false));
  }, [limit]);

  return { entries, loading, error };
}
