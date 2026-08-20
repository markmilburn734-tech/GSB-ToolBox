// ─────────────────────────────────────────────────────────────────────────────
// factFindSchema.js — GENERATED, do not hand-edit.
//
// Produced by scripts/gen_factfind.py from public/forms/cashcalc-fact-find.pdf.
// Every `pdf` value is a fully-qualified AcroForm field name read out of that
// document, so the mapping cannot drift from the real form. Re-run the
// generator if the source PDF is ever replaced.
//
// 699 mapped fields across 23 sections / 17 pages.
// ─────────────────────────────────────────────────────────────────────────────

/** @type {import('./documentTypes').DocumentSchema} */
export const FACT_FIND_SCHEMA = {
  id: 'factfind',
  title: 'Fact Find',
  subtitle: 'Full client KYC — completes the CashCalc fact find document',
  pdf: '/forms/cashcalc-fact-find.pdf',
  fileStem: 'Fact Find',
  nameKey: 'c1lastName',
  layout: 'wizard',
  footnote:
    'Sections mirror the pages of the CashCalc fact find. Table sections have the same fixed number '
    + 'of rows as the printed grids, so a client with more than ten holdings needs a continuation sheet. '
    + 'Client 2 sections can be left blank for a single-client fact find.',
  sections: [
  {
    "id": "cover",
    "title": "Cover",
    "page": 1,
    "hint": "Appears on the front page of the document.",
    "fields": [
      {
        "key": "coverFor1",
        "label": "For",
        "type": "text",
        "pdf": "Text9.0"
      },
      {
        "key": "coverFor2",
        "label": "For (second line)",
        "type": "text",
        "pdf": "Text9.1"
      },
      {
        "key": "coverDate",
        "label": "Date",
        "type": "date",
        "pdf": "Date1_af_date"
      }
    ]
  },
  {
    "id": "client1",
    "title": "Client 1 — Personal Details",
    "page": 2,
    "fields": [
      {
        "key": "c1title",
        "label": "Title",
        "type": "text",
        "pdf": "AnswerTitle"
      },
      {
        "key": "c1firstName",
        "label": "First name",
        "type": "text",
        "pdf": "AnswerFirst name"
      },
      {
        "key": "c1middleNames",
        "label": "Middle names",
        "type": "text",
        "pdf": "AnswerMiddle names"
      },
      {
        "key": "c1lastName",
        "label": "Last name",
        "type": "text",
        "pdf": "AnswerLast name"
      },
      {
        "key": "c1knownAs",
        "label": "Known as",
        "type": "text",
        "pdf": "AnswerKnown as"
      },
      {
        "key": "c1pronouns",
        "label": "Pronouns",
        "type": "text",
        "pdf": "AnswerPronouns"
      },
      {
        "key": "c1dateOfBirth",
        "label": "Date of birth",
        "type": "date",
        "pdf": "AnswerDate of birth"
      },
      {
        "key": "c1placeOfBirth",
        "label": "Place of birth",
        "type": "text",
        "pdf": "AnswerPlace of birth"
      },
      {
        "key": "c1nationality",
        "label": "Nationality",
        "type": "text",
        "pdf": "AnswerNationality"
      },
      {
        "key": "c1gender",
        "label": "Gender",
        "type": "text",
        "pdf": "AnswerGender"
      },
      {
        "key": "c1legalSex",
        "label": "Legal sex",
        "type": "text",
        "pdf": "AnswerLegal sex"
      },
      {
        "key": "c1maritalStatus",
        "label": "Marital status",
        "type": "text",
        "pdf": "AnswerMarital status"
      },
      {
        "key": "c1homePhone",
        "label": "Home phone",
        "type": "text",
        "pdf": "AnswerHome phone"
      },
      {
        "key": "c1mobilePhone",
        "label": "Mobile phone",
        "type": "text",
        "pdf": "AnswerMobile phone"
      },
      {
        "key": "c1emailAddress",
        "label": "Email address",
        "type": "text",
        "pdf": "AnswerEmail address"
      }
    ]
  },
  {
    "id": "client2",
    "title": "Client 2 — Personal Details",
    "page": 3,
    "hint": "Leave blank for a single-client fact find.",
    "fields": [
      {
        "key": "c2title_2",
        "label": "Title",
        "type": "text",
        "pdf": "AnswerTitle_2"
      },
      {
        "key": "c2firstName_2",
        "label": "First name",
        "type": "text",
        "pdf": "AnswerFirst name_2"
      },
      {
        "key": "c2middleNames_2",
        "label": "Middle names",
        "type": "text",
        "pdf": "AnswerMiddle names_2"
      },
      {
        "key": "c2lastName_2",
        "label": "Last name",
        "type": "text",
        "pdf": "AnswerLast name_2"
      },
      {
        "key": "c2knownAs_2",
        "label": "Known as",
        "type": "text",
        "pdf": "AnswerKnown as_2"
      },
      {
        "key": "c2pronouns_2",
        "label": "Pronouns",
        "type": "text",
        "pdf": "AnswerPronouns_2"
      },
      {
        "key": "c2dateOfBirth_2",
        "label": "Date of birth",
        "type": "date",
        "pdf": "AnswerDate of birth_2"
      },
      {
        "key": "c2placeOfBirth_2",
        "label": "Place of birth",
        "type": "text",
        "pdf": "AnswerPlace of birth_2"
      },
      {
        "key": "c2nationality_2",
        "label": "Nationality",
        "type": "text",
        "pdf": "AnswerNationality_2"
      },
      {
        "key": "c2gender_2",
        "label": "Gender",
        "type": "text",
        "pdf": "AnswerGender_2"
      },
      {
        "key": "c2legalSex_2",
        "label": "Legal sex",
        "type": "text",
        "pdf": "AnswerLegal sex_2"
      },
      {
        "key": "c2maritalStatus_2",
        "label": "Marital status",
        "type": "text",
        "pdf": "AnswerMarital status_2"
      },
      {
        "key": "c2homePhone_2",
        "label": "Home phone",
        "type": "text",
        "pdf": "AnswerHome phone_2"
      },
      {
        "key": "c2mobilePhone_2",
        "label": "Mobile phone",
        "type": "text",
        "pdf": "AnswerMobile phone_2"
      },
      {
        "key": "c2emailAddress_2",
        "label": "Email address",
        "type": "text",
        "pdf": "AnswerEmail address_2"
      }
    ]
  },
  {
    "id": "address",
    "title": "Current Address",
    "page": 4,
    "fields": [
      {
        "key": "addrownershipStatus",
        "label": "Ownership Status",
        "type": "text",
        "pdf": "Ownership Status"
      },
      {
        "key": "addrpostcode",
        "label": "Postcode",
        "type": "text",
        "pdf": "Postcode"
      },
      {
        "key": "addrhouseNamenumber",
        "label": "House name/number",
        "type": "text",
        "pdf": "House namenumber"
      },
      {
        "key": "addrstreetName",
        "label": "Street name",
        "type": "text",
        "pdf": "Street name"
      },
      {
        "key": "addraddressLine3",
        "label": "Address Line 3",
        "type": "text",
        "pdf": "Address Line 3"
      },
      {
        "key": "addraddressLine4",
        "label": "Address Line 4",
        "type": "text",
        "pdf": "Address Line 4"
      },
      {
        "key": "addrtownCity",
        "label": "Town City",
        "type": "text",
        "pdf": "Town City"
      },
      {
        "key": "addrcounty",
        "label": "County",
        "type": "text",
        "pdf": "County"
      },
      {
        "key": "addrcountry",
        "label": "Country",
        "type": "text",
        "pdf": "Country"
      },
      {
        "key": "addrmoveInDate",
        "label": "Move In Date",
        "type": "date",
        "pdf": "Move In Date"
      }
    ]
  },
  {
    "id": "prevAddresses",
    "title": "Previous Addresses",
    "page": 4,
    "fields": [
      {
        "key": "prevAddr1",
        "label": "Previous address 1",
        "type": "textarea",
        "pdf": "Text1"
      },
      {
        "key": "prevAddr2",
        "label": "Previous address 2",
        "type": "textarea",
        "pdf": "Text2"
      },
      {
        "key": "prevAddr3",
        "label": "Previous address 3",
        "type": "textarea",
        "pdf": "Text3"
      }
    ]
  },
  {
    "id": "dependants",
    "title": "Dependants & Children",
    "page": 4,
    "type": "table",
    "columns": [
      "Name",
      "Date of Birth",
      "Dependant Until"
    ],
    "columnTypes": [
      "text",
      "date",
      "text"
    ],
    "cells": [
      [
        "Text4",
        "Date10_af_date",
        "Text15"
      ],
      [
        "Text5",
        "Date11_af_date",
        "Text16"
      ],
      [
        "Text6",
        "Date12_af_date",
        "Text17"
      ],
      [
        "Text7",
        "Date13_af_date",
        "Text18"
      ],
      [
        "Text8",
        "Date14_af_date",
        "Text19"
      ]
    ]
  },
  {
    "id": "employment1",
    "title": "Client 1 — Employment",
    "page": 5,
    "fields": [
      {
        "key": "e1countryDomiciled",
        "label": "Country domiciled",
        "type": "text",
        "pdf": "Country domiciled"
      },
      {
        "key": "e1residentForTax",
        "label": "Resident for tax",
        "type": "text",
        "pdf": "Resident for tax"
      },
      {
        "key": "e1nationalInsuranceNumber",
        "label": "National Insurance number",
        "type": "text",
        "pdf": "National Insurance number"
      },
      {
        "key": "e1employmentStatus",
        "label": "Employment status",
        "type": "text",
        "pdf": "Employment status"
      },
      {
        "key": "e1desiredRetirementAge",
        "label": "Desired retirement age",
        "type": "text",
        "pdf": "Desired retirement age"
      },
      {
        "key": "e1occupation",
        "label": "Occupation",
        "type": "text",
        "pdf": "Occupation"
      },
      {
        "key": "e1employer",
        "label": "Employer",
        "type": "text",
        "pdf": "Employer"
      },
      {
        "key": "e1employmentStarted",
        "label": "Employment started",
        "type": "date",
        "pdf": "Employment started"
      },
      {
        "key": "e1highestRateOfTaxPaid",
        "label": "Highest rate of tax paid",
        "type": "text",
        "pdf": "Highest rate of tax paid"
      },
      {
        "key": "e1Notes",
        "label": "Notes",
        "type": "textarea",
        "pdf": "Text20"
      }
    ]
  },
  {
    "id": "employment2",
    "title": "Client 2 — Employment",
    "page": 6,
    "fields": [
      {
        "key": "e2countryDomiciled_2",
        "label": "Country domiciled",
        "type": "text",
        "pdf": "Country domiciled_2"
      },
      {
        "key": "e2residentForTax_2",
        "label": "Resident for tax",
        "type": "text",
        "pdf": "Resident for tax_2"
      },
      {
        "key": "e2nationalInsuranceNumber_2",
        "label": "National Insurance number",
        "type": "text",
        "pdf": "National Insurance number_2"
      },
      {
        "key": "e2employmentStatus_2",
        "label": "Employment status",
        "type": "text",
        "pdf": "Employment status_2"
      },
      {
        "key": "e2desiredRetirementAge_2",
        "label": "Desired retirement age",
        "type": "text",
        "pdf": "Desired retirement age_2"
      },
      {
        "key": "e2occupation_2",
        "label": "Occupation",
        "type": "text",
        "pdf": "Occupation_2"
      },
      {
        "key": "e2employer_2",
        "label": "Employer",
        "type": "text",
        "pdf": "Employer_2"
      },
      {
        "key": "e2employmentStarted_2",
        "label": "Employment started",
        "type": "date",
        "pdf": "Employment started_2"
      },
      {
        "key": "e2highestRateOfTaxPaid_2",
        "label": "Highest rate of tax paid",
        "type": "text",
        "pdf": "Highest rate of tax paid_2"
      },
      {
        "key": "e2Notes",
        "label": "Notes",
        "type": "textarea",
        "pdf": "Text21"
      }
    ]
  },
  {
    "id": "incomes",
    "title": "Incomes",
    "page": 7,
    "type": "table",
    "columns": [
      "Owner",
      "Name",
      "Amount",
      "Frequency",
      "Net/Gross",
      "Timeframe"
    ],
    "cells": [
      [
        "Text29.0",
        "Text30.0",
        "Text31.0",
        "Text32.0",
        "Text33.0",
        "Text34.0"
      ],
      [
        "Text29.1",
        "Text30.1",
        "Text31.1",
        "Text32.1",
        "Text33.1",
        "Text34.1"
      ],
      [
        "Text29.2",
        "Text30.2",
        "Text31.2",
        "Text32.2",
        "Text33.2",
        "Text34.2"
      ],
      [
        "Text29.3",
        "Text30.3",
        "Text31.3",
        "Text32.3",
        "Text33.3",
        "Text34.3"
      ],
      [
        "Text29.4",
        "Text30.4",
        "Text31.4",
        "Text32.4",
        "Text33.4",
        "Text34.4"
      ],
      [
        "Text29.5",
        "Text30.5",
        "Text31.5",
        "Text32.5",
        "Text33.5",
        "Text34.5"
      ],
      [
        "Text29.6",
        "Text30.6",
        "Text31.6",
        "Text32.6",
        "Text33.6",
        "Text34.6"
      ],
      [
        "Text29.7",
        "Text30.7",
        "Text31.7",
        "Text32.7",
        "Text33.7",
        "Text34.7"
      ],
      [
        "Text29.8",
        "Text30.8",
        "Text31.8",
        "Text32.8",
        "Text33.8",
        "Text34.8"
      ],
      [
        "Text29.9",
        "Text30.9",
        "Text31.9",
        "Text32.9",
        "Text33.9",
        "Text34.9"
      ]
    ],
    "notes": {
      "key": "incomeNotes",
      "pdf": "Text35"
    }
  },
  {
    "id": "expLoans",
    "title": "Expenses — Loan repayments",
    "page": 8,
    "type": "table",
    "columns": [
      "Owner",
      "Name",
      "Amount",
      "Frequency",
      "Priority",
      "Timeframe"
    ],
    "cells": [
      [
        "Text36.0.0",
        "Text37.0.0",
        "Text38.0.0",
        "Text39.0.0",
        "Text40.0.0",
        "Text41.0.0"
      ],
      [
        "Text36.0.1.0",
        "Text37.0.1.0",
        "Text38.0.1.0",
        "Text39.0.1.0",
        "Text40.0.1.0",
        "Text41.0.1.0"
      ],
      [
        "Text36.0.1.1",
        "Text37.0.1.1",
        "Text38.0.1.1",
        "Text39.0.1.1",
        "Text40.0.1.1",
        "Text41.0.1.1"
      ],
      [
        "Text36.0.1.2",
        "Text37.0.1.2",
        "Text38.0.1.2",
        "Text39.0.1.2",
        "Text40.0.1.2",
        "Text41.0.1.2"
      ],
      [
        "Text36.0.1.3",
        "Text37.0.1.3",
        "Text38.0.1.3",
        "Text39.0.1.3",
        "Text40.0.1.3",
        "Text41.0.1.3"
      ],
      [
        "Text36.0.1.4",
        "Text37.0.1.4",
        "Text38.0.1.4",
        "Text39.0.1.4",
        "Text40.0.1.4",
        "Text41.0.1.4"
      ],
      [
        "Text36.0.1.5",
        "Text37.0.1.5",
        "Text38.0.1.5",
        "Text39.0.1.5",
        "Text40.0.1.5",
        "Text41.0.1.5"
      ]
    ]
  },
  {
    "id": "expHousing",
    "title": "Expenses — Housing",
    "page": 8,
    "type": "table",
    "columns": [
      "Owner",
      "Name",
      "Amount",
      "Frequency",
      "Priority",
      "Timeframe"
    ],
    "cells": [
      [
        "Text42.0",
        "Text43.0",
        "Text44.0",
        "Text45.0",
        "Text46.0",
        "Text47.0"
      ],
      [
        "Text42.1",
        "Text43.1",
        "Text44.1",
        "Text45.1",
        "Text46.1",
        "Text47.1"
      ],
      [
        "Text42.2",
        "Text43.2",
        "Text44.2",
        "Text45.2",
        "Text46.2",
        "Text47.2"
      ],
      [
        "Text42.3",
        "Text43.3",
        "Text44.3",
        "Text45.3",
        "Text46.3",
        "Text47.3"
      ],
      [
        "Text42.4",
        "Text43.4",
        "Text44.4",
        "Text45.4",
        "Text46.4",
        "Text47.4"
      ],
      [
        "Text42.5",
        "Text43.5",
        "Text44.5",
        "Text45.5",
        "Text46.5",
        "Text47.5"
      ],
      [
        "Text42.6",
        "Text43.6",
        "Text44.6",
        "Text45.6",
        "Text46.6",
        "Text47.6"
      ]
    ]
  },
  {
    "id": "expMotoring",
    "title": "Expenses — Motoring",
    "page": 8,
    "type": "table",
    "columns": [
      "Owner",
      "Name",
      "Amount",
      "Frequency",
      "Priority",
      "Timeframe"
    ],
    "cells": [
      [
        "Text55.0",
        "Text56.0",
        "Text57.0",
        "Text58.0",
        "Text59.0",
        "Text60.0"
      ],
      [
        "Text55.1",
        "Text56.1",
        "Text57.1",
        "Text58.1",
        "Text59.1",
        "Text60.1"
      ],
      [
        "Text55.2",
        "Text56.2",
        "Text57.2",
        "Text58.2",
        "Text59.2",
        "Text60.2"
      ],
      [
        "Text55.3",
        "Text56.3",
        "Text57.3",
        "Text58.3",
        "Text59.3",
        "Text60.3"
      ],
      [
        "Text55.4",
        "Text56.4",
        "Text57.4",
        "Text58.4",
        "Text59.4",
        "Text60.4"
      ],
      [
        "Text55.5",
        "Text56.5",
        "Text57.5",
        "Text58.5",
        "Text59.5",
        "Text60.5"
      ],
      [
        "Text55.6",
        "Text56.6",
        "Text57.6",
        "Text58.6",
        "Text59.6",
        "Text60.6"
      ]
    ]
  },
  {
    "id": "expPersonal",
    "title": "Expenses — Personal",
    "page": 9,
    "type": "table",
    "columns": [
      "Owner",
      "Name",
      "Amount",
      "Frequency",
      "Priority",
      "Timeframe"
    ],
    "cells": [
      [
        "Text61.0",
        "Text62.0",
        "Text63.0",
        "Text64.0",
        "Text65.0",
        "Text66.0"
      ],
      [
        "Text61.1",
        "Text62.1",
        "Text63.1",
        "Text64.1",
        "Text65.1",
        "Text66.1"
      ],
      [
        "Text61.2",
        "Text62.2",
        "Text63.2",
        "Text64.2",
        "Text65.2",
        "Text66.2"
      ],
      [
        "Text61.3",
        "Text62.3",
        "Text63.3",
        "Text64.3",
        "Text65.3",
        "Text66.3"
      ],
      [
        "Text61.4",
        "Text62.4",
        "Text63.4",
        "Text64.4",
        "Text65.4",
        "Text66.4"
      ],
      [
        "Text61.5",
        "Text62.5",
        "Text63.5",
        "Text64.5",
        "Text65.5",
        "Text66.5"
      ],
      [
        "Text61.6",
        "Text62.6",
        "Text63.6",
        "Text64.6",
        "Text65.6",
        "Text66.6"
      ],
      [
        "Text61.7",
        "Text62.7",
        "Text63.7",
        "Text64.7",
        "Text65.7",
        "Text66.7"
      ]
    ]
  },
  {
    "id": "expProfessional",
    "title": "Expenses — Professional",
    "page": 9,
    "type": "table",
    "columns": [
      "Owner",
      "Name",
      "Amount",
      "Frequency",
      "Priority",
      "Timeframe"
    ],
    "cells": [
      [
        "Text67.0",
        "Text68.0",
        "Text69.0",
        "Text70.0",
        "Text71.0",
        "Text72.0"
      ],
      [
        "Text67.1",
        "Text68.1",
        "Text69.1",
        "Text70.1",
        "Text71.1",
        "Text72.1"
      ],
      [
        "Text67.2",
        "Text68.2",
        "Text69.2",
        "Text70.2",
        "Text71.2",
        "Text72.2"
      ],
      [
        "Text67.3",
        "Text68.3",
        "Text69.3",
        "Text70.3",
        "Text71.3",
        "Text72.3"
      ],
      [
        "Text67.4",
        "Text68.4",
        "Text69.4",
        "Text70.4",
        "Text71.4",
        "Text72.4"
      ],
      [
        "Text67.5",
        "Text68.5",
        "Text69.5",
        "Text70.5",
        "Text71.5",
        "Text72.5"
      ]
    ]
  },
  {
    "id": "expMisc",
    "title": "Expenses — Miscellaneous",
    "page": 9,
    "type": "table",
    "columns": [
      "Owner",
      "Name",
      "Amount",
      "Frequency",
      "Priority",
      "Timeframe"
    ],
    "cells": [
      [
        "Text73.0",
        "Text74.0",
        "Text75.0",
        "Text76.0",
        "Text77.0",
        "Text78.0"
      ],
      [
        "Text73.1",
        "Text74.1",
        "Text75.1",
        "Text76.1",
        "Text77.1",
        "Text78.1"
      ],
      [
        "Text73.2",
        "Text74.2",
        "Text75.2",
        "Text76.2",
        "Text77.2",
        "Text78.2"
      ],
      [
        "Text73.3",
        "Text74.3",
        "Text75.3",
        "Text76.3",
        "Text77.3",
        "Text78.3"
      ],
      [
        "Text73.4",
        "Text74.4",
        "Text75.4",
        "Text76.4",
        "Text77.4",
        "Text78.4"
      ]
    ],
    "notes": {
      "key": "expenseNotes",
      "pdf": "Text79"
    }
  },
  {
    "id": "pensions",
    "title": "Pensions",
    "page": 10,
    "type": "table",
    "columns": [
      "Owner",
      "Type",
      "Provider",
      "Value",
      "Policy number"
    ],
    "cells": [
      [
        "Text80.0",
        "Text81.0",
        "Text82.0",
        "Text83.0",
        "Text84.0"
      ],
      [
        "Text80.1",
        "Text81.1",
        "Text82.1",
        "Text83.1",
        "Text84.1"
      ],
      [
        "Text80.2",
        "Text81.2",
        "Text82.2",
        "Text83.2",
        "Text84.2"
      ],
      [
        "Text80.3",
        "Text81.3",
        "Text82.3",
        "Text83.3",
        "Text84.3"
      ],
      [
        "Text80.4",
        "Text81.4",
        "Text82.4",
        "Text83.4",
        "Text84.4"
      ],
      [
        "Text80.5",
        "Text81.5",
        "Text82.5",
        "Text83.5",
        "Text84.5"
      ],
      [
        "Text80.6",
        "Text81.6",
        "Text82.6",
        "Text83.6",
        "Text84.6"
      ],
      [
        "Text80.7",
        "Text81.7",
        "Text82.7",
        "Text83.7",
        "Text84.7"
      ],
      [
        "Text80.8",
        "Text81.8",
        "Text82.8",
        "Text83.8",
        "Text84.8"
      ],
      [
        "Text80.9",
        "Text81.9",
        "Text82.9",
        "Text83.9",
        "Text84.9"
      ]
    ],
    "notes": {
      "key": "pensionNotes",
      "pdf": "Text85"
    }
  },
  {
    "id": "savings",
    "title": "Savings & Investments",
    "page": 11,
    "type": "table",
    "columns": [
      "Owner",
      "Type",
      "Provider",
      "Value"
    ],
    "cells": [
      [
        "Text86.0",
        "Text87.0",
        "Text88.0",
        "Text89.0"
      ],
      [
        "Text86.1",
        "Text87.1",
        "Text88.1",
        "Text89.1"
      ],
      [
        "Text86.2",
        "Text87.2",
        "Text88.2",
        "Text89.2"
      ],
      [
        "Text86.3",
        "Text87.3",
        "Text88.3",
        "Text89.3"
      ],
      [
        "Text86.4",
        "Text87.4",
        "Text88.4",
        "Text89.4"
      ],
      [
        "Text86.5",
        "Text87.5",
        "Text88.5",
        "Text89.5"
      ],
      [
        "Text86.6",
        "Text87.6",
        "Text88.6",
        "Text89.6"
      ],
      [
        "Text86.7",
        "Text87.7",
        "Text88.7",
        "Text89.7"
      ],
      [
        "Text86.8",
        "Text87.8",
        "Text88.8",
        "Text89.8"
      ],
      [
        "Text86.9",
        "Text87.9",
        "Text88.9",
        "Text89.9"
      ]
    ],
    "notes": {
      "key": "savingsNotes",
      "pdf": "Text90"
    }
  },
  {
    "id": "otherAssets",
    "title": "Other Assets",
    "page": 12,
    "type": "table",
    "columns": [
      "Owner",
      "Description",
      "Current Value",
      "Original Value"
    ],
    "cells": [
      [
        "Text91.0",
        "Text92.0",
        "Text93.0",
        "Text94.0"
      ],
      [
        "Text91.1",
        "Text92.1",
        "Text93.1",
        "Text94.1"
      ],
      [
        "Text91.2",
        "Text92.2",
        "Text93.2",
        "Text94.2"
      ],
      [
        "Text91.3",
        "Text92.3",
        "Text93.3",
        "Text94.3"
      ],
      [
        "Text91.4",
        "Text92.4",
        "Text93.4",
        "Text94.4"
      ],
      [
        "Text91.5",
        "Text92.5",
        "Text93.5",
        "Text94.5"
      ],
      [
        "Text91.6",
        "Text92.6",
        "Text93.6",
        "Text94.6"
      ],
      [
        "Text91.7",
        "Text92.7",
        "Text93.7",
        "Text94.7"
      ],
      [
        "Text91.8",
        "Text92.8",
        "Text93.8",
        "Text94.8"
      ],
      [
        "Text91.9",
        "Text92.9",
        "Text93.9",
        "Text94.9"
      ]
    ],
    "notes": {
      "key": "otherAssetNotes",
      "pdf": "Text95"
    }
  },
  {
    "id": "loans",
    "title": "Loans & Mortgages",
    "page": 13,
    "type": "table",
    "columns": [
      "Owner",
      "Type",
      "Provider",
      "Monthly Cost",
      "Outstanding Value",
      "Interest Rate",
      "Special Rate",
      "Final Payment"
    ],
    "cells": [
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow1",
        "Owner Type Provider Monthly Cost Outstanding ValueRow1_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow1_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow1_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow1_5",
        "Text100.0",
        "Special Rate Final PaymentRow1",
        "Special Rate Final PaymentRow1_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow2_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow2_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow2_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow2_5",
        "Text100.1",
        "Special Rate Final PaymentRow2",
        "Special Rate Final PaymentRow2_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow3_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow3_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow3_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow3_5",
        "Text100.2",
        "Special Rate Final PaymentRow3",
        "Special Rate Final PaymentRow3_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow4_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow4_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow4_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow4_5",
        "Text100.3",
        "Special Rate Final PaymentRow4",
        "Special Rate Final PaymentRow4_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow5",
        "Owner Type Provider Monthly Cost Outstanding ValueRow5_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow5_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow5_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow5_5",
        "Text100.4",
        "Special Rate Final PaymentRow5",
        "Special Rate Final PaymentRow5_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow6",
        "Owner Type Provider Monthly Cost Outstanding ValueRow6_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow6_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow6_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow6_5",
        "Text100.5",
        "Special Rate Final PaymentRow6",
        "Special Rate Final PaymentRow6_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow7",
        "Owner Type Provider Monthly Cost Outstanding ValueRow7_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow7_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow7_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow7_5",
        "Text100.6",
        "Special Rate Final PaymentRow7",
        "Special Rate Final PaymentRow7_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow8",
        "Owner Type Provider Monthly Cost Outstanding ValueRow8_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow8_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow8_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow8_5",
        "Text100.7",
        "Special Rate Final PaymentRow8",
        "Special Rate Final PaymentRow8_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow9",
        "Owner Type Provider Monthly Cost Outstanding ValueRow9_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow9_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow9_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow9_5",
        "Text100.8",
        "Special Rate Final PaymentRow9",
        "Special Rate Final PaymentRow9_2"
      ],
      [
        "Owner Type Provider Monthly Cost Outstanding ValueRow10",
        "Owner Type Provider Monthly Cost Outstanding ValueRow10_2",
        "Owner Type Provider Monthly Cost Outstanding ValueRow10_3",
        "Owner Type Provider Monthly Cost Outstanding ValueRow10_4",
        "Owner Type Provider Monthly Cost Outstanding ValueRow10_5",
        "Text100.9",
        "Special Rate Final PaymentRow10",
        "Special Rate Final PaymentRow10_2"
      ]
    ],
    "notes": {
      "key": "loanNotes",
      "pdf": "Text96"
    }
  },
  {
    "id": "health1",
    "title": "Client 1 — Health, Wills & LPA",
    "page": 14,
    "fields": [
      {
        "key": "h1currentStateOfHealth",
        "label": "Current state of health",
        "type": "text",
        "pdf": "Current state of health"
      },
      {
        "key": "h1stateOfHealthExplanation",
        "label": "State of health explanation",
        "type": "textarea",
        "pdf": "State of health explanation"
      },
      {
        "key": "h1smoker",
        "label": "Smoker?",
        "type": "text",
        "pdf": "Smoker"
      },
      {
        "key": "h1cigarettesPerDay",
        "label": "Cigarettes per day",
        "type": "text",
        "pdf": "Cigarettes per day"
      },
      {
        "key": "h1smokerSince",
        "label": "Smoker since",
        "type": "date",
        "pdf": "Smoker since"
      },
      {
        "key": "h1longTermCareNeeded",
        "label": "Long term care needed?",
        "type": "text",
        "pdf": "Long term care needed"
      },
      {
        "key": "h1longTermCareExplanation",
        "label": "Long term care explanation",
        "type": "textarea",
        "pdf": "Long term care explanation"
      },
      {
        "key": "h1will",
        "label": "Will?",
        "type": "text",
        "pdf": "Will"
      },
      {
        "key": "h1informationAboutWill",
        "label": "Information about will",
        "type": "textarea",
        "pdf": "Information about will"
      },
      {
        "key": "h1powerOfAttorney",
        "label": "Power of attorney?",
        "type": "text",
        "pdf": "Power of attorney"
      },
      {
        "key": "h1detailsOfIndividualWithPowerOfAttorney",
        "label": "Details of individual with power of attorney",
        "type": "textarea",
        "pdf": "Details of individual with power of attorney"
      }
    ]
  },
  {
    "id": "health2",
    "title": "Client 2 — Health, Wills & LPA",
    "page": 15,
    "fields": [
      {
        "key": "h2currentStateOfHealth_2",
        "label": "Current state of health",
        "type": "text",
        "pdf": "Current state of health_2"
      },
      {
        "key": "h2stateOfHealthExplanation_2",
        "label": "State of health explanation",
        "type": "textarea",
        "pdf": "State of health explanation_2"
      },
      {
        "key": "h2smoker_2",
        "label": "Smoker?",
        "type": "text",
        "pdf": "Smoker_2"
      },
      {
        "key": "h2cigarettesPerDay_2",
        "label": "Cigarettes per day",
        "type": "text",
        "pdf": "Cigarettes per day_2"
      },
      {
        "key": "h2smokerSince_2",
        "label": "Smoker since",
        "type": "date",
        "pdf": "Smoker since_2"
      },
      {
        "key": "h2longTermCareNeeded_2",
        "label": "Long term care needed?",
        "type": "text",
        "pdf": "Long term care needed_2"
      },
      {
        "key": "h2longTermCareExplanation_2",
        "label": "Long term care explanation",
        "type": "textarea",
        "pdf": "Long term care explanation_2"
      },
      {
        "key": "h2will_2",
        "label": "Will?",
        "type": "text",
        "pdf": "Will_2"
      },
      {
        "key": "h2informationAboutWill_2",
        "label": "Information about will",
        "type": "textarea",
        "pdf": "Information about will_2"
      },
      {
        "key": "h2powerOfAttorney_2",
        "label": "Power of attorney?",
        "type": "text",
        "pdf": "Power of attorney_2"
      },
      {
        "key": "h2detailsOfIndividualWithPowerOfAttorney_2",
        "label": "Details of individual with power of attorney",
        "type": "textarea",
        "pdf": "Details of individual with power of attorney_2"
      }
    ]
  },
  {
    "id": "protection",
    "title": "Protection Policies",
    "page": 16,
    "type": "table",
    "columns": [
      "Owner",
      "Type",
      "Provider",
      "Monthly Cost",
      "Amount Assured",
      "In Trust?",
      "Assured Until"
    ],
    "cells": [
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow1",
        "Owner Type Provider Monthly Cost Amount AssuredRow1_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow1_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow1_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow1_5",
        "Text97.0",
        "Assured UntilRow1"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow2",
        "Owner Type Provider Monthly Cost Amount AssuredRow2_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow2_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow2_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow2_5",
        "Text97.1",
        "Assured UntilRow2"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow3",
        "Owner Type Provider Monthly Cost Amount AssuredRow3_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow3_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow3_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow3_5",
        "Text97.2",
        "Assured UntilRow3"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow4",
        "Owner Type Provider Monthly Cost Amount AssuredRow4_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow4_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow4_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow4_5",
        "Text97.3",
        "Assured UntilRow4"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow5",
        "Owner Type Provider Monthly Cost Amount AssuredRow5_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow5_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow5_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow5_5",
        "Text97.4",
        "Assured UntilRow5"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow6",
        "Owner Type Provider Monthly Cost Amount AssuredRow6_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow6_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow6_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow6_5",
        "Text97.5",
        "Assured UntilRow6"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow7",
        "Owner Type Provider Monthly Cost Amount AssuredRow7_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow7_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow7_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow7_5",
        "Text97.6",
        "Assured UntilRow7"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow8",
        "Owner Type Provider Monthly Cost Amount AssuredRow8_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow8_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow8_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow8_5",
        "Text97.7",
        "Assured UntilRow8"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow9",
        "Owner Type Provider Monthly Cost Amount AssuredRow9_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow9_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow9_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow9_5",
        "Text97.8",
        "Assured UntilRow9"
      ],
      [
        "Owner Type Provider Monthly Cost Amount AssuredRow10",
        "Owner Type Provider Monthly Cost Amount AssuredRow10_2",
        "Owner Type Provider Monthly Cost Amount AssuredRow10_3",
        "Owner Type Provider Monthly Cost Amount AssuredRow10_4",
        "Owner Type Provider Monthly Cost Amount AssuredRow10_5",
        "Text97.9",
        "Assured UntilRow10"
      ]
    ],
    "notes": {
      "key": "protectionNotes",
      "pdf": "Text98"
    }
  },
  {
    "id": "objectives",
    "title": "Objectives",
    "page": 17,
    "hint": "Free text — one block per objective.",
    "fields": [
      {
        "key": "objective1",
        "label": "Objective 1",
        "type": "textarea",
        "pdf": "Text99.0",
        "rows": 3
      },
      {
        "key": "objective2",
        "label": "Objective 2",
        "type": "textarea",
        "pdf": "Text99.1",
        "rows": 3
      },
      {
        "key": "objective3",
        "label": "Objective 3",
        "type": "textarea",
        "pdf": "Text99.2",
        "rows": 3
      },
      {
        "key": "objective4",
        "label": "Objective 4",
        "type": "textarea",
        "pdf": "Text99.3",
        "rows": 3
      },
      {
        "key": "objective5",
        "label": "Objective 5",
        "type": "textarea",
        "pdf": "Text99.4",
        "rows": 3
      },
      {
        "key": "objective6",
        "label": "Objective 6",
        "type": "textarea",
        "pdf": "Text99.5.0",
        "rows": 3
      },
      {
        "key": "objective7",
        "label": "Objective 7",
        "type": "textarea",
        "pdf": "Text99.5.1",
        "rows": 3
      },
      {
        "key": "objective8",
        "label": "Objective 8",
        "type": "textarea",
        "pdf": "Text99.5.2",
        "rows": 3
      },
      {
        "key": "objective9",
        "label": "Objective 9",
        "type": "textarea",
        "pdf": "Text99.5.3",
        "rows": 3
      }
    ]
  }
],
};

export default FACT_FIND_SCHEMA;
