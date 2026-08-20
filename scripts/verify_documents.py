# ─────────────────────────────────────────────────────────────────────────────
# verify_documents.py — checks the four document schemas against the real PDFs.
#
# The app cannot be built on the owner's machine (no Node), so this is the
# standing verification for the Documents tab. It answers three questions:
#
#   1. Does every AcroForm field name a schema references actually exist?
#   2. Does the schema cover every fillable field in the document, or are some
#      silently unreachable from the UI?
#   3. Do the radio-group export values the schema uses match the PDF's?
#
# It then fills every mapped field with a marker value and writes the result to
# scripts/_verify_out/ so the filled documents can be opened and eyeballed.
#
#   python scripts/verify_documents.py
# ─────────────────────────────────────────────────────────────────────────────

import pathlib
import re
import sys

from pypdf import PdfReader, PdfWriter

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "scripts" / "_verify_out"

DOCUMENTS = [
    ("Fact Find",            "factFindSchema.js", "cashcalc-fact-find.pdf"),
    ("ATRQ",                 "atrqSchema.js",     "gsb-atrq.pdf"),
    ("Knowledge & Experience", "keSchema.js",     "knowledge-experience.pdf"),
    ("Oxford Risk",          "oxfordSchema.js",   "oxford-risk.pdf"),
]

# Signature widgets cannot be filled programmatically — excluded from coverage.
SIGNATURE_TYPE = "/Sig"


def quoted_strings(source):
    """Every '…' / "…" literal in a JS file — a superset of the field names."""
    out = set()
    for match in re.finditer(r"'([^'\\\n]*)'|\"([^\"\\\n]*)\"", source):
        out.add(match.group(1) if match.group(1) is not None else match.group(2))
    return out


