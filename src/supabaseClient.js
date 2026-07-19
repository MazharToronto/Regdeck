import { createClient } from "@supabase/supabase-js";

// REPLACE THESE WITH YOUR ACTUAL SUPABASE URL AND KEY
const SUPABASE_URL = "https://xhzfzpmktwtzixgzxchk.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable__LwBKKjkpB5DSwU7FMmlkA_Jil0yWe7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
