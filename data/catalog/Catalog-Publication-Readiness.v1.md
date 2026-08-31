# Catalog publication-readiness report v1

Calculator catalog SHA-256: `993eaf5d8b25a3612d144f74138865ba5c48e32c4061ddff7a1c7f59a15af718`  
Measurement catalog SHA-256: `9e803b527ebd82c3e5f506950a982ba4c2af6d017c3cf323792e283f73f53bd5`

> This is a deterministic quarantine/readiness report. It is not clinical approval and performs no import or lifecycle transition.

## Summary

- Calculator research records: 62
- Calculator publication eligible: 0
- Calculator quarantined: 62
- Measurement research records: 79
- Measurement publication eligible: 0
- Measurement quarantined: 79
- New measurement candidates / library enrichments: 65 / 14
- Known reversed conversion records: 20

## Calculator-by-calculator disposition

| Key | Tier | Category | Source status | Disposition | Blockers |
|---|---:|---|---|---|---|
| `ada-type2-risk-test` | 2 | metabolic | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `ag-ratio` | 2 | lab-panel-extension | 1/1 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `alcohol-standard-drinks` | 1 | liver-alcohol | 2/7 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-ENGINE-CAPABILITY` |
| `anion-gap` | 3 | lab-panel-extension | 1/1 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `apri` | 1 | liver-alcohol | 6/7 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `ascvd-10-year-pce` | 2 | cardiovascular | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `ast-alt-ratio` | 2 | liver-alcohol | 3/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `audit-c` | 1 | liver-alcohol | 3/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-LICENSING` |
| `blood-pressure-category` | 1 | cardiovascular | 1/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `bmi` | 1 | anthropometric | 2/6 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `body-fat-us-navy` | 1 | anthropometric | 2/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `body-surface-area` | 2 | anthropometric | 1/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `bun-creatinine-ratio` | 1 | kidney-hydration | 3/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `caffeine-intake-tracker` | 2 | mental-sleep | 1/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `calorie-bmr-tdee` | 1 | anthropometric | 2/6 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `child-screen-time-checker` | 3 | mental-sleep | 1/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `ckd-epi-2021-egfr` | 1 | kidney-hydration | 4/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-LICENSING` |
| `cockcroft-gault-crcl` | 2 | kidney-hydration | 2/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `corrected-calcium` | 1 | lab-panel-extension | 2/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `daily-calorie-needs-dga` | 2 | anthropometric | 0/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `daily-water-intake` | 1 | kidney-hydration | 3/5 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `epworth-sleepiness-scale` | 3 | mental-sleep | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `fev1-fvc-interpretation` | 2 | respiratory | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-ENGINE-CAPABILITY` |
| `fib-4-index` | 1 | liver-alcohol | 5/6 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `findrisc` | 1 | metabolic | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `friedewald-ldl` | 1 | lab-panel-extension | 2/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `gad-7` | 1 | mental-sleep | 2/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `gestational-age` | 1 | womens-repro | 2/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-ENGINE-CAPABILITY` |
| `homa-ir` | 1 | metabolic | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `ideal-body-weight-devine` | 2 | anthropometric | 2/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `indirect-bilirubin` | 3 | lab-panel-extension | 2/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `lean-body-mass-boer` | 2 | anthropometric | 1/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `max-heart-rate` | 1 | cardiovascular | 3/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `mean-arterial-pressure` | 2 | cardiovascular | 2/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `menstrual-cycle-checker` | 2 | womens-repro | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `metabolic-syndrome-checker` | 1 | metabolic | 4/6 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `mmrc-dyspnea-scale` | 3 | respiratory | 2/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `nlr` | 2 | lab-panel-extension | 1/1 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `non-hdl-cholesterol` | 1 | cardiovascular | 2/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `ogtt-2h-interpreter` | 1 | metabolic | 1/1 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `ovulation-fertile-window` | 1 | womens-repro | 4/6 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-ENGINE-CAPABILITY`, `CAT-CALC-LICENSING` |
| `pediatric-growth-percentiles` | 2 | womens-repro | 1/5 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-ENGINE-CAPABILITY`, `CAT-CALC-LICENSING` |
| `phq-9` | 1 | mental-sleep | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `physical-activity-target` | 2 | mental-sleep | 2/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `predicted-peak-expiratory-flow` | 1 | respiratory | 3/5 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-ENGINE-CAPABILITY` |
| `pregnancy-due-date` | 1 | womens-repro | 2/6 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-ENGINE-CAPABILITY`, `CAT-CALC-LICENSING` |
| `pregnancy-weight-gain` | 1 | womens-repro | 0/5 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `pss-10` | 2 | mental-sleep | 3/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-LICENSING` |
| `pulse-pressure` | 2 | cardiovascular | 2/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `respiratory-rate-checker` | 2 | respiratory | 4/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `resting-heart-rate` | 1 | cardiovascular | 2/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `six-minute-walk-distance` | 2 | respiratory | 1/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `sleep-duration-checker` | 1 | mental-sleep | 3/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `smoking-pack-years` | 1 | respiratory | 2/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY`, `CAT-CALC-LICENSING` |
| `spo2-checker` | 1 | respiratory | 4/4 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `target-heart-rate-zones` | 1 | cardiovascular | 3/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `tc-hdl-ratio` | 1 | cardiovascular | 1/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `transferrin-saturation` | 1 | lab-panel-extension | 2/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW` |
| `tyg-index` | 1 | metabolic | 2/5 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `waist-circumference-risk` | 1 | anthropometric | 3/5 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `waist-to-height-ratio` | 1 | anthropometric | 1/3 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |
| `waist-to-hip-ratio` | 2 | anthropometric | 1/2 fetch-verified | quarantined | `CAT-CALC-LEGACY-SHAPE`, `CAT-CALC-MEASUREMENT-MAPPING`, `CAT-CALC-COMPLETE-GOLDEN`, `CAT-CALC-CONTENT-GOVERNANCE`, `CAT-CALC-INDEPENDENT-REVIEW`, `CAT-CALC-SOURCE-REVERIFY` |

