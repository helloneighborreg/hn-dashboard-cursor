import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
	return (
		<Html lang="en">
			<Head>
				{process.env.NODE_ENV === 'development' && (
					<link rel="stylesheet" href="/dev.css" />
				)}
			</Head>
			<body>
				{/* OpenNext dev can leave body hidden until hydration; unhide without touching Next's boot scripts. */}
				<script
					dangerouslySetInnerHTML={{
						__html: `(function(){function show(){document.body.style.display='block';}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show);else show();})();`,
					}}
				/>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
