import Head from 'next/head';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { AuthProvider } from '../components/AuthContext';

const inter = Inter({
	subsets: ['latin'],
	weight: ['300', '400', '500', '600', '700'],
	display: 'swap',
});

export default function App({ Component, pageProps }) {
	return (
		<div className={inter.className}>
			<AuthProvider user={pageProps.user}>
				<Head>
					<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
					<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
					<link rel="icon" href="/logo-icon-192.png" type="image/png" sizes="192x192" />
					<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
					<link rel="manifest" href="/manifest.webmanifest" />
					<meta name="apple-mobile-web-app-title" content="Hello Neighbor" />
					<meta name="application-name" content="Hello Neighbor" />
					<meta name="theme-color" content="#5B9AB8" />
				</Head>
				<Component {...pageProps} />
			</AuthProvider>
		</div>
	);
}
