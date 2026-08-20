// ─────────────────────────────────────────────────────────────────────────────
// documents/index.js — registry of completable documents.
//
// Each entry pairs a sub-tab id with the schema that drives it. App.jsx reads
// DOCUMENT_TABS for the sub-tab bar; DocumentFormView renders whichever schema
// it is handed. To add a document: drop the PDF in public/forms, write a
// schema, and add it here.
// ─────────────────────────────────────────────────────────────────────────────

import { FACT_FIND_SCHEMA } from './factFindSchema';
import { ATRQ_SCHEMA }      from './atrqSchema';
import { KE_SCHEMA }        from './keSchema';
import { OXFORD_SCHEMA }    from './oxfordSchema';

/** Sub-tab id → schema. Ids are also the localStorage keys (gsb_doc_<id>). */
export const DOCUMENT_SCHEMAS = {
    docfactfind: FACT_FIND_SCHEMA,
    docatrq:     ATRQ_SCHEMA,
    docke:       KE_SCHEMA,
    docoxford:   OXFORD_SCHEMA,
};

/** Order and labels for the Documents sub-tab bar. */
export const DOCUMENT_TABS = [
    { id: 'docfactfind', label: 'Fact Find (KYC)' },
    { id: 'docatrq',     label: 'ATRQ' },
    { id: 'docke',       label: 'K&E' },
    { id: 'docoxford',   label: 'Oxford Risk' },
];

export const DOCUMENT_TAB_IDS = DOCUMENT_TABS.map((t) => t.id);
