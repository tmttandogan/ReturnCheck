import { database } from '@/db/raw';
import { caseSchema,decisionSchema,demoCases,assessment,related,ReturnCase } from '@/lib/returns';
import { z } from 'zod';
import { readCases as readAll,enrichCase as enrich } from '@/db/cases';
const failure=(e:unknown)=>{console.error('Return storage error',e);return Response.json({error:'Could not access saved returns. Please try again.'},{status:503});};
export async function GET(){try{const all=await readAll();return Response.json({cases:all.map(c=>enrich(c,all))});}catch(e){return failure(e);}}
export async function POST(request:Request){try{const body:any=await request.json();
 if(body.action==='confirm_clean'){
 const input=z.object({ids:z.array(z.string()).min(1).max(500)}).safeParse(body);if(!input.success)return Response.json({error:'Select valid return IDs'},{status:400});
 const all=await readAll(),ids=new Set(input.data.ids),eligible=all.filter(c=>ids.has(c.id)&&c.decision==='Open'&&assessment(c,all).action==='Ready for refund');if(!eligible.length)return Response.json({updated:0,skipped:ids.size});
 const db=database();const results=await db.batch(eligible.map(c=>{const a=assessment(c,all);const updated={...c,decision:a.action,note:a.note,history:[...c.history,{date:new Date().toISOString(),decision:a.action,note:a.note}]};
 return db.prepare(`UPDATE return_cases SET payload=?, revision=revision+1 WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM return_cases other WHERE other.id<>? AND upper(trim(json_extract(other.payload,'$.orderId')))=? AND lower(trim(json_extract(other.payload,'$.product')))=? AND json_extract(other.payload,'$.demo')=?)`).bind(JSON.stringify(updated),c.id,c.revision,c.id,c.orderId.trim().toUpperCase(),c.product.trim().toLowerCase(),c.demo?1:0);}));
 const updated=results.reduce((n:number,r:any)=>n+(r.meta.changes||0),0);return Response.json({updated,skipped:ids.size-updated});
 }
 const parsed=z.object({cases:z.array(caseSchema).min(1).max(500)}).safeParse(body);const records=body.demo===true?demoCases:parsed.success?parsed.data.cases:null;if(!records)return Response.json({error:'Invalid return data'},{status:400});
 const db=database();const results=await db.batch(records.map(c=>db.prepare('INSERT INTO return_cases (id,payload,revision) VALUES (?,?,0) ON CONFLICT(id) DO NOTHING').bind(c.id,JSON.stringify({...c,decision:'Open',note:'',history:[]}))));return Response.json({added:results.reduce((n:number,r:any)=>n+(r.meta.changes||0),0),skipped:results.filter((r:any)=>!r.meta.changes).length});
 }catch(e){return failure(e);}}
export async function PATCH(request:Request){try{
 const input=z.object({id:z.string().min(1),revision:z.number().int().min(0),decision:decisionSchema.optional(),note:z.string().trim().max(2000).optional(),applyRecommendation:z.boolean().optional(),evidence:z.object({received:z.boolean(),expectedSerial:z.string().trim().max(100),returnedSerial:z.string().trim().max(100),refunded:z.boolean(),serial:z.enum(['Match','Mismatch','Unknown'])}).optional()}).safeParse(await request.json());if(!input.success)return Response.json({error:'Invalid review data'},{status:400});
 const b=input.data,all=await readAll(),c=all.find(x=>x.id===b.id);if(!c)return Response.json({error:'Return not found'},{status:404});if(c.revision!==b.revision)return Response.json({error:'This case changed. Refresh before saving.'},{status:409});
 const changed={...c,...b.evidence,...(c.orderSource?{expectedSerial:c.expectedSerial}:{})};const a=assessment(changed,all);const decision=b.applyRecommendation?a.action:b.decision??(b.evidence?'Open':c.decision);const note=b.applyRecommendation?a.note:b.note??c.note;
 if(decision==='Ready for refund'&&a.flags.length)return Response.json({error:'Resolve evidence flags before marking this case ready for refund.'},{status:400});
 const eventNote=b.evidence?`Evidence updated. ${a.reason}`:note;const updated={...changed,decision,note,history:[...c.history,{date:new Date().toISOString(),decision,note:eventNote}]};delete updated.relatedIds;
 const db=database();const ready=decision==='Ready for refund';const query=ready?`UPDATE return_cases SET payload=?,revision=revision+1 WHERE id=? AND revision=? AND NOT EXISTS (SELECT 1 FROM return_cases other WHERE other.id<>? AND upper(trim(json_extract(other.payload,'$.orderId')))=? AND lower(trim(json_extract(other.payload,'$.product')))=? AND json_extract(other.payload,'$.demo')=?)`:'UPDATE return_cases SET payload=?,revision=revision+1 WHERE id=? AND revision=?';const statement=db.prepare(query);const result=await (ready?statement.bind(JSON.stringify(updated),b.id,b.revision,b.id,changed.orderId.trim().toUpperCase(),changed.product.trim().toLowerCase(),changed.demo?1:0):statement.bind(JSON.stringify(updated),b.id,b.revision)).run();if(!result.meta.changes)return Response.json({error:'This case changed. Refresh before saving.'},{status:409});
 return Response.json({case:enrich({...updated,revision:b.revision+1},all)});
 }catch(e){return failure(e);}}
