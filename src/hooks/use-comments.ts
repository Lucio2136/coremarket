import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Comment {
  id: string;
  market_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    username: string;
    avatar_color: string;
    avatar_url: string | null;
  } | null;
}

export function useComments(marketId: string) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [posting, setPosting]   = useState(false);

  const fetchComments = useCallback(async () => {
    const { data, error } = await supabase
      .from("market_comments")
      .select("*, profiles(username, avatar_color, avatar_url)")
      .eq("market_id", marketId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) setComments(data as Comment[]);
    setLoading(false);
  }, [marketId]);

  useEffect(() => {
    fetchComments();

    const channel = supabase
      .channel(`comments-${marketId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "market_comments",
          filter: `market_id=eq.${marketId}`,
        },
        () => fetchComments()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [marketId, fetchComments]);

  const postComment = useCallback(async (content: string): Promise<boolean> => {
    if (!content.trim()) return false;
    setPosting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setPosting(false); return false; }

    const { error } = await supabase
      .from("market_comments")
      .insert({ market_id: marketId, user_id: user.id, content: content.trim() });

    setPosting(false);
    return !error;
  }, [marketId]);

  const deleteComment = useCallback(async (commentId: string) => {
    await supabase.from("market_comments").delete().eq("id", commentId);
  }, []);

  return { comments, loading, posting, postComment, deleteComment };
}
