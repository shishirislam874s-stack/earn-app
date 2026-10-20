const express=require('express'),{Pool}=require('pg'),bcrypt=require('bcryptjs'),crypto=require('crypto');
const AU=process.env.ADMIN_USERNAME||'slshisirboss',AP=process.env.ADMIN_PASSWORD||'53624123';
const DBU=process.env.DATABASE_URL||process.env.POSTGRES_URL||process.env.POSTGRES_PRISMA_URL;
const pool=new Pool({connectionString:DBU,ssl:/localhost|127\.0\.0\.1/.test(DBU||'')?false:{rejectUnauthorized:false},max:3});
const q=(t,p)=>pool.query(t,p);
const TODAY="(now() at time zone 'Asia/Dhaka')::date";
const DEF={payment_number_bkash:'01604606880',payment_number_nagad:'01604606880',payment_number_rocket:'01604606880',limit_A:50,limit_B:100,limit_C:150,fee_A:500,fee_B:1000,fee_C:1500,min_withdraw:100,ref_join:1,ref_active:100,work_days:5,w1_days:2,w2_days:3,w3_days:4,team_size:20,t1_bonus:10,t2_bonus:20,t3_bonus:30,watch_seconds:15,broadcast:''};
const SQL=`
create table if not exists users(id serial primary key,name text not null,phone text unique not null,pw text not null,category text,work_until date,balance numeric(12,2) not null default 0,ref_by int,blocked boolean not null default false,activated_at timestamptz,created_at timestamptz not null default now());
create table if not exists settings(k text primary key,v text);
create table if not exists videos(id serial primary key,title text not null,link text not null,reward numeric(10,2) not null);
create table if not exists activations(id serial primary key,user_id int not null,category text not null,method text not null,trx text unique not null,fee numeric not null,status text not null default 'pending',created_at timestamptz not null default now());
create table if not exists watch_sessions(user_id int,video_id int,started_at timestamptz not null default now(),primary key(user_id,video_id));
create table if not exists submissions(id serial primary key,user_id int not null,video_id int not null,vtitle text,proof bytea,mime text,reward numeric(10,2) not null,credited numeric(10,2) not null default 0,status text not null default 'pending',created_at timestamptz not null default now());
create unique index if not exists sub_once on submissions(user_id,video_id) where status<>'rejected';
create table if not exists withdrawals(id serial primary key,user_id int not null,method text not null,number text not null,amount numeric(12,2) not null,status text not null default 'pending',created_at timestamptz not null default now());
create table if not exists daily(user_id int,d date,amount numeric(10,2) not null default 0,primary key(user_id,d));
create table if not exists ledger(id serial primary key,user_id int not null,type text not null,amount numeric(12,2) not null,status text not null default 'approved',ref text,created_at timestamptz not null default now());
create index if not exists led_u on ledger(user_id,id desc);
create index if not exists led_r on ledger(ref);
create index if not exists users_ref on users(ref_by);
create table if not exists team_bonuses(id serial primary key,leader_id int,member_id int,new_id int,category text,amount numeric,created_at timestamptz default now());
create table if not exists notifs(id serial primary key,user_id int,bn text,en text,seen boolean default false,created_at timestamptz default now());
create table if not exists sessions(th text primary key,kind text,uid int,seen timestamptz default now());
create table if not exists lockouts(k text primary key,fails int default 0,until timestamptz);`;
async function init(){const c=await pool.connect();try{await c.query('select pg_advisory_lock(4242)');await c.query(SQL);for(const[k,v]of Object.entries(DEF))await c.query('insert into settings values($1,$2) on conflict do nothing',[k,String(v)])}finally{await c.query('select pg_advisory_unlock(4242)').catch(()=>{});c.release()}}
class E extends Error{constructor(bn,en,code=400){super(en);this.bn=bn;this.en=en;this.code=code}}
const wrap=f=>(req,res,next)=>f(req,res,next).catch(e=>{if(e instanceof E)return res.status(e.code).json({bn:e.bn,en:e.en});console.error(e);res.status(500).json({bn:'সার্ভারে সমস্যা হয়েছে',en:'Server error'})});
async function tx(fn){const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}finally{c.release()}}
const S=async c=>{const o={};(await c.query('select k,v from settings')).rows.forEach(x=>o[x.k]=x.v);return o};
const r2=x=>Math.round(x*100)/100;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const cookies=req=>{const o={};(req.headers.cookie||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)try{o[p.slice(0,i).trim()]=decodeURIComponent(p.slice(i+1))}catch(e){}});return o};
async function mk(res,kind,uid){const t=crypto.randomBytes(32).toString('hex');await q('insert into sessions(th,kind,uid) values($1,$2,$3)',[hash(t),kind,uid]);res.append('Set-Cookie',`${kind}s=${t}; HttpOnly; SameSite=Lax; Path=/; Secure; Max-Age=${kind=='a'?1800:2592000}`)}
async function auth(req,kind){const t=cookies(req)[kind+'s'];if(!t)return null;const s=(await q('select * from sessions where th=$1 and kind=$2',[hash(t),kind])).rows[0];if(!s)return null;const age=Date.now()-new Date(s.seen).getTime();if(age>(kind=='a'?1800000:2592000000)){await q('delete from sessions where th=$1',[s.th]);return null}await q('update sessions set seen=now() where th=$1',[s.th]);return s}
async function out(req,res,kind){const t=cookies(req)[kind+'s'];if(t)await q('delete from sessions where th=$1',[hash(t)]);res.append('Set-Cookie',`${kind}s=; HttpOnly; SameSite=Lax; Path=/; Secure; Max-Age=0`);res.json({ok:1})}
const U=wrap(async(req,res,next)=>{const s=await auth(req,'u');if(!s)throw new E('লগইন করুন','Please log in',401);const u=(await q('select * from users where id=$1',[s.uid])).rows[0];if(!u||u.blocked)throw new E('অ্যাকাউন্ট বন্ধ আছে','Account blocked',403);req.u=u;next()});
const A=wrap(async(req,res,next)=>{if(!await auth(req,'a'))throw new E('অ্যাডমিন লগইন করুন','Admin login required',401);next()});
async function stat(c,uid){const s=await S(c);const u=(await c.query(`select *,work_until-${TODAY} wl from users where id=$1`,[uid])).rows[0];
 const ar=Number((await c.query('select count(*) n from users where ref_by=$1 and activated_at is not null',[uid])).rows[0].n);
 const earned=Number((await c.query(`select coalesce(sum(amount),0) a from daily where user_id=$1 and d=${TODAY}`,[uid])).rows[0].a);
 return{s,u,ar,earned,leader:ar>=Number(s.team_size),open:!!u.category&&u.wl!=null&&u.wl>=0}}
