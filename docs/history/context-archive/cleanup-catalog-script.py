# Catalog cleanup — executes ONLY the confirmed actions from Catalog-Structure-and-Dedup-Review.md
# (D1 inventory dedup, D2 alias fix, D3 confirmed merges, D4 measurement merges/renames, D5 panel vocab).
# Every absorbed record is preserved IN FULL under mergedFrom / duplicateSurveyEntry. Nothing clinical is altered.
import json, copy
from collections import Counter

CAT = r'C:\athnect\catalog\health-calculator-catalog.json'
MEA = r'C:\athnect\catalog\measurements-reference-extension.json'

def load(p):
    with open(p, 'r', encoding='utf-8-sig') as f:
        return json.load(f)

def save(p, obj):
    with open(p, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def urls(obj, acc):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == 'url' and isinstance(v, str):
                acc.add(v)
            else:
                urls(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            urls(v, acc)
    return acc

cat = load(CAT); mea = load(MEA)
stats = {'before': {'calculators': len(cat['calculators']), 'inventoryIndex': len(cat['inventoryIndex']),
                    'openIssues': len(cat['openIssues']), 'measurements': len(mea['measurements'])}}
urls_before_cat = urls(cat, set()); urls_before_mea = urls(mea, set())

log = []

# ---------- D1: dedupe inventoryIndex exact duplicate keys ----------
seen = {}
new_inv = []
for e in cat['inventoryIndex']:
    k = e['key']
    if k in seen:
        first = seen[k]
        sb = first.get('surveyedBy')
        sb = sb if isinstance(sb, list) else [sb]
        other = e.get('surveyedBy')
        if other not in sb:
            sb.append(other)
        first['surveyedBy'] = sb
        dup = copy.deepcopy(e)
        first.setdefault('duplicateSurveyEntry', []).append(dup)  # full provenance preserved
        log.append(f'D1 inventory dedup: {k} (surveyedBy now {sb})')
    else:
        e2 = copy.deepcopy(e)
        seen[k] = e2
        new_inv.append(e2)
cat['inventoryIndex'] = new_inv

# ---------- D3: calculator merges (confirmed only) ----------
calcs = {c['key']: c for c in cat['calculators']}
order = [c['key'] for c in cat['calculators']]

MERGES = [
    ('friedewald-ldl', ['vldl-estimate'], None,
     'VLDL (TG/5) is a secondary output of this calculator (see mergedFrom).'),
    ('tc-hdl-ratio', ['ldl-hdl-ratio', 'tg-hdl-ratio'],
     'Cholesterol Ratios (TC/HDL primary; LDL/HDL & TG/HDL secondary, research-context)',
     'LDL/HDL and TG/HDL ratios are secondary research-context outputs with no authoritative cutoffs (see mergedFrom).'),
    ('homa-ir', ['quicki'], None,
     'QUICKI (log10-gated) is a secondary output computed from the same two inputs (see mergedFrom).'),
    ('gestational-age', ['pregnancy-trimester'], None,
     'Trimester is a result block banding GA weeks (Cleveland Clinic 13/28-week scheme; see mergedFrom).'),
    ('ckd-epi-2021-egfr', ['kdigo-ckd-stage'],
     'eGFR & CKD Stage (CKD-EPI 2021 + KDIGO G/A staging)',
     'KDIGO G/A staging and the G-by-A risk heat-map are integrated; optional ACR input adds the A stage (see mergedFrom). Eliminates the previously duplicated G-band table.'),
]
for host_key, absorb, rename, note in MERGES:
    host = calcs[host_key]
    host.setdefault('mergedFrom', [])
    for ak in absorb:
        rec = calcs.pop(ak)
        order.remove(ak)
        host['mergedFrom'].append(copy.deepcopy(rec))
        log.append(f'D3 merge: {ak} -> {host_key}')
    host['mergeNote'] = note
    if rename:
        host['name'] = rename

# calorie merge: 3 entries -> 1 new host
energy_keys = ['bmr-mifflin-st-jeor', 'bmr-harris-benedict-revised', 'tdee-activity-multiplier']
energy = [calcs.pop(k) for k in energy_keys]
insert_at = order.index('bmr-mifflin-st-jeor')
for k in energy_keys:
    order.remove(k)
    log.append(f'D3 merge: {k} -> calorie-bmr-tdee (new combined entry)')
src_union, seen_u = [], set()
for e in energy:
    for s in e.get('sources', []):
        if s.get('url') not in seen_u:
            seen_u.add(s.get('url'))
            src_union.append(copy.deepcopy(s))
inp_union, seen_i = [], set()
for e in energy:
    for i in e.get('inputs', []):
        k = i.get('key')
        if k == 'bmr':
            continue  # computed internally in the combined tool; original preserved in mergedFrom
        if k not in seen_i:
            seen_i.add(k)
            inp_union.append(copy.deepcopy(i))
calorie = {
    'key': 'calorie-bmr-tdee',
    'name': 'Calorie / BMR / TDEE Calculator (Mifflin-St Jeor primary; revised Harris-Benedict alternate)',
    'tier': 1,
    'category': 'anthropometric',
    'logicType': 'mixed',
    'whyRelevant': 'The market packages BMR + activity multiplier + calorie needs as one tool (inventory: calorie-bmr-tdee); combined per dedup review D3 cluster 5. Mifflin-St Jeor is the primary method per the ADA evidence review; revised Harris-Benedict is the labeled alternate; TDEE = BMR x activity factor.',
    'realWorldPresence': 'Offered as a single combined calculator on MDCalc, Mayo Clinic (calorie calculator), NIDDK-adjacent tools and Omni; see mergedFrom entries for each component\u2019s original presence.',
    'inputs': inp_union,
    'logic': 'Method select: Mifflin-St Jeor (primary) or revised Harris-Benedict (alternate) computes BMR/REE from weight, height, age, sex; TDEE = BMR x activity multiplier (1.2 sedentary .. 1.9 very active, StatPearls-anchored; intermediate values labeled convention). All verbatim coefficients, bands and caveats preserved unchanged in mergedFrom.',
    'outputScale': 'kcal/day (BMR and TDEE)',
    'resultCategories': copy.deepcopy(energy[2].get('resultCategories', [])),
    'sources': src_union,
    'platformMapping': 'Fully expressible: linear derived formulas with sex branch (condition DSL/ternary), method select, activity multiplier via optionPoints/lookup, round() for display. No missing primitives.',
    'cautions': 'Healthy adults only; +-10% typical error (larger in obesity); users overestimate activity level; not for pregnancy/children/clinical nutrition. Component-specific cautions preserved in mergedFrom.',
    'mergeNote': 'Combined entry created by dedup cleanup (review D3 cluster 5) from the three components in mergedFrom; daily-calorie-needs-dga intentionally kept separate (population reference table, different construct).',
    'mergedFrom': [copy.deepcopy(e) for e in energy],
}
calcs['calorie-bmr-tdee'] = calorie
order.insert(insert_at, 'calorie-bmr-tdee')
cat['calculators'] = [calcs[k] for k in order]

# alias map for removed calculator keys (references keep resolving)
cat['calculatorAliases'] = {
    'vldl-estimate': 'friedewald-ldl',
    'ldl-hdl-ratio': 'tc-hdl-ratio',
    'tg-hdl-ratio': 'tc-hdl-ratio',
    'quicki': 'homa-ir',
    'pregnancy-trimester': 'gestational-age',
    'kdigo-ckd-stage': 'ckd-epi-2021-egfr',
    'bmr-mifflin-st-jeor': 'calorie-bmr-tdee',
    'bmr-harris-benedict-revised': 'calorie-bmr-tdee',
    'tdee-activity-multiplier': 'calorie-bmr-tdee',
}

# ---------- D2: inventory fullSpecKey aliases ----------
ALIAS = {
    'bmi-adult': ['bmi'], 'bp-category': ['blood-pressure-category'],
    'ascvd-pce-10yr': ['ascvd-10-year-pce'], 'target-heart-rate': ['target-heart-rate-zones'],
    'diabetes-risk-test-ada-cdc': ['ada-type2-risk-test'], 'diabetes-risk-ada': ['ada-type2-risk-test'],
    'egfr-ckd-epi-2021': ['ckd-epi-2021-egfr'], 'uacr-interpretation': ['ckd-epi-2021-egfr'],
    'ldl-friedewald': ['friedewald-ldl'], 'ldl-friedewald-nonhdl': ['friedewald-ldl', 'non-hdl-cholesterol'],
    'cholesterol-ratios-nonhdl': ['tc-hdl-ratio', 'non-hdl-cholesterol'],
    'fib-4': ['fib-4-index'], 'tsat-transferrin-saturation': ['transferrin-saturation'],
    'calorie-needs': ['daily-calorie-needs-dga'], 'calorie-bmr-tdee': ['calorie-bmr-tdee'],
    'ideal-weight-devine': ['ideal-body-weight-devine'], 'ideal-adjusted-body-weight': ['ideal-body-weight-devine'],
    'bsa-mosteller': ['body-surface-area'], 'pack-years': ['smoking-pack-years'],
    'alcohol-standard-drink-calculator': ['alcohol-standard-drinks'], 'alcohol-units': ['alcohol-standard-drinks'],
    'audit-alcohol-screen': ['audit-c'], 'waist-hip-ratio': ['waist-to-hip-ratio'],
    'waist-height-ratio': ['waist-to-height-ratio'],
    'waist-circumference-hip-ratio': ['waist-circumference-risk', 'waist-to-hip-ratio'],
    'body-fat': ['body-fat-us-navy'], 'due-date': ['pregnancy-due-date'],
    'water-intake': ['daily-water-intake'], 'epworth-sleepiness': ['epworth-sleepiness-scale'],
    'bmi-child-teen-percentile': ['pediatric-growth-percentiles'], 'child-bmi-percentile': ['pediatric-growth-percentiles'],
}
PLATFORM = {
    'a1c-eag': 'eAG derived parameter already in niro-cws.config.json (28.7*hba1c-46.7)',
    'eag-a1c-converter': 'eAG derived parameter already in niro-cws.config.json (28.7*hba1c-46.7)',
    'anemia-hemoglobin': 'hemoglobin biomarker interpretation in the existing 40-biomarker library',
}
calc_keys = set(calcs.keys())
fixed_true = 0
for e in cat['inventoryIndex']:
    k = e['key']
    targets = None
    if k in calc_keys:
        targets = [k]
    elif k in ALIAS:
        targets = ALIAS[k]
    elif k in cat['calculatorAliases']:
        targets = [cat['calculatorAliases'][k]]
    if targets:
        e['fullSpecKey'] = targets
        e['fullSpecInCatalog'] = True
        fixed_true += 1
    elif k in PLATFORM:
        e['fullSpecInCatalog'] = False
        e['coveredBy'] = PLATFORM[k]
    else:
        e['fullSpecInCatalog'] = False
log.append(f'D2 alias fix: {fixed_true} inventory entries now correctly cross-referenced (was 21 True)')

# ---------- D4: measurements ----------
meas = {m['key']: m for m in mea['measurements']}
morder = [m['key'] for m in mea['measurements']]

def merge_meas(host_key, absorb_keys, note, union_sources):
    host = meas[host_key]
    host.setdefault('mergedFrom', [])
    for ak in absorb_keys:
        rec = meas.pop(ak)
        morder.remove(ak)
        host['mergedFrom'].append(copy.deepcopy(rec))
        if union_sources:
            have = {s.get('url') for s in host.get('sources', [])}
            for s in rec.get('sources', []):
                if s.get('url') not in have:
                    have.add(s.get('url'))
                    host['sources'].append(copy.deepcopy(s))
        log.append(f'D4 merge: {ak} -> {host_key}')
    host['mergeNote'] = note

merge_meas('spo2', ['oxygen-saturation'],
           'Same measurement contributed by two research agents; records merged, sources unioned.', True)
merge_meas('triglycerides', ['fasting-triglycerides', 'triglycerides-categories'],
           'Single triglycerides record: fasting context, NCEP category bands, and metabolic-syndrome threshold (>=150 mg/dL) consolidated; verbatim originals in mergedFrom.', True)
merge_meas('systolic-bp', ['blood-pressure-mets'],
           'Metabolic-syndrome BP component (SBP >=130 OR DBP >=85, or on antihypertensive treatment) kept as a context; applies jointly with diastolic-bp.', False)

RENAMES = {'fasting-plasma-glucose': 'fasting-glucose', 'serum-creatinine': 'creatinine', 'platelet-count': 'platelets'}
for old, new in RENAMES.items():
    rec = meas.pop(old)
    rec['formerKey'] = old
    rec['key'] = new
    meas[new] = rec
    morder[morder.index(old)] = new
    log.append(f'D4 rename: {old} -> {new} (canonical library ID)')

LIB_KEYS = ['alt', 'ast', 'bun', 'egfr', 'fasting-insulin', 'hba1c', 'hdl-cholesterol', 'ldl-cholesterol',
            'systolic-bp', 'total-cholesterol', 'triglycerides', 'fasting-glucose', 'creatinine', 'platelets']
flagged = 0
for k in LIB_KEYS:
    if k in meas:
        meas[k]['libraryMerge'] = True
        meas[k]['libraryKey'] = k
        meas[k].setdefault('mergeNote', '')
        meas[k]['libraryMergeNote'] = 'Enriches the existing biomarker-dataset.json record with the same key: merge-on-import as additional per-org reference ranges / conflicts. Never overwrite library values.'
        flagged += 1
log.append(f'D4 library-overlap flags: {flagged} records marked libraryMerge (enrichment, not new analytes)')

# D5: panel controlled vocabulary (originals preserved in panelOriginal)
PANEL = {}
def pmap(*names):
    def reg(target):
        for n in names: PANEL[n] = target
    return reg
pmap('Lipid panel', 'Lipid', 'Lipids', 'Lipids (derived)', 'Lipid panel (derived)')('lipid')
pmap('CBC', 'Complete blood count (CBC)', 'CBC (RBC indices)')('cbc')
pmap('CBC differential')('cbc-differential')
pmap('Iron studies')('iron-studies')
pmap('Electrolytes')('electrolytes')
pmap('Minerals', 'Minerals / CMP')('minerals')
pmap('Liver panel', 'Liver / hepatic function panel')('liver')
pmap('Basic/Comprehensive Metabolic Panel; Renal panel', 'Basic/Comprehensive Metabolic Panel',
     'Derived from metabolic panel', 'Urine microalbumin panel', 'Auto-reported with metabolic panels',
     'Derived (drug-dosing context)')('renal')
pmap('Basic metabolic / glucose', 'Glucose tolerance', 'Glycemic', 'Metabolic (add-on)',
     'Glycemic (HbA1c-adjacent)')('glycemic')
pmap('Vitals', 'Vital signs', 'Vitals (derived)', 'Vitals (self-service)')('vitals')
pmap('Spirometry', 'Spirometry / asthma self-monitoring')('spirometry')
pmap('anthropometry-core', 'anthropometry-central-adiposity')('anthropometry')
pmap('womens-reproductive-health')('reproductive')
pmap('Sleep & Lifestyle', 'Lifestyle/hydration')('lifestyle-reference')
pmap('Proteins', 'Proteins / CMP')('proteins')
pmap('Pancreatic enzymes')('pancreatic-enzymes')
pmap('Muscle enzymes')('muscle-enzymes')
pmap('General chemistry')('general-chemistry')
pmap("Men's health")('mens-health')
pn = 0
for m in meas.values():
    orig = m.get('panel')
    if orig in PANEL and PANEL[orig] != orig:
        m['panelOriginal'] = orig
        m['panel'] = PANEL[orig]
        pn += 1
log.append(f'D5 panel vocabulary normalized on {pn} records (originals kept in panelOriginal)')

mea['measurements'] = [meas[k] for k in morder]

# metadata updates
cat['counts'] = {'calculators': len(cat['calculators']), 'inventoryIndex': len(cat['inventoryIndex'])}
cat['cleanedAt'] = '2026-08-20'
cat['cleanupBasis'] = 'Catalog-Structure-and-Dedup-Review.md (confirmed actions only); backup in backup-2026-08-20/; details in Cleanup-Report.md'
mea['counts'] = {'measurements': len(mea['measurements']),
                 'genuinelyNew': len(mea['measurements']) - flagged,
                 'libraryEnrichments': flagged}
mea['cleanedAt'] = '2026-08-20'
mea['cleanupBasis'] = cat['cleanupBasis']

# ---------- VALIDATION ----------
errs = []
ck = [c['key'] for c in cat['calculators']]
if len(ck) != len(set(ck)): errs.append('duplicate calculator keys remain')
ik = [e['key'] for e in cat['inventoryIndex']]
if len(ik) != len(set(ik)): errs.append('duplicate inventory keys remain')
mk = [m['key'] for m in mea['measurements']]
if len(mk) != len(set(mk)): errs.append('duplicate measurement keys remain')
for e in cat['inventoryIndex']:
    for t in e.get('fullSpecKey', []):
        if t not in set(ck): errs.append(f'unresolved fullSpecKey {t} on {e["key"]}')
for a, t in cat['calculatorAliases'].items():
    if t not in set(ck): errs.append(f'unresolved alias target {t}')
urls_after_cat = urls(cat, set()); urls_after_mea = urls(mea, set())
lost_cat = urls_before_cat - urls_after_cat
lost_mea = urls_before_mea - urls_after_mea
if lost_cat: errs.append(f'LOST catalog source urls: {sorted(lost_cat)}')
if lost_mea: errs.append(f'LOST measurement source urls: {sorted(lost_mea)}')

stats['after'] = {'calculators': len(ck), 'inventoryIndex': len(ik),
                  'openIssues': len(cat['openIssues']), 'measurements': len(mk),
                  'libraryEnrichmentFlags': flagged,
                  'sourceUrls_cat_before_after': [len(urls_before_cat), len(urls_after_cat)],
                  'sourceUrls_mea_before_after': [len(urls_before_mea), len(urls_after_mea)]}

if errs:
    print('VALIDATION FAILED — NOT SAVING:')
    for e in errs: print('  ', e)
else:
    save(CAT, cat); save(MEA, mea)
    # reparse to prove files are valid
    load(CAT); load(MEA)
    print('SAVED + reparse OK')
    print(json.dumps(stats, indent=1))
    print('--- ACTION LOG ---')
    for l in log: print(' ', l)
