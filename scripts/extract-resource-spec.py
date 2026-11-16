"""Extract the supplied specification, retaining the source row for audit."""
import json
import re
import sys
from pathlib import Path
import openpyxl

source = Path(sys.argv[1])
sheet = openpyxl.load_workbook(source, data_only=True).active
rules = []
for rownum, values in enumerate(sheet.iter_rows(min_row=2, values_only=True), 2):
    module, item, kind, state, name, suffix, resolution, size = values
    if not name:
        continue
    width, height = map(int, re.findall(r'\d+', resolution))
    limits = {}
    for section in size.split('；'):
        formats, kb = section.split('≤')
        limit = int(re.search(r'\d+', kb).group()) * 1024
        for ext in formats.strip().split('/'):
            limits[ext] = limit
    rules.append(dict(row=rownum, module=str(module), item=str(item), kind=kind,
                      state=state, name=name, extensions=suffix.split('、'),
                      width=width, height=height, limits=limits, sizeLabel=size))
assert len(rules) == 471
assert len({r['name'] for r in rules}) == len(rules)
target = Path(__file__).resolve().parent.parent / 'resource-packager' / 'spec.js'
target.parent.mkdir(exist_ok=True)
target.write_text('/* Generated from the supplied workbook; do not hand-edit. */\n'
                  'globalThis.RESOURCE_SPEC = ' + json.dumps(rules, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
print(json.dumps(dict(rows=len(rules), modules=list(dict.fromkeys(r['module'] for r in rules)),
                     expanded=sum(4 if '{0-3}' in r['name'] else 1 for r in rules)), ensure_ascii=False))
