'use strict';
import {AREA_IDS,POSITION_WEIGHTS,validOrder,weightsFor,completeComparator,areaResult,areaRank,comparison,validateAssessment} from './scoring.js';

const STEPS=[
  {title:'Compare the opportunities for meaningful community influence',short:'Compare the opportunities for meaningful community influence',desc:'  '},
  {title:'(Optional) Adjust ranking of governance areas by impact',short:'(Optional) Adjust ranking of governance areas by impact',desc:'Put the five governance areas in the order, from having the most to least impact on community having meaningful influence to ensure solutions to displacement and for community wellbeing are prioritized and advanced.'},
  {title:'See the updated comparison',short:'Your the updated comparison',desc:'Compare the default results with those based on your priorities. Your ranking changes how much each governance area counts — not the assessment per criteria.'},
  {title:'See how other prioritized committee governance',short:'See how other prioritized committee governance',desc:'Compare the weight you assigned to each governance area with the average across completed responses to this SAC Terms of Reference assessment.'}
];
const AREA_INTRO={
 G1:'The ability to shape priorities, make recommendations and influence how advice is used.',
 G2:'The opportunity to participate early and receive information in time to contribute.',
 G3:'Whose perspectives are represented and what support members are promised.',
 G5:'How committee advice and decisions are recorded, explained and made public.',
 G4:'Who governs the committee, sets its rules and protects members’ democratic rights.'
};
const CRITERIA_SUMMARIES={
 'G1-01':'Whether members can propose agenda items, influence study scope and engagement methods, and help shape planning directions instead of only commenting on staff-prepared drafts.',
 'G1-02':'Whether members can develop collective recommendations, preserve dissenting views, and expect staff to consider their advice under stated TOR commitments.',
 'G2-01':'Which stages of planning members are involved in, how long the committee operates, and what meetings or additional working groups the TOR provides for.',
 'G2-02':'Whether members receive agendas and materials in advance and have a defined role in sharing information with and hearing from their communities.',
 'G3-01':'Whether the TOR specifies who should be represented, how members are selected, and how alternates, vacancies and gaps in representation are handled.',
 'G3-02':'Whether the TOR provides compensation, accessible participation options, orientation and access to technical or City expertise.',
 'G5-01':'What meeting records the TOR requires and whether members can review, correct or approve them under clear procedures.',
 'G5-02':'Whether the TOR explains the committee’s origins and mandate and provides public access to meeting information, records or observation.',
 'G5-03':'Whether staff must give written explanations of how committee advice was used, why recommendations were not adopted, and when responses are provided.',
 'G4-01':'Whether members can approve or amend the TOR and share authority over committee leadership or operating rules.',
 'G4-02':'Whether the TOR names responsible leads and contacts and defines staff and facilitator duties, including preparation and follow-up.',
 'G4-03':'Whether the TOR protects members’ expression, dissent and independent civic participation, with appropriate safeguards in conduct, confidentiality and removal rules.'
};
const CONNECTION_CHOICES=[
 ['resident','I live in the neighbourhood'],['former','I used to live in the neighbourhood'],
 ['business','I own or operate a local business'],['worker','I work/volunteer here'],
 ['visit','I regularly spend time here (school, worship, visiting, etc.)'],
 ['representation','My current councillor is also a councillor of this neighbourhood (Colle, Matlow, Padovani, Bravo)'],
 ['other','Another connection']
];
let DATA=null;
let COMMUNITY={available:false,count:0,averages:null};
const START=[...AREA_IDS];
const APP_BASE=new URL('../',import.meta.url).pathname;
const STATE={step:0,unlocked:0,selectedComparator:'comp1',order:[...START],connections:[],email:'',newsletterOptIn:false,planningOptIn:false,feedback:'',id:null,token:null,revision:0,savedSignature:'',notice:'',saveStatus:'',saveError:'',saving:false};
const q=(selector,root=document)=>root.querySelector(selector);
const qa=(selector,root=document)=>Array.from(root.querySelectorAll(selector));
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const members=id=>DATA.components.filter(c=>c.area===id);
const currentWeights=()=>weightsFor(STATE.order);
const baseWeights=()=>weightsFor(START);
const fmt=v=>(v==null?'—':(Math.abs(v)<0.005?'0':(v>0?'+':'')+v.toFixed(1)));
const pct=v=>(v==null?'—':Number(v).toFixed(1)+'%');
const signed=v=>v>0?'delta-positive':v<0?'delta-negative':'';
const approved=()=>DATA?.published===true;
const ranked=order=>comparison(DATA,order);
const rankedById=order=>Object.fromEntries(ranked(order).map(row=>[row.id,row]));
const privateLink=()=>STATE.id&&STATE.token?`${location.origin}${location.pathname}#resume=${STATE.id}.${STATE.token}`:'';

