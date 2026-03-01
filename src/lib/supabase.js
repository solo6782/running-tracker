import { createClient } from '@supabase/supabase-js';

export function createServerClient(url, serviceRoleKey) {
	return createClient(url, serviceRoleKey, {
		auth: { persistSession: false }
	});
}