const gate=st=>{if(!st.u.category)throw new E('আগে আইডি অ্যাক্টিভ করুন, তারপর সব কাজ করতে পারবেন।','Activate your ID first, then you can do all the work.',403)};
const gateWork=st=>{gate(st);if(!st.open)throw new E('ভিডিও কাজ বন্ধ আছে। কাজ চালাতে আগে কাউকে জয়েন করান ও তার আইডি অ্যাক্টিভ করান।','Video work is locked. Refer someone and get their ID activated to continue. Category A opens 2 days, B 3 days, C 4 days.',403)};
const bal=(c,uid,amt)=>c.query('update users set balance=balance+$2 where id=$1',[uid,amt]);
async function credit(c,uid,amt,type,ref,status='approved'){await bal(c,uid,amt);await c.query('insert into ledger(user_id,type,amount,status,ref) values($1,$2,$3,$4,$5)',[uid,type,amt,status,ref||null])}
const notify=(c,uid,bn,en)=>c.query('insert into notifs(user_id,bn,en) values($1,$2,$3)',[uid,bn,en]);
const lock=(c,id)=>c.query('select * from users where id=$1 for update',[id]).then(r=>r.rows[0]);

const app=express();app.disable('x-powered-by');
app.use(express.json({limit:'4mb'}));
let ready;app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');ready=ready||init();ready.then(()=>next(),e=>{ready=null;console.error(e);res.status(500).json({bn:'ডাটাবেস যুক্ত নেই। Vercel এর Storage থেকে Postgres যুক্ত করে Redeploy করুন।',en:'Database not connected. Add Postgres in Vercel Storage and redeploy.'})})});

// ---------- public / auth ----------
app.get('/api/refname',wrap(async(req,res)=>{const id=parseInt(req.query.ref);const r=id>0&&id<2e9?(await q('select name from users where id=$1',[id])).rows[0]:null;res.json({name:r?r.name:null})}));
app.post('/api/register',wrap(async(req,res)=>{const name=String(req.body.name||'').trim(),phone=String(req.body.phone||'').trim(),pw=String(req.body.password||'');
 if(name.length<2||name.length>40)throw new E('নাম ২-৪০ অক্ষর হবে','Name must be 2-40 characters');
 if(!/^01\d{9}$/.test(phone))throw new E('সঠিক ফোন নম্বর দিন (০১XXXXXXXXX)','Enter a valid phone number (01XXXXXXXXX)');
 if(pw.length<6||pw.length>72)throw new E('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর','Password must be at least 6 characters');
 const h=await bcrypt.hash(pw,10);let ref=parseInt(req.body.ref);
 const id=await tx(async c=>{
  if(!(ref>0&&ref<2e9&&(await c.query('select 1 from users where id=$1',[ref])).rowCount))ref=null;
  const u=(await c.query('insert into users(name,phone,pw,ref_by) values($1,$2,$3,$4) returning id',[name,phone,h,ref])).rows[0];
  if(ref){const s=await S(c);await lock(c,ref);await credit(c,ref,Number(s.ref_join),'ref_join','join:'+u.id);await notify(c,ref,`${name} আপনার রেফারে জয়েন করেছে`,`${name} joined with your referral`)}
  return u.id}).catch(e=>{if(e.code=='23505')throw new E('এই নম্বর আগে থেকেই আছে','This phone number is already registered');throw e});
 await mk(res,'u',id);res.json({ok:1})}));
