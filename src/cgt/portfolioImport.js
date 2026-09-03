// ─────────────────────────────────────────────────────────────────────────────
// portfolioImport.js — reads a client portfolio out of a spreadsheet.
//
// Expected columns (case-insensitive, order-independent):
//
//     Name | Currency | Price | Qty | Avg Price
//
// Everything else is optional. Header names are matched against a list of
// aliases, the way api.js handles the Google Sheet, so a custodian export that
// says "Quantity" or "Average Cost" imports without being reformatted first.
//
// AVG PRICE IS READ AS GBP BY DEFAULT. A UK capital gain includes the currency
// move between purchase and sale, so the cost that matters is what the client
// actually paid in sterling. If the sheet quotes cost in the holding's own
// currency, `avgCostInNative` converts at TODAY's rate — which is FX-blind and
// wrong in a way the UI has to say out loud.
//
// Rows are never silently dropped: anything unusable comes back in `issues`
// with its row number, so the adviser can see what didn't import.
// ─────────────────────────────────────────────────────────────────────────────

import Papa from 'papaparse';

/** Column aliases, richest first. */
const COLUMNS = {
    name:     ['name', 'asset name', 'holding', 'fund name', 'security', 'description', 'investment'],
    currency: ['currency', 'ccy', 'curr', 'denomination'],
    price:    ['price', 'current price', 'market price', 'last price', 'unit price', 'mid price'],
    qty:      ['qty', 'quantity', 'units', 'shares', 'nominal', 'holding units', 'no of units'],
    avgCost:  ['avg price', 'average price', 'avg cost', 'average cost', 'book cost per unit',
               'cost per unit', 'avg book cost', 'base cost'],
    bookCost: ['book cost', 'total book cost', 'total cost', 'cost basis', 'acquisition cost'],
    isin:     ['isin'],
    ticker:   ['ticker', 'symbol', 'epic', 'code'],
};

/** Strips whitespace and invisible characters Excel likes to leave behind. */
function clean(raw) {
    if (raw == null) return '';
    // Same control/BOM/zero-width/nbsp set that api.js strips off the Sheet feed.
    return String(raw).trim().replace(/[\u0000-\u001F\u007F-\u009F\uFEFF\u200B\u00A0]/gu, '');
}

/**
 * Parses a spreadsheet number: strips currency symbols, thousands separators
 * and percent signs, and reads (1,234) as negative.
 */
function num(raw) {
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
    let s = clean(raw);
    if (!s) return NaN;
    const negative = /^\(.*\)$/.test(s);
    s = s.replace(/[()]/g, '').replace(/[£$€¥]|CHF|GBP|USD|EUR/gi, '').replace(/[,\s]/g, '');
    const v = parseFloat(s);
    if (!Number.isFinite(v)) return NaN;
    return negative ? -v : v;
}

/** Builds header → canonical-field lookup for one row of headers. */
function mapHeaders(headers) {
    /** @type {Record<string,string>} */
    const map = {};
    const seen = new Set();

    headers.forEach((raw) => {
        const h = clean(raw).toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
        if (!h) return;
        for (const [field, aliases] of Object.entries(COLUMNS)) {
            if (seen.has(field)) continue;
            if (aliases.includes(h)) {
                map[raw] = field;
                seen.add(field);
                return;
            }
        }
    });

    // Second pass: allow partial matches ("Market Price (GBP)") for anything
    // still unmatched, so a decorated header doesn't fail the import.
    headers.forEach((raw) => {
        if (map[raw]) return;
        const h = clean(raw).toLowerCase();
        if (!h) return;
        for (const [field, aliases] of Object.entries(COLUMNS)) {
            if (seen.has(field)) continue;
            if (aliases.some((a) => h.includes(a))) {
                map[raw] = field;
                seen.add(field);
                return;
            }
        }
    });

    return map;
}

/**
 * Turns raw rows (array of objects keyed by header) into holdings.
 * @returns {{ holdings: object[], issues: string[], mapped: Record<string,string> }}
 */
