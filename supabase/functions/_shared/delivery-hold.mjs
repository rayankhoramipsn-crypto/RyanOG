// Explicit staging release hold. Removing this requires separate delivery approval
// and a reviewed deployment; pre-existing runtime flags cannot activate sends.
export function stagingDeliveryEnv(env){
 const blocked=new Set(['EMAIL_DELIVERY_ENABLED','EMAIL_SENDER_VERIFIED','WEB_PUSH_ENABLED']);
 return name=>blocked.has(name)?'false':env(name);
}
