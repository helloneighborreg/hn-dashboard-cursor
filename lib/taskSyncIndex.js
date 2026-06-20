const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isLegacyReservationId(value) {
	return UUID_RE.test(String(value || '').trim());
}

function taskMatchesCancelledReservation(row, { code, hospitableId }) {
	if (!row) return false;
	if (hospitableId && row.hospitable_reservation_id === hospitableId) return true;
	if (hospitableId && row.reservation_id === hospitableId) return true;
	if (code && String(row.reservation_id || '').toUpperCase() === code) return true;
	if (code) {
		const title = String(row.title || '').toUpperCase();
		if (title.startsWith(`${code} `) || title.startsWith(`${code}-`)) return true;
	}
	return isLegacyReservationId(row.reservation_id);
}

/** In-memory index for turnover tasks (one Supabase load per sync). */
export function buildTurnoverTaskIndex(tasks = []) {
	const byCode = new Map();
	const byHospitableId = new Map();
	const byPropertyCheckout = new Map();
	const all = [];

	for (const row of tasks) {
		if (row?.type !== 'turnover') continue;
		all.push(row);

		const code = String(row.reservation_id || '').trim().toUpperCase();
		if (code) byCode.set(code, row);

		const hospitableId = row.hospitable_reservation_id?.trim();
		if (hospitableId) byHospitableId.set(hospitableId, row);

		if (row.property_id && row.checkout_date) {
			const key = `${row.property_id}|${row.checkout_date}`;
			if (!byPropertyCheckout.has(key)) byPropertyCheckout.set(key, []);
			byPropertyCheckout.get(key).push(row);
		}
	}

	return { byCode, byHospitableId, byPropertyCheckout, all };
}

export function findTaskInIndex(lookup, index, { allowPropertyDateFallback = true } = {}) {
	const code = lookup.reservation_id?.trim()?.toUpperCase();
	const legacyId = lookup.hospitable_reservation_id?.trim();

	if (code && index.byCode.has(code)) return index.byCode.get(code);

	if (legacyId && index.byHospitableId.has(legacyId)) return index.byHospitableId.get(legacyId);

	if (legacyId) {
		const byUuid = index.all.find((t) => t.reservation_id === legacyId);
		if (byUuid) return byUuid;
	}

	const lookupIds = new Set([code, legacyId].filter(Boolean));
	if (lookup.property_id && lookupIds.size) {
		const candidates = index.all.filter(
			(t) =>
				t.property_id === lookup.property_id
				&& lookupIds.has(String(t.reservation_id || '').toUpperCase()),
		);
		if (candidates.length === 1) return candidates[0];
	}

	if (allowPropertyDateFallback && lookup.property_id && lookup.checkout_date) {
		const rows = index.byPropertyCheckout.get(`${lookup.property_id}|${lookup.checkout_date}`) || [];
		if (rows.length === 1 && isLegacyReservationId(rows[0].reservation_id)) return rows[0];
	}

	return null;
}

export function findTaskForCancelled(lookup, index, { code, hospitableId } = {}) {
	let existing = findTaskInIndex(lookup, index, { allowPropertyDateFallback: false });
	if (!existing) existing = findTaskInIndex(lookup, index, { allowPropertyDateFallback: true });

	if (!existing && code) {
		const matches = index.all.filter(
			(t) => String(t.title || '').toUpperCase().startsWith(`${code} `)
				|| String(t.title || '').toUpperCase().startsWith(`${code}-`),
		);
		if (matches.length === 1) existing = matches[0];
	}

	if (!existing && lookup.property_id && lookup.checkout_date) {
		const rows = index.byPropertyCheckout.get(`${lookup.property_id}|${lookup.checkout_date}`) || [];
		const matches = rows.filter((row) => taskMatchesCancelledReservation(row, { code, hospitableId }));
		if (matches.length === 1) return matches[0];
		if (rows.length === 1 && isLegacyReservationId(rows[0].reservation_id)) return rows[0];
	}

	return existing;
}

export function removeTaskFromIndex(index, task) {
	if (!task?.id) return;
	const id = task.id;
	index.all = index.all.filter((t) => t.id !== id);

	const code = String(task.reservation_id || '').trim().toUpperCase();
	if (code && index.byCode.get(code)?.id === id) index.byCode.delete(code);

	const hospitableId = task.hospitable_reservation_id?.trim();
	if (hospitableId && index.byHospitableId.get(hospitableId)?.id === id) {
		index.byHospitableId.delete(hospitableId);
	}

	if (task.property_id && task.checkout_date) {
		const key = `${task.property_id}|${task.checkout_date}`;
		const rows = index.byPropertyCheckout.get(key);
		if (rows) {
			const next = rows.filter((t) => t.id !== id);
			if (next.length) index.byPropertyCheckout.set(key, next);
			else index.byPropertyCheckout.delete(key);
		}
	}
}

export function addTaskToIndex(index, task) {
	if (!task?.id || task.type !== 'turnover') return;
	removeTaskFromIndex(index, task);
	index.all.push(task);

	const code = String(task.reservation_id || '').trim().toUpperCase();
	if (code) index.byCode.set(code, task);

	const hospitableId = task.hospitable_reservation_id?.trim();
	if (hospitableId) index.byHospitableId.set(hospitableId, task);

	if (task.property_id && task.checkout_date) {
		const key = `${task.property_id}|${task.checkout_date}`;
		if (!index.byPropertyCheckout.has(key)) index.byPropertyCheckout.set(key, []);
		index.byPropertyCheckout.get(key).push(task);
	}
}
