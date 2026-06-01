import { defineCloudflareConfig } from '@opennextjs/cloudflare';

const config = defineCloudflareConfig({});

// iron-session → uncrypto resolves to crypto.web.mjs under workerd conditions,
// but OpenNext only copies the node build artifacts. Use node resolution instead.
if (config.cloudflare) {
	config.cloudflare.useWorkerdCondition = false;
}

export default config;
