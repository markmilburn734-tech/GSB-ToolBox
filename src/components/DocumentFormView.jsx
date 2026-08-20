// ─────────────────────────────────────────────────────────────────────────────
// DocumentFormView.jsx — one renderer, four completable documents.
//
// Everything on screen is driven by a schema from src/documents/. Adding a
// fifth document means writing a schema, not another component.
//
//   • answers auto-save to localStorage (see docStore.js for why these tabs are
//     the one exception to the app's no-persistence rule)
//   • "Download PDF" writes the answers into the ORIGINAL branded document
//   • Export/Import JSON moves a part-finished document between machines
//
// Long documents (the 23-section fact find) use the `wizard` layout — a section
// rail plus one section at a time. Short questionnaires render as one scroll.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Download, Upload, Check, AlertCircle, Trash2, ChevronRight, FileText } from './Icons';
import {
    loadDocument, saveDocument, clearDocument,
    exportDocumentJson, importDocumentJson, storageAvailable,
} from '../documents/docStore';
import { fillDocument, downloadPdf, documentFileName } from '../documents/pdfFill';

// ─── Shared classes (match the app-wide design system) ───────────────────────
const card    = 'bg-white/75 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-sm';
const label   = 'block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1';
const input   = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-brand';
const btnBase = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const btnMain = `${btnBase} bg-brand text-white hover:bg-brand6`;
const btnGhost = `${btnBase} bg-white border border-gray-200 text-gray-600 hover:border-brand hover:text-brand`;

/** Answered = anything the adviser has actually put a value into. */
const isAnswered = (v) => v !== undefined && v !== null && v !== '' && v !== false;

/** Every answer key a section owns, so we can show per-section progress. */
function sectionKeys(section) {
    if (section.type === 'table') {
        const keys = (section.cells || []).flatMap((row, r) => row.map((_, c) => `${section.id}.${r}.${c}`));
        if (section.notes) keys.push(section.notes.key);
        return keys;
    }
    return (section.fields || []).flatMap((f) => (
        f.type === 'checkgroup' ? (f.items || []).map((i) => i.key)
            : f.type === 'computed' ? []
            : [f.key]
    ));
}

// ─── Field controls ──────────────────────────────────────────────────────────

function TextControl({ field, value, onChange }) {
    if (field.type === 'textarea') {
        return (
            <textarea
                rows={field.rows || 2}
                className={`${input} resize-y`}
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
            />
        );
    }
    const type = field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text';
    return (
        <input
            type={type}
            className={`${input} ${field.type === 'date' || field.type === 'number' ? 'font-mono' : ''}`}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
        />
    );
}

function RadioControl({ field, value, onChange }) {
    // Inline = the compact 1–5 strip used by the Oxford statements.
    if (field.inline) {
        return (
            <div className="flex gap-1.5">
                {field.options.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => onChange(value === opt.value ? '' : opt.value)}
                        className={`w-9 h-9 rounded-lg text-xs font-bold font-mono border transition-colors ${
                            value === opt.value
                                ? 'bg-brand text-white border-brand'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-brand hover:text-brand'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        );
    }
    return (
        <div className="space-y-1">
            {field.options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(value === opt.value ? '' : opt.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors flex items-start gap-2.5 ${
                        value === opt.value
                            ? 'bg-brand-tint border-brand text-brand font-semibold'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-brand6'
                    }`}
                >
                    <span className={`mt-0.5 w-3.5 h-3.5 shrink-0 rounded-full border-2 ${
                        value === opt.value ? 'border-brand bg-brand' : 'border-gray-300'
                    }`} />
                    <span>{opt.label}</span>
                </button>
            ))}
        </div>
    );
}

function CheckControl({ checked, onChange, children, note }) {
    return (
        <label className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-gray-200 bg-white cursor-pointer hover:border-brand6 transition-colors">
            <input
                type="checkbox"
                className="mt-0.5 w-4 h-4 shrink-0 accent-brand cursor-pointer"
                checked={!!checked}
                onChange={(e) => onChange(e.target.checked)}
            />
            <span className="text-sm text-gray-700">
                {children}
                {note && <span className="block text-[11px] text-gray-400 mt-0.5 italic">{note}</span>}
            </span>
        </label>
    );
}

