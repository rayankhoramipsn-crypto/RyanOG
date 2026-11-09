import { createWebhookHandler } from '../_shared/webhook-handler.mjs';
Deno.serve(createWebhookHandler({ env: (name: string) => Deno.env.get(name) }));