## Measurement-by-measurement disposition

| Key | Role | Panel | Sources | Conversions | Disposition | Blockers |
|---|---|---|---:|---:|---|---|
| `ag-ratio` | new-candidate | proteins | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `alp` | new-candidate | liver | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `alt` | library-enrichment | liver | 1/1 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `amylase` | new-candidate | pancreatic-enzymes | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `ast` | library-enrichment | liver | 2/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `basophils-absolute` | new-candidate | cbc-differential | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `basophils-percent` | new-candidate | cbc-differential | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `bilirubin-direct` | new-candidate | liver | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `bilirubin-indirect` | new-candidate | liver | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `body-temperature` | new-candidate | vitals | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-SPECIAL` |
| `bun` | library-enrichment | renal | 2/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `bun-creatinine-ratio` | new-candidate | renal | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE` |
| `caffeine-daily-limit` | new-candidate | lifestyle-reference | 1/3 fetch-verified | 5 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-SPECIAL` |
| `calcium-total` | new-candidate | minerals | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `child-screen-time-limits` | new-candidate | lifestyle-reference | 1/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY` |
| `chloride` | new-candidate | electrolytes | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `co2-bicarbonate` | new-candidate | electrolytes | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `creatine-kinase` | new-candidate | muscle-enzymes | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `creatinine` | library-enrichment | renal | 3/3 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `creatinine-clearance` | new-candidate | renal | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE` |
| `diastolic-bp` | new-candidate | vitals | 1/1 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `egfr` | library-enrichment | renal | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-LIBRARY-MERGE` |
| `eosinophils-absolute` | new-candidate | cbc-differential | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `eosinophils-percent` | new-candidate | cbc-differential | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `fasting-glucose` | library-enrichment | glycemic | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `fasting-insulin` | library-enrichment | glycemic | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-SPECIAL`, `CAT-MEAS-LIBRARY-MERGE` |
| `fev1-fvc-ratio` | new-candidate | spirometry | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE` |
| `fructosamine` | new-candidate | glycemic | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `gestational-age-classification` | new-candidate | reproductive | 2/3 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY` |
| `globulin` | new-candidate | proteins | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `hba1c` | library-enrichment | glycemic | 1/1 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-LIBRARY-MERGE` |
| `hdl-cholesterol` | library-enrichment | lipid | 2/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `height` | new-candidate | anthropometry | 0/1 fetch-verified | 3 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-SPECIAL` |
| `hematocrit` | new-candidate | cbc | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `hip-circumference` | new-candidate | anthropometry | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `ldh` | new-candidate | general-chemistry | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `ldl-cholesterol` | library-enrichment | lipid | 2/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `lipase` | new-candidate | pancreatic-enzymes | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `lymphocytes-absolute` | new-candidate | cbc-differential | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `lymphocytes-percent` | new-candidate | cbc-differential | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `mch` | new-candidate | cbc | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `mchc` | new-candidate | cbc | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `mean-arterial-pressure` | new-candidate | vitals | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE` |
| `menstrual-bleeding-duration` | new-candidate | reproductive | 1/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY` |
| `menstrual-cycle-length` | new-candidate | reproductive | 3/4 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY` |
| `monocytes-absolute` | new-candidate | cbc-differential | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `monocytes-percent` | new-candidate | cbc-differential | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `neck-circumference` | new-candidate | anthropometry | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `neutrophils-absolute` | new-candidate | cbc-differential | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `neutrophils-percent` | new-candidate | cbc-differential | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `non-hdl-cholesterol` | new-candidate | lipid | 2/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `ogtt-2h-plasma-glucose` | new-candidate | glycemic | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `peak-expiratory-flow` | new-candidate | spirometry | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `phosphate` | new-candidate | minerals | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `physical-activity-weekly-target` | new-candidate | lifestyle-reference | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE` |
| `platelets` | library-enrichment | cbc | 1/1 fetch-verified | 3 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `potassium` | new-candidate | electrolytes | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `pre-pregnancy-bmi` | new-candidate | reproductive | 1/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-SPECIAL` |
| `psa` | new-candidate | mens-health | 3/3 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `pulse-pressure` | new-candidate | vitals | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE` |
| `rbc-count` | new-candidate | cbc | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `rdw` | new-candidate | cbc | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `respiratory-rate-adult` | new-candidate | vitals | 4/4 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `resting-heart-rate` | new-candidate | vitals | 2/2 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE` |
| `serum-iron` | new-candidate | iron-studies | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `sleep-duration-by-age` | new-candidate | lifestyle-reference | 3/4 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY` |
| `sodium` | new-candidate | electrolytes | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `spo2` | new-candidate | vitals | 4/5 fetch-verified | 0 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY` |
| `systolic-bp` | library-enrichment | vitals | 1/1 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `tibc` | new-candidate | iron-studies | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `total-cholesterol` | library-enrichment | lipid | 2/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `total-protein` | new-candidate | proteins | 1/1 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `total-water-intake` | new-candidate | lifestyle-reference | 3/3 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `transferrin-saturation` | new-candidate | iron-studies | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `triglycerides` | library-enrichment | lipid | 5/5 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-LIBRARY-MERGE` |
| `urine-acr` | new-candidate | renal | 2/2 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE` |
| `vldl-cholesterol` | new-candidate | lipid | 2/2 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-REVERSED` |
| `waist-circumference` | new-candidate | anthropometry | 3/5 fetch-verified | 1 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY`, `CAT-MEAS-CONVERSION-SHAPE` |
| `weight` | new-candidate | anthropometry | 0/1 fetch-verified | 2 | quarantined | `CAT-MEAS-LEGACY-SHAPE`, `CAT-MEAS-RANGE-STRUCTURE`, `CAT-MEAS-CLAIM-LINKS`, `CAT-MEAS-REVIEW-EVIDENCE`, `CAT-MEAS-SOURCE-REVERIFY`, `CAT-MEAS-CONVERSION-SHAPE`, `CAT-MEAS-CONVERSION-SPECIAL` |

