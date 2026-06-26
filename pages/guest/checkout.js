import { useRouter } from 'next/router';
import GuestCheckoutFlow from '../../components/guest/GuestCheckoutFlow';
import { normalizeCheckoutCode } from '../../lib/guestCheckout';

export default function GuestCheckoutPage() {
	const router = useRouter();
	const initialCode = router.isReady
		? (normalizeCheckoutCode(router.query.code) || '')
		: '';

	return <GuestCheckoutFlow initialCode={initialCode} routerReady={router.isReady} />;
}
