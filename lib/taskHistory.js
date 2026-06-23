/** Apply submitted/approved timestamps when task status changes. */
export function applyTaskHistoryPatches(previousTask, updates) {
	const patch = { ...updates };
	const prevStatus = previousTask?.status;
	const nextStatus = updates.status ?? prevStatus;
	const ts = new Date().toISOString();

	if (nextStatus === 'under_review' && prevStatus !== 'under_review' && !previousTask?.submitted_at) {
		patch.submitted_at = ts;
	}
	if (nextStatus === 'completed' && prevStatus !== 'completed') {
		patch.completed_at = ts;
		if (prevStatus === 'under_review' || previousTask?.submitted_at) {
			patch.approved_at = ts;
		}
	}
	return patch;
}
