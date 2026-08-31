# Complete Source Analysis

> Deliverable 2. Every provided source, what it contains, and what was extracted. Transcription method: local Whisper (faster-whisper, CPU) — Hinglish audio, translate + native passes; raw timestamped transcripts preserved in [transcripts/](transcripts/). Transcription quality note: the audio is code-mixed Hindi-English processed with a compact on-device model; verbatim wording is approximate in places, so requirements were cross-checked across BOTH passes and against the brief, and anything still ambiguous is registered as Needs Clarification rather than guessed.

## Source 1 — Audio 1.ogg (114s, primary Niro source)

**Content:** assignment framing + the three shared references.

Extracted requirements/insights:
1. The assignment was deliberately designed to be "not very complicated", a **full-stack test that is "very close to what we do and still useful to us"** — not a throwaway theoretical exercise.
2. Working style: voice notes / discussion are the norm ("especially since it is remote").
3. Reference 1 — **NirogGyan biomarkers page**: content pages built by the company's program manager; **every page has proper meta information; it has helped SEO**, including "offbeat" (long-tail) biomarkers, not just common ones. Shared as the model for content + SEO.
4. Reference 2 — **the B2C tool (niro.health)**: work-in-progress, "semi success"; useful to "push our latest product" and features they can't ship in B2B. Shared as the product-experience reference.
5. Reference 3 — **Omni Calculator**: "a world-renowned collection of calculators… used in all these calculators" — the interaction/collection reference.
6. Ends: "I will share one more voice note."

## Source 2 — Audio 2.ogg (215s, primary Niro source — the core requirement note)

**Content:** company context, the actual product ask, working process, stakes.

Extracted requirements/insights:
1. **Company context:** "We make blood reports smart and patient-friendly." A **risk calculator already exists inside their reports**: with a health profile + available biomarkers they compute risk; **"partial risk score" is normal because a full lab report isn't always available**; a **consolidated wellness score ("your health score")** is produced — currently **internal to the report**.
2. **The Niro risk logic "covers 3 profiles"** (transcription garbled — registered NC-C10).
3. **The ask:** "Build something like the biomarkers page" — publicly searchable, **SEO-optimized**, "a collection of risk calculators", **"smarter, interlinked — not like Omni; Omni is reference, it's all purana (dated). We'll make something much smaller but it becomes a hub like Omni calculator. It has to look good, SEO optimized."**
4. **THE core architectural requirement (verbatim intent):** "Backend should be such that **creating a new calculator becomes very straightforward — even a non-tech guy can do that — calculator as well as associated content**. Like the heart risk calculator: it is the heart risk **with this content — the whole thing**." → self-serve builder must cover calculator logic AND its content page (description, education, SEO meta).
5. Role expectation: "You have to be a bit of an architect… frontend… **simple backend**."
6. **Process:** don't just deliver output — **start with the basics, present the approach, ask questions ("I can clear it for you"), deadline will be set**.
7. **Stakes:** "If you do a decent good job of it, **we can even start the internship with this**… cover a lot of the calculators — you can work with **two-three calculators**, but make the image very comprehensive and **attract a lot of traffic from all possible calculator-related traffic**."
8. **Tooling:** going the extra mile — "you can also use **Claude** or similar… you can also use **MCP**"; and **analyze which risk-calculator/question keywords exist so the calculator roadmap can be planned** (NC-C11 scope).

## Source 3 — Audio 3.ogg (43s, primary Niro source — scope boundary note)

Extracted requirements/insights:
1. **"All the calculators can be very independent of what NirogGyan does — at least for the assignment."** → build from scratch, no dependency on existing Niroggyan application code (matches master §17).
2. "If it is proper, we have to integrate it with the rest of our code — we will see" → clean modularity matters for possible future integration.
3. **"For now this is going to be a lead magnet — to bring traffic."** → product positioning confirmed: anonymous-first, shareable, SEO-first.
4. "Put your brains through it… if you want to take more time to do it properly, you can do that." → quality over speed.