app.post('/api/login',wrap(async(req,res)=>{const u=(await q('select * from users where phone=$1',[String(req.body.phone||'')])).rows[0];
 if(!u||!await bcrypt.compare(String(req.body.password||''),u.pw))throw new E('ফোন বা পাসওয়ার্ড ভুল','Wrong phone or password',401);
 if(u.blocked)throw new E('অ্যাকাউন্ট বন্ধ আছে','Account blocked',403);await mk(res,'u',u.id);res.json({ok:1})}));
app.post('/api/logout',wrap((req,res)=>out(req,res,'u')));

// ---------- user ----------
app.get('/api/me',U,wrap(async(req,res)=>{const st=await stat(pool,req.u.id),{s,u}=st;
 const pend=(await q("select 1 from activations where user_id=$1 and status='pending'",[u.id])).rowCount>0;
 const unread=Number((await q('select count(*) n from notifs where user_id=$1 and not seen',[u.id])).rows[0].n);
 res.json({id:u.id,name:u.name,category:u.category,balance:Number(u.balance),active:!!u.category,open:st.open,daysLeft:u.wl==null?0:Math.max(0,u.wl+1),earned:st.earned,cap:u.category?Number(s['limit_'+u.category]):0,leader:st.leader,pending:pend,unread,site:process.env.PUBLIC_SITE_URL||'',cfg:s})}));
app.post('/api/activate',U,wrap(async(req,res)=>{const{category,method}=req.body,t=String(req.body.trx||'').trim().toLowerCase();
 if(!['A','B','C'].includes(category)||!['bkash','nagad','rocket'].includes(method))throw new E('ক্যাটাগরি ও পেমেন্ট মাধ্যম বাছুন','Choose category and payment method');
 if(!/^[a-z0-9]{6,20}$/.test(t))throw new E('সঠিক ট্রানজ্যাকশন আইডি দিন','Enter a valid transaction ID');
 await tx(async c=>{await lock(c,req.u.id);if((await c.query("select 1 from activations where user_id=$1 and status='pending'",[req.u.id])).rowCount)throw new E('আগের রিকোয়েস্ট পেন্ডিং আছে','You already have a pending request');
  const s=await S(c);const fee=Number(s['fee_'+category]);
  const r=await c.query('insert into activations(user_id,category,method,trx,fee) values($1,$2,$3,$4,$5) returning id',[req.u.id,category,method,t,fee]);
  await c.query("insert into ledger(user_id,type,amount,status,ref) values($1,'activation',$2,'pending',$3)",[req.u.id,fee,'act:'+r.rows[0].id])
 }).catch(e=>{if(e.code=='23505')throw new E('এই ট্রানজ্যাকশন আইডি আগে ব্যবহার হয়েছে','This transaction ID was already used');throw e});
 res.json({ok:1})}));
app.get('/api/videos',U,wrap(async(req,res)=>{const st=await stat(pool,req.u.id);gateWork(st);
 const r=await q(`select v.id,v.title,v.link,v.reward,case when w.started_at>now()-interval '30 minutes' then greatest(0,ceil($2::numeric-extract(epoch from now()-w.started_at))) end rem from videos v left join watch_sessions w on w.video_id=v.id and w.user_id=$1 where not exists(select 1 from submissions x where x.video_id=v.id and x.user_id=$1 and x.status<>'rejected') order by v.id limit 300`,[req.u.id,Number(st.s.watch_seconds)]);
 res.json({videos:r.rows.map(v=>({...v,reward:Number(v.reward),rem:v.rem==null?null:Number(v.rem)})),earned:st.earned,cap:Number(st.s['limit_'+st.u.category]),daysLeft:Math.max(0,st.u.wl+1)})}));