## Exact blocker details

### Calculator: ada-type2-risk-test

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Calculator: ag-ratio

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: alcohol-standard-drinks

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 5 of 7 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).
- `CAT-CALC-ENGINE-CAPABILITY`: The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.

### Calculator: anion-gap

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: apri

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 7 source objects are not exactly fetch-verified (fetch-verified, search-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: ascvd-10-year-pce

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Calculator: ast-alt-ratio

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: audit-c

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: blood-pressure-category

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Calculator: bmi

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 4 of 6 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: body-fat-us-navy

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 4 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: body-surface-area

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 3 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Calculator: bun-creatinine-ratio

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: caffeine-intake-tracker

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 3 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: calorie-bmr-tdee

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 4 of 6 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: child-screen-time-checker

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Calculator: ckd-epi-2021-egfr

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: cockcroft-gault-crcl

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 3 source objects are not exactly fetch-verified (fetch-verified, search-verified (PubMed page fetch blocked by cookie wall; citation confirmed via search results and NKF page)).

### Calculator: corrected-calcium

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 3 source objects are not exactly fetch-verified (fetch-verified, fetch-verified (formula constants not visible on fetched page; normal-albumin value and ionized-calcium caution verified; underlying citation Payne RB et al., BMJ 1973 — search-verified, not fetched)).

### Calculator: daily-calorie-needs-dga

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 2 source objects are not exactly fetch-verified (blocked-cited).

### Calculator: daily-water-intake

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 5 source objects are not exactly fetch-verified (blocked-cited (HTTP 403; equivalent values verified via PMC + MedlinePlus), fetch-verified, search-verified).

### Calculator: epworth-sleepiness-scale

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: fev1-fvc-interpretation

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified).
- `CAT-CALC-ENGINE-CAPABILITY`: The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.

