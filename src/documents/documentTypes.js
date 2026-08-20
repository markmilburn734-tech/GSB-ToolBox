// ─────────────────────────────────────────────────────────────────────────────
// documentTypes.js
//
// JSDoc typedefs shared by the four document schemas. There is no runtime code
// here — it exists so editors can check schema shape and so the generated
// factFindSchema.js has something to point `@type` at.
//
// A schema is a pure description of ONE completable document:
//   • what the adviser sees on screen (sections → fields)
//   • which AcroForm field in the source PDF each answer writes to (`pdf`)
// The renderer (DocumentFormView) and the filler (pdfFill) are both generic —
// adding a fifth document means adding a schema, not adding components.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'text'|'textarea'|'date'|'email'|'number'|'radio'|'checkbox'|'checkgroup'} FieldType
 */

/**
 * @typedef {object} FieldOption
 * @property {string} value  export value of the PDF radio widget (e.g. '0'…'4')
 * @property {string} label  what the adviser reads on screen
 */

/**
 * @typedef {object} SchemaField
 * @property {string}  key              key in the saved answer object
 * @property {string}  label            visible label
 * @property {FieldType} type
 * @property {string}  [pdf]            fully-qualified AcroForm field name
 * @property {FieldOption[]} [options]  for `radio`
 * @property {SchemaField[]} [items]    for `checkgroup` — each item is its own checkbox field
 * @property {string}  [note]           small grey caption under the field
 * @property {number}  [rows]           textarea height
 * @property {boolean} [wide]           span the full width of the grid
 */

/**
 * A section is EITHER a list of fields (`fields`) or a fixed-row table
 * (`type: 'table'`). Tables mirror the ruled grids in the source PDFs, so the
 * row count is whatever the document prints — advisers cannot add rows.
 *
 * @typedef {object} SchemaSection
 * @property {string}   id
 * @property {string}   title
 * @property {number}   [page]        page of the source PDF (shown as a hint)
 * @property {string}   [hint]
 * @property {'table'}  [type]
 * @property {SchemaField[]} [fields]
 * @property {string[]} [columns]     table column headers
 * @property {string[]} [columnTypes] per-column input type, defaults to text
 * @property {string[][]} [cells]     [row][col] → AcroForm field name
 * @property {{key:string, pdf:string}} [notes]  free-text notes box under a table
 */

/**
 * @typedef {object} DocumentSchema
 * @property {string} id                 storage key + sub-tab id
 * @property {string} title
 * @property {string} subtitle
 * @property {string} pdf                path to the source PDF under /public
 * @property {string} fileStem           download filename stem
 * @property {string} [nameKey]          answer key appended to the filename
 * @property {'scroll'|'wizard'} [layout] default 'scroll'
 * @property {string} [footnote]         small print shown under the form
 * @property {SchemaSection[]} sections
 */

export {};
