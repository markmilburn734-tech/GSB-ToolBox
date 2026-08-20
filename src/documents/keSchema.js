// ─────────────────────────────────────────────────────────────────────────────
// keSchema.js — Knowledge & Experience Questionnaire
//
// Source: public/forms/knowledge-experience.pdf (1 page, 24 tick boxes).
//
// The checkbox field names in the source PDF are NOT in reading order —
// "Check Box23" sits second in question 2, "Check Box3" second-to-last in
// question 3, and so on. The mapping below was derived from the widget
// rectangles (top-to-bottom y position on the page), not from the names.
// Do not "tidy" these into numeric order; that would silently tick the wrong
// boxes on the printed document.
//
// SCORING: unlike the ATRQ and Oxford questionnaires, this document prints its
// own key (0 / 1-8 / 9-16 / 17-21) and carries a field for the result, so the
// ToolBox fills it in. The score is simply the number of investment types
// ticked across the three questions — the three "none of the above" options do
// not score, which is what makes 21 (3 × 7) the maximum the key describes.
// ─────────────────────────────────────────────────────────────────────────────

/** The seven scoring investment types, printed identically under each question. */
const TYPES = [
    'Cash Deposits or Government Bonds',
    'Investment grade corporate bonds or “High Yield” corporate bonds',
    'UK or Overseas shares in developed markets',
    'Emerging market shares or smaller company shares',
    'Absolute-return style investments or hedge funds',
    'Unregulated investments, Venture Capital Trusts or EIS schemes',
    'Speculative options, Futures or “Spread betting” accounts',
];

/**
 * Builds one question's tick-list.
 * @param {string} prefix   answer-key prefix (q1/q2/q3)
 * @param {string[]} boxes  PDF field names, in the order the options are PRINTED
 * @param {string} noneLabel label of the trailing non-scoring option
 */
function tickList(prefix, boxes, noneLabel) {
    const items = TYPES.map((label, i) => ({
        key: `${prefix}_${i + 1}`,
        label: `${i + 1}. ${label}`,
        pdf: boxes[i],
    }));
    items.push({ key: `${prefix}_none`, label: `8. ${noneLabel}`, pdf: boxes[7], noScore: true });
    return items;
}

// Widget order on the page, top → bottom. Derived from the PDF, not guessed.
const Q1_BOXES = ['Check Box1', 'Check Box5', 'Check Box4', 'Check Box6',
                  'Check Box7', 'Check Box8', 'Check Box9', 'Check Box10'];
const Q2_BOXES = ['Check Box11', 'Check Box23', 'Check Box12', 'Check Box13',
                  'Check Box14', 'Check Box22', 'Check Box21', 'Check Box15'];
const Q3_BOXES = ['Check Box18', 'Check Box16', 'Check Box17', 'Check Box19',
                  'Check Box20', 'Check Box24', 'Check Box3', 'Check Box27'];

const SCORING_KEYS = ['q1', 'q2', 'q3'].flatMap(
    (p) => TYPES.map((_, i) => `${p}_${i + 1}`),
);

/**
 * Number of investment types ticked across all three questions (0–21).
 * @param {Record<string, any>} data
 */
export function keScore(data) {
    return SCORING_KEYS.reduce((n, k) => n + (data[k] ? 1 : 0), 0);
}

/** The band descriptions exactly as printed on the source document. */
export const KE_BANDS = [
    {
        max: 0, name: 'No Previous K&E',
        text: 'As a relatively inexperienced investor, potentially investing for the first time, please be '
            + 'mindful of the need to understand and explore to your satisfaction the investment choices '
            + 'presented to you by your Financial Adviser.',
    },
    {
        max: 8, name: 'Low K&E',
        text: 'As a relatively inexperienced investor, please be mindful of the need to understand and '
            + 'explore to your satisfaction the investment choices presented to you by your Financial Adviser.',
    },
    {
        max: 16, name: 'Medium K&E',
        text: 'As a moderately experienced investor, please be mindful of the need to understand and explore '
            + 'to your satisfaction the investment choices presented to you by your Financial Adviser. '
            + 'Understanding the risk reward dynamics of your investments is a key part of maintaining '
            + 'reasonable expectations from your investments.',
    },
    {
        max: 21, name: 'High K&E',
        text: 'As an experienced investor, please be mindful of the need to understand and explore to your '
            + 'satisfaction the investment choices presented to you by your Financial Adviser. Understanding '
            + 'the risk reward dynamics of your investments is a key part of maintaining reasonable '
            + 'expectations from your investments. Discussing prior experiences with your adviser may help '
            + 'them better understand your requirements and preferences when investing.',
    },
];

/** @param {number} score */
export const keBand = (score) => KE_BANDS.find((b) => score <= b.max) || KE_BANDS[KE_BANDS.length - 1];

/** @type {import('./documentTypes').DocumentSchema} */
export const KE_SCHEMA = {
    id: 'ke',
    title: 'Knowledge & Experience',
    subtitle: 'Three tick-lists — scored 0–21 against the key printed on the document',
    pdf: '/forms/knowledge-experience.pdf',
    fileStem: 'Knowledge and Experience',
    nameKey: 'clientName',
    layout: 'scroll',
    footnote:
        'Knowledge & Experience does not change a client’s risk tolerance — per the document, it gives the '
        + 'adviser further insight into what guidance is suitable. The signature and date lines are printed '
        + 'rules rather than form fields, so they are completed on the downloaded document.',

    sections: [
        {
            id: 'q1',
            title: 'Question 1 — Could explain to a friend',
            page: 1,
            hint: 'Tick the box for each investment type the client understands well enough to explain to a friend.',
            fields: [{
                key: 'q1', label: 'Investment types the client could explain', type: 'checkgroup', wide: true,
                items: tickList('q1', Q1_BOXES, 'I don’t think I could explain any of them'),
            }],
        },
        {
            id: 'q2',
            title: 'Question 2 — Held previously',
            page: 1,
            fields: [{
                key: 'q2', label: 'Investment products held at any time previously', type: 'checkgroup', wide: true,
                items: tickList('q2', Q2_BOXES, 'None of the above'),
            }],
        },
        {
            id: 'q3',
            title: 'Question 3 — Currently held',
            page: 1,
            fields: [{
                key: 'q3', label: 'Investment products currently held', type: 'checkgroup', wide: true,
                items: tickList('q3', Q3_BOXES, 'None of the above'),
            }],
        },
        {
            id: 'result',
            title: 'Score & Category',
            page: 1,
            fields: [
                {
                    key: 'score',
                    label: 'Knowledge & Experience score',
                    type: 'computed',
                    pdf: 'Text2',
                    wide: true,
                    compute: (data) => String(keScore(data)),
                    describe: (data) => {
                        const score = keScore(data);
                        const band = keBand(score);
                        return { value: `${score} / 21`, name: band.name, text: band.text };
                    },
                    note: 'Written into the score box on the document. Counts the seven investment types under '
                        + 'each question; the “none of the above” options do not score.',
                },
                { key: 'clientName', label: 'Name', type: 'text', pdf: 'Text1', wide: true },
            ],
        },
    ],
};

export default KE_SCHEMA;