app.post('/api/watch',U,wrap(async(req,res)=>{const st=await stat(pool,req.u.id);gateWork(st);const vid=Number(req.body.video_id);
 if(!(await q("select 1 from videos v where v.id=$1 and not exists(select 1 from submissions x where x.video_id=v.id and x.user_id=$2 and x.status<>'rejected')",[vid,req.u.id])).rowCount)throw new E('ভিডিও পাওয়া যায়নি','Video not available',404);
 const r=await q(`insert into watch_sessions(user_id,video_id) values($1,$2) on conflict(user_id,video_id) do update set started_at=case when watch_sessions.started_at<now()-interval '30 minutes' then now() else watch_sessions.started_at end returning greatest(0,ceil($3::numeric-extract(epoch from now()-started_at))) rem`,[req.u.id,vid,Number(st.s.watch_seconds)]);
 res.json({rem:Number(r.rows[0].rem)})}));
app.post('/api/submit',U,wrap(async(req,res)=>{const vid=Number(req.body.video_id),m=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body.image||''));
 if(!vid||!m)throw new E('স্ক্রিনশট (ছবি) দিন','Upload a screenshot image');
 const buf=Buffer.from(m[2],'base64');if(buf.length>3e6)throw new E('ছবি বেশি বড়','Image is too large');
 await tx(async c=>{const uid=req.u.id;await lock(c,uid);const st=await stat(c,uid);gateWork(st);
  const v=(await c.query('select * from videos where id=$1',[vid])).rows[0];if(!v)throw new E('ভিডিও পাওয়া যায়নি','Video not found',404);
  const w=(await c.query('select extract(epoch from now()-started_at) sec from watch_sessions where user_id=$1 and video_id=$2',[uid,vid])).rows[0];
  if(!w||Number(w.sec)>1800)throw new E('আগে ভিডিও দেখুন','Watch the video first');
  if(Number(w.sec)<Number(st.s.watch_seconds))throw new E('টাইমার শেষ হওয়া পর্যন্ত অপেক্ষা করুন','Please wait for the timer to finish');
  await c.query(`insert into daily(user_id,d) values($1,${TODAY}) on conflict do nothing`,[uid]);
  const d=(await c.query(`select amount from daily where user_id=$1 and d=${TODAY} for update`,[uid])).rows[0];
  const pend=Number((await c.query("select coalesce(sum(reward),0) p from submissions where user_id=$1 and status='pending'",[uid])).rows[0].p);
  if(Number(d.amount)+pend>=Number(st.s['limit_'+st.u.category]))throw new E('আজকের লিমিট শেষ, কাল আবার আসুন','Daily limit reached, come back tomorrow');
  const r=await c.query('insert into submissions(user_id,video_id,vtitle,proof,mime,reward) values($1,$2,$3,$4,$5,$6) returning id',[uid,vid,v.title,buf,m[1],v.reward]);
  await c.query("insert into ledger(user_id,type,amount,status,ref) values($1,'video',$2,'pending',$3)",[uid,v.reward,'sub:'+r.rows[0].id]);
  await c.query('delete from watch_sessions where user_id=$1 and video_id=$2',[uid,vid]);
 }).catch(e=>{if(e.code=='23505')throw new E('এই ভিডিও আগেই জমা দিয়েছেন','You already submitted this video');throw e});
 res.json({ok:1})}));
app.post('/api/withdraw',U,wrap(async(req,res)=>{const amt=r2(Number(req.body.amount)),method=req.body.method,num=String(req.body.number||'').trim();
 if(!['bkash','nagad','rocket'].includes(method)||!/^01\d{9}$/.test(num))throw new E('সঠিক মাধ্যম ও নম্বর দিন','Choose a method and enter a valid number');
 await tx(async c=>{const u=await lock(c,req.u.id);const st=await stat(c,u.id);gate(st);
  if(!(amt>0)||amt<Number(st.s.min_withdraw))throw new E('সর্বনিম্ন উইথড্র '+st.s.min_withdraw,'Minimum withdraw is '+st.s.min_withdraw);
  if(amt>Number(u.balance))throw new E('ব্যালেন্স যথেষ্ট নয়','Insufficient balance');
  await bal(c,u.id,-amt);const r=await c.query('insert into withdrawals(user_id,method,number,amount) values($1,$2,$3,$4) returning id',[u.id,method,num,amt]);
  await c.query("insert into ledger(user_id,type,amount,status,ref) values($1,'withdraw',$2,'pending',$3)",[u.id,-amt,'wd:'+r.rows[0].id])});
 res.json({ok:1})}));