function snapshot(){return {ranking:[...STATE.order],connections:[...STATE.connections],email:STATE.email.trim(),newsletterOptIn:STATE.newsletterOptIn,planningOptIn:STATE.planningOptIn,feedback:STATE.feedback.trim()};}
const signature=()=>JSON.stringify(snapshot());
function showMessage(message){STATE.notice=message;const el=q('#notice');if(el){el.textContent=message;el.hidden=!message;}}
function saveLabel(){
  if(STATE.saving)return ' ';
  if(STATE.saveError)return STATE.saveError;
  if(STATE.id)return ' ';
  return ' ';
}
async function fetchJSON(path,opts={}){
  const r=await fetch(path,{cache:'no-store',...opts});
  let payload={};try{payload=await r.json();}catch{}
  if(!r.ok)throw Object.assign(new Error(payload.error||'The service is unavailable.'),{status:r.status});
  return payload;
}
async function loadCommunity(){
 try{const v=await fetchJSON(APP_BASE+'api/community');COMMUNITY={available:v.available===true,count:v.count||0,averages:v.averages||null};}
 catch{COMMUNITY={available:false,count:0,averages:null,error:true};}
 if(STATE.step===3)render();
}
async function restoreFromLink(){
 const match=location.hash.match(/^#resume=([0-9a-f-]{36})\.([A-Za-z0-9_-]{40,50})$/i);
 if(!match)return;
 const [,id,token]=match;
 try {
   const s=await fetchJSON(APP_BASE+'api/response?id='+encodeURIComponent(id),{headers:{Authorization:'Bearer '+token}});
   if(!validOrder(s.ranking))throw Error('Response contains an invalid ranking.');
   STATE.order=[...s.ranking];STATE.connections=[...s.connections||[]];STATE.email=s.email||'';
   STATE.newsletterOptIn=!!s.newsletterOptIn;STATE.planningOptIn=!!s.planningOptIn;STATE.feedback=s.feedback||'';
   STATE.id=s.id;STATE.token=token;STATE.revision=s.revision;STATE.savedSignature=signature();STATE.unlocked=3;
   STATE.notice='Welcome back. Your saved response has been restored and can be revised.';
 } catch(e){STATE.saveError='Could not restore your private response. The link may be invalid or the response unavailable.';}
}
let inflight=null,saveTimer=null;
async function saveResponse(){
 if(inflight){await inflight;if(STATE.savedSignature===signature())return true;}
 if(STATE.savedSignature===signature() && STATE.id)return true;
 if((STATE.newsletterOptIn||STATE.planningOptIn)&&!STATE.email.trim()){
   STATE.saveError='Please enter your email address to receive updates, or uncheck the update choices.';render();return false;
 }
  const payload=snapshot();
  STATE.saving=true;STATE.saveError='';
  inflight=(async()=>{
   try{
     const request={...payload};if(STATE.id){request.id=STATE.id;request.revision=STATE.revision;}
     const s=await fetchJSON(APP_BASE+'api/response',{method:'POST',headers:{'Content-Type':'application/json',...(STATE.token?{Authorization:'Bearer '+STATE.token}:{})},body:JSON.stringify(request)});
     if(!STATE.id){STATE.id=s.id;STATE.token=s.token;STATE.revision=s.revision;history.replaceState(null,'',location.pathname+location.search+'#resume='+STATE.id+'.'+STATE.token);}
     else STATE.revision=s.revision;
     STATE.savedSignature=JSON.stringify(payload);
     STATE.saving=false;
     await loadCommunity();
     return true;
   }catch(e){STATE.saving=false;STATE.saveError=e.status===409?'Your response was changed elsewhere. Open your private return link again before editing.':`Your response has not been saved online. ${e.message}`;return false;}
   finally{inflight=null;}
 })();
 const success=await inflight;
 const el=q('#save-state');if(el)el.textContent=saveLabel();
 return success;
}
function scheduleSave(){if(!STATE.id)return;clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{await saveResponse();const el=q('#save-state');if(el)el.textContent=saveLabel();},900);}