function ComputedControl({ field, data }) {
    const out = field.describe ? field.describe(data) : { value: field.compute?.(data) };
    return (
        <div className="rounded-xl border border-brand/30 bg-brand-tint/60 p-4">
            <div className="flex items-baseline gap-3">
                <span className="text-2xl font-bold font-mono text-brand">{out.value}</span>
                {out.name && <span className="text-sm font-bold text-brand6">{out.name}</span>}
            </div>
            {out.text && <p className="text-xs text-gray-600 mt-2 leading-relaxed">{out.text}</p>}
        </div>
    );
}

function Field({ field, data, set }) {
    const value = data[field.key];

    if (field.type === 'checkgroup') {
        return (
            <div>
                <span className={label}>{field.label}</span>
                <div className="space-y-1 mt-1.5">
                    {(field.items || []).map((item) => (
                        <CheckControl
                            key={item.key}
                            checked={data[item.key]}
                            onChange={(v) => set(item.key, v)}
                            note={item.note}
                        >
                            {item.label}
                        </CheckControl>
                    ))}
                </div>
            </div>
        );
    }

    if (field.type === 'checkbox') {
        return (
            <CheckControl checked={value} onChange={(v) => set(field.key, v)} note={field.note}>
                {field.label}
            </CheckControl>
        );
    }

    if (field.type === 'computed') {
        return (
            <div>
                <span className={label}>{field.label}</span>
                <ComputedControl field={field} data={data} />
                {field.note && <p className="text-[11px] text-gray-400 mt-1.5 italic">{field.note}</p>}
            </div>
        );
    }

    return (
        <div>
            <span className={label}>{field.label}</span>
            {field.type === 'radio'
                ? <RadioControl field={field} value={value} onChange={(v) => set(field.key, v)} />
                : <TextControl field={field} value={value} onChange={(v) => set(field.key, v)} />}
            {field.note && <p className="text-[11px] text-gray-400 mt-1 italic">{field.note}</p>}
        </div>
    );
}

// ─── Table section (mirrors the ruled grids in the source PDFs) ──────────────