app.get('/api/history',U,wrap(async(req,res)=>{res.json((await q('select type,amount,status,created_at from ledger where user_id=$1 order by id desc limit 300',[req.u.id])).rows.map(r=>({...r,amount:Number(r.amount)})))}));
app.get('/api/notifs',U,wrap(async(req,res)=>{const r=await q('select bn,en,seen,created_at from notifs where user_id=$1 order by id desc limit 60',[req.u.id]);await q('update notifs set seen=true where user_id=$1 and not seen',[req.u.id]);res.json(r.rows)}));
app.get('/api/team',U,wrap(async(req,res)=>{const st=await stat(pool,req.u.id);gate(st);const uid=req.u.id;
 const mem=(await q('select u.id,u.name,u.category,(u.activated_at is not null) active,(select count(*) from users r where r.ref_by=u.id)::int cnt from users u where u.ref_by=$1 order by u.id desc limit 300',[uid])).rows;
 const total=Number((await q('select count(*) n from users where ref_by=$1',[uid])).rows[0].n);
 const earned=Number((await q('select coalesce(sum(amount),0) a from team_bonuses where leader_id=$1',[uid])).rows[0].a);
 const hist=(await q('select t.created_at,t.category,t.amount,m.name mname from team_bonuses t join users m on m.id=t.member_id where t.leader_id=$1 order by t.id desc limit 100',[uid])).rows;
 res.json({leader:st.leader,active:st.ar,total,size:Number(st.s.team_size),earned,members:mem,hist:hist.map(h=>({...h,amount:Number(h.amount)}))})}));

// ---------- admin ----------
app.post('/api/admin/login',wrap(async(req,res)=>{const ip=(req.headers['x-forwarded-for']||'x').split(',')[0].trim();
 const l=(await q('select * from lockouts where k=$1',[ip])).rows[0];if(l&&l.until&&new Date(l.until)>new Date())throw new E('অনেকবার ভুল হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন','Too many attempts, try again in a few minutes',429);
 const h=s=>crypto.createHash('sha256').update(String(s)).digest();const a=crypto.timingSafeEqual(h(req.body.username),h(AU)),b=crypto.timingSafeEqual(h(req.body.password),h(AP));
 if(!(a&&b)){await q("insert into lockouts(k,fails) values($1,1) on conflict(k) do update set fails=case when lockouts.fails+1>=5 then 0 else lockouts.fails+1 end,until=case when lockouts.fails+1>=5 then now()+interval '5 minutes' else lockouts.until end",[ip]);throw new E('ইউজারনেম বা পাসওয়ার্ড ভুল','Wrong username or password',401)}
 await q('delete from lockouts where k=$1',[ip]);await mk(res,'a',0);res.json({ok:1})}));
app.post('/api/admin/logout',wrap((req,res)=>out(req,res,'a')));
app.get('/api/admin/me',A,(req,res)=>res.json({ok:1}));
app.get('/api/admin/counts',A,wrap(async(req,res)=>{res.json((await q("select (select count(*) from activations where status='pending')::int act,(select count(*) from submissions where status='pending')::int vid,(select count(*) from withdrawals where status='pending')::int wd,(select count(*) from users)::int users,(select count(*) from users where category is not null)::int active,(select coalesce(sum(amount),0) from withdrawals where status='paid') paid")).rows[0])}));
const LISTS={
 act:{from:'activations a join users u on u.id=a.user_id',cols:'a.id,a.user_id,u.name,a.category,a.method,a.trx,a.fee,a.status,a.created_at',s:'u.name ilike $1 or a.user_id::text=$2 or a.trx ilike $1'},
 vid:{from:'submissions a join users u on u.id=a.user_id',cols:'a.id,a.user_id,u.name,a.vtitle,a.reward,a.credited,a.status,a.created_at',s:'u.name ilike $1 or a.user_id::text=$2 or a.vtitle ilike $1'},
 wd:{from:'withdrawals a join users u on u.id=a.user_id',cols:'a.id,a.user_id,u.name,a.method,a.number,a.amount,a.status,a.created_at',s:'u.name ilike $1 or a.user_id::text=$2 or a.number=$2'}};
app.get('/api/admin/list/:t',A,wrap(async(req,res)=>{const L=LISTS[req.params.t];if(!L)throw new E('?','?',404);const st=req.query.status||'pending',qq=String(req.query.q||'').trim().slice(0,60),pg=Math.max(0,parseInt(req.query.page)||0);
 let w=st=='pending'?"a.status='pending'":st=='done'?"a.status in ('approved','paid')":st=='rejected'?"a.status='rejected'":'true';
 if(qq)w+=` and (${L.s})`;
 const r=await q(`select ${L.cols} from ${L.from} where ${w} order by a.id desc limit 21 offset ${pg*20}`,qq?['%'+qq+'%',qq]:[]);
 res.json({rows:r.rows.slice(0,20),more:r.rows.length>20})}));