function evidenceStatus(){return `<div class="safety-note" role="status"><strong>TOR comparison awaiting approval.</strong> The twelve assessment criteria and governance weights are established. Comparative findings will appear when their written-TOR judgments have been verified and approved. No example scores are shown.</div>`;}
function scorebar(score){
 if(score==null)return '<div class="relative-track demo-track" aria-label="No score yet"></div>';
 const pct=Math.min(50,Math.abs(score)/12*48);
 return `<div class="relative-track demo-track" aria-label="Net score ${fmt(score)}"><span class="zero-axis"></span><i class="${score>=0?'positive-bar':'negative-bar'}" style="left:${score>=0?50:50-pct}%;width:${pct}%"></i></div>`;
}

/* Display-only metadata for the SAC TOR comparison cards.
   Dates refer to the TOR document, not the final planning report.
   Councillors are current as of November 2026.
   Historic City team names are retained where applicable.
   These fields do not affect assessment scores. */

const TOR_CARD_META = {
  ljovpf: {
    date: "Sept 2026",
    wards: "Wards 5, 8, 9 and 12",
    councillors: "Josh Matlow Mike Colle; Frances Nunziata; Alejandra Bravo",
    lead: "Development Review — Toronto & East York North, Midtown Section",
    support: "City Planning - Heritage"
  },

  comp1: {
    date: "March 2025",
    wards: "Wards 10 and 11",
    councillors: "Ausma Malik; Dianne Saxe",
    lead: "Development Review — Toronto & East York South, South Section",
    support: "Development Review; City Planning"
  },

  comp2: {
    date: "Sept 2025",
    wards: "Ward 5 — York South-Weston",
    councillors: "Frances Nunziata",
    lead: "Development Review — Community Planning, Etobicoke York District - Central Section",
    support: "City Planning — Urban Design; Heritage Planning; Gladki Planning Associates, Edge of the Bush"
  },

  comp3: {
    date: "Oct 2023",
    wards: "Ward 18 — Willowdale",
    councillors: "Lily Cheng",
    lead: "City Planning — Strategic Initiatives, Policy & Analysis; Development Review — Community Planning, North York",
    support: "None confirmed"
  },

  comp4: {
    date: "Mar 2021",
    wards: "Ward 5 — York South-Weston",
    councillors: "Frances Nunziata",
    lead: "City Planning — Community Planning, Etobicoke York Central and South Sections",
    support: "More than 4 divisions, including: Economic Development & Culture; Social Development, Finance & Administration"
  },

  comp5: {
    date: "Nov 2017",
    wards: "Ward 13 — Parkdale-High Park (pre ward-mash)",
    councillors: "Sarah Doucette",
    lead: "City Planning — Community Planning, Etobicoke York District",
    support: "City Planning — Urban Design"
  },

  comp6: {
    date: "Aug 2021",
    wards: "Ward 7 — Humber River-Black Creek",
    councillors: "Anthony Perruzza",
    lead: "Interdivisional team including Social Development, Economic Development, and City Planning",
    support: "More than 4 divisions, including Employment and Transportation; Jane Finch Community and Family Centre (CAC facilitation partner)"
  },

  comp7: {
    date: "May 2021",
    wards: "Wards 8, 12 and 15",
    councillors: "Josh Matlow; Mike Colle; Rachel Chernos Lin",
    lead: "Community Planning, Toronto and East York District - Midtown section",
    support: "Inter-divisional City team, including Parks, Forestry & Recreation; Children's Services; Economic Development & Culture; Transportation Services; CreateTO; TTC"
  },

  comp8: {
    date: "Aug 2014",
    wards: "Ward 29 – Toronto-Danforth (pre ward-mash)",
    councillors: "Mary Fragedakis",
    lead: "City Planning — Community Planning, Toronto & East York District - East Section",
    support: "Urban Design and Transportation Planning"
  },

  comp9: {
    date: "Nov 2021",
    wards: "Wards 24 and 25",
    councillors: "Paul Ainslie; Neethan Shan",
    lead: "City Planning — Community Planning, Scarborough District - Southeast Section",
    support: "City Planning — Urban Design"
  },

  comp10: {
    date: "2015 or earlier",
    wards: "Citywide — all wards",
    councillors: "Councillor Matlow is elected City rep",
    lead: "Social Development, Finance & Administration - Social Policy Analysis and Research (SPAR)",
    support: "Multiple City divisions and agencies"
  }
};

