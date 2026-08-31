import os
import subprocess
import sys

html_content = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>14 - Priority-wise Execution Plan</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    @page {
        size: A4 portrait;
        margin: 14mm 14mm 16mm 14mm;
        @bottom-right {
            content: "Page " counter(page) " of " counter(pages);
            font-family: 'Inter', sans-serif;
            font-size: 8pt;
            color: #64748B;
        }
    }

    * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        color: #1E293B;
        background-color: #FFFFFF;
        line-height: 1.5;
        font-size: 9.5pt;
        margin: 0;
        padding: 0;
    }

    /* Cover / Header Section */
    .header-card {
        background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
        color: #FFFFFF;
        padding: 24px 28px;
        border-radius: 12px;
        margin-bottom: 20px;
        box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15);
        border: 1px solid #334155;
    }

    .header-badge-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
    }

    .header-tag {
        background: rgba(13, 148, 136, 0.2);
        color: #2DD4BF;
        border: 1px solid rgba(45, 212, 191, 0.4);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 8pt;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .header-date {
        font-size: 8pt;
        color: #94A3B8;
    }

    .header-card h1 {
        margin: 0 0 8px 0;
        font-size: 20pt;
        font-weight: 800;
        letter-spacing: -0.5px;
        color: #F8FAFC;
    }

    .header-card p.subtitle {
        margin: 0 0 14px 0;
        font-size: 10pt;
        color: #CBD5E1;
        line-height: 1.4;
    }

    .principle-box {
        background: rgba(255, 255, 255, 0.07);
        border-left: 3.5px solid #0EA5E9;
        padding: 10px 14px;
        border-radius: 0 8px 8px 0;
        font-size: 8.5pt;
        color: #E2E8F0;
    }

    .principle-box strong {
        color: #38BDF8;
    }

    /* Section Headings */
    h2.section-title {
        font-size: 13pt;
        font-weight: 700;
        color: #0F172A;
        border-bottom: 2px solid #E2E8F0;
        padding-bottom: 6px;
        margin: 22px 0 14px 0;
        display: flex;
        align-items: center;
        gap: 8px;
        letter-spacing: -0.3px;
        page-break-after: avoid;
    }

    h2.section-title .icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        background: #EFF6FF;
        color: #2563EB;
        border-radius: 6px;
        font-size: 10pt;
    }

    /* Phase Map Diagram Styling */
    .phase-map-container {
        background: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 20px;
        page-break-inside: avoid;
    }

    .diagram-svg {
        width: 100%;
        height: auto;
    }

    .critical-path-bar {
        margin-top: 12px;
        background: #FEF3C7;
        border: 1px solid #FCD34D;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 8.5pt;
        color: #92400E;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .critical-path-bar strong {
        color: #78350F;
        font-weight: 700;
    }

    .parallel-tracks-note {
        margin-top: 8px;
        font-size: 8pt;
        color: #475569;
        line-height: 1.4;
    }

    /* Phase Cards Grid & Single Layout */
    .phase-card {
        background: #FFFFFF;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        margin-bottom: 14px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        page-break-inside: avoid;
        overflow: hidden;
    }

    .phase-card.completed {
        border-left: 4px solid #10B981;
    }

    .phase-card.in-progress {
        border-left: 4px solid #0EA5E9;
    }

    .phase-card.planned {
        border-left: 4px solid #6366F1;
    }

    .phase-card.critical-gate {
        border-left: 4px solid #F59E0B;
        background: #FFFBEE;
    }

    .phase-header {
        padding: 10px 14px;
        background: #F8FAFC;
        border-bottom: 1px solid #E2E8F0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .phase-card.completed .phase-header {
        background: #F0FDF4;
    }

    .phase-card.critical-gate .phase-header {
        background: #FEF3C7;
    }

    .phase-title-group {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .phase-num {
        font-weight: 800;
        font-size: 10pt;
        color: #0F172A;
    }

    .phase-name {
        font-weight: 700;
        font-size: 10.5pt;
        color: #1E293B;
    }

    .status-badge {
        font-size: 7.5pt;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }

    .status-badge.complete {
        background: #D1FAE5;
        color: #065F46;
        border: 1px solid #A7F3D0;
    }

    .status-badge.next {
        background: #E0F2FE;
        color: #075985;
        border: 1px solid #BAE6FD;
    }

    .status-badge.planned {
        background: #EEF2FF;
        color: #3730A3;
        border: 1px solid #C7D2FE;
    }

    .status-badge.gate {
        background: #FEF3C7;
        color: #92400E;
        border: 1px solid #FDE68A;
    }

    .phase-body {
        padding: 12px 14px;
    }

    .phase-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 14px;
    }

    .full-width {
        grid-column: span 2;
    }

    .field-label {
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748B;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
    }

    .field-value {
        font-size: 8.8pt;
        color: #334155;
        line-height: 1.45;
    }

    .field-value ul {
        margin: 2px 0 0 0;
        padding-left: 16px;
    }

    .field-value li {
        margin-bottom: 2px;
    }

    .deliverables-list {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 3px;
    }

    .deliverable-chip {
        font-family: 'JetBrains Mono', monospace;
        font-size: 7.5pt;
        background: #F1F5F9;
        color: #0F172A;
        border: 1px solid #E2E8F0;
        padding: 2px 6px;
        border-radius: 4px;
    }

    .dod-box {
        background: #F8FAFC;
        border: 1px dashed #CBD5E1;
        padding: 6px 10px;
        border-radius: 6px;
        margin-top: 4px;
        font-size: 8.5pt;
    }

    .blocker-alert {
        background: #FEF2F2;
        border-left: 3px solid #EF4444;
        padding: 6px 10px;
        border-radius: 0 6px 6px 0;
        margin-top: 6px;
        font-size: 8.3pt;
        color: #991B1B;
    }

    .gate-highlight {
        background: #FFFBEB;
        border: 1.5px solid #F59E0B;
        border-radius: 8px;
        padding: 10px 12px;
        margin-top: 8px;
    }

    .gate-highlight-title {
        font-weight: 800;
        font-size: 8.5pt;
        color: #B45309;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
    }

    /* Global DOD & Hiring Framing Cards */
    .callout-card {
        background: #F8FAFC;
        border: 1px solid #CBD5E1;
        border-radius: 10px;
        padding: 14px 16px;
        margin-bottom: 16px;
        page-break-inside: avoid;
    }

    .callout-card.accent-purple {
        border-left: 4px solid #8B5CF6;
        background: #FAF5FF;
    }

    .callout-card.accent-emerald {
        border-left: 4px solid #10B981;
        background: #ECFDF5;
    }

    .callout-title {
        font-size: 10pt;
        font-weight: 700;
        color: #0F172A;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .dod-ol {
        margin: 0;
        padding-left: 18px;
        font-size: 8.8pt;
    }

    .dod-ol li {
        margin-bottom: 4px;
        color: #1E293B;
    }

    /* Table Styling */
    table.data-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        font-size: 8.3pt;
        page-break-inside: avoid;
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid #E2E8F0;
    }

    table.data-table th {
        background: #0F172A;
        color: #FFFFFF;
        text-align: left;
        padding: 8px 10px;
        font-weight: 600;
        font-size: 8pt;
        letter-spacing: 0.3px;
    }

    table.data-table td {
        padding: 8px 10px;
        border-bottom: 1px solid #E2E8F0;
        color: #334155;
        vertical-align: top;
    }

    table.data-table tr:nth-child(even) {
        background-color: #F8FAFC;
    }

    table.data-table tr:last-child td {
        border-bottom: none;
    }

    .type-badge {
        display: inline-block;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 7.3pt;
        font-weight: 600;
        white-space: nowrap;
    }

    .type-badge.external { background: #FEF2F2; color: #991B1B; border: 1px solid #FCA5A5; }
    .type-badge.spec { background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; }
    .type-badge.medical { background: #EFF6FF; color: #1E40AF; border: 1px solid #93C5FD; }
    .type-badge.security { background: #FAF5FF; color: #6B21A8; border: 1px solid #E9D5FF; }
    .type-badge.scope { background: #F3F4F6; color: #374151; border: 1px solid #D1D5DB; }

    .footer-note {
        text-align: center;
        font-size: 7.5pt;
        color: #94A3B8;
        margin-top: 24px;
        padding-top: 8px;
        border-top: 1px solid #E2E8F0;
    }
</style>
</head>
<body>

    <!-- Header Section -->
    <div class="header-card">
        <div class="header-badge-row">
            <span class="header-tag">Deliverables 21–25 + 28</span>
            <span class="header-date">Platform Blueprint | MERN Architecture</span>
        </div>
        <h1>Priority-wise Execution Plan</h1>
        <p class="subtitle">Dependency-aware, phase-gated roadmap for building the reusable health calculator platform on MERN stack.</p>
        <div class="principle-box">
            <strong>Core Architectural Mandate (§15):</strong> Generic platform primitives are built before any calculator content. The Niro CWS itself validates the generic platform — never build hard-coded-Niro-first.
        </div>
    </div>

    <!-- Phase Map Section -->
    <h2 class="section-title">
        <span class="icon">🗺️</span> Phase Map & Critical Path
    </h2>

    <div class="phase-map-container">
        <svg class="diagram-svg" viewBox="0 0 820 250" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748B"/>
                </marker>
                <marker id="arrow-crit" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#0284C7"/>
                </marker>
            </defs>

            <!-- Row 1: Package Foundation (P1, P2, P3) -->
            <g transform="translate(10, 15)">
                <rect x="0" y="0" width="240" height="42" rx="6" fill="#ECFDF5" stroke="#10B981" stroke-width="1.5"/>
                <text x="12" y="18" font-family="Inter" font-size="9" font-weight="bold" fill="#065F46">P1 Source & Req Analysis ✅</text>
                <text x="12" y="32" font-family="Inter" font-size="7.5" fill="#047857">Transcripts, Brief & SOT Matrix</text>
            </g>

            <g transform="translate(290, 15)">
                <rect x="0" y="0" width="240" height="42" rx="6" fill="#ECFDF5" stroke="#10B981" stroke-width="1.5"/>
                <text x="12" y="18" font-family="Inter" font-size="9" font-weight="bold" fill="#065F46">P2 Trusted Medical Verification ✅</text>
                <text x="12" y="32" font-family="Inter" font-size="7.5" fill="#047857">4 Research Passes + Sources</text>
            </g>

            <g transform="translate(570, 15)">
                <rect x="0" y="0" width="240" height="42" rx="6" fill="#ECFDF5" stroke="#10B981" stroke-width="1.5"/>
                <text x="12" y="18" font-family="Inter" font-size="9" font-weight="bold" fill="#065F46">P3 Biomarker Dataset & Rules ✅</text>
                <text x="12" y="32" font-family="Inter" font-size="7.5" fill="#047857">38 Biomarkers + Config Samples</text>
            </g>

            <!-- Arrows Row 1 -->
            <line x1="250" y1="36" x2="284" y2="36" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow)"/>
            <line x1="530" y1="36" x2="564" y2="36" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow)"/>

            <!-- Connector Down to Platform Core -->
            <path d="M 690 57 L 690 75 L 130 75 L 130 93" fill="none" stroke="#0284C7" stroke-width="2" stroke-dasharray="4,4" marker-end="url(#arrow-crit)"/>

            <!-- Row 2: Platform Primitives (P4, P5, P6) -->
            <g transform="translate(10, 95)">
                <rect x="0" y="0" width="240" height="42" rx="6" fill="#F0F9FF" stroke="#0284C7" stroke-width="2"/>
                <text x="12" y="18" font-family="Inter" font-size="9" font-weight="bold" fill="#075985">P4 Architecture & Data Model</text>
                <text x="12" y="32" font-family="Inter" font-size="7.5" fill="#0369A1">MERN Monorepo + Mongoose</text>
            </g>

            <g transform="translate(290, 95)">
                <rect x="0" y="0" width="240" height="42" rx="6" fill="#F0F9FF" stroke="#0284C7" stroke-width="2"/>
                <text x="12" y="18" font-family="Inter" font-size="9" font-weight="bold" fill="#075985">P5 Config Model + Validator</text>
                <text x="12" y="32" font-family="Inter" font-size="7.5" fill="#0369A1">JSON-Schema & Validator Engine</text>
            </g>

            <g transform="translate(570, 95)">
                <rect x="0" y="0" width="240" height="42" rx="6" fill="#F0F9FF" stroke="#0284C7" stroke-width="2"/>
                <text x="12" y="18" font-family="Inter" font-size="9" font-weight="bold" fill="#075985">P6 Generic Rule/Formula Engine</text>
                <text x="12" y="32" font-family="Inter" font-size="7.5" fill="#0369A1">10-Stage Deterministic Pipeline</text>
            </g>

            <!-- Arrows Row 2 -->
            <line x1="250" y1="116" x2="284" y2="116" stroke="#0284C7" stroke-width="2" marker-end="url(#arrow-crit)"/>
            <line x1="530" y1="116" x2="564" y2="116" stroke="#0284C7" stroke-width="2" marker-end="url(#arrow-crit)"/>

            <!-- Row 3: Renderer, Builder, Backend, Config (P7, P8, P10, P9) -->
            <!-- P10 Backend -->
            <g transform="translate(570, 175)">
                <rect x="0" y="0" width="240" height="40" rx="6" fill="#F5F3FF" stroke="#7C3AED" stroke-width="2"/>
                <text x="12" y="16" font-family="Inter" font-size="9" font-weight="bold" fill="#5B21B6">P10 Backend Integration (APIs)</text>
                <text x="12" y="30" font-family="Inter" font-size="7.5" fill="#6D28D9">REST Endpoints + ETag Caching</text>
            </g>

            <!-- P7 Dynamic Renderer -->
            <g transform="translate(10, 175)">
                <rect x="0" y="0" width="240" height="40" rx="6" fill="#FAF5FF" stroke="#8B5CF6" stroke-width="1.5"/>
                <text x="12" y="16" font-family="Inter" font-size="9" font-weight="bold" fill="#6B21A8">P7 Dynamic React Renderer</text>
                <text x="12" y="30" font-family="Inter" font-size="7.5" fill="#7E22CE">Config-Driven UI Components</text>
            </g>

            <!-- P8 Admin Builder -->
            <g transform="translate(290, 175)">
                <rect x="0" y="0" width="240" height="40" rx="6" fill="#FAF5FF" stroke="#8B5CF6" stroke-width="1.5"/>
                <text x="12" y="16" font-family="Inter" font-size="9" font-weight="bold" fill="#6B21A8">P8 Admin Calculator Builder</text>
                <text x="12" y="30" font-family="Inter" font-size="7.5" fill="#7E22CE">Self-Serve Visual Config Builder</text>
            </g>

            <!-- Flow Connections Row 2 to Row 3 -->
            <path d="M 690 137 L 690 170" fill="none" stroke="#0284C7" stroke-width="2" marker-end="url(#arrow-crit)"/>
            <path d="M 410 137 L 410 155 L 130 155 L 130 170" fill="none" stroke="#64748B" stroke-width="1.5" marker-end="url(#arrow)"/>
            <path d="M 130 215 L 130 230 L 710 230 L 710 215" fill="none" stroke="#0284C7" stroke-width="2"/>
        </svg>

        <div class="critical-path-bar">
            <strong>🎯 Critical Path:</strong>
            <span>P1 → P4 → P5 → P6 → P10 → P7 → P9 → P11 → P12</span>
        </div>

        <div class="parallel-tracks-note">
            <strong>Parallel Tracks:</strong> P7 UI exploration starts after P5 schema freeze; P8 starts once P5+P7 exist; P2/P3 medical content runs beside P4–P6 platform code; Biomarker library pages develop alongside P7.
        </div>
    </div>

    <!-- Phase Details -->
    <h2 class="section-title">
        <span class="icon">📦</span> Phase Details & Execution Specifications
    </h2>

    <!-- Phase 1 -->
    <div class="phase-card completed">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 1</span>
                <span class="phase-name">Source & Requirement Analysis</span>
            </div>
            <span class="status-badge complete">✅ Completed</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Extract every requirement and calculation rule from Niro sources; classify by authoritative source.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="deliverables-list">
                        <span class="deliverable-chip">01-project-understanding.md</span>
                        <span class="deliverable-chip">02-source-analysis.md</span>
                        <span class="deliverable-chip">03-source-of-truth-matrix.md</span>
                    </div>
                </div>
                <div class="full-width">
                    <div class="field-label">Key Tasks & Verification</div>
                    <div class="field-value">
                        Analyze brief and 3 reference websites; construct Source-of-Truth matrix; register all requirement gaps in Needs Clarification register.
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> Requirements fully documented; all gaps registered as Needs Clarification. Every downstream artifact explicitly cites its source class.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 2 -->
    <div class="phase-card completed">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 2</span>
                <span class="phase-name">Trusted Medical Data Verification</span>
            </div>
            <span class="status-badge complete">✅ Completed</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Establish authoritative medical reference values for every biomarker fact not provided by Niro sources.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="deliverables-list">
                        <span class="deliverable-chip">04-trusted-medical-sources.md</span>
                        <span class="deliverable-chip">research/ (4 passes)</span>
                    </div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks & Verification</div>
                    <div class="field-value">
                        Executed 4 systematic research passes (Cardio+Metabolic, Inflammatory+Liver, Nutritional+Hematology, Kidney+Thyroid+Hormonal). Recorded Org, Title, URL, Section, and Date. Every value traceable directly to fetched content.
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> 38 biomarkers + 4 demographic adjustment factors covered or explicitly tagged NC. Conflicts documented separately, never arbitrarily merged.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 3 -->
    <div class="phase-card completed">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 3</span>
                <span class="phase-name">Biomarker Dataset & Rule Mapping</span>
            </div>
            <span class="status-badge complete">✅ Completed</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Create implementation-ready biomarker library and platform calculator configuration rules.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="deliverables-list">
                        <span class="deliverable-chip">05-biomarker-dataset.md</span>
                        <span class="deliverable-chip">06-biomarker-reference.md</span>
                        <span class="deliverable-chip">biomarker-dataset.json</span>
                        <span class="deliverable-chip">niro-cws.config.json</span>
                        <span class="deliverable-chip">covid-risk.config.json</span>
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> Every biomarker contains domain, standard units + conversion factors, external anchor points with citations, demographic rules, and NC tags for Niro-specific rules.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 4 -->
    <div class="phase-card in-progress">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 4</span>
                <span class="phase-name">Platform Architecture & Data Model</span>
            </div>
            <span class="status-badge next">▶ Next Up</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Codify the designed architecture in a fresh MERN monorepo bootstrap.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">Running skeleton, Mongoose schemas, seed scripts, ESLint/Prettier setup.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks & Dependencies</div>
                    <div class="field-value">
                        Repo scaffold (`client/`, `server/`, `server/engine/`); Express skeleton + healthz; MongoDB connection + Mongoose models per `09-mongodb-data-model.md`. <em>Dep: P1.</em>
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> `npm run dev` boots client + server cleanly; `/healthz` returns green; database seed populates biomarker library successfully.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 5 -->
    <div class="phase-card planned">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 5</span>
                <span class="phase-name">Generic Calculator Configuration Model</span>
            </div>
            <span class="status-badge planned">Planned</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Define and enforce the formal configuration contract interpreted by renderer and engine.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">JSON-Schema + `configValidator` + Version Lifecycle Service + Unit Tests.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks & Verification</div>
                    <div class="field-value">
                        Build JSON-Schema for CalculatorVersion; write `configValidator` (weights sum, band coverage, formula parsing, cycle detection); immutability & rollback service. <em>Verification: Validator rejects 20+ crafted bad configs.</em>
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> Both sample configs (Niro CWS + COVID Demo) validate cleanly; publish/rollback round-trips correctly; audit log entries created.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 6 -->
    <div class="phase-card planned">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 6</span>
                <span class="phase-name">Generic Rule / Formula Engine</span>
            </div>
            <span class="status-badge planned">Planned</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Build the 10-stage deterministic calculation pipeline (`13-calculation-engine-design.md`).</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">`server/engine/` pure module with ≥95% branch coverage.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Pipeline Stages</div>
                    <div class="field-value">
                        Condition DSL interpreter → Unit normalizer → Derived-parameter resolver (topo sort) → Band/Option scorer → Domain aggregator → Weighted raw score → Adjustments → Categorizer → Contributor ranking → Audit trace builder.
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> Engine executes both sample configs with <strong>zero calculator-specific code</strong> (grep-proof: zero "niro" or "covid" strings inside `engine/`).
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 7 -->
    <div class="phase-card planned">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 7</span>
                <span class="phase-name">Dynamic React Calculator Renderer</span>
            </div>
            <span class="status-badge planned">Planned</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Single React application capable of rendering form & results for any published configuration.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">Dynamic Field Registry, Result Block Registry, Library pages, Accessibility compliance.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks & Verification</div>
                    <div class="field-value">
                        Field types (number, select, radio, boolean + unit switcher); FieldShell with help/skip; multi-step form; result widgets (gauges, category, contributors, breakdown). Renders BOTH sample configs without UI code changes.
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> Niro CWS and COVID demo forms + result views fully render from JSON config alone.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 8 -->
    <div class="phase-card planned">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 8</span>
                <span class="phase-name">Admin Calculator Builder</span>
            </div>
            <span class="status-badge planned">Planned</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Self-serve visual builder: Create/Edit → Validate → Preview → Test → Publish (`12-admin-calculator-builder.md`).</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">Admin UI suite, visual condition & band editors, real-time preview API integration.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks & Verification</div>
                    <div class="field-value">
                        Auth (JWT/roles); 5-step workspace; condition builder; band editor with context tabs; source-tagging; test-case runner; publish/rollback controls. Build COVID calculator end-to-end solely via Admin UI.
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> Non-developer walkthrough script can create a new calculator without touching code.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 9 -->
    <div class="phase-card planned">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 9</span>
                <span class="phase-name">Niro Calculator Configuration (Data, Not Code)</span>
            </div>
            <span class="status-badge planned">Planned</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Production Niro CWS configured purely as data payload.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">Production `niro-cws.config.json` + closed clarifications C1–C6 + stored test cases.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks & Sheet Arrival Workflow</div>
                    <div class="field-value">
                        Seed initial config. <strong>When Niro Risk Logic Sheet arrives:</strong> update interim bands/points via Builder UI, link cell references, close clarifications C1–C6, and save worked examples as test cases.
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> Stored test cases reproduce sheet worked examples exactly; every band carries an explicit source reference.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 10 -->
    <div class="phase-card planned">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 10</span>
                <span class="phase-name">Backend Integration (APIs)</span>
            </div>
            <span class="status-badge planned">Planned</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Implement API surface specified in `10-api-specification.md`.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">Express REST endpoints, Supertest suite, ETag cache layer, audit middleware.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks & Verification</div>
                    <div class="field-value">
                        Public routes (`/config`, `/assess`, `/results`, `/biomarkers`); Admin draft/publish routes; validation middleware; rate limiting; ETag config caching. <em>Verification: Supertest suite covering 422 errors, 409 immutability, cache invalidation.</em>
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> All endpoints deterministic & green; assessment latency p95 &lt; 300 ms locally.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 11 -->
    <div class="phase-card critical-gate">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 11</span>
                <span class="phase-name">Testing & End-to-End QA</span>
            </div>
            <span class="status-badge gate">⚡ CRITICAL REUSABILITY GATE</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Prove mathematical correctness, platform robustness, AND true reusability.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">Full test matrix (Unit, API, Component, E2E) + Reusability Gate Evidence.</div>
                </div>
                <div class="full-width">
                    <div class="gate-highlight">
                        <div class="gate-highlight-title">🏆 THE REUSABILITY GATE (Master §16 Exam)</div>
                        <div class="field-value">
                            Create the 2nd calculator (COVID Risk) <strong>through the Admin Builder UI only</strong>, publish, and complete assessment publicly — while CI verifies <strong>ZERO diffs</strong> in `engine/` or `renderer/` core code.
                        </div>
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> All automated test suites green; Reusability Gate passes with video recording & clean CI diff check.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Phase 12 -->
    <div class="phase-card planned">
        <div class="phase-header">
            <div class="phase-title-group">
                <span class="phase-num">Phase 12</span>
                <span class="phase-name">Final Polish & Release Readiness</span>
            </div>
            <span class="status-badge planned">Planned</span>
        </div>
        <div class="phase-body">
            <div class="phase-grid">
                <div>
                    <div class="field-label">Objective</div>
                    <div class="field-value">Deliver production-grade, reviewer-ready release package.</div>
                </div>
                <div>
                    <div class="field-label">Deliverables</div>
                    <div class="field-value">Polished repository, complete documentation, setup scripts, version tags.</div>
                </div>
                <div class="full-width">
                    <div class="field-label">Tasks</div>
                    <div class="field-value">
                        UI polish; a11y audit (axe + keyboard); disclaimer/source label review; bundle optimization; comprehensive README with setup, architecture guide, walkthrough demo script, and test evidence.
                    </div>
                </div>
                <div class="full-width">
                    <div class="dod-box">
                        <strong>Definition of Done:</strong> A reviewer can clone repo → `npm install` → seed → run → complete both calculators and build a custom calculator using only the README.
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Global DOD Section -->
    <h2 class="section-title">
        <span class="icon">✅</span> Global Definition of Done (Release Gates)
    </h2>

    <div class="callout-card accent-emerald">
        <div class="callout-title">
            <span>Core Quality Gates</span>
        </div>
        <ol class="dod-ol">
            <li><strong>Single Core Pipeline:</strong> Both Niro CWS and COVID calculators execute through identical core code without custom branching (CI verified).</li>
            <li><strong>Traceability:</strong> Every medical value on screen traces back to an explicit Niro source, external medical authority, or NC label.</li>
            <li><strong>Determinism & Auditability:</strong> Every published result is 100% reproducible from `calculatorVersionId` + `engineVersion` + exact user inputs.</li>
            <li><strong>Zero-Deploy Updates:</strong> Admins can edit score thresholds or bands via Admin UI and observe live changes without code deployment.</li>
            <li><strong>Success Criteria Alignment:</strong> All 10 success-criteria questions (§20) answer YES (mapped in `16-testing-strategy.md`).</li>
        </ol>
    </div>

    <!-- Hiring Assignment Section -->
    <h2 class="section-title">
        <span class="icon">💼</span> Hiring Assignment Evaluation Framing
    </h2>

    <div class="callout-card accent-purple">
        <div class="callout-title">
            <span>Evaluation Mapping (§17)</span>
        </div>
        <div class="field-value">
            The candidate builds P4–P12 from scratch without pre-existing code. Submission includes GitHub repo, working MERN implementation, setup/architecture documentation, walkthrough script, and test evidence.
            <br/><br/>
            <strong>Review Rubric Direct Mapping:</strong> Parameter-driven design (P5/P6) • Ease of adding new calculators (P8 + Reusability Gate) • Rule/Formula engine quality (P6) • MERN full-stack execution (P4/P7/P10) • UI/UX polish & accessibility (P7) • Automated testing coverage (P11) • Technical documentation (P12).
        </div>
    </div>

    <div class="footer-note">
        Generated from <code>14-execution-plan.md</code> • Athnect Health Calculator Platform Architecture
    </div>

</body>
</html>
"""

html_path = r"c:\athnect\deliverables\14-execution-plan.html"
pdf_path = r"c:\athnect\deliverables\14-execution-plan.pdf"

with open(html_path, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"HTML generated at: {html_path}")

edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
file_url = "file:///" + html_path.replace("\\", "/")
cmd = [
    edge_path,
    "--headless",
    "--disable-gpu",
    "--no-pdf-header-footer",
    f"--print-to-pdf={pdf_path}",
    file_url
]

print("Running Edge print to PDF command...")
res = subprocess.run(cmd, capture_output=True, text=True)
print("Return code:", res.returncode)
print("Stdout:", res.stdout)
print("Stderr:", res.stderr)

if os.path.exists(pdf_path):
    size = os.path.getsize(pdf_path)
    print(f"SUCCESS: PDF created successfully at {pdf_path} (Size: {size} bytes)")
else:
    print("ERROR: PDF creation failed.")
