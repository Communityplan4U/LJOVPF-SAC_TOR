from pathlib import Path
import json,sys
from openpyxl import load_workbook
from collections import defaultdict
root=Path(__file__).resolve().parents[1]
if len(sys.argv)<2 or sys.argv[1].startswith('--'):
 print('Usage: python scripts/import-approved-review.py /path/to/approved-review.xlsx [--publish]');sys.exit(2)
source=Path(sys.argv[1])
config_path=root/'data/assessment.json';data=json.loads(config_path.read_text())
ws=load_workbook(source,read_only=True,data_only=True)['Assessment Approval']
ws.reset_dimensions()
provided=0;pending=[];issues=[];seen=set();verified={c['id'] for c in data['comparators'] if c['id'] not in ('ljovpf','comp2')}
# The review sheet is authoritative: clearing approval must clear previously imported ratings.
for body_id in verified:
 for comp_id in data['judgments'][body_id]:
  data['judgments'][body_id][comp_id]={'rating':None,'ljovpf_excerpt':'','comparator_excerpt':'','rationale':'','source_section':''}
for row in ws.iter_rows(min_row=6,values_only=True):
 if not row or not row[0]:continue
 body,name,area,comp,component,lj_excerpt,other_excerpt,section,rating,why,status,url=row[:12]
 key=(body,comp)
 if key in seen:issues.append('Duplicate '+str(key));continue
 seen.add(key)
 if body=='comp2':
  if rating is not None or status=='Approved':issues.append('Weston may not be rated until its own TOR is verified')
  continue
 if body not in verified or comp not in data['judgments'].get(body,{}):issues.append('Unrecognized comparator/component '+str(key));continue
 if status!='Approved':pending.append(key);continue
 try:n=int(rating)
 except(TypeError,ValueError):issues.append('Missing/bad rating '+str(key));continue
 if n not in (-1,0,1):issues.append('Invalid rating '+str(key));continue
 if not all(str(v or '').strip() for v in (lj_excerpt,other_excerpt,section,why)):
  issues.append('Missing exact TOR evidence '+str(key));continue
 data['judgments'][body][comp]={'rating':n,'ljovpf_excerpt':str(lj_excerpt),'comparator_excerpt':str(other_excerpt),'rationale':str(why),'source_section':str(section)}
 provided+=1
need=12*len(verified)
if issues:
 print('Review data has errors:\n'+'\n'.join(' - '+x for x in issues));sys.exit(1)
print(f'Approved evidence rows: {provided} of {need}; remaining: {len(pending)}')
if '--publish' in sys.argv:
 if provided!=need:print('Cannot publish: all 108 verified comparator-component rows require approval.');sys.exit(1)
 data['published']=True;data['assessment_status']='approved'
else:
 data['published']=False;data['assessment_status']='awaiting_approval'
from subprocess import run
# write only after validating the complete mapped structure
from tempfile import NamedTemporaryFile
with NamedTemporaryFile('w',suffix='.json',delete=False) as f:
 f.write(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp=Path(f.name)
verify=run(['node',str(root/'scripts/validate-assessment.mjs'),str(temp)]+(['--publish'] if '--publish' in sys.argv else []),capture_output=True,text=True)
if verify.returncode:
 temp.unlink();print(verify.stderr);sys.exit(1)
config_path.write_text(temp.read_text());temp.unlink()
print('Saved reviewed assessment JSON to',config_path)