app.get('/api/admin/proof/:id',A,wrap(async(req,res)=>{const r=(await q('select proof,mime from submissions where id=$1',[parseInt(req.params.id)||0])).rows[0];if(!r)return res.status(404).end();res.set('Content-Type',r.mime).set('Cache-Control','private, max-age=3600').send(r.proof)}));
const done=new E('আগেই সম্পন্ন হয়েছে','Already handled',409);
app.post('/api/admin/act/:id/:do',A,wrap(async(req,res)=>{const ok=req.params.do=='approve';if(!ok&&req.params.do!='reject')throw done;
 await tx(async c=>{const a=(await c.query('select * from activations where id=$1 for update',[parseInt(req.params.id)||0])).rows[0];if(!a||a.status!='pending')throw done;
  await c.query('update activations set status=$2 where id=$1',[a.id,ok?'approved':'rejected']);await c.query('update ledger set status=$2 where ref=$1',['act:'+a.id,ok?'approved':'rejected']);
  if(!ok)return notify(c,a.user_id,'আপনার আইডি অ্যাক্টিভেশন রিজেক্ট হয়েছে','Your ID activation was rejected');
  const s=await S(c),u=await lock(c,a.user_id),idx={A:1,B:2,C:3}[a.category],first=!u.activated_at;
  if(!first){await c.query('update users set category=$2 where id=$1',[u.id,a.category]);return notify(c,u.id,'আপনার ক্যাটাগরি '+a.category+' হয়েছে','Your category is now '+a.category)}
  await c.query(`update users set category=$2,activated_at=now(),work_until=${TODAY}+$3::int where id=$1`,[u.id,a.category,Number(s.work_days)-1]);
  await notify(c,u.id,'আপনার আইডি অ্যাক্টিভ হয়েছে। কাজ শুরু করুন!','Your ID is active. Start working!');
  if(u.ref_by){const X=await lock(c,u.ref_by);await credit(c,X.id,Number(s.ref_active),'ref_active','act:'+u.id);
   await notify(c,X.id,`${u.name} এর আইডি অ্যাক্টিভ হয়েছে, বোনাস পেয়েছেন`,`${u.name}'s ID is active, you got a bonus`);
   if(X.activated_at){const d=Number(s['w'+idx+'_days']);await c.query(`update users set work_until=case when work_until>=${TODAY} then work_until+$2::int else ${TODAY}+$2::int-1 end where id=$1`,[X.id,d]);await notify(c,X.id,`কাজের সময় ${d} দিন বেড়েছে`,`Work window extended by ${d} days`)}
   if(X.ref_by){const Lr=await lock(c,X.ref_by);const n=Number((await c.query('select count(*) n from users where ref_by=$1 and activated_at is not null',[Lr.id])).rows[0].n);
    if(Lr.activated_at&&Lr.category&&n>=Number(s.team_size)){const amt=Number(s['t'+idx+'_bonus']);await credit(c,Lr.id,amt,'team_bonus','team:'+u.id);
     await c.query('insert into team_bonuses(leader_id,member_id,new_id,category,amount) values($1,$2,$3,$4,$5)',[Lr.id,X.id,u.id,a.category,amt]);
     await notify(c,Lr.id,`টিম বোনাস +${amt} পেয়েছেন`,`You received a team bonus of +${amt}`)}}}
 });res.json({ok:1})}));
app.post('/api/admin/vid/:id/:do',A,wrap(async(req,res)=>{const ok=req.params.do=='approve';if(!ok&&req.params.do!='reject')throw done;
 const msg=await tx(async c=>{const s=(await c.query('select * from submissions where id=$1 for update',[parseInt(req.params.id)||0])).rows[0];if(!s||s.status!='pending')throw done;
  if(!ok){await c.query("update submissions set status='rejected' where id=$1",[s.id]);await c.query("update ledger set status='rejected' where ref=$1",['sub:'+s.id]);await notify(c,s.user_id,'আপনার ভিডিও কাজ রিজেক্ট হয়েছে, আবার চেষ্টা করুন','Your video work was rejected, you can retry');return 'rejected'}
  const u=await lock(c,s.user_id),set=await S(c);await c.query(`insert into daily(user_id,d) values($1,${TODAY}) on conflict do nothing`,[u.id]);
  const d=(await c.query(`select amount from daily where user_id=$1 and d=${TODAY} for update`,[u.id])).rows[0];
  const cap=Number(set['limit_'+(u.category||'A')]),cr=r2(Math.max(0,Math.min(Number(s.reward),cap-Number(d.amount))));
  if(cr>0){await c.query(`update daily set amount=amount+$2 where user_id=$1 and d=${TODAY}`,[u.id,cr]);await bal(c,u.id,cr)}
  await c.query("update submissions set status='approved',credited=$2 where id=$1",[s.id,cr]);await c.query("update ledger set status='approved',amount=$2 where ref=$1",['sub:'+s.id,cr]);
  await notify(c,u.id,cr>0?`ভিডিও কাজ অনুমোদিত, +${cr}`:'ভিডিও কাজ অনুমোদিত, কিন্তু আজকের লিমিট শেষ তাই টাকা যোগ হয়নি',cr>0?`Video work approved, +${cr}`:'Video work approved, but the daily limit is reached so nothing was added');return 'approved'});
 res.json({ok:1,msg})}));
