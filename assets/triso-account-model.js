/* Presentation categories for the existing canonical order state machine. */
(function(global){
 'use strict';
 const groups={fulfilled:'completed',payment_submitted:'progress',payment_review:'progress',paid:'progress',fulfillment_pending:'progress',awaiting_payment:'action',disputed:'action',cancelled:'closed',refunded:'closed'};
 function summarize(rows,owner){
  const unique=new Map();for(const row of rows||[])if(row?.id&&owner&&(row.customer_id===owner||row.seller_id===owner))unique.set(String(row.id),row);
  const orders=[...unique.values()],counts={total:orders.length,completed:0,progress:0,action:0,closed:0};
  for(const row of orders)if(groups[row.status])counts[groups[row.status]]++;
  return {orders,counts};
 }
 global.TrisoAccountModel={summarize};
})(window);