## Source 4 — NIRO_Project_Source_Context_and_Implementation_Brief.txt (reference/context document — NOT source of truth)

Consolidates previously established Niro context. Used for: CWS structure (9 domains + weights, §4–5), calculation model (§7), categories (§8), adjustment factors (§6), UX hierarchy (§9), engine-separation principle (§10), MERN suggestion (§11), phase plan (§12–13), deliverable expectations (§14–15). Where it encodes Niro rules it is treated as the best available representation **pending verification against the primary Risk Logic Sheet/Doc**; where it conflicts with audio, audio wins (no conflicts found — the sources agree and complement).

## Source 5 — `Risk Analysis/` folder (ARRIVED 2026-08-18 — the primary risk-logic sources)

**5a. "Comprehensive Wellness Score Framework: A Point-Based Assessment of Health Parameters" (PDF, 18 pp)** — the complete CWS point system: all 38 parameter band/point tables (incl. negative protective points for HDL and physical activity, sex-specific bands, morning/afternoon cortisol), adjustment tables (age/BMI/smoking/activity), the domain/raw/final formulas and the 5 categories with interpretation + recommended-action text, plus per-band scientific citations. **Carries the embedded comment: "This has been rejected because of no stratified ranges available for client"** → configured as documented but gated on clarification N1. Full extraction: [research/niro-risk-logic-extraction.md](research/niro-risk-logic-extraction.md) §A.

**5b. "Risk calculators.xlsx" (3 sheets — the "3 profiles" from Audio 2):**
- **Hypothyroid** — additive risk factors (age/sex/family history/symptoms/autoimmune/TSH/T4-T3/antibodies, 5–20 pts each), categories 0–15/16–35/>35, evidence references (ITS, ATA 2021, NHANES, Indian prevalence studies).
- **Diabetes** — IDRS-based (age/waist/activity/family history) + glycemic component with the verbatim rule "Take only maximum of Hba1c, FBS, PP", explicit missing-data logic (Age mandatory; waist imputed 10 when glycemic ≥10; activity defaults Moderate), categories <40/40–70/>70 with escalation overrides.
- **Heart** — "Modified Cardiovascular Risk Engine": modified Framingham point tables (treated/untreated/missing SBP, HbA1c-based diabetic criterion, triglycerides addition), 26-row points→risk% lookup (worked example verified: 13 pts → 10%), young-age correction (S_lipid × M_young), isolated high-cholesterol floor penalties with verbatim patient messaging, final = max(adjusted, floor).

These sheets resolve C1–C3, C6, C8–C10 and introduce clarifications N1–N9 ([03-source-of-truth-matrix.md](03-source-of-truth-matrix.md)). All four Niro calculators are now expressed as platform configurations in [config-samples/](config-samples/).

## Source 6 — Reference websites (UI/UX references only)

| Site | Analyzed | Key takeaways |
|---|---|---|
| niroggyan.com/biomarkers | ✓ (fetched) | 243-biomarker directory; search + popular searches; A–Z + category + test-type facets; card → detail progressive disclosure; related-tests interlinking; strong meta/SEO discipline |
| niro.health | ✓ (meta/sitemap/bundle inspected; JS SPA) | Single-page product: Upload → Features → Testimonials → FAQ → Demo; "AI Lab Analyzer — 1000s of biomarkers, personalized regional ranges"; simple upload→analyze→understand journey; trust cues |
| omnicalculator.com/health | ✓ (fetched) | 439 calculators grouped by category with one-line descriptions; per-calculator page: inputs → calculate → result → explanation; the "hub" pattern to emulate at smaller, smarter, interlinked scale |

## Cross-source consistency check

Audio ⊆ brief ⊆ master requirements — no contradictions found. The audio adds product positioning (lead magnet, SEO hub, non-tech authoring incl. content, independence from existing code, 2–3 calculators to start) that the brief lacks; the brief adds the CWS numeric structure the audio doesn't state; the master requirements define the platform architecture bar (config-driven, versioned, auditable). All three agree on: MERN, simplicity over over-engineering, deterministic auditable scoring, source-traceable medical data.