### Calculator: fib-4-index

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 6 source objects are not exactly fetch-verified (fetch-verified, search-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: findrisc

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Calculator: friedewald-ldl

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 3 source objects are not exactly fetch-verified (fetch-verified, fetch-verified (TG>400 limitation verified; page did not expose the primary citation — underlying paper Friedewald WT, Levy RI, Fredrickson DS, Clin Chem 1972;18:499-502 is search-verified, not fetched)).

### Calculator: gad-7

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Calculator: gestational-age

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 3 source objects are not exactly fetch-verified (fetch-verified, search-verified).
- `CAT-CALC-ENGINE-CAPABILITY`: The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.

### Calculator: homa-ir

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: ideal-body-weight-devine

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 4 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: indirect-bilirubin

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: lean-body-mass-boer

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Calculator: max-heart-rate

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: mean-arterial-pressure

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: menstrual-cycle-checker

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified (ACOG PDF located at acog.org media path; HTML page blocked)).

### Calculator: metabolic-syndrome-checker

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 6 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: mmrc-dyspnea-scale

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: nlr

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: non-hdl-cholesterol

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: ogtt-2h-interpreter

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: ovulation-fertile-window

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 6 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).
- `CAT-CALC-ENGINE-CAPABILITY`: The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: pediatric-growth-percentiles

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 4 of 5 source objects are not exactly fetch-verified (blocked-cited (existence and content search-verified via cdc.gov results), fetch-verified, search-verified).
- `CAT-CALC-ENGINE-CAPABILITY`: The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: phq-9

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: physical-activity-target

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 3 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Calculator: predicted-peak-expiratory-flow

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 5 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).
- `CAT-CALC-ENGINE-CAPABILITY`: The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.

### Calculator: pregnancy-due-date

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 4 of 6 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).
- `CAT-CALC-ENGINE-CAPABILITY`: The research mapping explicitly records a missing/versioned engine or product capability; scope must be narrowed or a separately reviewed contract added.
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: pregnancy-weight-gain

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 5 of 5 source objects are not exactly fetch-verified (blocked-cited, fetch-verified (report located; summary table values cross-verified via PMC-indexed literature quoting the report: 12.5–18/11.5–16/7–11.5/5–9 kg; rates 0.44–0.58/0.35–0.50/0.23–0.33/0.17–0.27 kg/wk), search-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: pss-10

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: pulse-pressure

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: respiratory-rate-checker

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: resting-heart-rate

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: six-minute-walk-distance

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Calculator: sleep-duration-checker

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Calculator: smoking-pack-years

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 4 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).
- `CAT-CALC-LICENSING`: The research row discusses licensing, copyright, permission, proprietary scope, or link-out handling, but no accepted structured publication disposition is present; prose such as “no restrictions” is not approval evidence.

