import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Client-side Supabase (lecture seule, anon key)
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

// Server-side Supabase (écriture, service role key)
// À utiliser uniquement dans +server.js / +page.server.js
export function createServerClient(serviceRoleKey) {
	return createClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
		auth: { persistSession: false }
	});
}
