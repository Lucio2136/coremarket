import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  bank_details: { clabe: string; bank_name: string; holder_name: string };
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useWithdrawals = () => {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWithdrawals([]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setWithdrawals(data ?? []);
      setLoading(false);
    };

    fetch();

    // Escuchar cambios de status (cuando admin aprueba/rechaza)
    const channel = supabase
      .channel(`withdrawals-${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "withdrawals",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setWithdrawals((prev) => [payload.new as Withdrawal, ...prev]);
        } else if (payload.eventType === "UPDATE") {
          setWithdrawals((prev) =>
            prev.map((w) => w.id === payload.new.id ? { ...w, ...payload.new as Withdrawal } : w)
          );
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  return { withdrawals, loading };
};
