/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { Context, Hono } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

async function verifyTokenFromRequest(c: Context) {
	const JWKS = createRemoteJWKSet(new URL(`${c.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));
	const authHeader = c.req.header('Authorization');

	if (!authHeader?.startsWith('Bearer ')) {
		return c.json({ error: 'Missing or invalid Authorization header' }, 401);
	}

	const token = authHeader.replace('Bearer ', '');

	const { payload } = await jwtVerify(token, JWKS, {
		issuer: `${c.env.SUPABASE_URL}/auth/v1`,

		audience: 'authenticated',
	});

	const userId = payload.sub;

	return userId;
}

interface Env {
	SUPABASE_URL: string;
	KV: KVNamespace;
}

const app = new Hono<{
	Bindings: Env;
}>();

app.get('/', (c) => {
	return c.text('Hello');
});

app.get('/hanzi/explain', async (c: Context) => {
	try {
		const userId = await verifyTokenFromRequest(c);

		if (!userId) {
			return c.json({ error: 'Unauthorized' }, 401);
		}

		const hanzi = c.req.query('hanzi');
		if (!hanzi) {
			return c.json({ error: 'Missing hanzi query parameter' }, 400);
		}

		const explanation = await c.env.KV.get(hanzi);

		if (!explanation) {
			return c.json({ error: 'No explanation found', hanzi }, 404);
		}

		return c.json(JSON.parse(explanation));
	} catch (err) {
		return c.json({ error: (err as Error).message }, 400);
	}
});

export default app;
