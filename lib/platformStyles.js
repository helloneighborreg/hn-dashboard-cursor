/** Booking-platform badge colors/labels, shared across calendar and reservation views. */

export const PLATFORM_STYLES = {
	airbnb: { bg: '#E31C5F', text: '#fff', label: 'Airbnb' },
	homeaway: { bg: '#00A699', text: '#fff', label: 'VRBO / HomeAway' },
	vrbo: { bg: '#00A699', text: '#fff', label: 'VRBO' },
	booking_com: { bg: '#003580', text: '#fff', label: 'Booking.com' },
	direct: { bg: '#5B9AB8', text: '#fff', label: 'Direct' },
	hospitable: { bg: '#5B9AB8', text: '#fff', label: 'Direct' },
	manual: { bg: '#5B9AB8', text: '#fff', label: 'Direct / Manual' },
};

export function platformStyle(p) {
	return PLATFORM_STYLES[p] || { bg: '#9CA3AF', text: '#fff', label: p || 'Unknown' };
}
