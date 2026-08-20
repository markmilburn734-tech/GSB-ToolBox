// ─────────────────────────────────────────────────────────────────────────────
// oxfordSchema.js — Oxford Risk Tolerance Questionnaire
//
// Source: public/forms/oxford-risk.pdf (2 pages, 18 statements + confirmation).
//
// Each statement is a radio group RB1…RB18 with export values '0'…'4' for the
// printed 1–5 scale (1 = strongly disagree … 5 = strongly agree). The groups
// are laid out strictly top-to-bottom in numeric order on page 1.
//
// NOT SCORED by design. The document places the client in one of five Risk
// Tolerance categories but does not publish the formula, and half the
// statements are reverse-worded — guessing a key would produce an
// authoritative-looking category that is not the validated one. The adviser
// enters the category from the official scoring, and the ToolBox writes it
// into the box on page 2.
// ─────────────────────────────────────────────────────────────────────────────

/** The printed 1–5 scale. Export values are 0-based, labels are 1-based. */
const LIKERT = [
    { value: '0', label: '1' },
    { value: '1', label: '2' },
    { value: '2', label: '3' },
    { value: '3', label: '4' },
    { value: '4', label: '5' },
];

/**
 * Statements 1–18 as [AcroForm field name, printed text].
 *
 * The field names are written out literally rather than built as `RB${n}` so
 * scripts/verify_documents.py can audit the mapping against the real PDF — and
 * so a future reader can grep for a field name and find it.
 */
const STATEMENTS = [
    ['RB1',  'I would probably invest a very significant amount in a high-risk investment.'],
    ['RB2',  'I would be happy putting my money into the stock market.'],
    ['RB3',  'I would worry a great deal if I thought I would lose money in an investment.'],
    ['RB4',  'I would consider investing in a risky investment for the excitement of seeing whether it goes up or down in value.'],
    ['RB5',  'I would worry about losing money on the stock market.'],
    ['RB6',  'Risks are necessary to make money.'],
    ['RB7',  'The level of risk doesn’t matter; it is more important to have the opportunity of achieving higher returns with my money.'],
    ['RB8',  'I would be anxious if I saw my investments had gone down in value.'],
    ['RB9',  'I would be happy to accept large short term falls in the value of my investments to maximise my potential longer-term returns.'],
    ['RB10', 'I worry about the instability of the stock market.'],
    ['RB11', 'I believe that I generally take bigger investment risks with my money than other people.'],
    ['RB12', 'I would be happy to risk losses to get potentially greater long-term gains.'],
    ['RB13', 'I would get a thrill from making risky investments with my money.'],
    ['RB14', 'If there’s a chance of making better long-term returns, I’m prepared to take an investment risk.'],
    ['RB15', 'I would rather have a predictable investment outcome than one which is potentially higher, but unpredictable.'],
    ['RB16', 'I expect high investment growth and I am willing to accept the consequent possibility of large losses.'],
    ['RB17', 'The idea that the value of my investments can be variable makes me feel anxious.'],
    ['RB18', 'In my view, you need to take risks to make money.'],
];

/** The five categories, as described on page 2 of the document. */
export const OXFORD_CATEGORIES = [
    { value: '1', label: '1 — The Cautious Investor' },
    { value: '2', label: '2 — The Cautiously Balanced Investor' },
    { value: '3', label: '3 — The Balanced Investor' },
    { value: '4', label: '4 — The Growth Investor' },
    { value: '5', label: '5 — The Speculator Investor' },
];

/** @type {import('./documentTypes').DocumentSchema} */
export const OXFORD_SCHEMA = {
    id: 'oxford',
    title: 'Oxford Risk Tolerance',
    subtitle: '18 statements scored 1–5 — UK, Western Europe, U.A.E. and Australasia',
    pdf: '/forms/oxford-risk.pdf',
    fileStem: 'Risk Tolerance Questionnaire',
    nameKey: 'clientName',
    layout: 'scroll',
    footnote:
        'The ToolBox captures the responses and writes them into the questionnaire; it does not compute the '
        + 'Risk Tolerance category, because the validated scoring key is not published in the document. Enter '
        + 'the category from the official scoring and it will be written into the box on page 2. Risk Tolerance '
        + 'is independent of wealth, income and objectives, and is unlikely to change much over time.',

    sections: [
        {
            id: 'header',
            title: 'Client & Adviser',
            page: 1,
            fields: [
                { key: 'clientName', label: 'Client’s Name', type: 'text', pdf: 'Text Field 26' },
                { key: 'date', label: 'Date', type: 'date', pdf: 'Text Field 27' },
                { key: 'adviserName', label: 'Adviser’s Name', type: 'text', pdf: 'Text Field 28' },
                { key: 'reference', label: 'Reference', type: 'text', pdf: 'Text Field 29' },
            ],
        },

        {
            id: 'statements',
            title: 'Risk Tolerance Statements',
            page: 1,
            hint: 'On a scale of 1 to 5, where 1 is “Strongly disagree” and 5 is “Strongly agree”. Answer each '
                + 'thoughtfully and honestly — if a statement seems open to interpretation, give the most '
                + 'intuitive response.',
            fields: STATEMENTS.map(([pdf, text], i) => ({
                key: pdf.toLowerCase(),
                label: `${i + 1}. ${text}`,
                type: 'radio',
                pdf,
                options: LIKERT,
                inline: true,
                wide: true,
            })),
        },

        {
            id: 'outcome',
            title: 'Risk Tolerance Category',
            page: 2,
            hint: 'Entered by the adviser from the official scoring — the ToolBox does not calculate it.',
            fields: [
                {
                    key: 'category',
                    label: 'Risk Tolerance category',
                    type: 'radio',
                    pdf: 'Text Field 43',
                    writeAs: 'text',      // a text box on the document, not a radio widget
                    options: OXFORD_CATEGORIES,
                    wide: true,
                },
                {
                    key: 'confirmed',
                    label: 'Client confirms the category is a fair measure of their comfort with risk',
                    type: 'checkbox',
                    pdf: 'Check Box 273',
                    wide: true,
                },
                { key: 'customerName', label: 'Customer Name', type: 'text', pdf: 'Text Field 42' },
                { key: 'signDate', label: 'Date', type: 'date', pdf: 'Text Field 41' },
            ],
        },
    ],
};

export default OXFORD_SCHEMA;
