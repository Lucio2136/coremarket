import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

export interface BetNotification {
  id: string;
  market_id: string;
  market_title: string;
  side: "yes" | "no";
  amount: number;
  payout_amount: number | null;
  potential_payout: number;
  status: "won" | "lost";
  created_at: string;
}

function getReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`quotr-notif-read-${userId}`);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(userId: string, ids: Set<string>) {
  localStorage.setItem(`quotr-notif-read-${userId}`, JSON.stringify([...ids]));
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<BetNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  const fetchResolved = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("bets")
      .select("id, market_id, side, amount, payout_amount, potential_payout, status, created_at, markets(title)")
      .eq("user_id", user.id)
      .in("status", ["won", "lost"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data) return;

    const mapped: BetNotification[] = data.map((b: any) => ({
      id: b.id,
      market_id: b.market_id,
      market_title: b.markets?.title ?? `Mercado #${b.market_id?.slice(0, 8)}`,
      side: b.side,
      amount: b.amount,
      payout_amount: b.payout_amount,
      potential_payout: b.potential_payout,
      status: b.status,
      created_at: b.created_at,
    }));

    // Solo mostrar toasts después de la carga inicial
    if (initialized.current) {
      for (const n of mapped) {
        if (!knownIds.current.has(n.id)) {
          const payout = n.payout_amount ?? n.potential_payout ?? 0;
          if (n.status === "won") {
            toast.success(`¡Ganaste! ${n.market_title}`, {
              description: `+$${payout.toFixed(2)} MXN acreditados`,
              duration: 6000,
            });
          } else {
            toast.error(`Apuesta perdida: ${n.market_title}`, {
              description: `−$${n.amount.toFixed(2)} MXN`,
              duration: 5000,
            });
          }
        }
      }
    }

    knownIds.current = new Set(mapped.map((n) => n.id));
    initialized.current = true;
    setNotifications(mapped);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setReadIds(new Set());
      knownIds.current = new Set();
      initialized.current = false;
      return;
    }

    setReadIds(getReadIds(user.id));
    fetchResolved();

    const channel = supabase
      .channel(`notif-bets-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "bets",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchResolved())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchResolved]);

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = useCallback(() => {
    if (!user) return;
    const newIds = new Set([...readIds, ...notifications.map((n) => n.id)]);
    setReadIds(newIds);
    saveReadIds(user.id, newIds);
  }, [user, readIds, notifications]);

  return { notifications, unreadCount, markAllRead };
}
