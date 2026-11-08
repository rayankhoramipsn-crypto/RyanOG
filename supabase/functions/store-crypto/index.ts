import { createStoreHandler } from '../_shared/store-handler.mjs';
Deno.serve(createStoreHandler({ env: (name: string) => Deno.env.get(name) }));
