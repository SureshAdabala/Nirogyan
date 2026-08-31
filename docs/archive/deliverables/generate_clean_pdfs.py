import os
import subprocess

# HTML Template for 08-architecture-diagram (B&W, Single Page)
arch_html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>08 - System Architecture Overview</title>
<style>
    @page {
        size: A4 portrait;
        margin: 12mm 15mm;
    }
    * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    body {
        font-family: Arial, Helvetica, sans-serif;
        color: #000000;
        background: #ffffff;
        font-size: 9pt;
        line-height: 1.35;
        margin: 0;
        padding: 0;
    }
    h1 {
        font-size: 16pt;
        margin: 0 0 2px 0;
        font-weight: bold;
        color: #000000;
    }
    .subtitle {
        font-size: 9pt;
        font-style: italic;
        color: #333333;
        margin-bottom: 10px;
        border-bottom: 1px solid #000000;
        padding-bottom: 4px;
    }
    h2 {
        font-size: 11pt;
        margin: 10px 0 4px 0;
        font-weight: bold;
        border-bottom: 1px solid #cccccc;
        padding-bottom: 2px;
    }
    p {
        margin: 0 0 6px 0;
    }
    .diagram-box {
        border: 1px solid #000000;
        padding: 8px 12px;
        margin: 8px 0;
        background: #fafafa;
        text-align: center;
        font-family: monospace;
        font-size: 8.5pt;
    }
    .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-top: 6px;
    }
    .card {
        border: 1px solid #cccccc;
        padding: 6px 8px;
        border-radius: 4px;
        background: #ffffff;
    }
    .card-title {
        font-weight: bold;
        font-size: 9pt;
        margin-bottom: 3px;
        border-bottom: 1px stroke #eeeeee;
    }
    ul {
        margin: 2px 0 0 0;
        padding-left: 14px;
    }
    li {
        margin-bottom: 2px;
    }
    .benefits-list {
        margin-top: 4px;
    }
</style>
</head>
<body>

    <h1>System Architecture Overview</h1>
    <div class="subtitle">Non-Technical Guide — How the Health Calculator Platform Works</div>

    <h2>1. Core Concept</h2>
    <p>The platform is designed as a single reusable engine. Instead of writing custom software code for every new health test, the system reads a structured configuration document. Adding a new calculator (such as Niro CWS or COVID Risk) requires creating a configuration file, not writing new code.</p>

    <h2>2. System Flow Diagram</h2>
    <div class="diagram-box">
        [User Input Form] ──► [Rule & Formula Engine] ──► [Health Assessment Report]<br>
                                     ▲<br>
                                     │ (loads config)<br>
        [Admin Builder] ──────► [Database Vault]
    </div>

    <h2>3. The Four Key Components</h2>
    <div class="grid">
        <div class="card">
            <div class="card-title">1. User Interface</div>
            <ul>
                <li>Renders questions, options, and unit selectors dynamically from configuration.</li>
                <li>Displays calculated scores, risk categories, domain breakdowns, and recommendations.</li>
                <li>Adapts automatically whenever a calculator configuration is updated.</li>
            </ul>
        </div>
        <div class="card">
            <div class="card-title">2. Admin Builder</div>
            <ul>
                <li>Provides a visual interface for non-technical team members to create and edit calculators.</li>
                <li>Allows configuring parameters, unit conversions, scoring bands, and display layouts.</li>
                <li>Includes a validator to check for errors before publishing.</li>
            </ul>
        </div>
        <div class="card">
            <div class="card-title">3. Rule and Formula Engine</div>
            <ul>
                <li>Evaluates user inputs through a deterministic calculation pipeline.</li>
                <li>Normalizes units, computes derived values, scores bands, and ranks risk contributors.</li>
                <li>Operates independently of specific calculator logic to ensure complete reusability.</li>
            </ul>
        </div>
        <div class="card">
            <div class="card-title">4. Database Vault</div>
            <ul>
                <li>Stores standard biomarker definitions, calculator configurations, and assessment history.</li>
                <li>Maintains version control so every published result can be recreated accurately.</li>
                <li>Ensures data integrity and security.</li>
            </ul>
        </div>
    </div>

    <h2>4. Key System Benefits</h2>
    <ul class="benefits-list">
        <li><strong>Zero-Code Expansion:</strong> New calculators are added by creating configuration data rather than editing core code.</li>
        <li><strong>Fast Evaluation:</strong> Calculates results in under 0.3 seconds.</li>
        <li><strong>Full Traceability:</strong> Every score traces directly to verified reference logic.</li>
    </ul>

