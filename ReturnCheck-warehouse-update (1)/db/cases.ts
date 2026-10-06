import { database } from './raw';
import { ReturnCase,related } from '@/lib/returns';
import { orderKey,OrderRecord } from '@/lib/orders';
export async function readOrders(){const d=await database().prepare('SELECT payload FROM order_records ORDER BY id').all();return d.results.map((r:any)=>JSON.parse(r.payload)) as OrderRecord[];}
export async function readCases(){const [data,orders]=await Promise.all([database().prepare('SELECT payload,revision FROM return_cases ORDER BY id').all(),readOrders()]);const map=new Map(orders.map(c=>[orderKey(c),c]));return data.results.map((r:any)=>{const c={...JSON.parse(r.payload),revision:r.revision};const o=map.get(orderKey(c));return o?{...c,expectedSerial:o.expectedSerial,amountPaid:o.amountPaid,amountRefunded:o.amountRefunded,trackingNumber:o.trackingNumber,orderSource:o.source,orderImportedAt:o.importedAt}:c;}) as ReturnCase[];}
export const enrichCase=(c:ReturnCase,all:ReturnCase[])=>({...c,relatedIds:related(c,all)});
