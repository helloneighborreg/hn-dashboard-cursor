import { getSupabase } from './supabase.js';

function throwDbError(error) {
	if (error?.code === 'PGRST205' || /Could not find the table/i.test(error?.message || '')) {
		const err = new Error(
			'Push notifications are not set up yet. Ask an admin to run supabase/migrations/20260714_push_subscriptions.sql in Supabase.',
		);
		err.status = 503;
		throw err;
	}
	throw error;
}

function mapRow(row) {
	if (!row) return null;
	return {
		id: row.id,
		username: row.username,
		endpoint: row.endpoint,
		p256dh: row.p256dh,
		auth: row.auth,
		user_agent: row.user_agent,
		created_at: row.created_at,
		updated_at: row.updated_at,
	};
}

export async function upsertPushSubscription({
	username,
	endpoint,
	p256dh,
	auth,
	userAgent = null,
}) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('push_subscriptions')
		.upsert(
			{
				username,
				endpoint,
				p256dh,
				auth,
				user_agent: userAgent,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: 'endpoint' },
		)
		.select()
		.single();
	if (error) throwDbError(error);
	return mapRow(data);
}

export async function deletePushSubscriptionByEndpoint(endpoint) {
	const supabase = getSupabase();
	const { error } = await supabase
		.from('push_subscriptions')
		.delete()
		.eq('endpoint', endpoint);
	if (error) throwDbError(error);
}

export async function deletePushSubscriptionsForUsername(username, endpoint = null) {
	const supabase = getSupabase();
	let query = supabase.from('push_subscriptions').delete().eq('username', username);
	if (endpoint) query = query.eq('endpoint', endpoint);
	const { error } = await query;
	if (error) throwDbError(error);
}

export async function getPushSubscriptionsForUsername(username) {
	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('push_subscriptions')
		.select('*')
		.eq('username', username);
	if (error) throwDbError(error);
	return (data || []).map(mapRow);
}

export async function getPushSubscriptionsForUsernames(usernames) {
	const unique = [...new Set((usernames || []).filter(Boolean))];
	if (!unique.length) return [];

	const supabase = getSupabase();
	const { data, error } = await supabase
		.from('push_subscriptions')
		.select('*')
		.in('username', unique);
	if (error) throwDbError(error);
	return (data || []).map(mapRow);
}
