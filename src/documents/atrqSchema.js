// ─────────────────────────────────────────────────────────────────────────────
// atrqSchema.js — GSB Attitude to Risk Questionnaire (v4, 05.02.2025)
//
// Source: public/forms/gsb-atrq.pdf (42 AcroForm fields over 5 pages).
//
// Field-name notes, all read out of the real document:
//   • Questions 1–13 are radio groups named "Question 1"…"Question 13" whose
//     export values are '0'…'4', top option first. Question 10 has only three.
//   • "Question 14" is NOT question 14 on the page — it is the investment-term
//     control printed under question 13. The page's questions 14/15/16 are the
//     tick-lists on page 5, whose fields are named after their labels.
//   • The signature is a /Sig widget and cannot be filled programmatically, so
//     the document is downloaded unsigned for wet or digital signing.
//
// NOT SCORED by design — the ToolBox captures answers and produces the
// document; the adviser applies the scoring key outside the tool.
// ─────────────────────────────────────────────────────────────────────────────

/** The five-point agree/disagree scale used by Q1, 5, 6, 11 and 13. */
const AGREE_SCALE = [
    { value: '0', label: 'I strongly agree with this statement' },
    { value: '1', label: 'I tend to agree with this statement' },
    { value: '2', label: 'In between' },
    { value: '3', label: 'I tend to disagree with this statement' },
    { value: '4', label: 'I strongly disagree with this statement' },
];

/** @param {string[]} labels */
const scale = (labels) => labels.map((label, i) => ({ value: String(i), label }));

/**
 * One radio question. The AcroForm field name is passed LITERALLY rather than
 * built from the question number — the numbering on the page and the field
 * names do not line up (see the header note), and scripts/verify_documents.py
 * can only audit the mapping if the names appear verbatim in this file.
 *
 * @param {string} pdf      AcroForm field name, exactly as it appears in the PDF
 * @param {string} label    question text as printed
 * @param {FieldOption[]} options
 */
const question = (pdf, label, options) => ({
    key: pdf.replace(/\s+/g, '').toLowerCase(),
    label,
    type: 'radio',
    pdf,
    options,
    wide: true,
});

