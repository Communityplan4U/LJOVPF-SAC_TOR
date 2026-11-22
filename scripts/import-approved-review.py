"""Import source-backed SAC TOR judgments from an approved 12-component workbook.

Only the 'Assessment Approval' sheet is authoritative. Existing ratings are
cleared first so a withdrawn approval cannot silently survive a later import.
"""
from pathlib import Path
from tempfile import NamedTemporaryFile
from subprocess import run
import json
import sys
from openpyxl import load_workbook

root = Path(__file__).resolve().parents[1]
if len(sys.argv) < 2 or sys.argv[1].startswith('--'):
    raise SystemExit('Usage: python scripts/import-approved-review.py /path/to/approved-review.xlsx [--publish]')
source = Path(sys.argv[1]).resolve()
publication = '--publish' in sys.argv[2:]
config_path = root/'data'/'assessment.json'
data = json.loads(config_path.read_text())
components = {c['id']: c for c in data['components']}
areas = {a['id']: a for a in data['areas']}
verified = {c['id'] for c in data['comparators'] if c['id'] != data['reference_id'] and c.get('url') and c.get('source_state') != 'unverified'}
not_verified = {c['id'] for c in data['comparators'] if c['id'] != data['reference_id']} - verified
ws = load_workbook(source, read_only=True, data_only=True)['Assessment Approval']
ws.reset_dimensions()
issues = []
seen = set()
provided = 0
for bid in verified:
    for code in components:
        data['judgments'][bid][code] = {'rating': None, 'ljovpf_excerpt': '', 'comparator_excerpt': '', 'rationale': '', 'source_section': ''}
for num, row in enumerate(ws.iter_rows(min_row=6, values_only=True), 6):
    if not row or not row[0]:
        continue
    if len(row) < 12:
        issues.append(f'Incomplete row {num}'); continue
    bid, name, area, code, title, lj, other, section, rating, rationale, status, source_url = row[:12]
    key = (bid, code)
    if key in seen:
        issues.append(f'Duplicate judgment {key}'); continue
    seen.add(key)
    if bid in not_verified:
        if status == 'Approved' or rating is not None:
            issues.append(f'Unverified comparator cannot be rated: {key}')
        continue
    if bid not in verified or code not in components:
        issues.append(f'Unexpected comparator or criterion: {key}'); continue
    component = components[code]
    if title != component['name'] or area != areas[component['area']]['name']:
        issues.append(f'Mismatched component description at {key}'); continue
    if status != 'Approved':
        continue
    if not isinstance(rating, (int, float)) or rating not in (-1, 0, 1):
        issues.append(f'Invalid rating at {key}'); continue
    if not all(isinstance(value, str) and value.strip() for value in (lj, other, section, rationale, source_url)):
        issues.append(f'Missing TOR evidence at {key}'); continue
    data['judgments'][bid][code] = {
        'rating': int(rating),
        'ljovpf_excerpt': lj.strip(),
        'comparator_excerpt': other.strip(),
        'rationale': rationale.strip(),
        'source_section': section.strip(),
        'approval_reference': f'Assessment Approval!A{num}:L{num}',
        'evidence_format': 'TOR provision summaries, not verbatim quotations'
    }
    provided += 1
need = len(components) * len(verified)
if issues:
    raise SystemExit('Import rejected:\n'+'\n'.join(' - '+x for x in issues))
print(f'Approved, source-backed judgments: {provided} of {need}; verified comparators: {len(verified)}')
if publication and provided != need:
    raise SystemExit(f'Publication rejected: all {need} judgments must be approved')
data['published'] = publication
data['assessment_status'] = 'approved' if publication else 'awaiting_approval'
data['assessment_source_workbook'] = source.name
if publication:
    data['approved_on'] = data.get('approved_on') or '2026-11-22'
with NamedTemporaryFile('w', suffix='.json', delete=False) as out:
    out.write(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
    temp = Path(out.name)
validation = run(['node', str(root/'scripts'/'validate-assessment.mjs'), str(temp)] + (['--publish'] if publication else []), capture_output=True, text=True)
if validation.returncode:
    temp.unlink()
    raise SystemExit(validation.stderr or validation.stdout)
config_path.write_text(temp.read_text())
temp.unlink()
print('Updated authoritative SAC assessment:', config_path)
