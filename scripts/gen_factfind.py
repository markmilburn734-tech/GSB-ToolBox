# Generates src/documents/factFindSchema.js from the CashCalc Fact Find PDF.
# Field names are read straight out of the AcroForm so the mapping can never
# drift from the real document; labels/structure are declared here.
import sys, re, json, pathlib
from pypdf import PdfReader

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = str(ROOT / "public" / "forms" / "cashcalc-fact-find.pdf")
OUT = str(ROOT / "src" / "documents" / "factFindSchema.js")

reader = PdfReader(SRC)


def fq(o):
    parts, cur, n = [], o, 0
    while cur is not None and n < 8:
        t = cur.get("/T")
        if t:
            parts.append(str(t))
        cur = cur.get("/Parent")
        n += 1
    return ".".join(reversed(parts))


def widgets(page_no):
    out = []
    for a in (reader.pages[page_no - 1].get("/Annots") or []):
        o = a.get_object()
        x0, y0, x1, y1 = [float(v) for v in o.get("/Rect")]
        out.append({"y": y1, "x": x0, "n": fq(o)})
    return out


def base(n):
    return re.sub(r"(\.\d+)+$", "", n)


def table_cells(page_no, columns, families=None, ylimit=None):
    """Rows of fully-qualified field names, top→bottom, each row left→right."""
    ws = widgets(page_no)
    if families:
        ws = [w for w in ws if base(w["n"]) in families]
    if ylimit:
        lo, hi = ylimit
        ws = [w for w in ws if lo <= w["y"] <= hi]
    ws.sort(key=lambda w: -w["y"])
    rows = []
    for w in ws:
        if rows and abs(rows[-1][0]["y"] - w["y"]) <= 4:
            rows[-1].append(w)
        else:
            rows.append([w])
    cells = []
    for r in rows:
        r.sort(key=lambda w: w["x"])
        assert len(r) == len(columns), (
            f"page {page_no}: row at y={round(r[0]['y'])} has {len(r)} cells, "
            f"expected {len(columns)} ({[w['n'] for w in r]})"
        )
        cells.append([w["n"] for w in r])
    return cells


def fam(prefix, first, last):
    return {f"{prefix}{i}" for i in range(first, last + 1)}


# ── Column headers, straight off the printed document ────────────────────────
INCOME_COLS = ["Owner", "Name", "Amount", "Frequency", "Net/Gross", "Timeframe"]
EXPENSE_COLS = ["Owner", "Name", "Amount", "Frequency", "Priority", "Timeframe"]
PENSION_COLS = ["Owner", "Type", "Provider", "Value", "Policy number"]
SAVINGS_COLS = ["Owner", "Type", "Provider", "Value"]
OTHER_COLS = ["Owner", "Description", "Current Value", "Original Value"]
LOAN_COLS = ["Owner", "Type", "Provider", "Monthly Cost", "Outstanding Value",
             "Interest Rate", "Special Rate", "Final Payment"]
PROT_COLS = ["Owner", "Type", "Provider", "Monthly Cost", "Amount Assured",
             "In Trust?", "Assured Until"]
DEP_COLS = ["Name", "Date of Birth", "Dependant Until"]

PERSONAL = ["Title", "First name", "Middle names", "Last name", "Known as",
            "Pronouns", "Date of birth", "Place of birth", "Nationality",
            "Gender", "Legal sex", "Marital status", "Home phone",
            "Mobile phone", "Email address"]

ADDRESS = ["Ownership Status", "Postcode", "House namenumber", "Street name",
           "Address Line 3", "Address Line 4", "Town City", "County",
           "Country", "Move In Date"]
ADDRESS_LABELS = {"House namenumber": "House name/number"}

EMPLOYMENT = ["Country domiciled", "Resident for tax",
              "National Insurance number", "Employment status",
              "Desired retirement age", "Occupation", "Employer",
              "Employment started", "Highest rate of tax paid"]

HEALTH = ["Current state of health", "State of health explanation", "Smoker",
          "Cigarettes per day", "Smoker since", "Long term care needed",
          "Long term care explanation", "Will", "Information about will",
          "Power of attorney", "Details of individual with power of attorney"]
HEALTH_LABELS = {"Smoker": "Smoker?", "Long term care needed": "Long term care needed?",
                 "Will": "Will?", "Power of attorney": "Power of attorney?"}

