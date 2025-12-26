const BASE=(function(){const p=location.pathname;return p.replace(/[^/]*$/, '')})()
const api=(p,q)=>fetch(`${BASE}api.php?path=${p}${q?`&${q}`:''}`)
const post=(p,b,k)=>fetch(`${BASE}api.php?path=${p}`,{method:'POST',headers:{'Content-Type':'application/json',...(k?{'Authorization':'Bearer '+k}:{})},body:JSON.stringify(b)})
let CONFIG={refreshSeconds:60,durations:[15,30,60],theme:'dark'}
let ROOMS=[]
const getISTDateStr = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};
let STATE={calendar:{},selectedDate:getISTDateStr()}
const BUSINESS_START_HOUR=0
const BUSINESS_END_HOUR=24
const SLOT_W=180
const SHIFT_SLOTS=0
const IST_OFFSET='+05:30'
const IST_MINUTES_OFFSET=330
const PASTELS=['#FFB3BA','#FFDFBA','#FFFFBA','#BAFFC9','#BAE1FF','#E2BAFF','#FFBAD2','#B5EAD7','#C7CEEA'];

const el=id=>document.getElementById(id)
const adjustRowHeight=()=>{
  const vh=window.innerHeight;
  // Header (96) + Padding/Datewrap (~100) = ~196 overhead
  const avail=vh-196;
  // We want 4 rooms to fit, so each room gets max avail/4
  // But we clamp it: Max 120px (standard), Min 85px (readable)
  const h=Math.min(120, Math.max(85, Math.floor(avail/4)));
  document.documentElement.style.setProperty('--row-h', h+'px');
}
const fmtIST=(d)=>d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'}).replace(' ','').toLowerCase()
const isToday=(dstr)=>{const t=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});return dstr===t}
const pad2=(n)=>String(n).padStart(2,'0')
const istAnchor=(dstr,h,m=0)=>new Date(`${dstr}T${pad2(h)}:${pad2(m)}:00+05:30`)
const windowStart=(dstr)=>istAnchor(dstr,BUSINESS_START_HOUR,0)
const windowEnd=(dstr)=>istAnchor(dstr,BUSINESS_END_HOUR,0)
const parseGraphDate=(part)=>{if(!part)return new Date();const tz=(part.timeZone||'').toLowerCase();if(tz==='utc')return new Date(part.dateTime+'Z');if(tz==='india standard time')return new Date(part.dateTime+IST_OFFSET);return new Date(part.dateTime)}
const label30=(d)=>fmtIST(d)
const isoNow=()=>new Date().toISOString()
const addMin=(iso,m)=>new Date(new Date(iso).getTime()+m*60000).toISOString()
function loadConfig(){return api('config').then(r=>{if(!r.ok)throw new Error('config');return r.json()}).then(j=>{CONFIG=j}).catch(()=>{CONFIG=CONFIG})}
function loadRooms(){
  return api('rooms').then(r=>{
    if(!r.ok) throw new Error('rooms');
    return r.json();
  }).then(j=>{
    if(!Array.isArray(j)) throw new Error('rooms_format');
    ROOMS=j;
  }).catch(()=>{
    return api('rooms&local=1').then(r=>r.json()).then(j=>{
      if(Array.isArray(j)) ROOMS=j; else ROOMS=[];
    });
  });
}
function loadCalendars(){const start=windowStart(STATE.selectedDate);const end=windowEnd(STATE.selectedDate);const s=start.toISOString();const e=end.toISOString();const jobs=ROOMS.map(r=>api('calendar',`email=${encodeURIComponent(r.email)}&start=${encodeURIComponent(s)}&end=${encodeURIComponent(e)}`).then(x=>x.json()).then(v=>({email:r.email,events:v})));return Promise.all(jobs).then(rows=>{STATE.calendar={};rows.forEach(x=>STATE.calendar[x.email]=x.events)})}
function statusFor(r){const now=new Date();const evs=STATE.calendar[r.email]||[];let upcoming=false;for(const ev of evs){const s=new Date(ev.start.dateTime);const e=new Date(ev.end.dateTime);if(now>=s&&now<e)return 'busy';if(s>now&&s-now<30*60000)upcoming=true}return upcoming?'upcoming':'free'}
function renderRooms(){const list=el('room-list');list.innerHTML='';ROOMS.forEach(r=>{const st=statusFor(r);if(STATE.filterFree&&st!=='free')return;const div=document.createElement('div');div.className='room';div.innerHTML=`<div><div class="room-name">${r.alias||r.name}</div><div class="room-meta">${r.building||''} ${r.floor?('• '+r.floor):''}</div></div><div class="status-dot status-${st}"></div>`;div.onclick=()=>openModal(r);list.appendChild(div)})}
function renderTimeline(){
  const grid=el('hour-grid');grid.innerHTML='';
  const ds=windowStart(STATE.selectedDate);
  const de=windowEnd(STATE.selectedDate);
  const slots=(BUSINESS_END_HOUR-BUSINESS_START_HOUR)*2
  const width=slots*SLOT_W
  grid.style.gridTemplateColumns=`repeat(${slots}, ${SLOT_W}px)`
  grid.style.width=width+'px'
  for(let i=0;i<slots;i++){
    const cell=document.createElement('div');cell.className='timecell';
    const t=new Date(ds.getTime()+i*30*60000);
    cell.textContent=label30(t);
    grid.appendChild(cell)
  }
  let vlines=document.getElementById('vlines');
  if(!vlines){vlines=document.createElement('div');vlines.id='vlines';const tl=document.getElementById('timeline');vlines.style.position='absolute';vlines.style.top='0';vlines.style.left='12px';vlines.style.height='100%';vlines.style.pointerEvents='none';vlines.style.zIndex='1';tl.appendChild(vlines)}
  vlines.innerHTML='';
  vlines.style.width=width+'px';
  for(let i=0;i<=slots;i++){
    const line=document.createElement('div');
    line.style.position='absolute';
    line.style.left=(i*SLOT_W)+'px';
    line.style.top='0';
    line.style.bottom='0';
    line.style.borderLeft='1px dashed #213043';
    line.style.opacity='1.00';
    vlines.appendChild(line);
  }
  const rows=el('rows');rows.innerHTML='';
  rows.style.width=width+'px'
  ROOMS.forEach((r, idx)=>{
    const row=document.createElement('div');row.className='roomrow';
    const blocks=document.createElement('div');blocks.className='blocks';
    blocks.style.width=width+'px'
    blocks.addEventListener('click',(e)=>{
      const tl=document.getElementById('timeline');
      const rect=blocks.getBoundingClientRect();
      const x=e.clientX - rect.left;
      const slot=Math.max(0,Math.min(slots-1,Math.floor(x/SLOT_W)));
      const startTime=new Date(ds.getTime()+slot*30*60000);
      openModal(r,startTime);
    });
    const evs=(STATE.calendar[r.email]||[]).slice().sort((a,b)=>parseGraphDate(a.start)-parseGraphDate(b.start));
    const start=ds;const end=de;const w=end-start;
    for(const ev of evs){
      const s=parseGraphDate(ev.start);const e=parseGraphDate(ev.end);
      const ls=Math.max(s,start);const re=Math.min(e,end);
      if(re<=start||ls>=end) continue
      const step=30*60000;
      // Calculate exact left position based on grid
      const leftPx=Math.floor(((ls-start)/step)*SLOT_W);
      // Calculate width and subtract 3px for the gap at the end
      let widthPx=Math.floor(((re-ls)/step)*SLOT_W) - 3;
      
      const b=document.createElement('div');b.className='block busy';
      b.style.left=leftPx+'px';b.style.width=Math.max(1,widthPx)+'px';
      if(CONFIG.pastelColors){
        const color=PASTELS[idx % PASTELS.length];
        b.style.background=color;
        b.style.color='#1f2937';
        b.style.outlineColor='rgba(0,0,0,0.1)';
      }
      const online=((ev.isOnlineMeeting===true) || (!!ev.onlineMeeting))?true:false;
      const typeLabel=online?'Online':'Offline';
      const organizer=(ev.organizer&&ev.organizer.emailAddress&&ev.organizer.emailAddress.name)?ev.organizer.emailAddress.name:(ev.organizer&&ev.organizer.displayName)?ev.organizer.displayName:'';
      const subj=(ev.subject||'');
      const m=subj.match(/Booked by (.+)/i);
      const bookedBy=m?m[1].trim():organizer;
      b.innerHTML=`<div>${fmtIST(s)}–${fmtIST(e)}</div><div style="font-weight:400;margin-top:4px">${typeLabel}</div><div style="font-weight:600;opacity:.9;margin-top:2px">${bookedBy}</div>`;
      const now=new Date();if(isToday(STATE.selectedDate)&&now>=ls&&now<re)b.classList.add('ongoing');
      
      blocks.appendChild(b)
    }
    row.appendChild(blocks);rows.appendChild(row)
  });
  placeNowLine()
}
function placeNowLine(){
  const tl=el('timeline');let l=el('nowline');if(!l){l=document.createElement('div');l.id='nowline';l.className='nowline';tl.appendChild(l)}
  const ws=windowStart(STATE.selectedDate);const we=windowEnd(STATE.selectedDate);
  const now=Date.now();
  if(!isToday(STATE.selectedDate)||now<ws.getTime()||now>we.getTime()){l.style.display='none';return}else{l.style.display='block'}
  const step=30*60000;
  const leftPx=((now-ws.getTime())/step)*SLOT_W;
  const blocks=el('rows');l.style.left=(leftPx+12)+'px';
  el('timeline').scrollLeft=Math.max(0,leftPx - el('timeline').clientWidth/2)
}
function refresh(){
  const l=el('loader');if(l)l.classList.add('active');
  loadRooms().then(loadCalendars).then(()=>{
    renderRooms();renderTimeline();
    if(l)l.classList.remove('active');
  }).catch(()=>{
    renderRooms();renderTimeline();
    if(l)l.classList.remove('active');
  })
}
function setup(){
  const dp=el('date-picker');dp.value=STATE.selectedDate;
  dp.addEventListener('change',e=>{STATE.selectedDate=e.target.value||STATE.selectedDate;refresh()});
  el('prev-day').addEventListener('click',()=>{const d=new Date(STATE.selectedDate);d.setDate(d.getDate()-1);STATE.selectedDate=d.toISOString().slice(0,10);dp.value=STATE.selectedDate;refresh()})
  el('today').addEventListener('click',()=>{STATE.selectedDate=getISTDateStr();dp.value=STATE.selectedDate;refresh()})
  el('next-day').addEventListener('click',()=>{const d=new Date(STATE.selectedDate);d.setDate(d.getDate()+1);STATE.selectedDate=d.toISOString().slice(0,10);dp.value=STATE.selectedDate;refresh()})
  el('durations').innerHTML=CONFIG.durations.map(d=>`<button class="btn" data-d="${d}">${d} min</button>`).join('');
  el('durations').addEventListener('click',e=>{const d=e.target.getAttribute('data-d');if(!d)return;el('duration').value=d});
  setInterval(()=>{refresh()},CONFIG.refreshSeconds*1000);
  refresh();
  setInterval(placeNowLine,10000);
  setInterval(updateClock,1000);
  updateClock();
  window.addEventListener('resize', adjustRowHeight);
  adjustRowHeight();
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js')
    .then(reg=>console.log('SW registered',reg))
    .catch(err=>console.log('SW failed',err))
}
function updateClock(){
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Kolkata' });
  const date = now.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const tEl = el('clock-time');
  const dEl = el('clock-date');
  if(tEl) tEl.textContent = time;
  if(dEl) dEl.textContent = date;
}
function openModal(room,startAt){
  const m=el('modal');m.classList.add('active');
  el('modal-title').textContent=room.alias||room.name;
  
  const base = startAt || new Date();
  const dateStr = base.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Asia/Kolkata' });
  const timeStr = base.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  el('modal-time').textContent = `${dateStr} • ${timeStr}`;
  
  el('duration').value='';
  el('organizer').value='';
  el('booking-error').style.display='none';
  el('booking-error').textContent='';
  el('confirm').onclick=()=>confirmBooking(room,startAt)
}
function closeModal(){el('modal').classList.remove('active')}
function confirmBooking(room,startAt){
  const d=parseInt(el('duration').value||CONFIG.durations[0]);
  const org=(el('organizer').value||'').trim();
  const base=startAt||new Date();
  
  const getIST = (date) => {
      const p = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit',
          hour12: false
      }).formatToParts(date);
      const val = (t) => p.find(x => x.type === t).value;
      return `${val('year')}-${val('month')}-${val('day')}T${val('hour')}:${val('minute')}:${val('second')}`;
  };

  const start=getIST(base);
  const end=getIST(new Date(base.getTime()+d*60000));
  
  const subject=org?`Booked by ${org}`:'Booked by unknown';
  el('booking-error').style.display='none';
  post('book',{email:room.email,subject,start,end,tz:'India Standard Time'}).then(r=>{
    if(r.status===201){closeModal();refresh()}
    else if(r.status===409){
      const msg = `${room.alias||room.name} - already booked`;
      const errEl = el('booking-error');
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }
    else{r.json().then(j=>alert('Error '+(j.error||r.status)))}
  })
}
window.addEventListener('DOMContentLoaded',()=>{loadConfig().then(setup)})