app.post('/api/admin/wd/:id/:do',A,wrap(async(req,res)=>{const paid=req.params.do=='paid';if(!paid&&req.params.do!='reject')throw done;
 await tx(async c=>{const w=(await c.query('select * from withdrawals where id=$1 for update',[parseInt(req.params.id)||0])).rows[0];if(!w||w.status!='pending')throw done;
  await c.query('update withdrawals set status=$2 where id=$1',[w.id,paid?'paid':'rejected']);await c.query('update ledger set status=$2 where ref=$1',['wd:'+w.id,paid?'paid':'rejected']);
  if(paid)return notify(c,w.user_id,`আপনার ${w.amount} টাকা উইথড্র পেমেন্ট হয়েছে`,`Your withdraw of ${w.amount} has been paid`);
  await lock(c,w.user_id);await credit(c,w.user_id,Number(w.amount),'refund','wd:'+w.id);await notify(c,w.user_id,'উইথড্র রিজেক্ট হয়েছে, টাকা ফেরত পেয়েছেন','Withdraw rejected, amount refunded')});
 res.json({ok:1})}));
app.get('/api/admin/team',A,wrap(async(req,res)=>{const p=[],w=['true'],{from,to,cat,q:qq}=req.query,pg=Math.max(0,parseInt(req.query.page)||0);
 const D="(t.created_at at time zone 'Asia/Dhaka')::date";
 if(/^\d{4}-\d\d-\d\d$/.test(from||'')){p.push(from);w.push(`${D}>=$${p.length}`)}if(/^\d{4}-\d\d-\d\d$/.test(to||'')){p.push(to);w.push(`${D}<=$${p.length}`)}
 if(['A','B','C'].includes(cat)){p.push(cat);w.push(`t.category=$${p.length}`)}
 if(qq){p.push('%'+String(qq).slice(0,60)+'%');p.push(String(qq));w.push(`(l.name ilike $${p.length-1} or l.id::text=$${p.length})`)}
 const rows=(await q(`select t.id,t.created_at,t.category,t.amount,l.id lid,l.name lname,m.id mid,m.name mname,n.id nid,n.name nname from team_bonuses t join users l on l.id=t.leader_id join users m on m.id=t.member_id join users n on n.id=t.new_id where ${w.join(' and ')} order by t.id desc limit 21 offset ${pg*20}`,p)).rows;
 const sum=(await q(`select (select coalesce(sum(amount),0) from team_bonuses) total,(select count(*) from (select u.id from users u where (select count(*) from users r where r.ref_by=u.id and r.activated_at is not null)>=$1) z)::int leaders,(select coalesce(sum(amount),0) from team_bonuses where (created_at at time zone 'Asia/Dhaka')::date=${TODAY}) today`,[Number((await S(pool)).team_size)])).rows[0];
 res.json({rows:rows.slice(0,20),more:rows.length>20,sum})}));
