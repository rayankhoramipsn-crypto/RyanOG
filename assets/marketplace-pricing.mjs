/* USD review arithmetic. BigInt cents; never a payment authorization. */
const LIMIT=999999999999n;
export function usdCents(value){
 const text=String(value);if(!/^(0|[1-9]\d{0,9})(\.\d{1,8})?$/.test(text))throw Error('Invalid USD amount');
 const [whole,fraction='']=text.split('.');const cents=BigInt(whole)*100n+BigInt((fraction+'00').slice(0,2))+(Number(fraction[2]||0)>=5?1n:0n);
 if(cents>LIMIT)throw Error('USD amount exceeds supported range');return cents;
}
export function checkoutQuote(price,method,fee='0'){
 if(!['crypto','paypal'].includes(method))throw Error('Invalid payment method');
 const item=usdCents(price),fees=usdCents(fee);if(item<=0n)throw Error('Invalid item price');
 const discount=method==='crypto'?(item+5n)/10n:0n;
 return Object.freeze({item_cents:String(item),fee_cents:String(fees),discount_cents:String(discount),total_cents:String(item-discount+fees),method,policy:'market-crypto-10-v1',payable:false});
}
export function usdText(cents,locale='en'){
 if(!/^\d{1,15}$/.test(String(cents)))throw Error('Invalid cents');
 return new Intl.NumberFormat(['en','fa','ar'].includes(locale)?locale:'en',{style:'currency',currency:'USD'}).format(Number(cents)/100);
}
