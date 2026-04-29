# Database Standard Operating Procedures

## Goal
Secure and reliable interaction with the Supabase PostgreSQL backend.

## Structure
- **Table:** `Record` (or `Invoice`).
- **Access Control:** Supabase Authentication combined with Row Level Security (RLS) policies. Only authenticated users can read/write.

## Tools (Data Fetching / Writing)
- The frontend will utilize `@supabase/supabase-js` for queries.
- Supabase API key is strictly maintained in `.env`.

## Edge Cases
- **Missing Env Variables:** App initialization fails safely if `.env` keys are missing.
- **Role Mismatches:** Handled via RLS on the Supabase side (users can only access data appropriate to their role).
