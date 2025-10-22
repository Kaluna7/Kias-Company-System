export const buttonRiskAssessment = [
  {
    logo: "/images/Finance.png",
    name: "Finnance",
    href: "/Page/risk-assessment-dashboard/finance/",
  },
  {
    logo: "/images/Accounting.png",
    name: "Accounting",
    href: "/Page/risk-assessment-dashboard/accounting/",
  },
  {
    logo: "/images/Hrd.png",
    name: "HRD",
    href: "/Page/risk-assessment-dashboard/hrd/",
  },
  {
    logo: "/images/General.png",
    name: "General Affair",
    href: "/Page/risk-assessment-dashboard/g&a/",
  },
  {
    logo: "/images/Design.png",
    name: "Store D & P",
    href: "/Page/risk-assessment-dashboard/sdp/",
  },
  {
    logo: "/images/Tax.png",
    name: "Tax",
    href: "/Page/risk-assessment-dashboard/tax/",
  },
  {
    logo: "/images/L&p.png",
    name: "L & P",
    href: "/Page/risk-assessment-dashboard/l&p/",
  },
  {
    logo: "/images/Mis.png",
    name: "MIS",
    href: "/Page/risk-assessment-dashboard/mis/",
  },
  {
    logo: "/images/Merchandise.png",
    name: "Merchandise",
    href: "/Page/risk-assessment-dashboard/merch/",
  },
  {
    logo: "/images/Operational.png",
    name: "Operational",
    href: "/Page/risk-assessment-dashboard/ops/",
  },
  {
    logo: "/images/Warehouse.png",
    name: "Warehouse",
    href: "/Page/risk-assessment-dashboard/whs/",
  },
];

export const fileButton = [
];

export const editButton = [
];

export const viewButton = [
];

// LIST INPUT POP UP RISK ASSESSMENT FORM
export const ListAssessmentForm = [
  {
    label: "Category",
    placeholder: "Category",
  },
  {
    label: "Sub Department",
    placeholder: "Sub Department",
  },
  {
    label: "SOP Related / Standard",
    placeholder: "if Yes, please input / if Not, please blank it",
  },
  {
    label: "Risk Description",
    placeholder: "Give a brief summary of the risk.",
  },
  {
    label: "Risk Details",
    placeholder: "Give a brief summary of the risk.",
  },
  {
    label: "Impact Description",
    placeholder: "What will happen if the risk is not mitigated or eliminated?",
  },
  {
    label: "Impact Level",
    placeholder: "Rate (LOW) to 3 (HIGH)",
  },
  {
    label: "Probability Level",
    placeholder: "Rate 1 (LOW) to 3 (HIGH)",
  },
  {
    label: "Priority Level",
    placeholder: "(IMPACT X PROBABILITY) Address  highest first. ",
  },
  {
    label: "Mitigation Strategy",
    placeholder:
      "What can be done to lower or eliminate the impact or probability?",
  },
  {
    label: "Owner",
    placeholder: "Who's responsible?",
  },
  {
    label: "Root Cause Category",
    placeholder: "Give a brief summary of the root cause",
  },
  {
    label: "Onset TimeFrame",
    placeholder:
      "Choose TimeFrame",
  },
];



// FORM NEW DATA CONFIG

export const LABEL_TO_KEY = {
  "Category": "category",
  "Sub Department": "sub_department",
  "SOP Related / Standard": "sop_related",
  "Risk Description": "risk_description",
  "Risk Details": "risk_details",
  "Impact Description": "impact_description",
  "Impact Level": "impact_level",
  "Probability Level": "probability_level",
  "Priority Level": "priority_level",
  "Mitigation Strategy": "mitigation_strategy",
  "Owner": "owners",
  "Root Cause Category": "root_cause_category",
  "Onset TimeFrame": "onset_timeframe",
};

export const NUMERIC_FIELDS = new Set([
  "impact_level",
  "probability_level",
  "priority_level",
]);

export const TEXTAREA_LABELS = new Set([
  "Risk Details",
  "Mitigation Strategy",
  "Impact Description",
  "Risk Description",
]);


export const SELECT_OPTIONS = {
    category: [
      { value: "Compliance", label: "Compliance" },
      { value: "Operational", label: "Operational" },
      { value: "Finance", label: "Finance" },
    ],
    onset_timeframe: [
      { value: "Slow", label: "Slow (Likely to occur with little or no warning)" },
      { value: "Moderate", label: "Moderate (Likely to occur within  2 to 4 weeks)" },
      { value: "Fast", label: "Fast (Likely to occur with little or no warning)" },
    ]
  };

export const OPTIONAL_FIELDS = new Set([
  "sop_related"
]);