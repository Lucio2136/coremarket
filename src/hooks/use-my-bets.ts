import { useEffect, useState } from "react";
import { supabase, Bet } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export const useMyBets = () => {
  const { user } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setBets([]);
      setLoading(false);
      return;
    }

    const fetchBets = async () => {
      try {
        setLoading(true);
        const { data, error: fetchError } = await supabase
          .from("bets")
          .select("*, markets(title)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (fetchError) throw fetchError;
        setBets(data || []);
        setError(null);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch bets";
        setError(errorMessage);
        console.error("Error fetching bets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBets();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`bets_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bets",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          fetchBets();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { bets, loading, error };
};