app.get('/api/admin/leaders',A,wrap(async(req,res)=>{res.json((await q(`select * from (select u.id,u.name,(select count(*) from users r where r.ref_by=u.id and r.activated_at is not null)::int ar,(select count(*) from users r where r.ref_by=u.id)::int members,(select coalesce(sum(amount),0) from team_bonuses where leader_id=u.id) earned from users u) z where ar>=$1 order by ar desc limit 200`,[Number((await S(pool)).team_size)])).rows)}));
app.get('/api/admin/leader/:id',A,wrap(async(req,res)=>{res.json((await q('select id,name,category,activated_at is not null active from users where ref_by=$1 order by id desc limit 300',[parseInt(req.params.id)||0])).rows)}));
app.get('/api/admin/videos',A,wrap(async(req,res)=>{res.json((await q('select * from videos order by id desc limit 500')).rows)}));
const vcheck=b=>{const t=String(b.title||'').trim().slice(0,120),l=String(b.link||'').trim(),r=Number(b.reward);if(!t||!/^https?:\/\/\S+$/.test(l)||!(r>0))throw new E('শিরোনাম, সঠিক লিংক ও রিওয়ার্ড দিন','Enter title, a valid link and reward');return[t,l,r]};
app.post('/api/admin/videos',A,wrap(async(req,res)=>{await q('insert into videos(title,link,reward) values($1,$2,$3)',vcheck(req.body));res.json({ok:1})}));
app.put('/api/admin/videos/:id',A,wrap(async(req,res)=>{await q('update videos set title=$2,link=$3,reward=$4 where id=$1',[parseInt(req.params.id)||0,...vcheck(req.body)]);res.json({ok:1})}));
app.delete('/api/admin/videos/:id',A,wrap(async(req,res)=>{await q('delete from videos where id=$1',[parseInt(req.params.id)||0]);res.json({ok:1})}));
app.get('/api/admin/settings',A,wrap(async(req,res)=>res.json(await S(pool))));
app.post('/api/admin/settings',A,wrap(async(req,res)=>{for(const k of Object.keys(DEF)){if(!(k in req.body))continue;let v=req.body[k];
 if(typeof DEF[k]=='number'){v=Number(v);if(!isFinite(v)||v<0)throw new E('সংখ্যা ভুল: '+k,'Invalid number: '+k)}else v=String(v).trim().slice(0,500);
 await q('insert into settings values($1,$2) on conflict(k) do update set v=$2',[k,String(v)])}res.json({ok:1})}));
app.get('/api/admin/users',A,wrap(async(req,res)=>{const qq=String(req.query.q||'').trim().slice(0,60),pg=Math.max(0,parseInt(req.query.page)||0);const s=await S(pool);
 const r=await q(`select u.id,u.name,u.phone,u.category,u.balance,u.blocked,to_char(u.work_until,'YYYY-MM-DD') work_until,(select count(*) from users r where r.ref_by=u.id and r.activated_at is not null)::int ar,(select coalesce(sum(amount),0) from team_bonuses where leader_id=u.id) tb from users u ${qq?'where u.name ilike $1 or u.phone like $1 or u.id::text=$2':''} order by u.id desc limit 21 offset ${pg*20}`,qq?['%'+qq+'%',qq]:[]);
 res.json({rows:r.rows.slice(0,20).map(u=>({...u,balance:Number(u.balance),tb:Number(u.tb),leader:u.ar>=Number(s.team_size)})),more:r.rows.length>20})}));
app.get('/api/admin/user/:id/history',A,wrap(async(req,res)=>{res.json((await q('select type,amount,status,created_at from ledger where user_id=$1 order by id desc limit 200',[parseInt(req.params.id)||0])).rows)}));
app.post('/api/admin/user/:id/balance',A,wrap(async(req,res)=>{const amt=r2(Number(req.body.amount)),add=req.body.mode=='add';if(!(amt>0))throw new E('সঠিক পরিমাণ দিন','Enter a valid amount');
 await tx(async c=>{const u=await lock(c,parseInt(req.params.id)||0);if(!u)throw new E('ইউজার নেই','User not found',404);if(!add&&amt>Number(u.balance))throw new E('ব্যালেন্সের বেশি কাটা যাবে না','Cannot deduct more than the balance');
  await credit(c,u.id,add?amt:-amt,add?'admin_add':'admin_deduct');await notify(c,u.id,add?`অ্যাডমিন ${amt} টাকা যোগ করেছে`:`অ্যাডমিন ${amt} টাকা কেটেছে`,add?`Admin added ${amt}`:`Admin deducted ${amt}`)});res.json({ok:1})}));
app.post('/api/admin/user/:id/category',A,wrap(async(req,res)=>{if(!['A','B','C'].includes(req.body.category))throw new E('ভুল ক্যাটাগরি','Invalid category');
 await tx(async c=>{const u=await lock(c,parseInt(req.params.id)||0);if(!u)throw new E('ইউজার নেই','User not found',404);const s=await S(c);
  await c.query(`update users set category=$2,activated_at=coalesce(activated_at,now()),work_until=coalesce(work_until,${TODAY}+$3::int) where id=$1`,[u.id,req.body.category,Number(s.work_days)-1]);
  await notify(c,u.id,'আপনার ক্যাটাগরি '+req.body.category+' করা হয়েছে','Your category was set to '+req.body.category)});res.json({ok:1})}));
app.post('/api/admin/user/:id/block',A,wrap(async(req,res)=>{const id=parseInt(req.params.id)||0;await q('update users set blocked=$2 where id=$1',[id,!!req.body.blocked]);if(req.body.blocked)await q("delete from sessions where kind='u' and uid=$1",[id]);res.json({ok:1})}));
app.use('/api',(req,res)=>res.status(404).json({bn:'পাওয়া যায়নি',en:'Not found'}));
module.exports=app;
