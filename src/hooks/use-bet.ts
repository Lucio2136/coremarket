import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export const useBet = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeBet = async (
    marketId: string,
    amount: number,
    side: "yes" | "no" | null,
    odds: number,
    optionId?: string   // solo para mercados de opción múltiple
  ) => {
    if (!user) throw new Error("No autenticado");

    try {
      setLoading(true);
      setError(null);

      const params: Record<string, unknown> = {
        p_market_id: marketId,
        p_amount:    amount,
        p_odds:      odds,
      };

      if (optionId) {
        params.p_option_id = optionId;
        params.p_side      = null;
      } else {
        params.p_side = side;
      }

      const { data, error: rpcError } = await supabase.rpc("place_bet", params);

      if (rpcError) throw new Error(rpcError.message);

      return data as {
        bet_id:           string;
        market_id:        string;
        side:             "yes" | "no" | null;
        option_id:        string | null;
        amount:           number;
        odds_at_bet:      number;
        potential_payout: number;
        status:           "pending";
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al apostar";
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { placeBet, loading, error };
};
