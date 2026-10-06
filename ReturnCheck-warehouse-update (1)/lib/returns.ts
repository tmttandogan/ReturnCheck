import { z } from 'zod';
export const decisionSchema = z.enum(['Open', 'Ready for refund', 'Request evidence', 'Inspect item']);
export const caseSchema = z.object({
  id:z.string().trim().min(1).max(80), orderId:z.string().trim().min(1).max(80),
  customer:z.string().trim().min(1).max(120), product:z.string().trim().min(1).max(160),
  amount:z.number().finite().min(0).max(1000000),
  shipment:z.enum(['Not shipped','In transit','Delivered']),
  received:z.boolean(), serial:z.enum(['Match','Mismatch','Unknown']),
  amountPaid:z.number().finite().min(0).max(1000000).optional(), amountRefunded:z.number().finite().min(0).max(1000000).optional(),
  expectedSerial:z.string().trim().max(100).default(''), returnedSerial:z.string().trim().max(100).default(''), refunded:z.boolean().default(false),
  duplicate:z.boolean(), priorOrders:z.number().int().min(0).max(100000),
  priorReturns:z.number().int().min(0).max(100000), demo:z.boolean().default(false),
}).refine(x=>x.priorReturns<=x.priorOrders,{message:'Prior returns cannot exceed prior orders'});
export type ReturnCase=z.infer<typeof caseSchema> & {decision:string;note:string;revision:number;history:{date:string;decision:string;note:string}[];relatedIds?:string[];orderSource?:string;orderImportedAt?:string;trackingNumber?:string};
export const serialStatus=(c:ReturnCase)=>c.expectedSerial&&c.returnedSerial?(c.expectedSerial.trim().toUpperCase()===c.returnedSerial.trim().toUpperCase()?'Match':'Mismatch'):c.expectedSerial||c.returnedSerial?'Unknown':c.serial;
export function related(c:ReturnCase,all?:ReturnCase[]){return all?all.filter(x=>x.id!==c.id&&x.demo===c.demo&&x.orderId.trim().toUpperCase()===c.orderId.trim().toUpperCase()&&x.product.trim().toLowerCase()===c.product.trim().toLowerCase()).map(x=>x.id):c.relatedIds??[];}
export function signals(c:ReturnCase,all?:ReturnCase[]){
 const result:{title:string;detail:string;level:'high'|'medium'}[]=[];
 if(c.amountPaid===undefined||c.amountRefunded===undefined)result.push({title:'Payment records missing',detail:'Import the original paid amount and prior refunded amount before confirming refund readiness.',level:'medium'});
 else if(c.amount>Math.max(0,c.amountPaid-c.amountRefunded))result.push({title:'Refund exceeds remaining paid amount',detail:`Requested $${c.amount.toFixed(2)}; $${Math.max(0,c.amountPaid-c.amountRefunded).toFixed(2)} remains after recorded refunds. Reconcile the payment ledger.`,level:'high'});
 if(c.refunded)result.push({title:'Refund already recorded',detail:'Source records show a refund has already been issued. Reconcile the payment before issuing another refund.',level:'high'});
 const linked=related(c,all);if(linked.length)result.push({title:'Overlapping return requests',detail:`Same order and product appear in ${linked.join(', ')}. Reconcile quantities and requests before proceeding; these may be legitimate separate returns.`,level:'high'});
 if(c.duplicate)result.push({title:'Duplicate refund request',detail:'Source data marks another refund request for this order. Verify whether the request is a duplicate.',level:'high'});
 if(serialStatus(c)==='Mismatch')result.push({title:'Serial number mismatch',detail:'Inspection data records a different serial number from the original item. Inspect the item before proceeding.',level:'high'});
 if(!c.received)result.push({title:'Warehouse receipt missing',detail:c.shipment==='Delivered'?'Carrier says delivered, but warehouse receipt is not recorded. Reconcile both records.':'The return has not been received by the warehouse. Verify receipt before proceeding.',level:'medium'});
 if(c.received&&serialStatus(c)==='Unknown')result.push({title:'Item verification incomplete',detail:'The return was received, but serial verification is not recorded. Request inspection evidence.',level:'medium'});
 return result;
}
export const priority=(c:ReturnCase)=>signals(c).some(s=>s.level==='high')?'Inspection':signals(c).length?'Evidence needed':'No flags';
export function assessment(c:ReturnCase,all?:ReturnCase[]){
 const flags=signals(c,all);const action=flags.some(x=>x.level==='high')?'Inspect item':flags.length?'Request evidence':'Ready for refund';
 const next=c.amountPaid!==undefined&&c.amountRefunded!==undefined&&c.amount>Math.max(0,c.amountPaid-c.amountRefunded)?'Reconcile the refundable amount':c.amountPaid===undefined||c.amountRefunded===undefined?'Import original payment records':c.refunded?'Reconcile the recorded refund':related(c,all).length||c.duplicate?'Reconcile overlapping refund requests':serialStatus(c)==='Mismatch'?'Inspect the serial-number mismatch':!c.received?(c.shipment==='Delivered'?'Confirm warehouse receipt':'Await warehouse receipt'):serialStatus(c)==='Unknown'?'Complete item verification':'Confirm refund readiness';
 const reason=flags.length?flags.map(x=>x.title).join('; '):'Warehouse receipt and serial verification recorded; no duplicate or prior-refund flags in supplied records.';
 const note=`Prepared review — ${next}. ${reason} Recommendation: ${action}. Based on supplied records; no payment issued.`;
 const draft=action==='Ready for refund'?`Hello ${c.customer}, we have received your return for ${c.product} (${c.orderId}). It is ready for the refund step, subject to final confirmation. We will confirm when the refund is issued.`:c.refunded?`Hello ${c.customer}, we are checking the refund already recorded for ${c.orderId} to confirm its status. We will update you after reconciling the payment.`:related(c,all).length||c.duplicate?`Hello ${c.customer}, we are reconciling the return requests for ${c.product} (${c.orderId}) so the correct refund can be processed. We will update you when this check is complete.`:action==='Inspect item'?`Hello ${c.customer}, your return for ${c.product} (${c.orderId}) needs an item-verification check before we can complete the refund review. We will update you after inspection.`:!c.received?`Hello ${c.customer}, we are awaiting confirmation that the warehouse has received your return for ${c.product} (${c.orderId}). We will update you once receipt is confirmed.`:`Hello ${c.customer}, we have received your return for ${c.product} (${c.orderId}) and are completing item verification before the refund review.`;
 return {action,next,reason,note,draft,flags};
}
export function caseReport(c:ReturnCase,all?:ReturnCase[]){const a=assessment(c,all);return JSON.stringify({generatedAt:new Date().toISOString(),rules:'3.0',case:c,assessment:a,limitation:'Supplied records only. No payment or customer message sent.'},null,2);}
const seed=[
 ['RT-1042','ORD-8102','Alex Morgan','Sony WH-1000XM5 headphones',450,'Delivered',true,'Mismatch',false,8,1],
 ['RT-1043','ORD-8103','Jamie Park','Apple AirPods Pro',249,'In transit',false,'Unknown',false,12,2],
 ['RT-1044','ORD-8104','Sam Rivera','GoPro HERO camera',399,'Delivered',true,'Match',true,5,1],
 ['RT-1045','ORD-8105','Taylor Brooks','Logitech MX Master mouse',99,'Delivered',true,'Match',false,16,2],
 ['RT-1046','ORD-8106','Jordan Lee','Samsung portable SSD',179,'Delivered',false,'Unknown',false,4,0],
 ['RT-1047','ORD-8107','Casey Ellis','Anker USB-C charger',65,'Delivered',true,'Match',false,7,1],
];
export const demoCases=seed.map(r=>({...caseSchema.parse({id:r[0],orderId:r[1],customer:r[2],product:r[3],amount:r[4],shipment:r[5],received:r[6],serial:r[7],duplicate:r[8],priorOrders:r[9],priorReturns:r[10],amountPaid:r[4],amountRefunded:0,demo:true}),decision:'Open',note:'',history:[],revision:0})) as ReturnCase[];
export const headers=['return_id','order_id','customer','product','amount','shipment','warehouse_received','serial_match','duplicate_refund','prior_orders','prior_returns','expected_serial','returned_serial','refund_issued','paid_amount','refunded_amount'];
export function csv(cases:ReturnCase[]){return [headers,...cases.map(c=>[c.id,c.orderId,c.customer,c.product,c.amount,c.shipment,c.received,c.serial,c.duplicate,c.priorOrders,c.priorReturns,c.expectedSerial||'',c.returnedSerial||'',c.refunded||false,c.amountPaid??'',c.amountRefunded??''])].map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\n');}
export function readCsv(text:string){
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field.length)throw new Error('Unexpected quote in CSV');else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';}else field+=c;}
 if(quoted)throw new Error('Unclosed quote in CSV');row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw new Error('CSV needs a header and at least one return');
 return rows;
}
export function parseCsv(text:string){
 const rows=readCsv(text);
 const head=rows.shift()!.map(x=>x.replace(/^\uFEFF/,'').trim());if(headers.slice(0,11).some(h=>!head.includes(h)))throw new Error('Use the template: one or more required columns are missing');
 if(rows.length>500)throw new Error('Import up to 500 returns at a time');
 const ids=new Set<string>();return rows.map((r,i)=>{const obj=Object.fromEntries(head.map((h,n)=>[h,(r[n]??'').trim()]));const bool=(key:string)=>{if(!['true','false'].includes(obj[key].toLowerCase()))throw new Error(`Row ${i+2}: ${key} must be true or false`);return obj[key].toLowerCase()==='true';};const num=(key:string)=>{if(!obj[key])throw new Error(`Row ${i+2}: ${key} is required`);return Number(obj[key]);};
 const parsed=caseSchema.safeParse({id:obj.return_id,orderId:obj.order_id,customer:obj.customer,product:obj.product,amount:num('amount'),shipment:obj.shipment,received:bool('warehouse_received'),serial:obj.serial_match,duplicate:bool('duplicate_refund'),priorOrders:num('prior_orders'),priorReturns:num('prior_returns'),amountPaid:obj.paid_amount?num('paid_amount'):undefined,amountRefunded:obj.refunded_amount?num('refunded_amount'):undefined,expectedSerial:obj.expected_serial||'',returnedSerial:obj.returned_serial||'',refunded:obj.refund_issued?bool('refund_issued'):false,demo:false});
 if(!parsed.success)throw new Error(`Row ${i+2}: ${parsed.error.issues[0].message}`);if(ids.has(parsed.data.id))throw new Error(`Duplicate return_id: ${parsed.data.id}`);ids.add(parsed.data.id);return parsed.data;});
}
