// ─────────────────────────────────────────────────────────────────────────────
// pdfFill.js
//
// Writes a saved answer object into the ORIGINAL branded PDF and hands the
// adviser the file. Nothing is re-drawn or re-typeset: we load the real
// document from /public/forms and set its AcroForm field values, so what comes
// out is the compliance document itself, signature line and all.
//
// The output is deliberately NOT flattened — the adviser can still adjust a
// field in Acrobat before printing/signing.
//
// Everything runs in the browser. No client data is uploaded anywhere.
// ─────────────────────────────────────────────────────────────────────────────

import { PDFDocument, PDFName, PDFBool } from 'pdf-lib';

// ─── Text sanitising ─────────────────────────────────────────────────────────
//
// pdf-lib regenerates field appearances with a standard (WinAnsi) font. A
// character outside that encoding — a curly quote pasted from Word, an em dash,
// an ellipsis — throws during save and would lose the adviser's whole document.
// Map the common offenders to safe equivalents and drop anything still exotic.

const SUBSTITUTIONS = [
    [/[‘’‚‛]/g, "'"],
    [/[“”„‟]/g, '"'],
    [/[–—―]/g, '-'],
    [/…/g, '...'],
    [/[   ]/g, ' '],
    [/[•●]/g, '- '],
    [/€/g, 'EUR '],
];

/**
 * Makes a string safe for the standard PDF font used to render field values.
 * @param {unknown} raw
 * @returns {string}
 */
export function toPdfSafeText(raw) {
    let s = raw == null ? '' : String(raw);
    SUBSTITUTIONS.forEach(([re, to]) => { s = s.replace(re, to); });
    // Keep tab/newline; drop remaining control chars and anything above WinAnsi.
    return s.replace(/[^\n\t\x20-\xFF]/g, '');
}

// ─── Field writers ───────────────────────────────────────────────────────────

/**
 * Sets one AcroForm field. Returns null on success or the field name on
 * failure, so a single bad mapping degrades to a warning instead of throwing
 * away a completed document.
 * @param {import('pdf-lib').PDFForm} form
 * @param {string} name
 * @param {FieldType|string} type
 * @param {unknown} value
 * @returns {string|null}
 */
function setField(form, name, type, value) {
    try {
        if (type === 'checkbox') {
            const box = form.getCheckBox(name);
            if (value) box.check();
            else box.uncheck();
            return null;
        }

        if (type === 'radio') {
            const group = form.getRadioGroup(name);
            if (value === '' || value == null) return null;
            // Export values come straight from the PDF (`/0`…`/4`, `/On`, `/Yes`).
            group.select(String(value));
            return null;
        }

        const text = toPdfSafeText(value);
        if (!text) return null;
        form.getTextField(name).setText(text);
        return null;
    } catch (err) {
        console.warn(`[GSB] PDF field "${name}" (${type}) could not be set:`, err?.message || err);
        return name;
    }
}

/**
 * Walks a schema and writes every answered field into the source PDF.
 * @param {import('./documentTypes').DocumentSchema} schema
 * @param {Record<string, any>} data
 * @returns {Promise<{ bytes: Uint8Array, written: number, failed: string[] }>}
 */
export async function fillDocument(schema, data) {
    const response = await fetch(schema.pdf);
    if (!response.ok) {
        throw new Error(`Could not load the source document (${schema.pdf}): HTTP ${response.status}`);
    }
    const source = await response.arrayBuffer();

    const pdf = await PDFDocument.load(source);
    const form = pdf.getForm();

    /** @type {string[]} */
    const failed = [];
    let written = 0;

    const write = (name, type, value) => {
        if (!name) return;
        const empty = value == null || value === '' || value === false;
        if (empty) return;                       // never stamp blanks over the template
        const miss = setField(form, name, type, value);
        if (miss) failed.push(miss);
        else written += 1;
    };

    schema.sections.forEach((section) => {
        // Fixed-row tables: cells[row][col] ↔ data[`${section.id}.${row}.${col}`]
        if (section.type === 'table') {
            (section.cells || []).forEach((row, r) => {
                row.forEach((fieldName, c) => {
                    write(fieldName, (section.columnTypes || [])[c] || 'text',
                        data[`${section.id}.${r}.${c}`]);
                });
            });
            if (section.notes) write(section.notes.pdf, 'textarea', data[section.notes.key]);
            return;
        }

        (section.fields || []).forEach((field) => {
            // A checkgroup is a label over N independent checkbox fields.
            if (field.type === 'checkgroup') {
                (field.items || []).forEach((item) => {
                    write(item.pdf, 'checkbox', data[item.key]);
                });
                return;
            }

            // Derived values (e.g. the K&E score) are never stored — they are
            // recomputed from the answers at fill time so they cannot go stale.
            if (field.type === 'computed') {
                write(field.pdf, 'text', field.compute ? field.compute(data) : '');
                return;
            }

            // `writeAs` lets a control render one way and write another: the
            // Oxford category is a set of radio buttons on screen but a plain
            // text box on the document.
            write(field.pdf, field.writeAs || field.type, data[field.key]);
        });
    });

    // Ask the viewer to regenerate appearances too — belt and braces for
    // readers that ignore pdf-lib's generated ones.
    try {
        form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True);
    } catch { /* non-fatal — the generated appearances still stand */ }

    try {
        form.updateFieldAppearances();
    } catch (err) {
        console.warn('[GSB] updateFieldAppearances failed; relying on NeedAppearances:', err?.message || err);
    }

    const bytes = await pdf.save({ updateFieldAppearances: false });
    return { bytes, written, failed };
}

// ─── Download ────────────────────────────────────────────────────────────────

/**
 * Builds the download filename: "Fact Find - Smith - 2026-08-19.pdf".
 * @param {import('./documentTypes').DocumentSchema} schema
 * @param {Record<string, any>} data
 */
export function documentFileName(schema, data) {
    const who = schema.nameKey ? String(data[schema.nameKey] || '').trim() : '';
    const stamp = new Date().toISOString().slice(0, 10);
    const parts = [schema.fileStem, who, stamp].filter(Boolean);
    return `${parts.join(' - ').replace(/[\\/:*?"<>|]/g, '')}.pdf`;
}

/**
 * Triggers a browser download of the filled document.
 * @param {Uint8Array} bytes
 * @param {string} fileName
 */
export function downloadPdf(bytes, fileName) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke on the next tick — Safari needs the URL alive during the click.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
