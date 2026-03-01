import { createClient } from '@supabase/supabase-js';

export function createServerClient(url, serviceRoleKey) {
	if (!url || !serviceRoleKey) {
		throw new Error(`Supabase config missing: url=${!!url}, key=${!!serviceRoleKey}`);
	}
	return createClient(url, serviceRoleKey, {
		auth: { persistSession: false }
	});
}
