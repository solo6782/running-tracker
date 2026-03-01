import adapter from '@sveltejs/adapter-cloudflare';

const config = {
	kit: {
		adapter: adapter()
	}
};

export default config;
```

**Problème 2** : la commande de deploy. Dans les settings Cloudflare de ton projet, change le **Deploy command** de :
```
npx wrangler deploy
```
vers :
```
npx wrangler pages deploy .svelte-kit/cloudflare
