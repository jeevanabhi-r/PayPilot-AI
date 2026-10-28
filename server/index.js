import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {catalog,parseRequest,validatePlan} from './logic.js';
const app=express();
const port=Number(process.env.PORT||3001);
const paypalReady=Boolean(process.env.PAYPAL_CLIENT_ID&&process.env.PAYPAL_CLIENT_SECRET);
const mode=paypalReady?'sandbox':'demo';
const history=[];
const pending=new Map();
app.disable('x-powered-by');
app.use(cors({origin:process.env.APP_ORIGIN?.split(',')||['http://localhost:5173']}));
app.use(express.json({limit:'20kb'}));
function fail(res,status,message){return res.status(status).json({error:message})}
async function paypalToken(){
  const auth=Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const r=await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  if(!r.ok)throw new Error(`PayPal authentication failed (${r.status})`);
  return (await r.json()).access_token;
}
async function paypalCall(endpoint,method,body){
  const token=await paypalToken();
  const r=await fetch(`https://api-m.sandbox.paypal.com${endpoint}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','PayPal-Request-Id':crypto.randomUUID()},body:body?JSON.stringify(body):undefined});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.message||`PayPal request failed (${r.status})`);
  return data;
}
app.get('/api/config',(req,res)=>res.json({mode,clientId:paypalReady?process.env.PAYPAL_CLIENT_ID:null,aiEnabled:Boolean(process.env.GROQ_API_KEY),currency:'USD'}));
app.get('/api/catalog',(req,res)=>res.json(catalog));
app.get('/api/history',(req,res)=>res.json(history.slice(-30).reverse()));
app.post('/api/plan',async(req,res)=>{
  const message=typeof req.body?.message==='string'?req.body.message.trim():'';
  if(!message||message.length>500)return fail(res,400,'Enter a request (1–500 characters).');
  let plan=parseRequest(message),engine='rules';
  if(process.env.GROQ_API_KEY){
    try{
      const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'llama-3.3-70b-versatile',temperature:0.1,max_tokens:260,messages:[{role:'system',content:`You are a product recommendation planner. Respond with ONLY JSON with keys productId, budget (number or null), reason (one concise sentence), alternatives (array of product IDs). You MUST select productId from this exact catalog: ${JSON.stringify(catalog.map(({id,name,price,description})=>({id,name,price,description})))}. Never invent products or prices. Never claim a payment happened. The user must approve any checkout.`},{role:'user',content:message}]})});
      if(r.ok){const data=await r.json();const raw=data.choices?.[0]?.message?.content||'';const candidate=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));if(validatePlan(candidate)){plan={...plan,productId:candidate.productId,reason:String(candidate.reason||plan.reason).slice(0,350),alternatives:Array.isArray(candidate.alternatives)?candidate.alternatives.filter(id=>catalog.some(p=>p.id===id)).slice(0,3):plan.alternatives};engine='groq';}}
    }catch(e){console.warn('AI fallback:',e.stack || e.message)}
  }
  const product=catalog.find(p=>p.id===plan.productId);
  res.json({plan:{...plan,product,alternatives:plan.alternatives.map(id=>catalog.find(p=>p.id===id)).filter(Boolean),withinBudget:plan.budget===null||product.price<=plan.budget},engine});
});
app.post('/api/orders',async(req,res)=>{
  const product=catalog.find(p=>p.id===req.body?.productId);
  if(!product)return fail(res,400,'Select a valid catalog product.');
  if(req.body?.approved!==true)return fail(res,400,'Explicit user approval is required.');
  try{
    const order=paypalReady?await paypalCall('/v2/checkout/orders','POST',{intent:'CAPTURE',purchase_units:[{reference_id:product.id,description:product.name,amount:{currency_code:'USD',value:product.price.toFixed(2)}}]}):{id:`DEMO-${crypto.randomUUID()}`,status:'CREATED'};
    pending.set(order.id,{productId:product.id,created:Date.now(),status:'CREATED'});
    res.json({id:order.id,status:order.status,mode});
  }catch(e){console.error(e);fail(res,502,e.message)}
});
app.post('/api/orders/:id/capture',async(req,res)=>{
  const id=req.params.id;const p=pending.get(id);
  if(!p)return fail(res,404,'Order not found in this session.');
  if(p.status!=='CREATED')return fail(res,409,'Order already processed.');
  const product=catalog.find(x=>x.id===p.productId);
  try{
    let capture;
    if(paypalReady){
      capture=await paypalCall(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`,'POST');
      if(capture.status!=='COMPLETED')return fail(res,409,`PayPal order status: ${capture.status}`);
      const unit=capture.purchase_units?.[0];const captured=unit?.payments?.captures?.[0];
      if(captured?.status!=='COMPLETED'||captured?.amount?.value!==product.price.toFixed(2)||captured?.amount?.currency_code!=='USD')return fail(res,409,'Capture verification failed.');
    }else{
      if(!id.startsWith('DEMO-'))return fail(res,400,'Not a demo order.');
      capture={id,status:'SIMULATED'};
    }
    p.status='COMPLETED';
    const transaction={id:crypto.randomUUID(),orderId:id,productId:product.id,name:product.name,amount:product.price,currency:'USD',status:paypalReady?'COMPLETED':'SIMULATED',createdAt:new Date().toISOString()};
    history.push(transaction);res.json({transaction,captureStatus:capture.status,mode});
  }catch(e){console.error(e);fail(res,502,e.message)}
});
app.post('/api/orders/:id/cancel',(req,res)=>{const p=pending.get(req.params.id);if(p&&p.status==='CREATED')p.status='CANCELLED';res.json({cancelled:true})});
const dirname=path.dirname(fileURLToPath(import.meta.url));const dist=path.resolve(dirname,'../dist');
app.use(express.static(dist));app.get('*',(req,res,next)=>{if(req.path.startsWith('/api/'))return next();res.sendFile(path.join(dist,'index.html'),err=>{if(err)res.status(404).send('Build the frontend with npm run build first.')})});
app.listen(port,()=>console.log(`PayPilot API listening on http://localhost:${port} (${mode} mode)`));
