import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  balance: number;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, username: string, referralCode?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signOut: () => Promise<void>;
  updateBalance: (amount: number) => Promise<void>;
  updateProfile: (updates: { username?: string; bio?: string; avatar_color?: string; avatar_url?: string }) => Promise<void>;
  refreshProfile: () => Promise<void>;
  resetPasswordEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (data) {
      setProfile(data);
      setBalance(data.balance_mxn ?? 0);
    }
  };

  // ── Inicialización única ─────────────────────────────────────────────────
  useEffect(() => {
    // 1. Sesión actual al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Cambios de auth — el único lugar que gestiona setUser/setProfile
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session?.user) {
          setUser(session.user);
          // Para usuarios OAuth: crear perfil si no existe
          (async () => {
            const { data: existingProfile } = await supabase
              .from("profiles")
              .select("id")
              .eq("id", session.user.id)
              .single();
            if (!existingProfile) {
              const base = (session.user.email?.split("@")[0] ?? "usuario")
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 14);
              const suffix = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
              await supabase.from("profiles").insert({
                id: session.user.id,
                username: `${base}${suffix}`,
                balance_mxn: 0,
              });
            }
            fetchProfile(session.user.id);
          })();
        }
        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setBalance(0);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Realtime balance ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`profile-${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as any;
        setProfile(updated);
        setBalance(updated.balance_mxn ?? 0);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Métodos de auth ──────────────────────────────────────────────────────
  // signIn y signUp solo lanzan la operación de Supabase Auth.
  // onAuthStateChange se encarga del resto (setUser, fetchProfile).
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signInWithFacebook = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string, username: string, referralCode?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) throw error;
    if (data.user) {
      await supabase.from("profiles").upsert(
        { id: data.user.id, username, balance_mxn: 0 },
        { onConflict: "id" }
      );
      if (referralCode?.trim()) {
        await supabase.rpc("apply_referral", {
          p_user_id: data.user.id,
          p_referral_code: referralCode.trim(),
        });
      }
      // onAuthStateChange SIGNED_IN cargará el perfil
    }
  };

  const signOut = async () => {
    // Limpiar estado local ANTES de llamar a Supabase para evitar
    // la race condition donde navigate("/") ocurre con estado sucio
    setUser(null);
    setProfile(null);
    setBalance(0);
    await supabase.auth.signOut();
  };

  const updateProfile = async (updates: { username?: string; bio?: string; avatar_color?: string; avatar_url?: string }) => {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();
    if (error) throw error;
    if (data) {
      setProfile(data);
    }
  };

  const updateBalance = async (amount: number) => {
    if (!user) return;
    const newBalance = balance + amount;
    await supabase
      .from("profiles")
      .update({ balance_mxn: newBalance })
      .eq("id", user.id);
    setBalance(newBalance);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const resetPasswordEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{
      user, profile, balance, loading,
      isAuthenticated: !!user,
      signIn, signInWithGoogle, signInWithFacebook,
      signUp, signOut, updateBalance, updateProfile, refreshProfile,
      resetPasswordEmail, updatePassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