### Calculator: spo2-checker

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: target-heart-rate-zones

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: tc-hdl-ratio

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 3 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: transferrin-saturation

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.

### Calculator: tyg-index

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 3 of 5 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: waist-circumference-risk

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 5 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: waist-to-height-ratio

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 2 of 3 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).

### Calculator: waist-to-hip-ratio

- `CAT-CALC-LEGACY-SHAPE`: This is a research pre-config, not a calculator-version.v1 document authored and validated through Calculator Studio.
- `CAT-CALC-MEASUREMENT-MAPPING`: No input declares an explicit biomarkerKey/measurementKey; approved immutable measurement revisions and snapshots are absent.
- `CAT-CALC-COMPLETE-GOLDEN`: No reviewer-approved complete source-worked example, expected final score/category, or boundary/missing/context test suite is present.
- `CAT-CALC-CONTENT-GOVERNANCE`: Structured publishable content, claim-level citations, authorship, applicability, disclaimer, SEO, and licensing dispositions are not recorded in the executable contract.
- `CAT-CALC-INDEPENDENT-REVIEW`: No named independent medical reviewer approval bound to protected logic/content/citation/measurement/test hashes is present.
- `CAT-CALC-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Measurement: ag-ratio

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: alp

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.

### Measurement: alt

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: amylase

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.

### Measurement: ast

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: basophils-absolute

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.

### Measurement: basophils-percent

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: bilirubin-direct

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µmol/L-to-mg/dL factor 17.104 is reciprocal to the declared direction; the locked contract records about ×0.0585.

### Measurement: bilirubin-indirect

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µmol/L-to-mg/dL factor 17.104 is reciprocal to the declared direction; the locked contract records about ×0.0585.

### Measurement: body-temperature

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-SPECIAL`: Temperature requires an explicit affine factor and offset; the slope-only legacy record is directionally ambiguous.

### Measurement: bun

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: bun-creatinine-ratio

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.

### Measurement: caffeine-daily-limit

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 2 of 3 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-SPECIAL`: Serving caffeine coefficients and beverage amounts are not dimensional unit conversions and require a reviewed input model.

### Measurement: calcium-total

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy mmol/L-to-mg/dL factor 0.2495 is reciprocal to the declared direction; the locked contract records about ×4.008.

### Measurement: child-screen-time-limits

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Measurement: chloride

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: co2-bicarbonate

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: creatine-kinase

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: creatinine

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: creatinine-clearance

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.

### Measurement: diastolic-bp

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: egfr

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: eosinophils-absolute

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.

### Measurement: eosinophils-percent

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: fasting-glucose

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: fasting-insulin

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-SPECIAL`: The legacy conversion stores factor 0 as an unresolved sentinel, which is invalid and non-invertible.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: fev1-fvc-ratio

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.

### Measurement: fructosamine

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: gestational-age-classification

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 3 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Measurement: globulin

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy g/L-to-g/dL factor 10 is reversed under the locked directional equation; the contract records ×0.1.

