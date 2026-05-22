import Head from 'next/head';
import '../styles/globals.css';
import { AuthProvider } from '../components/AuthContext';

export default function App({ Component, pageProps }) {
	return (
		<AuthProvider user={pageProps.user}>
			<Head>
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
			</Head>
			<Component {...pageProps} />
		</AuthProvider>
	);
}