DATE_FIELDS = {"Date of birth", "Move In Date", "Employment started", "Smoker since"}
LONG_FIELDS = {"State of health explanation", "Long term care explanation",
               "Information about will", "Details of individual with power of attorney"}


def key_of(label):
    s = re.sub(r"[^A-Za-z0-9 ]", " ", label).strip().split()
    return s[0].lower() + "".join(w.capitalize() for w in s[1:])


def qa_fields(names, suffix="", labels=None, prefix=""):
    out = []
    for n in names:
        label = (labels or {}).get(n, n)
        typ = "date" if n in DATE_FIELDS else ("textarea" if n in LONG_FIELDS else "text")
        out.append({"key": prefix + key_of(n) + suffix, "label": label,
                    "type": typ, "pdf": ("Answer" if names is PERSONAL else "") + n + suffix})
    return out


sections = []

sections.append({
    "id": "cover", "title": "Cover", "page": 1,
    "hint": "Appears on the front page of the document.",
    "fields": [
        {"key": "coverFor1", "label": "For", "type": "text", "pdf": "Text9.0"},
        {"key": "coverFor2", "label": "For (second line)", "type": "text", "pdf": "Text9.1"},
        {"key": "coverDate", "label": "Date", "type": "date", "pdf": "Date1_af_date"},
    ],
})

sections.append({"id": "client1", "title": "Client 1 — Personal Details", "page": 2,
                 "fields": qa_fields(PERSONAL, "", None, "c1")})
sections.append({"id": "client2", "title": "Client 2 — Personal Details", "page": 3,
                 "hint": "Leave blank for a single-client fact find.",
                 "fields": qa_fields(PERSONAL, "_2", None, "c2")})

sections.append({"id": "address", "title": "Current Address", "page": 4,
                 "fields": qa_fields(ADDRESS, "", ADDRESS_LABELS, "addr")})
sections.append({"id": "prevAddresses", "title": "Previous Addresses", "page": 4,
                 "fields": [
                     {"key": "prevAddr1", "label": "Previous address 1", "type": "textarea", "pdf": "Text1"},
                     {"key": "prevAddr2", "label": "Previous address 2", "type": "textarea", "pdf": "Text2"},
                     {"key": "prevAddr3", "label": "Previous address 3", "type": "textarea", "pdf": "Text3"},
                 ]})
sections.append({"id": "dependants", "title": "Dependants & Children", "page": 4,
                 "type": "table", "columns": DEP_COLS, "columnTypes": ["text", "date", "text"],
                 "cells": table_cells(4, DEP_COLS, ylimit=(80, 200))})

sections.append({"id": "employment1", "title": "Client 1 — Employment", "page": 5,
                 "fields": qa_fields(EMPLOYMENT, "", None, "e1") +
                           [{"key": "e1Notes", "label": "Notes", "type": "textarea", "pdf": "Text20"}]})
sections.append({"id": "employment2", "title": "Client 2 — Employment", "page": 6,
                 "fields": qa_fields(EMPLOYMENT, "_2", None, "e2") +
                           [{"key": "e2Notes", "label": "Notes", "type": "textarea", "pdf": "Text21"}]})

sections.append({"id": "incomes", "title": "Incomes", "page": 7, "type": "table",
                 "columns": INCOME_COLS,
                 "cells": table_cells(7, INCOME_COLS, fam("Text", 29, 34)),
                 "notes": {"key": "incomeNotes", "pdf": "Text35"}})

for sid, title, first, last in [
    ("expLoans", "Expenses — Loan repayments", 36, 41),
    ("expHousing", "Expenses — Housing", 42, 47),
    ("expMotoring", "Expenses — Motoring", 55, 60),
]:
    sections.append({"id": sid, "title": title, "page": 8, "type": "table",
                     "columns": EXPENSE_COLS,
                     "cells": table_cells(8, EXPENSE_COLS, fam("Text", first, last))})

for sid, title, first, last, notes in [
    ("expPersonal", "Expenses — Personal", 61, 66, None),
    ("expProfessional", "Expenses — Professional", 67, 72, None),
    ("expMisc", "Expenses — Miscellaneous", 73, 78, "Text79"),
]:
    s = {"id": sid, "title": title, "page": 9, "type": "table",
         "columns": EXPENSE_COLS,
         "cells": table_cells(9, EXPENSE_COLS, fam("Text", first, last))}
    if notes:
        s["notes"] = {"key": "expenseNotes", "pdf": notes}
    sections.append(s)

