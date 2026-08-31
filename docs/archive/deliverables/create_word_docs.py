import docx
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os
import shutil

def set_font_and_margins(doc):
    # Set 0.5 inch margins (single page fit)
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.5)
        section.bottom_margin = Inches(0.5)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)

# ----------------------------------------------------
# 1. Generate 08-architecture-diagram Word Document
# ----------------------------------------------------
doc_arch = Document()
set_font_and_margins(doc_arch)

# Title
p_title = doc_arch.add_paragraph()
run_title = p_title.add_run("System Architecture Overview")
run_title.font.name = "Arial"
run_title.font.size = Pt(16)
run_title.font.bold = True

# Subtitle
p_sub = doc_arch.add_paragraph()
run_sub = p_sub.add_run("Non-Technical Guide — How the Health Calculator Platform Works")
run_sub.font.name = "Arial"
run_sub.font.size = Pt(9)
run_sub.font.italic = True

# Section 1
p_h1 = doc_arch.add_paragraph()
r_h1 = p_h1.add_run("1. Core Concept")
r_h1.font.name = "Arial"
r_h1.font.size = Pt(11)
r_h1.font.bold = True

p_c1 = doc_arch.add_paragraph()
r_c1 = p_c1.add_run("The platform is designed as a single reusable engine. Instead of writing custom software code for every new health test, the system reads a structured configuration document. Adding a new calculator (such as Niro CWS or COVID Risk) requires creating a configuration file, not writing new code.")
r_c1.font.name = "Arial"
r_c1.font.size = Pt(9)

# Section 2
p_h2 = doc_arch.add_paragraph()
r_h2 = p_h2.add_run("2. System Flow Diagram")
r_h2.font.name = "Arial"
r_h2.font.size = Pt(11)
r_h2.font.bold = True

p_diag = doc_arch.add_paragraph()
r_diag = p_diag.add_run("[User Input Form] ---> [Rule & Formula Engine] ---> [Health Assessment Report]\n                                     ^\n                                     | (loads config)\n[Admin Builder] ------------> [Database Vault]")
r_diag.font.name = "Courier New"
r_diag.font.size = Pt(8.5)

# Section 3
p_h3 = doc_arch.add_paragraph()
r_h3 = p_h3.add_run("3. The Four Key Components")
r_h3.font.name = "Arial"
r_h3.font.size = Pt(11)
r_h3.font.bold = True

components = [
    ("1. User Interface", [
        "Renders questions, options, and unit selectors dynamically from configuration.",
        "Displays calculated scores, risk categories, domain breakdowns, and recommendations.",
        "Adapts automatically whenever a calculator configuration is updated."
    ]),
    ("2. Admin Builder", [
        "Provides a visual interface for non-technical team members to create and edit calculators.",
        "Allows configuring parameters, unit conversions, scoring bands, and display layouts.",
        "Includes a validator to check for errors before publishing."
    ]),
    ("3. Rule and Formula Engine", [
        "Evaluates user inputs through a deterministic calculation pipeline.",
        "Normalizes units, computes derived values, scores bands, and ranks risk contributors.",
        "Operates independently of specific calculator logic to ensure complete reusability."
    ]),
    ("4. Database Vault", [
        "Stores standard biomarker definitions, calculator configurations, and assessment history.",
        "Maintains version control so every published result can be recreated accurately.",
        "Ensures data integrity and security."
    ])
]

for title, bullets in components:
    p_comp = doc_arch.add_paragraph()
    r_comp = p_comp.add_run(title)
    r_comp.font.name = "Arial"
    r_comp.font.size = Pt(9.5)
    r_comp.font.bold = True
    
    for b in bullets:
        p_b = doc_arch.add_paragraph(style='List Bullet')
        r_b = p_b.add_run(b)
        r_b.font.name = "Arial"
        r_b.font.size = Pt(8.5)

# Section 4
p_h4 = doc_arch.add_paragraph()
r_h4 = p_h4.add_run("4. Key System Benefits")
r_h4.font.name = "Arial"
r_h4.font.size = Pt(11)
r_h4.font.bold = True

benefits = [
    ("Zero-Code Expansion: ", "New calculators are added by creating configuration data rather than editing core code."),
    ("Fast Evaluation: ", "Calculates results in under 0.3 seconds."),
    ("Full Traceability: ", "Every score traces directly to verified reference logic.")
]

for label, desc in benefits:
    p_ben = doc_arch.add_paragraph(style='List Bullet')
    r_lbl = p_ben.add_run(label)
    r_lbl.font.name = "Arial"
    r_lbl.font.size = Pt(8.5)
    r_lbl.font.bold = True
    
    r_desc = p_ben.add_run(desc)
    r_desc.font.name = "Arial"
    r_desc.font.size = Pt(8.5)

arch_docx_path = r"c:\athnect\deliverables\08-architecture-diagram.docx"
arch_doc_path = r"c:\athnect\deliverables\08-architecture-diagram.doc"

doc_arch.save(arch_docx_path)
shutil.copy(arch_docx_path, arch_doc_path)
print("08-architecture-diagram Word docs saved.")

# ----------------------------------------------------
# 2. Generate 14-execution-plan Word Document
# ----------------------------------------------------
doc_plan = Document()
set_font_and_margins(doc_plan)

