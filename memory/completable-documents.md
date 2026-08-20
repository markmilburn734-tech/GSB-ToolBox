---
name: completable-documents
description: The Documents tab — four compliance PDFs filled in-app via pdf-lib; decisions, traps and the no-Node verification
metadata:
  type: project
---

Added 2026-08-19. Four real compliance PDFs are completable inside the ToolBox and download as the **original branded document** (pdf-lib writes into the AcroForm; output is not flattened). Sources in `public/forms/`. Full detail in DEVELOPMENT.md §10.

**Owner's decisions (asked and confirmed):**
- Fill the real PDFs, not a re-typeset lookalike.
- **No scoring for the ATRQ and Oxford questionnaires** — validated keys aren't published in the documents and half the Oxford statements are reverse-worded. K&E *is* scored (0–21) because that document prints its own key and has a field for the result.
- New **Documents** primary tab; the existing lightweight Fact Find tab stays untouched.
- **localStorage autosave AND JSON export/import** — this is the one exception to the app-wide no-persistence rule (see [[local-build-env]] for why it can't be smoke-tested here).

**Traps that cost real time — don't re-derive:**
- AcroForm field names are NOT in reading order (K&E runs `Check Box1, 5, 4, 6…`). Every mapping came from widget **rectangles**, not names.
- The ATRQ's `Question 14` field is the *investment term* control, not question 14.
- ATRQ radio groups are 5-option except `Question 10` and `Question 14` (3).
- The source ATRQ has a **typo**: Q15 option 4 reads "Very cautious and risk averse", should be "Absolute Return or Hedge Funds". Reproduced as printed and flagged in-UI; fix belongs in the master PDF.

**Verification pattern (no Node on this machine):** `python scripts/verify_documents.py` audits all four schemas against the real PDFs — names resolve, *every* fillable field is reachable from the UI, radio option counts match — then test-fills them into `scripts/_verify_out/`. Last run: 792/792 fields mapped, all clean. `python scripts/gen_factfind.py` regenerates the 699-field fact find schema from the PDF (that file is generated — never hand-edit).

**Still unverified:** the React UI itself has never been rendered — no Node here, so `npm run dev` by the owner is the outstanding check. `pdf-lib` is a new dependency that only installs in Firebase CI.