</body>
</html>
"""

# HTML Template for 14-execution-plan (B&W, Single Page)
plan_html = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>14 - Project Execution Plan</title>
<style>
    @page {
        size: A4 portrait;
        margin: 12mm 15mm;
    }
    * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    body {
        font-family: Arial, Helvetica, sans-serif;
        color: #000000;
        background: #ffffff;
        font-size: 9pt;
        line-height: 1.35;
        margin: 0;
        padding: 0;
    }
    h1 {
        font-size: 16pt;
        margin: 0 0 2px 0;
        font-weight: bold;
        color: #000000;
    }
    .subtitle {
        font-size: 9pt;
        font-style: italic;
        color: #333333;
        margin-bottom: 10px;
        border-bottom: 1px solid #000000;
        padding-bottom: 4px;
    }
    h2 {
        font-size: 11pt;
        margin: 10px 0 4px 0;
        font-weight: bold;
        border-bottom: 1px solid #cccccc;
        padding-bottom: 2px;
    }
    ul {
        margin: 2px 0 6px 0;
        padding-left: 14px;
    }
    li {
        margin-bottom: 2px;
    }
    .phase-block {
        border: 1px solid #cccccc;
        padding: 6px 10px;
        margin-bottom: 8px;
        border-radius: 4px;
        background: #ffffff;
    }
    .phase-title {
        font-weight: bold;
        font-size: 9.5pt;
        margin-bottom: 3px;
        border-bottom: 1px stroke #eeeeee;
    }
    .phase-detail {
        margin-bottom: 2px;
    }
    .outcome-box {
        margin-top: 3px;
        font-weight: bold;
        background: #fafafa;
        padding: 3px 6px;
        border: 1px dashed #aaaaaa;
        border-radius: 3px;
    }
</style>
</head>
<body>

    <h1>Project Execution Plan</h1>
    <div class="subtitle">Non-Technical Guide — Four-Phase Outcome-Focused Delivery Plan</div>

    <h2>1. Roadmap Overview</h2>
    <ul>
        <li><strong>Phase 1:</strong> Research and Medical Rules Foundation</li>
        <li><strong>Phase 2:</strong> Engine and Database Build</li>
        <li><strong>Phase 3:</strong> User App and Admin Builder</li>
        <li><strong>Phase 4:</strong> Testing and Final Launch</li>
    </ul>

    <h2>2. Phase Details and Outcomes</h2>

    <div class="phase-block">
        <div class="phase-title">Phase 1: Research and Medical Rules Foundation</div>
        <div class="phase-detail"><strong>Tasks:</strong> Analyze project brief and reference sites; verify 38 biomarkers against medical sources; create standard biomarker reference dataset.</div>
        <div class="phase-detail"><strong>Deliverables:</strong> Project understanding document, source analysis, medical source references, and initial calculator configuration samples.</div>
        <div class="outcome-box">Outcome: Verified medical rulebook and reference datasets ready for system construction.</div>
    </div>

    <div class="phase-block">
        <div class="phase-title">Phase 2: Engine and Database Build</div>
        <div class="phase-detail"><strong>Tasks:</strong> Set up database schemas; build configuration validator service; build 10-stage calculation engine.</div>
        <div class="phase-detail"><strong>Deliverables:</strong> Database models, validator module, pure calculation engine module, and unit test suite.</div>
        <div class="outcome-box">Outcome: Working calculation engine that evaluates health scores in under 0.3 seconds.</div>
    </div>

    <div class="phase-block">
        <div class="phase-title">Phase 3: User App and Admin Builder</div>
        <div class="phase-detail"><strong>Tasks:</strong> Build dynamic React user form and results renderer; build visual Admin Builder interface; integrate REST APIs.</div>
        <div class="phase-detail"><strong>Deliverables:</strong> Dynamic web application, Admin Builder UI, and public/admin API endpoints.</div>
        <div class="outcome-box">Outcome: Functional web application and no-code administration panel for managing calculators.</div>
    </div>

    <div class="phase-block">
        <div class="phase-title">Phase 4: Testing and Final Launch</div>
        <div class="phase-detail"><strong>Tasks:</strong> Perform unit, API, component, and end-to-end testing; execute reusability check by building a second calculator via Admin UI only; prepare release documentation.</div>
        <div class="phase-detail"><strong>Deliverables:</strong> Completed test suite, reusability verification evidence, and release setup documentation.</div>
        <div class="outcome-box">Outcome: Fully tested, production-ready platform with proven zero-code calculator creation.</div>
    </div>

    <h2>3. Final Delivery Principles</h2>
    <ul>
        <li><strong>Zero-Code Updates:</strong> Adding or updating a calculator requires no code changes.</li>
        <li><strong>Medical Traceability:</strong> Every score traces to an explicit source or medical authority.</li>
        <li><strong>Result Reproducibility:</strong> Every calculated result is deterministic and fully auditable.</li>
    </ul>

</body>
</html>
"""

dir_path = r"c:\athnect\deliverables"
edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

# Save HTML files
arch_html_path = os.path.join(dir_path, "08-architecture-diagram.html")
arch_pdf_path = os.path.join(dir_path, "08-architecture-diagram.pdf")

plan_html_path = os.path.join(dir_path, "14-execution-plan.html")
plan_pdf_path = os.path.join(dir_path, "14-execution-plan.pdf")

with open(arch_html_path, "w", encoding="utf-8") as f:
    f.write(arch_html)

with open(plan_html_path, "w", encoding="utf-8") as f:
    f.write(plan_html)

print("HTML files created.")

# Convert 08-architecture-diagram to PDF
arch_url = "file:///" + arch_html_path.replace("\\", "/")
cmd1 = [
    edge_path, "--headless", "--disable-gpu", "--no-pdf-header-footer",
    f"--print-to-pdf={arch_pdf_path}", arch_url
]
subprocess.run(cmd1, capture_output=True, text=True)
print("Arch PDF result:", os.path.exists(arch_pdf_path), os.path.getsize(arch_pdf_path) if os.path.exists(arch_pdf_path) else 0)

# Convert 14-execution-plan to PDF
plan_url = "file:///" + plan_html_path.replace("\\", "/")
cmd2 = [
    edge_path, "--headless", "--disable-gpu", "--no-pdf-header-footer",
    f"--print-to-pdf={plan_pdf_path}", plan_url
]
subprocess.run(cmd2, capture_output=True, text=True)
print("Plan PDF result:", os.path.exists(plan_pdf_path), os.path.getsize(plan_pdf_path) if os.path.exists(plan_pdf_path) else 0)