function TableSection({ section, data, set }) {
    return (
        <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[720px] border-separate border-spacing-0">
                <thead>
                    <tr>
                        <th className="w-8" />
                        {section.columns.map((c) => (
                            <th key={c} className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-1.5 px-1">
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {(section.cells || []).map((row, r) => (
                        <tr key={r}>
                            <td className="text-[10px] font-mono text-gray-300 pr-1 align-middle">{r + 1}</td>
                            {row.map((_, c) => {
                                const key = `${section.id}.${r}.${c}`;
                                const type = (section.columnTypes || [])[c] || 'text';
                                return (
                                    <td key={c} className="px-0.5 py-0.5">
                                        <input
                                            type={type === 'date' ? 'date' : 'text'}
                                            className={`${input} py-1.5 text-[13px] ${type === 'date' ? 'font-mono' : ''}`}
                                            value={data[key] ?? ''}
                                            onChange={(e) => set(key, e.target.value)}
                                        />
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            {section.notes && (
                <div className="mt-3">
                    <span className={label}>Notes</span>
                    <textarea
                        rows={2}
                        className={`${input} resize-y`}
                        value={data[section.notes.key] ?? ''}
                        onChange={(e) => set(section.notes.key, e.target.value)}
                    />
                </div>
            )}
        </div>
    );
}

function Section({ section, data, set }) {
    return (
        <div className={`${card} p-5`}>
            <div className="mb-4">
                <div className="flex items-baseline gap-2">
                    <h3 className="text-sm font-bold text-gray-800">{section.title}</h3>
                    {section.page && (
                        <span className="text-[10px] font-mono text-gray-300">p.{section.page}</span>
                    )}
                </div>
                {section.hint && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{section.hint}</p>}
            </div>

            {section.type === 'table'
                ? <TableSection section={section} data={data} set={set} />
                : (
                    // Short answers sit three-up; anything marked `wide` (a
                    // question with option rows, a tick-list, a notes box) spans
                    // the full width so it stays readable.
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-5">
                        {(section.fields || []).map((f) => (
                            <div key={f.key} className={f.wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
                                <Field field={f} data={data} set={set} />
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
}

// ─── View ────────────────────────────────────────────────────────────────────

export default function DocumentFormView({ schema }) {
    const [initial]  = useState(() => loadDocument(schema.id));
    const [canStore] = useState(() => storageAvailable());   // probes storage — do it once
    const [data, setData]       = useState(initial.data);
    const [savedAt, setSavedAt] = useState(initial.savedAt);
    const [active, setActive]   = useState(schema.sections[0]?.id);
    const [busy, setBusy]       = useState(false);
    const [message, setMessage] = useState(null);   // { tone, text }
    const dirty   = useRef(false);
    const fileRef = useRef(null);

    const wizard = schema.layout === 'wizard';

    // ── Auto-save (debounced). Skipped until the adviser actually edits, so
    //    simply opening a tab never rewrites storage.
    useEffect(() => {
        if (!dirty.current) return undefined;
        const t = setTimeout(() => {
            const at = saveDocument(schema.id, data);
            if (at) setSavedAt(at);
            else setMessage({ tone: 'warn', text: 'Could not auto-save — export to JSON to avoid losing this.' });
        }, 600);
        return () => clearTimeout(t);
    }, [data, schema.id]);

    const set = useCallback((key, value) => {
        dirty.current = true;
        setData((d) => ({ ...d, [key]: value }));
    }, []);

    // ── Progress ────────────────────────────────────────────────────────────
    const progress = useMemo(() => {
        const per = {};
        let done = 0;
        let total = 0;
        schema.sections.forEach((s) => {
            const keys = sectionKeys(s);
            const n = keys.filter((k) => isAnswered(data[k])).length;
            per[s.id] = { done: n, total: keys.length };
            done += n;
            total += keys.length;
        });
        return { per, done, total };
    }, [schema.sections, data]);

    // ── Actions ─────────────────────────────────────────────────────────────
    const handleDownload = async () => {
        setBusy(true);
        setMessage(null);
        try {
            const { bytes, written, failed } = await fillDocument(schema, data);
            downloadPdf(bytes, documentFileName(schema, data));
            setMessage(failed.length
                ? { tone: 'warn', text: `Downloaded with ${written} fields filled — ${failed.length} could not be written (see the browser console).` }
                : { tone: 'ok', text: `Downloaded — ${written} fields written into the document.` });
        } catch (err) {
            setMessage({ tone: 'error', text: err?.message || 'The document could not be generated.' });
        } finally {
            setBusy(false);
        }
    };

    const handleImport = (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';                       // allow re-importing the same file
        if (!file) return;
        importDocumentJson(file, schema.id)
            .then((imported) => {
                dirty.current = true;
                setData(imported);
                setMessage({ tone: 'ok', text: `Imported ${Object.keys(imported).length} saved answers.` });
            })
            .catch((err) => setMessage({ tone: 'error', text: err.message }));
    };

    const handleClear = () => {
        const answered = progress.done;
        const warning = answered
            ? `Clear this document? ${answered} completed field${answered === 1 ? '' : 's'} will be deleted from this browser.`
            : 'Clear this document?';
        if (!window.confirm(warning)) return;
        clearDocument(schema.id);
        dirty.current = false;
        setData({});
        setSavedAt(null);
        setMessage({ tone: 'ok', text: 'Cleared.' });
    };

    const savedLabel = savedAt
        ? `Saved ${new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : canStore ? 'Not saved yet' : 'Browser storage unavailable';

    const activeSection = schema.sections.find((s) => s.id === active) || schema.sections[0];
    const activeIndex   = schema.sections.findIndex((s) => s.id === activeSection?.id);

    const tone = {
        ok:    'bg-emerald-50 border-emerald-200 text-emerald-700',
        warn:  'bg-amber-50 border-amber-200 text-amber-700',
        error: 'bg-rose-50 border-rose-200 text-rose-700',
    };

    return (
        <div className="max-w-7xl mx-auto px-4">
            {/* ── Boxless view header ─────────────────────────────────────── */}
            <div className="mb-5">
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{schema.title}</h2>
                <p className="text-gray-500 text-sm">{schema.subtitle}</p>
            </div>

            {/* ── Action bar ──────────────────────────────────────────────── */}
            <div className={`${card} p-4 mb-5 flex flex-wrap items-center gap-3`}>
                <button className={btnMain} onClick={handleDownload} disabled={busy}>
                    <Download size={14} /> {busy ? 'Generating…' : 'Download PDF'}
                </button>
                <button className={btnGhost} onClick={() => exportDocumentJson(schema, data)}>
                    <FileText size={14} /> Export JSON
                </button>
                <button className={btnGhost} onClick={() => fileRef.current?.click()}>
                    <Upload size={14} /> Import JSON
                </button>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />

                <div className="flex-1" />

                <span className="text-xs text-gray-500 font-mono">
                    {progress.done}<span className="text-gray-300"> / {progress.total}</span> fields
                </span>
                <span className={`text-xs font-bold flex items-center gap-1 ${savedAt ? 'text-emerald-600' : 'text-gray-400'}`}>
                    <Check size={13} /> {savedLabel}
                </span>
                <button className={`${btnGhost} hover:border-rose-300 hover:text-rose-600`} onClick={handleClear}>
                    <Trash2 size={14} /> Clear
                </button>
            </div>

            {message && (
                <div className={`rounded-xl border px-4 py-2.5 mb-5 text-xs flex items-start gap-2 ${tone[message.tone]}`}>
                    {message.tone === 'ok' ? <Check size={14} className="mt-0.5 shrink-0" />
                        : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                    <span>{message.text}</span>
                </div>
            )}

            {/* ── Sections ────────────────────────────────────────────────── */}
            {wizard ? (
                <div className="flex flex-col lg:flex-row gap-5 items-start">
                    <nav className={`${card} p-2 w-full lg:w-64 shrink-0 lg:sticky lg:top-32`}>
                        {schema.sections.map((s) => {
                            const p = progress.per[s.id];
                            const on = s.id === activeSection?.id;
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => setActive(s.id)}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                                        on ? 'bg-brand-tint text-brand' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                                    }`}
                                >
                                    <span className="flex-1 truncate">{s.title}</span>
                                    <span className={`text-[10px] font-mono shrink-0 ${
                                        p.done === 0 ? 'text-gray-300'
                                            : p.done === p.total ? 'text-emerald-500' : 'text-brand6'
                                    }`}>
                                        {p.done}/{p.total}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="flex-1 min-w-0">
                        {activeSection && <Section section={activeSection} data={data} set={set} />}
                        <div className="flex justify-between mt-4">
                            <button
                                className={btnGhost}
                                disabled={activeIndex <= 0}
                                onClick={() => setActive(schema.sections[activeIndex - 1].id)}
                            >
                                <ChevronRight size={14} className="rotate-180" /> Previous
                            </button>
                            <button
                                className={btnGhost}
                                disabled={activeIndex >= schema.sections.length - 1}
                                onClick={() => setActive(schema.sections[activeIndex + 1].id)}
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    {schema.sections.map((s) => (
                        <Section key={s.id} section={s} data={data} set={set} />
                    ))}
                </div>
            )}

            {schema.footnote && (
                <p className="text-[11px] text-gray-400 leading-relaxed mt-6 max-w-4xl">{schema.footnote}</p>
            )}
            <p className="text-[11px] text-gray-400 leading-relaxed mt-3 max-w-4xl">
                Answers are saved in this browser only and are never uploaded. Use <strong>Clear</strong> to remove
                client data from a shared machine.
            </p>
        </div>
    );
}
