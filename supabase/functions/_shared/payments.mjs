// Integer base units only. This module is shared by Edge Functions and Node tests.
export class PaymentError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export function normalizeTxid(value) {
  const txid = String(value ?? '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(txid)) throw new PaymentError('invalid_txid');
  return txid;
}
export function inspectPayment(evidence, invoice) {
  const fail = code => { throw new PaymentError(code); };
  if (!evidence || evidence.provider_invoice_id !== invoice.provider_invoice_id) fail('wrong_invoice');
  if (evidence.chain !== invoice.chain || evidence.chain !== 'mainnet') fail('wrong_chain');
  if (evidence.network !== invoice.network) fail('wrong_network');
  if (evidence.address !== invoice.address) fail('wrong_recipient');
  const txid = normalizeTxid(evidence.txid);
  if (txid !== evidence.txid || evidence.double_spend !== false) fail('invalid_transaction');
  if (typeof evidence.units !== 'string' || !/^[0-9]{1,16}$/.test(evidence.units)) fail('invalid_amount');
  if (!Number.isSafeInteger(evidence.confirmations) || evidence.confirmations < 0) fail('invalid_confirmations');
  const seen = Date.parse(evidence.seen_at), start = Date.parse(invoice.issued_at), end = Date.parse(invoice.expires_at);
  if (![seen, start, end].every(Number.isFinite) || seen < start || seen > end) fail('outside_invoice_window');
  if (BigInt(evidence.units) < BigInt(invoice.units)) return 'partial';
  if (evidence.confirmations < 6) return 'pending_confirmations';
  // Late verification of a timely payment still requires an inventory review in SQL.
  return 'verified';
}
export function validateInvoice(i, network, now = Date.now()) {
  if (!i || i.chain !== 'mainnet' || i.network !== network || !['BTC','LTC'].includes(network) ||
      (typeof i.units === 'number' && !Number.isSafeInteger(i.units)) || typeof i.address !== 'string' || i.address.length < 14 ||
      !/^[0-9]{1,16}$/.test(String(i.units)) || BigInt(i.units) < 1000n ||
      BigInt(i.units) > 9007199254740991n || !i.provider_invoice_id ||
      !Number.isFinite(Date.parse(i.expires_at)) || Date.parse(i.expires_at) <= now ||
      Date.parse(i.expires_at) > now + 3600000) throw new PaymentError('invalid_provider_invoice', 502);
  return i;
}
// No arbitrary URL or shared-wallet verifier is trusted. Implement a provider only
// after supported endpoints, merchant eligibility and sandbox fixtures are reviewed.
// Interface: createInvoice({order,network,idempotencyKey}), verify({invoice,txid}),
// authenticateWebhook(request) -> {order_id,event_id,evidence}; cancelInvoice(id).
export function configuredProvider() {
  return {
    name: 'unconfigured', enabled: false,
    async createInvoice() { throw new PaymentError('payment_provider_not_configured',503); },
    async verify() { throw new PaymentError('payment_provider_not_configured',503); },
    async authenticateWebhook() { throw new PaymentError('payment_provider_not_configured',503); },
  };
}
