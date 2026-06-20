import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';

export function plaidConfigured() {
	return Boolean(PLAID_CLIENT_ID && PLAID_SECRET);
}

export function getPlaidClient() {
	const configuration = new Configuration({
		basePath: PlaidEnvironments[PLAID_ENV] || PlaidEnvironments.sandbox,
		baseOptions: {
			headers: {
				'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
				'PLAID-SECRET': PLAID_SECRET,
			},
		},
	});
	return new PlaidApi(configuration);
}

export function mapPlaidTransaction(transaction, accountName) {
	return {
		id: transaction.transaction_id,
		source: 'plaid',
		externalId: transaction.transaction_id,
		date: transaction.date,
		description: transaction.merchant_name || transaction.name || 'Bank transaction',
		amount: -Number(transaction.amount),
		account: accountName,
		accountId: transaction.account_id,
		pending: Boolean(transaction.pending),
		category: transaction.personal_finance_category?.primary || '',
	};
}

export async function createPlaidLinkToken() {
	const plaid = getPlaidClient();
	const response = await plaid.linkTokenCreate({
		user: { client_user_id: 'hello-neighbor-dashboard' },
		client_name: 'Hello Neighbor Dashboard',
		products: [Products.Transactions],
		country_codes: [CountryCode.Us],
		language: 'en',
	});
	return response.data.link_token;
}

export async function exchangePlaidPublicToken(publicToken) {
	const plaid = getPlaidClient();
	const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
	const accessToken = exchange.data.access_token;
	const itemId = exchange.data.item_id;

	const item = await plaid.itemGet({ access_token: accessToken });
	const accountsResponse = await plaid.accountsGet({ access_token: accessToken });

	return {
		accessToken,
		itemId,
		institutionName: item.data.item.institution_name || 'Linked bank account',
		accounts: accountsResponse.data.accounts.map((account) => ({
			id: account.account_id,
			name: account.name,
			mask: account.mask,
			type: account.type,
			subtype: account.subtype,
		})),
	};
}

export async function syncPlaidTransactions(accessToken, cursor) {
	const plaid = getPlaidClient();
	let nextCursor = cursor || null;
	let upserted = [];
	let removedIds = [];
	let hasMore = true;

	while (hasMore) {
		const syncResponse = await plaid.transactionsSync({
			access_token: accessToken,
			cursor: nextCursor || undefined,
		});

		// `added` are brand new; `modified` are updates (e.g. pending -> posted, final
		// amount/description). Both map to an upsert keyed on transaction_id.
		upserted = upserted.concat(syncResponse.data.added, syncResponse.data.modified);
		// `removed` transactions were reversed/voided upstream and must be deleted locally.
		removedIds = removedIds.concat(
			syncResponse.data.removed.map((item) => item.transaction_id),
		);
		nextCursor = syncResponse.data.next_cursor;
		hasMore = syncResponse.data.has_more;
	}

	const accountsResponse = await plaid.accountsGet({ access_token: accessToken });
	const accountNameById = Object.fromEntries(
		accountsResponse.data.accounts.map((account) => [account.account_id, account.name]),
	);

	const transactions = upserted.map((transaction) =>
		mapPlaidTransaction(transaction, accountNameById[transaction.account_id] || 'Bank account'),
	);

	return { transactions, removedIds, cursor: nextCursor };
}

/** Revoke Plaid access for a linked item (best-effort; local DB is cleared regardless). */
export async function removePlaidItem(accessToken) {
	if (!accessToken) return;
	const plaid = getPlaidClient();
	await plaid.itemRemove({ access_token: accessToken });
}
