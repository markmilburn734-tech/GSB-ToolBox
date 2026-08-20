// ─────────────────────────────────────────────────────────────────────────────
// docStore.js
//
// Persistence for the completable documents. These are the ONE exception to the
// app-wide "in-session only, no localStorage" rule (see DEVELOPMENT.md §8): a
// 699-field fact find that evaporates on an accidental refresh is unusable.
//
// Scope of the exception:
//   • only the four document tabs write to localStorage — the calculators and
//     rebalancers are unchanged and still clear on refresh;
//   • data never leaves the browser (no backend, no telemetry);
//   • every document has a visible Clear button so an adviser can wipe client
//     data off a shared machine in one click.
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = 'gsb_doc_';
const VERSION = 1;

/** @param {string} id */
const storageKey = (id) => `${PREFIX}${id}`;

/**
 * localStorage can be unavailable (private mode, locked-down browser). Every
 * accessor degrades to in-memory only rather than throwing.
 * @returns {Storage|null}
 */
function safeStorage() {
    try {
        const s = window.localStorage;
        const probe = `${PREFIX}__probe`;
        s.setItem(probe, '1');
        s.removeItem(probe);
        return s;
    } catch {
        return null;
    }
}

export const storageAvailable = () => safeStorage() !== null;

/**
 * Reads a saved document. Returns `{}` when there is nothing stored or the
 * payload is unreadable — a corrupt entry must never block the tab.
 * @param {string} id
 * @returns {{ data: Record<string, any>, savedAt: string|null }}
 */
export function loadDocument(id) {
    const store = safeStorage();
    if (!store) return { data: {}, savedAt: null };
    try {
        const raw = store.getItem(storageKey(id));
        if (!raw) return { data: {}, savedAt: null };
        const parsed = JSON.parse(raw);
        return {
            data: (parsed && typeof parsed.data === 'object' && parsed.data) || {},
            savedAt: parsed?.savedAt || null,
        };
    } catch (err) {
        console.warn(`[GSB] Stored document "${id}" was unreadable and has been ignored:`, err);
        return { data: {}, savedAt: null };
    }
}

/**
 * @param {string} id
 * @param {Record<string, any>} data
 * @returns {string|null} ISO timestamp written, or null if storage is unavailable
 */
export function saveDocument(id, data) {
    const store = safeStorage();
    if (!store) return null;
    const savedAt = new Date().toISOString();
    try {
        store.setItem(storageKey(id), JSON.stringify({ version: VERSION, savedAt, data }));
        return savedAt;
    } catch (err) {
        // Quota exceeded is the realistic failure — surface it rather than
        // pretending the document is safe.
        console.error(`[GSB] Could not auto-save document "${id}":`, err);
        return null;
    }
}

/** @param {string} id */
export function clearDocument(id) {
    const store = safeStorage();
    if (store) store.removeItem(storageKey(id));
}

// ─── JSON export / import ────────────────────────────────────────────────────
//
// Lets a fact find move between machines or be filed alongside the client
// record. The envelope carries the document id so an import can refuse a file
// that belongs to a different form.

/**
 * @param {import('./documentTypes').DocumentSchema} schema
 * @param {Record<string, any>} data
 */
export function exportDocumentJson(schema, data) {
    const who = schema.nameKey ? String(data[schema.nameKey] || '').trim() : '';
    const stamp = new Date().toISOString().slice(0, 10);
    const name = [schema.fileStem, who, stamp].filter(Boolean).join(' - ')
        .replace(/[\\/:*?"<>|]/g, '');

    const payload = {
        gsbToolbox: 'document',
        version: VERSION,
        documentId: schema.id,
        documentTitle: schema.title,
        exportedAt: new Date().toISOString(),
        data,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Reads a previously exported .json back into an answer object.
 * @param {File} file
 * @param {string} expectedId
 * @returns {Promise<Record<string, any>>}
 */
export function importDocumentJson(file, expectedId) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('The file could not be read.'));
        reader.onload = () => {
            try {
                const parsed = JSON.parse(String(reader.result));
                const data = parsed?.data ?? parsed;
                if (!data || typeof data !== 'object' || Array.isArray(data)) {
                    throw new Error('That file does not contain document answers.');
                }
                if (parsed?.documentId && parsed.documentId !== expectedId) {
                    throw new Error(
                        `That file is a "${parsed.documentTitle || parsed.documentId}" export — open that tab to import it.`,
                    );
                }
                resolve(data);
            } catch (err) {
                reject(err instanceof SyntaxError ? new Error('That file is not valid JSON.') : err);
            }
        };
        reader.readAsText(file);
    });
}