function rowResult(cp) {
  const meta = TOR_CARD_META[cp.id] || {};

  const title = `${cp.name} · ${cp.body}`;

  const titleLink = cp.url
    ? `<a class="framework-link"
         href="${esc(cp.url)}"
         target="_blank"
         rel="noopener noreferrer"
         title="Open the Terms of Reference">
         ${esc(title)}
         <span aria-hidden="true">↗</span>
       </a>`
    : `<span>${esc(title)} (TOR link unavailable)</span>`;

  return `
    <div class="score-row relative-score-row tor-score-row ${cp.id === 'ljovpf' ? 'home-score' : ''}">

      <span class="score-rank">
        ${cp.rank ?? '—'}
      </span>

      <span class="score-name">
        ${titleLink}

        <small>
          Published: ${esc(meta.date || 'Not confirmed')}
          · ${esc(meta.wards || 'Ward not confirmed')}
          · Councillor(s): ${esc(meta.councillors || 'Not confirmed')}
        </small>
      </span>

      <strong class="tor-score ${signed(cp.score)}">
        ${fmt(cp.score)}
      </strong>

      ${scorebar(cp.score)}

      <small class="score-lead">
        Lead division/team: ${esc(meta.lead || 'Not confirmed')}
      </small>

      <small class="score-support">
        Supporting divisions/teams or partners: ${esc(meta.support || 'Not confirmed')}
      </small>

    </div>`;
}


