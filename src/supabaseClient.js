import { createClient } from "@supabase/supabase-js";

// REPLACE THESE WITH YOUR ACTUAL SUPABASE URL AND KEY
const SUPABASE_URL = "https://xhzfzpmktwtzixgzxchk.supabase.co";
const SUPABASE_PUBLIC_KEY = "sb_publishable__LwBKKjkpB5DSwU7FMmlkA_Jil0yWe7";

// Helper to decode JWT payload safely
const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

// Custom fetch to log the user roles for each Supabase API request
const customFetch = async (url, options) => {
  // Extract token from Authorization header
  if (options && options.headers) {
    // Note: Fetch headers can be a Headers object or a plain object
    let authHeader = null;
    
    if (options.headers instanceof Headers) {
      authHeader = options.headers.get('Authorization');
    } else if (typeof options.headers === 'object') {
      authHeader = options.headers['Authorization'] || options.headers['authorization'];
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = parseJwt(token);
      
      // If the JWT has the user_roles claim we injected in the SQL Hook, print it
      if (decoded && decoded.user_roles) {
        // We use string extraction to keep the log clean (e.g. "/rest/v1/work_orders")
        const endpoint = url.toString().replace(SUPABASE_URL, '');
        console.log(`[API Request to ${endpoint}] User Roles:`, decoded.user_roles);
      }
    }
  }
  
  return fetch(url, options);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
  global: {
    fetch: customFetch
  }
});