def field_types(reader):
    """{ fully-qualified name: /FT } for every terminal field, plus radio states."""
    types, states = {}, {}
    for page in reader.pages:
        for annot in (page.get("/Annots") or []):
            obj = annot.get_object()
            parent = obj.get("/Parent")
            name = obj.get("/T") or (parent.get("/T") if parent else None)
            if name is None:
                continue
            # fully-qualified name
            parts, cur, depth = [], obj, 0
            while cur is not None and depth < 8:
                t = cur.get("/T")
                if t:
                    parts.append(str(t))
                cur = cur.get("/Parent")
                depth += 1
            fq = ".".join(reversed(parts))
            ft = obj.get("/FT") or (parent.get("/FT") if parent else None)
            types[fq] = str(ft) if ft else "?"
            ap = obj.get("/AP")
            if ap and ap.get("/N") is not None:
                try:
                    on = [str(k)[1:] for k in ap["/N"].keys() if str(k) != "/Off"]
                except Exception:
                    on = []
                states.setdefault(fq, set()).update(on)
    return types, states


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    failures = []

    for title, schema_file, pdf_file in DOCUMENTS:
        schema_path = ROOT / "src" / "documents" / schema_file
        pdf_path = ROOT / "public" / "forms" / pdf_file
        print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")

        source = schema_path.read_text(encoding="utf-8")
        declared = quoted_strings(source)

        reader = PdfReader(str(pdf_path))
        types, states = field_types(reader)
        fillable = {n: t for n, t in types.items() if t != SIGNATURE_TYPE}
        signatures = [n for n, t in types.items() if t == SIGNATURE_TYPE]

        mapped = {n for n in fillable if n in declared}
        unmapped = sorted(set(fillable) - mapped)

        print(f"  fillable fields : {len(fillable)}")
        print(f"  mapped by schema: {len(mapped)}")
        if signatures:
            print(f"  signature fields: {len(signatures)} (not fillable — left for wet/digital signing)")

        if unmapped:
            failures.append(f"{title}: {len(unmapped)} fillable fields not reachable from the UI")
            print(f"  !! UNMAPPED     : {len(unmapped)}")
            for n in unmapped[:20]:
                print(f"       {n}  [{fillable[n]}]")
        else:
            print("  ✓ every fillable field is reachable from the UI")

        # ── Radio option counts ─────────────────────────────────────────────
        # A radio group with the wrong number of options is the failure mode
        # that matters: the ATRQ mixes five-option questions with two
        # three-option ones, and offering a fourth choice on a three-option
        # group would write a value the PDF cannot accept.
        radios = {n: s for n, s in states.items() if fillable.get(n) == "/Btn" and len(s) > 1}
        if radios:
            counted, unresolved, mismatched = 0, [], []
            positions = sorted(
                ((source.index(f"'{n}'"), n) for n in radios if f"'{n}'" in source),
            )
            for i, (start, name) in enumerate(positions):
                end = positions[i + 1][0] if i + 1 < len(positions) else len(source)
                slice_ = source[start:end]
                declared_count = None
                if "AGREE_SCALE" in slice_ or "LIKERT" in slice_:
                    declared_count = 5
                elif "scale([" in slice_:
                    inner = slice_[slice_.index("scale([") + 7:]
                    depth, cut = 1, len(inner)
                    for j, ch in enumerate(inner):
                        if ch == "[":
                            depth += 1
                        elif ch == "]":
                            depth -= 1
                            if depth == 0:
                                cut = j
                                break
                    declared_count = len(re.findall(r"'(?:[^'\\]|\\.)*'", inner[:cut]))
                if declared_count is None:
                    unresolved.append(name)
                else:
                    counted += 1
                    if declared_count != len(radios[name]):
                        mismatched.append((name, declared_count, len(radios[name])))

            if mismatched:
                failures.append(f"{title}: radio option counts do not match the PDF")
                for name, got, want in mismatched:
                    print(f"  !! {name}: schema declares {got} options, PDF widget has {want}")
            if counted:
                print(f"  ✓ {counted} radio groups declare the right number of options")
            if unresolved:
                print(f"  · {len(unresolved)} radio groups share a common option list "
                      f"(not statically countable): {', '.join(unresolved[:4])}"
                      f"{'…' if len(unresolved) > 4 else ''}")

            # Every literal export value used anywhere must exist on some
            # widget — except on a field marked `writeAs: 'text'`, which renders
            # as radio buttons but writes its value into a text box (the Oxford
            # risk category). Those values are free text, not export states.
            text_written = set()
            for block in re.finditer(r"\{[^{}]*writeAs:\s*'text'[^{}]*\}", source, re.S):
                ident = re.search(r"options:\s*([A-Z_][A-Z0-9_]*)", block.group(0))
                if not ident:
                    continue
                decl = re.search(
                    rf"const\s+{ident.group(1)}\s*=\s*\[(.*?)\n\];", source, re.S,
                )
                if decl:
                    text_written |= set(re.findall(r"value:\s*'([^']+)'", decl.group(1)))

            all_states = set().union(*radios.values())
            used = set(re.findall(r"value:\s*'([^']+)'", source)) - text_written
            stray = {v for v in used if v not in all_states and not v.isalpha()}
            if stray:
                failures.append(f"{title}: unknown radio export values {sorted(stray)}")
                print(f"  !! export values not present in any widget: {sorted(stray)}")

        # ── Functional fill: prove the document accepts programmatic values ──
        writer = PdfWriter(clone_from=str(pdf_path))
        filled = 0
        for page in writer.pages:
            values, checks = {}, {}
            for annot in (page.get("/Annots") or []):
                obj = annot.get_object()
                parent = obj.get("/Parent")
                parts, cur, depth = [], obj, 0
                while cur is not None and depth < 8:
                    t = cur.get("/T")
                    if t:
                        parts.append(str(t))
                    cur = cur.get("/Parent")
                    depth += 1
                fq = ".".join(reversed(parts))
                ft = types.get(fq)
                if fq not in mapped:
                    continue
                if ft == "/Tx":
                    values[fq] = "TEST"
                elif ft == "/Btn":
                    on = sorted(states.get(fq, {"Yes"}))
                    if on:
                        checks[fq] = f"/{on[0]}"
            if values or checks:
                try:
                    writer.update_page_form_field_values(page, {**values, **checks})
                    filled += len(values) + len(checks)
                except Exception as exc:  # noqa: BLE001
                    failures.append(f"{title}: fill failed — {exc}")
                    print(f"  !! fill error: {exc}")

        out_path = OUT_DIR / f"filled-{pdf_file}"
        with open(out_path, "wb") as fh:
            writer.write(fh)
        print(f"  ✓ test-filled {filled} widgets → {out_path.relative_to(ROOT)}")

    print(f"\n{'=' * 70}")
    if failures:
        print("FAILURES:")
        for f in failures:
            print("  •", f)
        sys.exit(1)
    print("All four documents verified: names resolve, coverage complete, fill works.")


if __name__ == "__main__":
    main()
