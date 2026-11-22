/* Public, deterministic assessment model. A score is only computed from approved
 * written-TOR judgments; pending/null judgments are never treated as zero. */
export const POSITION_WEIGHTS = Object.freeze([30, 25, 20, 15, 10]);
export const AREA_IDS = Object.freeze(['G1', 'G2', 'G3', 'G5', 'G4']);
export const REFERENCE_ID = 'ljovpf';

export function validOrder(order) {
  return Array.isArray(order) && order.length === 5 &&
    new Set(order).size === 5 && AREA_IDS.every(id => order.includes(id));
}
export function weightsFor(order = AREA_IDS) {
  if (!validOrder(order)) throw new TypeError('Five unique governance areas are required.');
  return Object.fromEntries(order.map((id,i) => [id, POSITION_WEIGHTS[i]]));
}
export function completeComparator(data, comparatorId) {
  if (comparatorId === REFERENCE_ID) return true;
  const comp = data.comparators.find(x => x.id === comparatorId);
  if (!comp || !comp.url || comp.source_state === 'unverified') return false;
  return data.components.every(c => [-1,0,1].includes(data.judgments?.[comparatorId]?.[c.id]?.rating));
}
export function areaResult(data, comparatorId, areaId, order = AREA_IDS, weighted = false) {
  if (!completeComparator(data, comparatorId)) return null;
  const components = data.components.filter(c => c.area === areaId);
  if (!components.length) return null;
  const net = comparatorId === REFERENCE_ID ? 0 : components.reduce((acc,c) => acc + data.judgments[comparatorId][c.id].rating,0);
  const result = weighted ? data.components.length * (weightsFor(order)[areaId]/100) * (net/components.length) : net;
  return Object.is(result,-0) ? 0 : result;
}
export function totalScore(data, comparatorId, order = AREA_IDS) {
  if (!data.published || !completeComparator(data,comparatorId)) return null;
  return data.areas.reduce((acc,a) => acc + areaResult(data,comparatorId,a.id,order,true),0);
}
export function comparison(data, order = AREA_IDS) {
  if (!validOrder(order)) throw new TypeError('Invalid area order');
  const list = data.comparators.map(c => ({...c,score:totalScore(data,c.id,order)}));
  for (const e of list) {
    e.rank = e.score === null ? null : 1 + list.filter(other => other.score !== null && other.score > e.score + 1e-9).length;
  }
  return list.sort((a,b) => (a.rank===null?1:0)-(b.rank===null?1:0) || (a.rank||999)-(b.rank||999) || a.name.localeCompare(b.name));
}
export function areaRank(data, comparatorId, areaId, order = AREA_IDS, weighted = false) {
  if (!data.published) return null;
  const current = areaResult(data,comparatorId,areaId,order,weighted);
  if (current === null) return null;
  return 1 + data.comparators.filter(c => {
    const v=areaResult(data,c.id,areaId,order,weighted);
    return v!==null && v>current+1e-9;
  }).length;
}
export function validateAssessment(data,requirePublished=false) {
  const issues=[];
  if (!data || typeof data!=='object') return ['Assessment must be an object'];
  if (requirePublished && data.published!==true) issues.push('Assessment is not marked published/approved');
  if (data.schema_version!=='tor12-v1') issues.push('Invalid schema_version');
  if (!Array.isArray(data.components)||data.components.length!==12) issues.push('Expected exactly 12 components');
  if (!Array.isArray(data.areas)||data.areas.length!==5) issues.push('Expected exactly five areas');
  if (!Array.isArray(data.comparators)||data.comparators.length!==11) issues.push('Expected 11 advisory bodies');
  if (issues.length) return issues;
  if (!validOrder(data.areas.map(a=>a.id))) issues.push('Missing or duplicate governance areas');
  const ids=data.components.map(c=>c.id);
  if (new Set(ids).size!==12) issues.push('Duplicate component IDs');
  for (const c of data.components) if(!AREA_IDS.includes(c.area)||!c.name||!c.description)issues.push('Invalid component '+c.id);
  for (const body of data.comparators.filter(c=>c.id!==REFERENCE_ID)) {
    if (body.url && (!body.url.startsWith('https://') || body.url.includes('\n')))issues.push('Invalid TOR URL for '+body.id);
    if (!data.judgments?.[body.id]) {issues.push('Missing judgment set for '+body.id);continue;}
    for (const c of data.components) {
      const r=data.judgments[body.id][c.id];
      if (!r) {issues.push('Missing judgment '+body.id+'/'+c.id);continue;}
      if (r.rating!==null && ![-1,0,1].includes(r.rating))issues.push('Bad rating '+body.id+'/'+c.id);
      if (r.rating!==null && !(String(r.ljovpf_excerpt||'').trim() && String(r.comparator_excerpt||'').trim() && String(r.source_section||'').trim()))issues.push('Missing written-TOR evidence '+body.id+'/'+c.id);
      if (r.rating!==null && !String(r.rationale||'').trim())issues.push('Missing TOR-only rationale '+body.id+'/'+c.id);
      if ((data.published || requirePublished) && body.source_state!=='unverified' && r.rating===null)issues.push('Unrated '+body.id+'/'+c.id);
    }
  }
  const weston=data.comparators.find(c=>c.id==='comp2');
  if (!weston) issues.push('Missing Weston in Gear');
  if (weston?.source_state==='unverified' && data.components.some(c=>data.judgments?.comp2?.[c.id]?.rating!==null))issues.push('Weston must remain unrated without its TOR');
  return issues;
}