function areaMatrix(order=START,weighted=false){
 const bodies=ranked(order);
 const labels={G1:'Decision-making & influence',G2:'Timing & participation',G3:'Representation & support',G5:'Transparency & accountability',G4:'Committee governance'};
 const columns=DATA.areas.map(a=>`<th scope="col" title="${esc(a.name)}">${esc(labels[a.id])}<small>${members(a.id).length} components</small></th>`).join('');
 const rows=bodies.map(cp=>{
  const cells=DATA.areas.map(a=>{
    const net=approved()?areaResult(DATA,cp.id,a.id,order,weighted):null;
    // Step 3 compares the selected weights with the starting weights; area ranks are independent of weighting.
    const defaultNet=weighted&&net!==null?areaResult(DATA,cp.id,a.id,START,true):null;
    const rank=net===null?null:areaRank(DATA,cp.id,a.id,START,false);
    const cls=net===null?'zero':net>0.00001?'pos':net<-.00001?'neg':'zero';
    return `<td><div class="ga-cell ${cls}"><strong>${net===null?'—':weighted?fmt(net):(net>0?'+':'')+net}</strong>${weighted?`<span class="ga-default-score">Default ${fmt(defaultNet)}</span>`:""}${(!weighted&&net!==null)?`<span class="ga-outof"> / ${members(a.id).length}</span>`:''}<span class="ga-rank">${rank===null?'Not rated':'Rank '+rank}</span></div></td>`;
  }).join('');
  return `<tr class="${cp.id==='ljovpf'?'ga-reference':''}"><th scope="row"><a class="ga-body-name" href="${esc(cp.url)}" target="_blank" rel="noopener noreferrer" title="Open Terms of Reference">${esc(cp.name)} ↗</a><small class="ga-body-kind">${esc(cp.body)}</small></th>${cells}</tr>`;
 }).join('');
 return `<section class="subpanel" aria-label="Governance-area comparison">
  <div class="split-intro"><div><h3>Comparison across the five governance areas</h3><p class="help gamatrix-description">${weighted?'The bold number is your weighted contribution; the smaller Default value uses the starting weights. Rankings within each governance area do not change.':'Compare the TOR provisions within each governance area. Each area score is the net result of its assessment criteria.'} ${!approved()?'Ratings are pending approval.':''}</p></div></div>
  <div class="ga-legend"><span class="ga-legend-item"><i class="ga-legend-swatch"></i> Positive: comparator scores higher</span><span class="ga-legend-item"><i class="ga-legend-swatch neutral"></i> Zero: net scores tied</span><span class="ga-legend-item"><i class="ga-legend-swatch negative"></i> Negative: LJOVPF scores higher</span></div>
  <div class="ga-table-shell" tabindex="0" role="region" aria-label="Comparison across all five governance areas; scroll horizontally if necessary"><table class="ga-table"><thead><tr><th scope="col">Advisory body</th>${columns}</tr></thead><tbody>${rows}</tbody></table></div>
  <p class="ga-bottomnote">${weighted?'Each area shows your weighted contribution and its Default contribution. Rankings use the original written-TOR judgments and stay unchanged when area weights change.':' '} Ties share a rank.</p>
 </section>`;
}
function evidenceSection(){
 const cp=DATA.comparators.find(x=>x.id===STATE.selectedComparator&&x.id!=='ljovpf')||DATA.comparators.find(x=>x.id!=='ljovpf');
 if(!cp)return '';
  
const ljov = DATA.comparators.find(x => x.id === 'ljovpf');

const meaning=v=>v===1?'LJOVPF TOR is weaker':v===-1?'LJOVPF TOR is stronger':v===0?'Comparable written provisions':'Not rated'; const groups=DATA.areas.map((a,i)=>`<details class="area-accordion" ${i===0?'open':''}><summary><span class="area-numeral">${i+1}</span><span class="acc-title">${esc(a.name)}<small>${members(a.id).length} assessment criteria</small></span><span class="chev">⌄</span></summary><div class="acc-content">${members(a.id).map(c=>{
   const e=DATA.judgments?.[cp.id]?.[c.id];
   if(!e||e.rating===null)return `<article class="detail-card"><strong>${esc(c.id)} — ${esc(c.name)}</strong><p class="help">Documentary assessment not available.</p></article>`;
   return `<article class="detail-card"><header><div><small>${esc(c.id)} · ${esc(a.name)}</small><h3>${esc(c.name)}</h3></div><span class="tag ${e.rating===1?'tag-w':e.rating===-1?'tag-s':'tag-c'}">
   ${meaning(e.rating)}
   </span></header><div class="detail-grid"><div><h4><a href="${esc(ljov.url)}" target="_blank" rel="noopener noreferrer">Little Jamaica SAC TOR ↗</a></h4><p>${esc(e.ljovpf_excerpt)}</p></div><div><h4><a href="${esc(cp.url)}" target="_blank" rel="noopener noreferrer">${esc(cp.name)} TOR ↗</a></h4><p>${esc(e.comparator_excerpt)}</p></div></div><div class="rationale"><strong>Assessment</strong><p>${esc(e.rationale)}</p></div>
<div class="help">
  <strong>What this governance area assesses:</strong>
  <ul class="criteria-bullets">
    ${members(a.id).map(item =>
      '<li><strong>' + esc(item.name) + ':</strong> ' +
      esc(CRITERIA_SUMMARIES[item.id] || item.description) +
      '</li>'
    ).join('')}
  </ul>
</div>
</article>`;
  }).join('')}</div></details>`).join('');
 return `<section class="subpanel" id="evidence"><h3>Assessments Summary</h3><p class="help">Select an advisory body to review the LJOVPF SAC against its comparitors. These descriptions summarize the documents - they are not verbatim quotations. Only what the TORs say is assessed, not their implementation.</p>
 <div class="select-row"><label for="evidence-comparator">Advisory body to examine</label><select id="evidence-comparator">${DATA.comparators.filter(x=>x.id!=='ljovpf').map(x=>`<option value="${esc(x.id)}" ${cp.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
${groups}</section>`;
}
function stepOne(){
 const results=ranked(START);
 return `${approved()?'':evidenceStatus()}<section class="subpanel"><div class="split-intro"><div><h3>Overall comparison</h3><p class="help">Compare the relative strength of written TOR provisions across all twelve criteria. The weighting of governance criteria is based on community responses in our <a href="https://communityinpublic.ca/ljcdap#9f47bb79-1716-4a7c-a255-79033acc62b3" target="_blank" rel="noopener noreferrer">2026 Little Jamaica ACTIONS & PROGRESS INDICATORS survey findings report</a>. 9/10 studies are comparable planning studies; the seniors TOR is included because Councillor Matlow explicitely identified it is his benchmark and commitment for what he'd like to see the Little Jamaica advisory work like.</p></div></div>
  <div class="score-legend"><span><i class="legend-dot"></i> Score is higher than LJOVPF's. None score lower.</span><span><i class="legend-dot legend-zero"></i> LJOVPF reference score: 0.</span></div><div class="scores">${results.map(rowResult).join('')}</div><p class="help mini-gap">These comparisons assess commitments expressly written into each TOR, not how a committee operated.</p></section>
${areaMatrix(START,false)}${evidenceSection()}`;
}
function areaCard(area,i){return `<article class="rank-item area-rank-item" draggable="true" data-rank="${esc(area.id)}" aria-label="Rank ${i+1}: ${esc(area.name)}"><div class="drag-handle" aria-hidden="true">⠿</div><span class="rank-number">${i+1}</span><div class="rank-detail"><div class="rank-title"><strong>${esc(area.name)}</strong></div><p>${esc(AREA_INTRO[area.id])}</p></div><div class="rank-buttons"><button type="button" aria-label="Move ${esc(area.name)} up" data-up="${esc(area.id)}" ${i===0?'disabled':''}>↑</button><button type="button" aria-label="Move ${esc(area.name)} down" data-down="${esc(area.id)}" ${i===4?'disabled':''}>↓</button></div></article>`;}
function connectionForm(){return `<section class="subpanel" id="participant-connection"><h3>How are you connected to Little Jamaica / Oakwood Vaughan?</h3><p>Optional. Select any that apply.</p>
  <div class="connections">${CONNECTION_CHOICES.map(([id,label])=>`<label><input type="checkbox" data-connection="${id}" ${STATE.connections.includes(id)?'checked':''}><span>${esc(label)}</span></label>`).join('')}</div>
  <label class="field-label" for="participant-email">Your email address (optional)</label>
<input id="participant-email" class="email-input" type="text" inputmode="email" autocomplete="email" maxlength="254" value="${esc(STATE.email)}" placeholder="you@example.com">  <p class="help">Add your email if you would like Community in Public to contact you about planning updates.</p>
  <fieldset class="consent"><legend>Would you like to stay involved? (Select all that apply)</legend><label><input id="newsletter" type="checkbox" ${STATE.newsletterOptIn?'checked':''}>Community in Public newsletter</label><label><input id="planning-updates" type="checkbox" ${STATE.planningOptIn?'checked':''}>Other updates about the Little Jamaica planning process</label></fieldset>
  <p class="help" style="margin-top:18px">Email is optional. If you would like to receive updates, please provide an email address where we can reach you.</p></section>`;}
function stepTwo(){return `<div class="selection-intro"><h3>Which rules matter most for community wellbeing?</h3><p>Drag the areas into your preferred order, or use the arrows. Weighting is based on placement. <strong>First place counts for 30%; fifth counts for 10%.</strong></p></div>
  <div class="subpanel"><div class="block-intro"><h3>Rank the five governance areas</h3><p class="help">The default order below is based on community responses in our <a href="https://communityinpublic.ca/ljcdap#9f47bb79-1716-4a7c-a255-79033acc62b3" target="_blank" rel="noopener noreferrer">2026 Little Jamaica ACTIONS & PROGRESS INDICATORS survey findings report</a>. Change the order to reflect your priorities.</p></div><div class="rank-items" id="area-rankings">${STATE.order.map((id,i)=>areaCard(DATA.areas.find(a=>a.id===id),i)).join('')}</div></div>${connectionForm()}`;}
function commentsForm(){return `<section class="subpanel" id="tor-comments"><h3>Additional comments (optional)</h3><p>Do you have any suggestions, concerns or feedback about the <strong>Little Jamaica and Oakwood Vaughan Stakeholder Advisory Committee’s Terms of Reference</strong>, or this survey - including how either can support community decision-making, democratic rights, and accountable government services?</p>
 <label class="sr-only" for="comment">Additional comments about the SAC Terms of Reference</label><textarea id="comment" class="tor-comment-input" maxlength="1500" rows="5" placeholder="Share your comments about the SAC Terms of Reference…">${esc(STATE.feedback)}</textarea>
 <button type="button" class="secondary" id="save-comment">Submit my comments</button><p class="help" id="comment-status" role="status">Comments are optional. Submitting an update replaces your previous comment.</p></section>`;}
function stepThree(){
 const base=rankedById(START),custom=ranked(STATE.order);
 const table=custom.map(cp=>{const old=base[cp.id];const delta=cp.score!==null&&old.score!==null?cp.score-old.score:null;
  return `<div class="result-line ${cp.id==='ljovpf'?'reference-line':''}"><div class="res-main"><span class="res-rank">${cp.rank??'—'}</span><div class="res-title"><span class="result-body-name">${esc(cp.name)}</span><small>${esc(cp.body)}</small></div></div><span class="res-sum">${fmt(old.score)} <small>${old.rank===null?'Not rated':'rank '+old.rank}</small></span><span class="res-sum strong">${fmt(cp.score)} <small>${cp.rank===null?'Not rated':`rank ${cp.rank}${Math.abs(delta)<.005?' · same score':' · change '+fmt(delta)}`}</small></span></div>`;
 }).join('');
 return `${approved()?'':evidenceStatus()}<section class="subpanel"><div class="split-intro"><div><h3>Starting comparison and your comparison</h3><p class="help">Both columns use the same approved written-TOR judgments. Only the importance assigned to the five governance areas changes. Tied scores share a rank.</p></div></div><div class="results-table"><div class="results-heading"><span>Advisory body</span><span>Starting</span><span>With your priorities</span></div>${table}</div></section>
${areaMatrix(STATE.order,true)}${evidenceSection()}${commentsForm()}`;
}
function stepFour(){
 const weights=currentWeights(),available=COMMUNITY.available===true,mean=COMMUNITY.averages||{};
 let message=COMMUNITY.error?'Community averages are temporarily unavailable. You can still review your weights.':
 !available?'Community averages will appear when the first completed response has been saved.':
 COMMUNITY.count===1?'Based on 1 completed response. The first community average may simply reflect your own ranking.':
 `Based on ${COMMUNITY.count} completed responses, using each saved response’s latest ranking.`;
 return `<div class="selection-intro"><div class="eyebrow">COMMUNITY PRIORITIES</div><h3>How do your priorities compare with other participants?</h3><p>Compare your governance-area weights with the averages across completed responses to this SAC Terms of Reference assessment.</p></div>
 <section class="subpanel"><h3>Your governance-area weights and the community average</h3><p class="comparison-help">The bars compare your ranking with the average among people who completed this assessment. The average is not a neighbourhood-wide poll.</p><p class="community-status" role="status">${esc(message)}</p>
 <div class="compare-list">${STATE.order.map(id=>{const a=DATA.areas.find(x=>x.id===id),y=weights[id],m=available?mean[id]:null;
  return `<div class="compare-item"><strong>${esc(a.name)}</strong><div class="compare-bars"><div><div class="bar-head">Your assessment weight <span>${pct(y)}</span></div><i style="width:${y/30*100}%" aria-hidden="true"></i></div><div><div class="bar-head">Community average weight <span>${pct(m)}</span></div><i class="average" style="width:${m==null?0:m/30*100}%" aria-hidden="true"></i></div></div></div>`;}).join('')}</div>
 <p class="help" style="margin-top:15px">The comparison reflects people who chose to participate, not necessarily the priorities of everyone in Little Jamaica and Oakwood Vaughan.</p>
 ${STATE.id?`<div class="return-actions"><button class="secondary" id="copy-return" type="button">Copy private return link</button><button class="secondary" id="refresh-community" type="button">Refresh community averages</button><button class="secondary" id="remove-response" type="button">Remove my response</button></div><p class="help">Anyone with your private return link can view and revise your response. Keep it confidential.</p>`:''}
 </section>`;
}
function navHeader(){q('#steps').innerHTML=STEPS.map((s,i)=>`<button data-step="${i}" class="${i===STATE.step?'current':''}" ${i===STATE.step?'aria-current="step"':''} ${i>STATE.unlocked+1?'disabled title="Complete earlier steps first"':''}><span>STEP ${i+1}</span>${esc(s.short)}</button>`).join('');q('#step-label').textContent=`STEP ${STATE.step+1} OF 4`;q('#step-title').textContent=STEPS[STATE.step].title;q('#step-detail').textContent=STEPS[STATE.step].desc;q('#progressbar').style.width=((STATE.step+1)/4*100)+'%';q('#save-state').textContent=saveLabel();}
function render(){if(!DATA)return;navHeader();q('#stage').innerHTML=[stepOne,stepTwo,stepThree,stepFour][STATE.step]();q('#actions').innerHTML=`${STATE.step?`<button class="secondary" data-step="${STATE.step-1}">← Previous step</button>`:'<span></span>'}${STATE.step<3?`<button class="primary" data-step="${STATE.step+1}">${['Rank what matters to you','See my updated comparison','Compare my priorities'][STATE.step]} →</button>`:'<button class="primary" data-step="0">Back to the comparison ↻</button>'}`;const n=q('#notice');n.hidden=!STATE.notice;if(STATE.notice)n.textContent=STATE.notice;}
async function navigate(i){
 i=Math.max(0,Math.min(3,i));
 if(i>STATE.unlocked+1){showMessage('Complete the earlier steps before continuing.');return;}
 if(STATE.step!==i && (STATE.id || (STATE.step===1 && i>=2) || (STATE.step===2 && i>=3))){
   if(saveTimer){clearTimeout(saveTimer);saveTimer=null;}
if(!await saveResponse()){STATE.notice='';render();return;}
 }
 STATE.step=i;STATE.unlocked=Math.max(STATE.unlocked,i);render();
 if(i===3)loadCommunity();
 const anchor=q('.layout');if(anchor)scrollTo({top:Math.max(0,anchor.getBoundingClientRect().top+scrollY-12),behavior:'smooth'});
}
function swap(id,delta){const i=STATE.order.indexOf(id),j=i+delta;if(i<0||j<0||j>4)return;[STATE.order[i],STATE.order[j]]=[STATE.order[j],STATE.order[i]];render();scheduleSave();}
function move(id,target){const i=STATE.order.indexOf(id),j=STATE.order.indexOf(target);if(i<0||j<0||i===j)return;STATE.order.splice(i,1);STATE.order.splice(j,0,id);render();scheduleSave();}
async function deleteResponse(){
 if(!STATE.id||!STATE.token)return;
 if(!confirm('Permanently remove your SAC TOR response, including optional contact details and comments?'))return;
 try{await fetchJSON(APP_BASE+'api/response?id='+encodeURIComponent(STATE.id),{method:'DELETE',headers:{Authorization:'Bearer '+STATE.token}});STATE.id=null;STATE.token=null;STATE.revision=0;STATE.savedSignature='';STATE.unlocked=3;history.replaceState(null,'',location.pathname+location.search);STATE.notice='Your response has been removed.';await loadCommunity();render();}
 catch(e){showMessage('Unable to remove your response: '+e.message);}
}
document.addEventListener('click',async ev=>{
 const b=ev.target.closest('button');if(!b||!DATA)return;
 if(b.hasAttribute('data-review')){STATE.selectedComparator=b.dataset.review;render();q('#evidence')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(b.hasAttribute('data-step')){await navigate(Number(b.dataset.step));return;}
 if(b.hasAttribute('data-up')){swap(b.dataset.up,-1);return;}
 if(b.hasAttribute('data-down')){swap(b.dataset.down,1);return;}
 if(b.id==='save-comment'){const ok=await saveResponse();const status=q('#comment-status');if(status)status.textContent=ok?'Your latest comment has been saved.':(STATE.saveError||'Comment not saved.');const saved=q('#save-state');if(saved)saved.textContent=saveLabel();return;}
 if(b.id==='copy-return'){try{await navigator.clipboard.writeText(privateLink());showMessage('Your private return link has been copied. Keep it confidential.');}catch{window.prompt('Copy your private return link:',privateLink());}return;}
 if(b.id==='refresh-community'){await loadCommunity();return;}
 if(b.id==='remove-response'){await deleteResponse();return;}
});
document.addEventListener('change',ev=>{
 if(!DATA)return;const el=ev.target;
 if(el.matches('[data-connection]')){const id=el.dataset.connection;STATE.connections=el.checked?[...new Set([...STATE.connections,id])]:STATE.connections.filter(x=>x!==id);scheduleSave();}
 if(el.id==='evidence-comparator'){STATE.selectedComparator=el.value;render();q('#evidence')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
 if(el.id==='newsletter'){STATE.newsletterOptIn=el.checked;scheduleSave();}
 if(el.id==='planning-updates'){STATE.planningOptIn=el.checked;scheduleSave();}
});
document.addEventListener('input',ev=>{if(!DATA)return;const el=ev.target;if(el.id==='participant-email'){STATE.email=el.value;scheduleSave();}if(el.id==='comment'){STATE.feedback=el.value;scheduleSave();}});
let dragging=null;
document.addEventListener('dragstart',ev=>{const item=ev.target.closest('[data-rank]');if(!item)return;dragging=item.dataset.rank;if(ev.dataTransfer){ev.dataTransfer.setData('text/plain',dragging);ev.dataTransfer.effectAllowed='move';}item.classList.add('is-dragging');});
document.addEventListener('dragover',ev=>{const item=ev.target.closest('[data-rank]');if(!item||!dragging)return;ev.preventDefault();if(ev.dataTransfer)ev.dataTransfer.dropEffect='move';qa('.drag-over').forEach(x=>x.classList.remove('drag-over'));item.classList.add('drag-over');});
document.addEventListener('drop',ev=>{const item=ev.target.closest('[data-rank]');if(!item||!dragging)return;ev.preventDefault();move(dragging,item.dataset.rank);dragging=null;});
document.addEventListener('dragend',()=>{dragging=null;qa('.drag-over,.is-dragging').forEach(x=>x.classList.remove('drag-over','is-dragging'));});

async function start(){
 try{
 DATA=window.LJOV_ASSESSMENT;
 if(!DATA)throw Error('The assessment is temporarily unavailable. Please try again later.');
 const issues=validateAssessment(DATA);
 if(issues.length){DATA.published=false;STATE.notice='Assessment evidence is incomplete or invalid. Comparative scores are withheld until it is corrected.';}
 await restoreFromLink();
 render();loadCommunity();
 }catch(e){const stage=q('#stage');if(stage)stage.innerHTML=`<div class="safety-note"><strong>Unable to load assessment definitions.</strong> ${esc(e.message)}</div>`;}
}
start();