export function rowsToHoldings(rows) {
    const issues = [];
    if (!rows.length) return { holdings: [], issues: ['The file has no rows.'], mapped: {} };

    const mapped = mapHeaders(Object.keys(rows[0]));
    const fields = new Set(Object.values(mapped));

    const missing = ['name', 'price', 'qty'].filter((f) => !fields.has(f));
    if (missing.length) {
        return {
            holdings: [],
            mapped,
            issues: [`Could not find a column for: ${missing.join(', ')}. `
                + `Expected headers like Name, Currency, Price, Qty, Avg Price.`],
        };
    }
    if (!fields.has('avgCost') && !fields.has('bookCost')) {
        issues.push('No average cost or book cost column found — gains will read as zero until you add one.');
    }

    const holdings = [];
    rows.forEach((row, i) => {
        /** @type {Record<string, any>} */
        const rec = {};
        Object.entries(mapped).forEach(([header, field]) => { rec[field] = row[header]; });

        const name = clean(rec.name);
        if (!name) return;                                    // blank spacer row

        const qty = num(rec.qty);
        const price = num(rec.price);
        const rowNo = i + 2;                                  // +1 header, +1 to 1-index

        if (!Number.isFinite(qty) || qty <= 0) {
            issues.push(`Row ${rowNo} (${name}): quantity is missing or not a number — skipped.`);
            return;
        }
        if (!Number.isFinite(price) || price < 0) {
            issues.push(`Row ${rowNo} (${name}): price is missing or not a number — skipped.`);
            return;
        }

        // Cost per unit, from whichever column the sheet supplies.
        let avgCost = num(rec.avgCost);
        if (!Number.isFinite(avgCost)) {
            const book = num(rec.bookCost);
            avgCost = Number.isFinite(book) && qty > 0 ? book / qty : NaN;
        }
        if (!Number.isFinite(avgCost) || avgCost < 0) {
            avgCost = 0;
            issues.push(`Row ${rowNo} (${name}): no usable cost — treated as £0 cost (full proceeds are gain).`);
        }

        const currency = clean(rec.currency).toUpperCase() || 'GBP';

        holdings.push({
            id: `imp-${i}-${name.slice(0, 24).replace(/\W+/g, '')}`,
            name,
            currency,
            ticker: clean(rec.ticker).toUpperCase(),
            isin: clean(rec.isin).toUpperCase(),
            qty,
            price,
            avgCost,
            locked: false,
            forced: false,
        });
    });

    if (!holdings.length && !issues.length) issues.push('No usable holdings found in the file.');
    return { holdings, issues, mapped };
}

/**
 * Reads a .csv/.tsv file.
 * @param {File} file
 */
function readCsv(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => (h || '').trim(),
            complete: ({ data }) => resolve(data),
            error: (err) => reject(new Error(`Could not read the CSV: ${err?.message || err}`)),
        });
    });
}

/**
 * Reads an .xlsx/.xls file. SheetJS is imported lazily so its ~800KB only
 * downloads when someone actually uploads a workbook.
 * @param {File} file
 */
async function readExcel(file) {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // Use the first sheet that actually has rows — exports often lead with a
    // cover or parameters tab.
    for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: true });
        if (rows.length) return rows;
    }
    return [];
}

/**
 * Reads a portfolio file of any supported type.
 * @param {File} file
 * @returns {Promise<{ holdings: object[], issues: string[], mapped: Record<string,string>, source: string }>}
 */
export async function importPortfolioFile(file) {
    const name = (file?.name || '').toLowerCase();
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xlsm') || name.endsWith('.xls');

    const rows = isExcel ? await readExcel(file) : await readCsv(file);
    const result = rowsToHoldings(rows);
    return { ...result, source: file?.name || 'portfolio' };
}

// ─── Template ────────────────────────────────────────────────────────────────

export const TEMPLATE_HEADERS = ['Name', 'Currency', 'Price', 'Qty', 'Avg Price', 'ISIN', 'Ticker'];

const TEMPLATE_ROWS = [
    ['Example: BP plc', 'GBP', '5.37', '2000', '4.10', 'GB0007980591', 'BP.L'],
    ['Example: AT&T Inc.', 'USD', '27.40', '1500', '18.20', 'US00206R1023', 'T'],
    ['Example: Diageo plc', 'GBP', '19.85', '800', '24.50', 'GB0002374006', 'DGE.L'],
];

/** Downloads a blank template in the format the importer expects. */
export function downloadTemplate() {
    const lines = [
        TEMPLATE_HEADERS.join(','),
        ...TEMPLATE_ROWS.map((r) => r.map((c) => (/[",]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'GSB CGT portfolio template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
