from pathlib import Path
import json
from openpyxl import Workbook
from openpyxl.styles import Font,PatternFill,Alignment,Border,Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.utils import get_column_letter
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'data/assessment.json').read_text())
wb=Workbook();intro=wb.active;intro.title='Start Here'
intro.sheet_view.showGridLines=False
intro.merge_cells('A1:H2');intro['A1']='LITTLE JAMAICA SAC | TOR-ONLY EVIDENCE APPROVAL'
intro['A1'].font=Font(name='Aptos Display',size=21,bold=True,color='FFFFFF')
intro['A1'].fill=PatternFill('solid',fgColor='512B63');intro['A1'].alignment=Alignment(vertical='center')
intro.row_dimensions[1].height=26;intro.row_dimensions[2].height=20
intro['A4']='Purpose';intro['B4']='Provide the exact written-TOR evidence and approve each of the 12 component comparisons for each verified comparator.'
intro['A5']='Judgment direction';intro['B5']='+1: comparator stronger; 0: comparable; -1: LJOVPF stronger. Do not rate a component using meeting conduct or subsequent actions.'
intro['A6']='Source constraint';intro['B6']='Both excerpts must be specific to the named TORs. When a TOR is silent, write "Not specified in this TOR" and explain.'
intro['A7']='No Weston inference';intro['B7']='Weston in Gear has no verified TOR source; leave all its rows as HOLD / blank until the actual TOR is located.'
intro['A8']='Approval';intro['B8']='Fill rating, both excerpts, TOR sections and rationale. Set status Approved only after source-checking. Keep Pending otherwise.'
intro['A9']='Import';intro['B9']='Run python scripts/import-approved-review.py review/assessment_review_template.xlsx. The tool will not publish until all 108 verified rows are approved.'
intro['A11']='Governance-area weights';intro['B11']='G1 30%; G2 25%; G3 20%; G5 15%; G4 10% by starting order. Ranking positions reassign these weights.'
intro['A12']='Fixed terms';intro['B12']='No separate Background & origin score. It is included in G5-02 and shares the G5 component weight.'
intro['A13']='Baseline';intro['B13']='Scores are computed from approved 12-component ratings only. No old 21-/23-component numbers are transferred.'
intro.column_dimensions['A'].width=25;intro.column_dimensions['B'].width=130
for r in range(4,14):
 intro[f'A{r}'].font=Font(name='Aptos',bold=True,color='563167',size=11)
 intro[f'B{r}'].font=Font(name='Aptos',size=11,color='333333')
 intro[f'B{r}'].alignment=Alignment(wrap_text=True,vertical='center');intro.row_dimensions[r].height=40
ws=wb.create_sheet('Assessment Approval')
ws.sheet_view.showGridLines=False
ws.merge_cells('A1:L2');ws['A1']='ASSESSMENT APPROVAL | Written Terms of Reference only'
ws['A1'].font=Font(name='Aptos Display',bold=True,color='FFFFFF',size=18)
ws['A1'].fill=PatternFill('solid',fgColor='512B63');ws['A1'].alignment=Alignment(vertical='center')
ws.merge_cells('A3:L3');ws['A3']='Blue fields are for review. Leave Weston unrated. Ratings must be based ONLY on written TOR provisions.'
ws['A3'].font=Font(name='Aptos',italic=True,color='8B561D',size=11)
headers=['Comparator ID','Comparator TOR body','Governance area','Component ID','Component title','LJOVPF TOR excerpt / explicit absence','Comparator TOR excerpt / explicit absence','TOR section(s)','Rating (-1, 0, +1)','TOR-only justification','Review status','Comparator TOR source URL']
for i,h in enumerate(headers,1):c=ws.cell(5,i,h);c.fill=PatternFill('solid',fgColor='E8DAEF');c.font=Font(name='Aptos',bold=True,color='4B2A5F');c.alignment=Alignment(wrap_text=True,vertical='center')
ws.row_dimensions[5].height=36
rows=[]
for body in data['comparators']:
 if body['id']=='ljovpf':continue
 for comp in data['components']:
  area=next(a for a in data['areas'] if a['id']==comp['area'])
  rows.append([body['id'],body['name']+' — '+body['body'],area['name'],comp['id'],comp['name'],None,None,None,None,None,'Hold: TOR unverified' if body['id']=='comp2' else 'Pending',body['url'] or 'TOR not verified'])
for i,row in enumerate(rows,6):
 for col,v in enumerate(row,1):
  c=ws.cell(i,col,v);c.alignment=Alignment(vertical='top',wrap_text=True)
  c.font=Font(name='Aptos',size=10,color='234F50' if col in [2,3,4,5,12] else ('164F95' if col in [6,7,8,9,10,11] else '555555'))
  if col in [6,7,8,9,10,11]:c.fill=PatternFill('solid',fgColor='F2F7FC' if row[0]!='comp2' else 'FFF2DF')
 ws.row_dimensions[i].height=55
ws.freeze_panes='F6';ws.auto_filter.ref=f'A5:L{5+len(rows)}'
widths=[15,38,37,17,42,50,50,30,18,59,22,60]
for i,w in enumerate(widths,1):ws.column_dimensions[get_column_letter(i)].width=w
dv=DataValidation(type='list',formula1='"-1,0,1"',allow_blank=True);dv.error='Choose -1, 0 or 1';dv.errorTitle='Invalid rating';dv.showErrorMessage=True;ws.add_data_validation(dv);dv.add(f'I6:I{len(rows)+5}')
dv2=DataValidation(type='list',formula1='"Pending,Approved,Hold: TOR unverified"',allow_blank=False);ws.add_data_validation(dv2);dv2.add(f'K6:K{len(rows)+5}')
ws.print_title_rows='1:5';ws.sheet_properties.pageSetUpPr.fitToPage=True
output=root/'docs/review/assessment_review_template.xlsx';wb.save(output)
print('Saved',output,'rows',len(rows),'verified',sum(r[0]!='comp2' for r in rows))