/** @type {import('./documentTypes').DocumentSchema} */
export const ATRQ_SCHEMA = {
    id: 'atrq',
    title: 'Attitude to Risk Questionnaire',
    subtitle: 'GSB ATRQ v4 — 13 risk questions, investment term and knowledge & experience',
    pdf: '/forms/gsb-atrq.pdf',
    fileStem: 'ATRQ',
    nameKey: 'clientName',
    layout: 'scroll',
    footnote:
        'Answers are captured and written into the GSB ATRQ document as-is. The ToolBox does not '
        + 'score this questionnaire — apply the GSB scoring key to the completed document. '
        + 'Per the document’s own footer, the result is an informed starting point for a discussion, '
        + 'not a definitive answer, and the questionnaire is not designed to identify investors who are '
        + 'unwilling to take any investment risk.',

    sections: [
        {
            id: 'details',
            title: 'Personal Details',
            page: 1,
            hint: 'Don’t spend too long on each answer — the client’s first response is usually best, '
                + 'and every question should be answered even if it doesn’t feel applicable.',
            fields: [
                { key: 'clientName', label: 'Client Name', type: 'text', pdf: 'Client Name', wide: true },
                { key: 'dob', label: 'Date of Birth', type: 'date', pdf: 'Date2_af_date' },
                { key: 'email', label: 'Email', type: 'email', pdf: 'Email' },
            ],
        },

        {
            id: 'attitude',
            title: 'Attitude to Risk',
            page: 2,
            fields: [
                question('Question 1',
                    '1. I would enjoy exploring investment opportunities for my money.', AGREE_SCALE),
                question('Question 2',
                    '2. I would go for the best possible return even if there were risk involved.',
                    scale(['Always', 'Usually', 'Sometimes', 'Rarely', 'Never'])),
                question('Question 3',
                    '3. How would you describe your typical attitude when making important financial decisions?',
                    scale(['Very adventurous', 'Fairly adventurous', 'Average', 'Fairly cautious', 'Very cautious'])),
                question('Question 4',
                    '4. What amount of risk do you feel you have taken with your past financial decisions?',
                    scale(['Very Large', 'Large', 'Medium', 'Small', 'Very Small'])),
                question('Question 5',
                    '5. To reach my financial goal I prefer an investment which is safe and grows slowly but '
                    + 'steadily, even if it means lower growth overall.', AGREE_SCALE),
                question('Question 6',
                    '6. I am looking for high investment growth. I am willing to accept the possibility of '
                    + 'greater losses to achieve this.', AGREE_SCALE),
                question('Question 7',
                    '7. If you had money to invest, how much would you be willing to place in an investment '
                    + 'with possible high returns but a similar chance of losing some of your money?',
                    scale(['All of it', 'More than half', 'Half', 'Less than half', 'Very little, if any'])),
                question('Question 8',
                    '8. How do you think that a friend who knows you well would describe your attitude to '
                    + 'taking financial risks?',
                    scale(['Daring', 'Sometimes daring', 'A thoughtful risk taker', 'Careful',
                        'Very cautious and risk averse'])),
                question('Question 9',
                    '9. If you had picked an investment with potential for large gains but also the risk of '
                    + 'large losses, how would you feel?',
                    scale(['Panicked and very uncomfortable', 'Quite uneasy', 'A little concerned',
                        'Accepting of the possible highs and lows', 'Excited by the potential for gain'])),
                question('Question 10',
                    '10. Imagine that you have some money to invest and a choice of two investment products. '
                    + 'Which option would you choose?',
                    scale([
                        'A product with a low average annual return but almost no risk of loss of the initial investment',
                        'A product with a higher average annual return but some risk of losing part of the initial investment',
                        'A mixture of the two products',
                    ])),
                question('Question 11',
                    '11. I would prefer small certain gains to large uncertain ones.', AGREE_SCALE),
                question('Question 12',
                    '12. When considering a major financial decision, which statement BEST describes the way '
                    + 'you think about the possible losses or the possible gains?',
                    scale(['I am excited about the possible gains', 'I am optimistic about possible gains',
                        'I think about both the possible gains and losses', 'I am conscious of the possible losses',
                        'I worry about the possible losses'])),
                question('Question 13',
                    '13. I want my investment money to be safe even if it means lower returns.', AGREE_SCALE),
            ],
        },

        {
            id: 'term',
            title: 'Investment Term',
            page: 4,
            fields: [{
                key: 'investmentTerm',
                label: 'What is your investment term?',
                type: 'radio',
                // Named "Question 14" in the PDF even though it is the term control.
                pdf: 'Question 14',
                options: scale(['Short [3-7 years]', 'Medium [8-15 years]', 'Long [15+ years]']),
                wide: true,
            }],
        },

        {
            id: 'ke',
            title: 'Knowledge & Experience',
            page: 5,
            hint: 'Tick every option that applies. These three lists mirror the standalone K&E survey.',
            fields: [
                {
                    key: 'keExplain',
                    label: '14. Which of the following investment types could you explain sufficiently to a friend?',
                    type: 'checkgroup',
                    wide: true,
                    items: [
                        { key: 'ke14_cash', label: 'Cash Deposits / Government Bonds', pdf: 'Cash Deposits  Government Bonds' },
                        { key: 'ke14_corp', label: 'Investment Grade or High Yield Corporate Bonds', pdf: 'Investment Grade or High Yield' },
                        { key: 'ke14_equities', label: 'Equities', pdf: 'Equities' },
                        { key: 'ke14_em', label: 'Emerging Market Shares', pdf: 'Emerging Market Shares I strongly' },
                        { key: 'ke14_hedge', label: 'Absolute Return or Hedge Funds', pdf: 'Absolute Return or Hedge Funds' },
                        { key: 'ke14_unreg', label: 'Unregulated Investments', pdf: 'Unregulated Investments' },
                        { key: 'ke14_vct', label: 'Venture Capital Trusts or EIS', pdf: 'Venture Capital Trusts or EIS' },
                        { key: 'ke14_options', label: 'Speculative options', pdf: 'Speculative options' },
                        { key: 'ke14_futures', label: 'Futures or spread-betting', pdf: 'Futures or spreadbetting' },
                    ],
                },
                {
                    key: 'keHeld',
                    label: '15. Which of the following investments have you held previously?',
                    type: 'checkgroup',
                    wide: true,
                    items: [
                        { key: 'ke15_cash', label: 'Cash Deposits or Government Bonds', pdf: 'Cash Deposits or Government Bonds' },
                        { key: 'ke15_dev', label: 'Developed market equities', pdf: 'Developed market equities' },
                        { key: 'ke15_em', label: 'Emerging market equities', pdf: 'Emerging market equities' },
                        {
                            key: 'ke15_hedge',
                            label: 'Very cautious and risk averse',
                            pdf: 'Very cautious and risk averse_2',
                            note: 'Label reproduced exactly as printed on the source PDF. By position in the '
                                + 'list it should read "Absolute Return or Hedge Funds" — a typo in the '
                                + 'document, not in the ToolBox. Worth fixing in the master PDF.',
                        },
                        { key: 'ke15_unreg', label: 'Unregulated investments', pdf: 'Unregulated investments' },
                        { key: 'ke15_vct', label: 'Venture Capital Trusts or EIS', pdf: 'Venture Capital Trusts or EIS_2' },
                        { key: 'ke15_options', label: 'Speculative options', pdf: 'Speculative options_2' },
                        { key: 'ke15_futures', label: 'Futures or spread-betting', pdf: 'Futures or spreadbetting_2' },
                    ],
                },
                {
                    key: 'keCurrent',
                    label: '16. What investments do you currently hold?',
                    type: 'checkgroup',
                    wide: true,
                    items: [
                        { key: 'ke16_cash', label: 'Cash Deposits / Government Bonds', pdf: 'Cash Deposits  Government Bonds_2' },
                        { key: 'ke16_dev', label: 'Developed Market Equities', pdf: 'Developed Market Equities' },
                        { key: 'ke16_em', label: 'Emerging Market Equities', pdf: 'Emerging Market Equities' },
                        { key: 'ke16_hedge', label: 'Absolute Return or Hedge Funds', pdf: 'Absolute Return or Hedge Funds_2' },
                        { key: 'ke16_unreg', label: 'Unregulated Investments', pdf: 'Unregulated Investments_2' },
                        { key: 'ke16_vct', label: 'Venture Capital Trusts or EIS', pdf: 'Venture Capital Trusts or EIS_3' },
                    ],
                },
            ],
        },

        {
            id: 'sign',
            title: 'Signature',
            page: 5,
            hint: 'The signature box is a signature field and stays empty — the downloaded PDF is signed '
                + 'by the client, on screen or on paper.',
            fields: [
                {
                    key: 'signatureDate',
                    label: 'Date of signature',
                    type: 'date',
                    pdf: 'Date of signature [dd/mm/yy]_af_date',
                },
            ],
        },
    ],
};

export default ATRQ_SCHEMA;
