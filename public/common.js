let lang=localStorage.lang;
const $=s=>document.querySelector(s),L=(b,e)=>lang=='bn'?b:e;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=n=>lang=='bn'?String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]):String(n);
const fmt=d=>new Date(d).toLocaleString(lang=='bn'?'bn-BD':'en-GB',{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'});
if(localStorage.light)document.body.classList.add('light');
function toast(m){const t=document.createElement('div');t.className='glass toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3300)}
async function api(p,b,m){const r=await fetch('/api/'+p,{method:m||(b?'POST':'GET'),headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined,credentials:'same-origin'});const j=await r.json().catch(()=>({}));if(!r.ok){if(!(r.status==401&&p=='me'))toast(L(j.bn,j.en)||'Error');throw Object.assign(j,{status:r.status})}return j}
function dlg(msg,inp,yes,no){return new Promise(ok=>{const o=document.createElement('div');o.className='ov';o.innerHTML=`<div class="glass"><p>${msg}</p>${inp?`<input id="dv" ${inp===true?'':`type="${inp}"`} autofocus>`:''}<div class="row"><button class="btn pri grow" id="y">${yes||'OK'}</button><button class="btn grow" id="n">${no||L('বাতিল','Cancel')}</button></div></div>`;document.body.append(o);const c=v=>{o.remove();ok(v)};o.querySelector('#y').onclick=()=>c(inp?o.querySelector('#dv').value:true);o.querySelector('#n').onclick=()=>c(null);o.onclick=e=>{if(e.target==o)c(null)}})}
function info(html){const o=document.createElement('div');o.className='ov';o.innerHTML=`<div class="glass">${html}<button class="btn pri" style="margin-top:12px;width:100%">OK</button></div>`;document.body.append(o);o.onclick=e=>{if(e.target==o||e.target.tagName=='BUTTON')o.remove()}}
function zoom(src){const o=document.createElement('div');o.className='ov';o.innerHTML=`<img src="${src}" style="max-width:100%;max-height:90vh;border-radius:20px">`;o.onclick=()=>o.remove();document.body.append(o)}
function copy(t){navigator.clipboard.writeText(t).then(()=>toast(L('কপি হয়েছে','Copied')),()=>toast(t))}
const TYPES={activation:['আইডি অ্যাক্টিভেশন','ID activation'],video:['ভিডিও কাজ','Video work'],ref_join:['রেফার (জয়েন)','Referral join'],ref_active:['রেফার বোনাস','Referral bonus'],team_bonus:['টিম বোনাস','Team bonus'],admin_add:['অ্যাডমিন যোগ','Admin added'],admin_deduct:['অ্যাডমিন কাটা','Admin deducted'],withdraw:['উইথড্র','Withdraw'],refund:['ফেরত','Refund']};
const STAT={pending:['পেন্ডিং','Pending'],approved:['অনুমোদিত','Approved'],rejected:['রিজেক্ট','Rejected'],paid:['পরিশোধিত','Paid']};
const stb=s=>`<span class="badge ${s}">${L(...(STAT[s]||[s,s]))}</span>`;
const PM={bkash:'bKash',nagad:'Nagad',rocket:'Rocket'};