sections.append({"id": "pensions", "title": "Pensions", "page": 10, "type": "table",
                 "columns": PENSION_COLS,
                 "cells": table_cells(10, PENSION_COLS, fam("Text", 80, 84)),
                 "notes": {"key": "pensionNotes", "pdf": "Text85"}})
sections.append({"id": "savings", "title": "Savings & Investments", "page": 11, "type": "table",
                 "columns": SAVINGS_COLS,
                 "cells": table_cells(11, SAVINGS_COLS, fam("Text", 86, 89)),
                 "notes": {"key": "savingsNotes", "pdf": "Text90"}})
sections.append({"id": "otherAssets", "title": "Other Assets", "page": 12, "type": "table",
                 "columns": OTHER_COLS,
                 "cells": table_cells(12, OTHER_COLS, fam("Text", 91, 94)),
                 "notes": {"key": "otherAssetNotes", "pdf": "Text95"}})
sections.append({"id": "loans", "title": "Loans & Mortgages", "page": 13, "type": "table",
                 "columns": LOAN_COLS,
                 "cells": table_cells(13, LOAN_COLS, ylimit=(480, 720)),
                 "notes": {"key": "loanNotes", "pdf": "Text96"}})

sections.append({"id": "health1", "title": "Client 1 — Health, Wills & LPA", "page": 14,
                 "fields": qa_fields(HEALTH, "", HEALTH_LABELS, "h1")})
sections.append({"id": "health2", "title": "Client 2 — Health, Wills & LPA", "page": 15,
                 "fields": qa_fields(HEALTH, "_2", HEALTH_LABELS, "h2")})

sections.append({"id": "protection", "title": "Protection Policies", "page": 16, "type": "table",
                 "columns": PROT_COLS,
                 "cells": table_cells(16, PROT_COLS, ylimit=(480, 720)),
                 "notes": {"key": "protectionNotes", "pdf": "Text98"}})

obj = widgets(17)
obj.sort(key=lambda w: -w["y"])
sections.append({"id": "objectives", "title": "Objectives", "page": 17,
                 "hint": "Free text — one block per objective.",
                 "fields": [{"key": f"objective{i+1}", "label": f"Objective {i+1}",
                             "type": "textarea", "pdf": w["n"], "rows": 3}
                            for i, w in enumerate(obj)]})

# ── Sanity: every pdf name we emit must exist in the AcroForm ────────────────
real = set(reader.get_fields().keys())
emitted = []
for s in sections:
    for f in s.get("fields", []):
        emitted.append(f["pdf"])
    for row in s.get("cells", []):
        emitted.extend(row)
    if s.get("notes"):
        emitted.append(s["notes"]["pdf"])
missing = [n for n in emitted if n not in real]
dupes = [n for n in set(emitted) if emitted.count(n) > 1]
print(f"emitted {len(emitted)} field refs | missing from PDF: {missing} | duplicated: {dupes}")
print(f"unmapped PDF fields: {len(real - set(emitted))}")
assert not missing and not dupes

body = json.dumps(sections, indent=2, ensure_ascii=False)
js = f"""// ─────────────────────────────────────────────────────────────────────────────
// factFindSchema.js — GENERATED, do not hand-edit.
//
// Produced by scripts/gen_factfind.py from public/forms/cashcalc-fact-find.pdf.
// Every `pdf` value is a fully-qualified AcroForm field name read out of that
// document, so the mapping cannot drift from the real form. Re-run the
// generator if the source PDF is ever replaced.
//
// {len(emitted)} mapped fields across {len(sections)} sections / 17 pages.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {{import('./documentTypes').DocumentSchema}} */
export const FACT_FIND_SCHEMA = {{
  id: 'factfind',
  title: 'Fact Find',
  subtitle: 'Full client KYC — completes the CashCalc fact find document',
  pdf: '/forms/cashcalc-fact-find.pdf',
  fileStem: 'Fact Find',
  nameKey: 'c1lastName',
  layout: 'wizard',
  footnote:
    'Sections mirror the pages of the CashCalc fact find. Table sections have the same fixed number '
    + 'of rows as the printed grids, so a client with more than ten holdings needs a continuation sheet. '
    + 'Client 2 sections can be left blank for a single-client fact find.',
  sections: {body},
}};

export default FACT_FIND_SCHEMA;
"""
open(OUT, "w", encoding="utf-8").write(js)
print("wrote", OUT, f"({len(js)} bytes)")
