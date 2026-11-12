// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7';
import {createDeliveryWorker} from '../_shared/delivery.mjs';
Deno.serve(createDeliveryWorker({env:(name:string)=>Deno.env.get(name),sendPush:(subscription:{endpoint:string;keys:{p256dh:string;auth:string}},payload:string,keys:{subject:string;publicKey:string;privateKey:string})=>webpush.sendNotification(subscription,payload,{vapidDetails:keys,TTL:300,timeout:10000})}));
