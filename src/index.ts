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
		throw new Error('Unauthorized');
	}

	const token = authHeader.replace('Bearer ', '');

	const { payload } = await jwtVerify(token, JWKS, {
		issuer: `${c.env.SUPABASE_URL}/auth/v1`,

		audience: 'authenticated',
	});

	const userId = payload.sub;

	if (!userId) {
		throw new Error('Invalid token: missing sub claim');
	}
	return userId;
}

interface Env {
	SUPABASE_URL: string;
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
		console.log('Authenticated user ID:', userId);
		return new Response('Hello, authenticated user!', { status: 200 });
	} catch (err) {
		return new Response('Unauthorized', { status: 401 });
	}
});

export default app;
