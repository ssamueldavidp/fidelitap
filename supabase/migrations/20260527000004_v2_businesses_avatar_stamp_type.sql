-- supabase/migrations/20260527000004_v2_businesses_avatar_stamp_type.sql
-- avatar_url for profile photo; type column on stamp_events for reward_claimed

ALTER TABLE public.businesses
  ADD COLUMN avatar_url TEXT;

-- stamp_events gets a type column for distinguishing regular stamps from reward claims
ALTER TABLE public.stamp_events
  ADD COLUMN type TEXT NOT NULL DEFAULT 'stamp'
    CHECK (type IN ('stamp', 'reward_claimed'));