# Title
p_title2 = doc_plan.add_paragraph()
r_title2 = p_title2.add_run("Project Execution Plan")
r_title2.font.name = "Arial"
r_title2.font.size = Pt(16)
r_title2.font.bold = True

# Subtitle
p_sub2 = doc_plan.add_paragraph()
r_sub2 = p_sub2.add_run("Non-Technical Guide — Four-Phase Outcome-Focused Delivery Plan")
r_sub2.font.name = "Arial"
r_sub2.font.size = Pt(9)
r_sub2.font.italic = True

# Section 1
p_p1 = doc_plan.add_paragraph()
r_p1 = p_p1.add_run("1. Roadmap Overview")
r_p1.font.name = "Arial"
r_p1.font.size = Pt(11)
r_p1.font.bold = True

phases_overview = [
    "Phase 1: Research and Medical Rules Foundation",
    "Phase 2: Engine and Database Build",
    "Phase 3: User App and Admin Builder",
    "Phase 4: Testing and Final Launch"
]

for po in phases_overview:
    p_po = doc_plan.add_paragraph(style='List Bullet')
    r_po = p_po.add_run(po)
    r_po.font.name = "Arial"
    r_po.font.size = Pt(8.5)

# Section 2
p_p2 = doc_plan.add_paragraph()
r_p2 = p_p2.add_run("2. Phase Details and Outcomes")
r_p2.font.name = "Arial"
r_p2.font.size = Pt(11)
r_p2.font.bold = True

phases_detail = [
    ("Phase 1: Research and Medical Rules Foundation",
     "Analyze project brief and reference sites; verify 38 biomarkers against medical sources; create standard biomarker reference dataset.",
     "Project understanding document, source analysis, medical source references, and initial calculator configuration samples.",
     "Verified medical rulebook and reference datasets ready for system construction."),
    
    ("Phase 2: Engine and Database Build",
     "Set up database schemas; build configuration validator service; build 10-stage calculation engine.",
     "Database models, validator module, pure calculation engine module, and unit test suite.",
     "Working calculation engine that evaluates health scores in under 0.3 seconds."),
    
    ("Phase 3: User App and Admin Builder",
     "Build dynamic React user form and results renderer; build visual Admin Builder interface; integrate REST APIs.",
     "Dynamic web application, Admin Builder UI, and public/admin API endpoints.",
     "Functional web application and no-code administration panel for managing calculators."),
    
    ("Phase 4: Testing and Final Launch",
     "Perform unit, API, component, and end-to-end testing; execute reusability check by building a second calculator via Admin UI only; prepare release documentation.",
     "Completed test suite, reusability verification evidence, and release setup documentation.",
     "Fully tested, production-ready platform with proven zero-code calculator creation.")
]

for p_title_text, tasks_text, deliv_text, outcome_text in phases_detail:
    p_dt = doc_plan.add_paragraph()
    r_dt = p_dt.add_run(p_title_text)
    r_dt.font.name = "Arial"
    r_dt.font.size = Pt(9.5)
    r_dt.font.bold = True
    
    p_tk = doc_plan.add_paragraph()
    r_tkl = p_tk.add_run("Tasks: ")
    r_tkl.font.name = "Arial"
    r_tkl.font.size = Pt(8.5)
    r_tkl.font.bold = True
    r_tkv = p_tk.add_run(tasks_text)
    r_tkv.font.name = "Arial"
    r_tkv.font.size = Pt(8.5)

    p_dl = doc_plan.add_paragraph()
    r_dll = p_dl.add_run("Deliverables: ")
    r_dll.font.name = "Arial"
    r_dll.font.size = Pt(8.5)
    r_dll.font.bold = True
    r_dlv = p_dl.add_run(deliv_text)
    r_dlv.font.name = "Arial"
    r_dlv.font.size = Pt(8.5)

    p_oc = doc_plan.add_paragraph()
    r_ocl = p_oc.add_run("Outcome: ")
    r_ocl.font.name = "Arial"
    r_ocl.font.size = Pt(8.5)
    r_ocl.font.bold = True
    r_ocv = p_oc.add_run(outcome_text)
    r_ocv.font.name = "Arial"
    r_ocv.font.size = Pt(8.5)

# Section 3
p_p3 = doc_plan.add_paragraph()
r_p3 = p_p3.add_run("3. Final Delivery Principles")
r_p3.font.name = "Arial"
r_p3.font.size = Pt(11)
r_p3.font.bold = True

principles = [
    ("Zero-Code Updates: ", "Adding or updating a calculator requires no code changes."),
    ("Medical Traceability: ", "Every score traces to an explicit source or medical authority."),
    ("Result Reproducibility: ", "Every calculated result is deterministic and fully auditable.")
]

for label, desc in principles:
    p_pr = doc_plan.add_paragraph(style='List Bullet')
    r_lbl = p_pr.add_run(label)
    r_lbl.font.name = "Arial"
    r_lbl.font.size = Pt(8.5)
    r_lbl.font.bold = True
    
    r_desc = p_pr.add_run(desc)
    r_desc.font.name = "Arial"
    r_desc.font.size = Pt(8.5)

plan_docx_path = r"c:\athnect\deliverables\14-execution-plan.docx"
plan_doc_path = r"c:\athnect\deliverables\14-execution-plan.doc"

doc_plan.save(plan_docx_path)
shutil.copy(plan_docx_path, plan_doc_path)
print("14-execution-plan Word docs saved successfully.")