### Measurement: hba1c

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: hdl-cholesterol

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: height

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 1 source objects are not exactly fetch-verified (search-verified).
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-SPECIAL`: The ft+in entry is a typed multi-component adapter, not a one-factor unit conversion.

### Measurement: hematocrit

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy L/L-to-percent factor 0.01 is reversed under canonical = entered × factor + offset; the locked contract records ×100 as the required direction.

### Measurement: hip-circumference

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: ldh

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.

### Measurement: ldl-cholesterol

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: lipase

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µkat/L-to-U/L factor 0.0167 is reciprocal to the declared direction; the locked contract records ×60.

### Measurement: lymphocytes-absolute

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.

### Measurement: lymphocytes-percent

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: mch

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: mchc

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy g/L-to-g/dL factor 10 is reversed under the locked directional equation; the contract records ×0.1.

### Measurement: mean-arterial-pressure

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.

### Measurement: menstrual-bleeding-duration

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Measurement: menstrual-cycle-length

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Measurement: monocytes-absolute

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.

### Measurement: monocytes-percent

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: neck-circumference

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: neutrophils-absolute

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy 10^9/L-to-cells/µL factor 0.001 is reversed; the locked contract records ×1000.

### Measurement: neutrophils-percent

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: non-hdl-cholesterol

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: ogtt-2h-plasma-glucose

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: peak-expiratory-flow

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: phosphate

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy mmol/L-to-mg/dL factor 0.3229 is reciprocal to the declared direction; the locked contract records about ×3.097.

### Measurement: physical-activity-weekly-target

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.

### Measurement: platelets

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: potassium

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: pre-pregnancy-bmi

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 2 source objects are not exactly fetch-verified (fetch-verified, search-verified).
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-SPECIAL`: Weight and height component conversions are attached to a derived BMI output and must be migrated to its input measurements.

### Measurement: psa

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: pulse-pressure

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.

### Measurement: rbc-count

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: rdw

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: respiratory-rate-adult

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: resting-heart-rate

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.

### Measurement: serum-iron

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µmol/L-to-µg/dL factor about 0.179 is reciprocal to the declared direction; the locked contract records about ×5.587.

### Measurement: sleep-duration-by-age

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 4 source objects are not exactly fetch-verified (fetch-verified, search-verified).

### Measurement: sodium

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: spo2

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 5 source objects are not exactly fetch-verified (blocked-cited, fetch-verified).

### Measurement: systolic-bp

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: tibc

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy µmol/L-to-µg/dL factor about 0.179 is reciprocal to the declared direction; the locked contract records about ×5.587.

### Measurement: total-cholesterol

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: total-protein

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy g/L-to-g/dL factor 10 is reversed under the locked directional equation; the contract records ×0.1.

### Measurement: total-water-intake

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: transferrin-saturation

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: triglycerides

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-LIBRARY-MERGE`: This row is an enrichment of an existing canonical measurement; it must be reviewed and merged as a new immutable revision, never inserted as a duplicate identity.

### Measurement: urine-acr

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: vldl-cholesterol

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-REVERSED`: Legacy mmol/L-to-mg/dL factor 0.02586 is reciprocal to the declared direction; the locked contract records about ×38.67.

### Measurement: waist-circumference

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 2 of 5 source objects are not exactly fetch-verified (blocked-cited, fetch-verified, search-verified).
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.

### Measurement: weight

- `CAT-MEAS-LEGACY-SHAPE`: This row is not a measurement-definition.v1 immutable revision and has no lifecycle/version/hash envelope.
- `CAT-MEAS-RANGE-STRUCTURE`: Reference ranges remain free text without stable IDs, exact boundary semantics, units, contexts, or interpretationOnly metadata.
- `CAT-MEAS-CLAIM-LINKS`: Numeric ranges, bounds, conversions, and derivations are not linked per value to stable source-claim IDs.
- `CAT-MEAS-REVIEW-EVIDENCE`: No qualified measurement-review identity, review hash, verified timestamp, expiry, or licensing disposition is present.
- `CAT-MEAS-SOURCE-REVERIFY`: 1 of 1 source objects are not exactly fetch-verified (search-verified).
- `CAT-MEAS-CONVERSION-SHAPE`: At least one conversion lacks explicit fromUnit, toUnit, factor, and offset fields under the locked directional equation.
- `CAT-MEAS-CONVERSION-SPECIAL`: The st+lb entry is a typed multi-component adapter, not a one-factor unit conversion.

## Safe next action

Select one record only after its source, licensing, conversion, mapping, applicability, and open-issue blockers are closed. Manually author it in Calculator Studio, bind approved immutable measurement revisions, add complete reviewer-approved source examples and boundary/missing/context tests, run all four validation layers, and obtain independent protected-hash medical approval before publication.

No historical source row was modified, and no database write was performed by this report.
