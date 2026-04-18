import { useEffect, useState } from "react";
import { supabase, Transaction } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

export const useTransactions = (limit = 20) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (err) throw err;
        setTransactions(data ?? []);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al cargar transacciones");
      } finally {
        setLoading(false);
      }
    };

    fetch();

    const channel = supabase
      .channel(`transactions-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "transactions",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setTransactions((prev) => [payload.new as Transaction, ...prev].slice(0, limit));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, limit]);

  return { transactions, loading, error };
};
