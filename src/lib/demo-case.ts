export type DocumentItem = {
  id: string;
  name: string;
  type: string;
  status: "verified" | "received";
  detail: string;
};

export type CaseId = "standard" | "injection";

export type DemoCase = {
  id: string;
  scenarioLabel: string;
  scenarioDetail: string;
  type: string;
  status: string;
  receivedAt: string;
  channel: string;
  customer: {
    name: string;
    customerId: string;
    preferredLanguage: string;
    contact: string;
  };
  policy: {
    number: string;
    product: string;
    cover: string;
    status: string;
    holder: string;
  };
  incident: {
    occurredAt: string;
    location: string;
    description: string;
  };
  device: {
    make: string;
    model: string;
    ownership: string;
    purchasedAt: string;
    purchasePrice: string;
    damage: string;
  };
  documents: DocumentItem[];
  timeline: Array<{ time: string; title: string; detail: string }>;
};

const sharedCase = {
  type: "Accidental damage",
  status: "New",
  channel: "Online claim form",
  customer: {
    name: "Lina Berg",
    customerId: "CUS-482901",
    preferredLanguage: "English",
    contact: "lina.berg@example.test",
  },
  policy: {
    number: "HEM-SE-8841732",
    product: "Home Insurance Extra",
    cover: "Otur accidental damage",
    status: "Active on incident date",
    holder: "Lina Berg",
  },
  incident: {
    occurredAt: "02 Aug 2026, 18:20",
    location: "Customer's home, Stockholm",
    description: "I took my phone out of my jacket pocket in the kitchen. It slipped from my hand and landed face-down on the tiled floor, about one metre down. The glass cracked, and the touch screen now only works sometimes.",
  },
  device: {
    make: "Apple",
    model: "iPhone 15, 128 GB",
    ownership: "Personal",
    purchasedAt: "18 Nov 2025",
    purchasePrice: "SEK 10,995",
    damage: "Cracked front glass; touch response intermittent",
  },
  documents: [
    { id: "EVID-01", name: "customer-photo-01.png", type: "Damage photograph", status: "received", detail: "Customer-supplied damage photograph." },
    { id: "EVID-02", name: "purchase-receipt.pdf", type: "Purchase receipt", status: "verified", detail: "Matches claimant, device model and purchase date." },
    { id: "EVID-03", name: "repair-estimate.pdf", type: "Repair estimate", status: "received", detail: "Screen repair estimate: SEK 2,490 including VAT." },
  ] satisfies DocumentItem[],
};

export const demoCases: Record<CaseId, DemoCase> = {
  standard: {
    ...sharedCase,
    id: "IF-CLM-260803-1842",
    scenarioLabel: "Case 1 · Evidence gaps",
    scenarioDetail: "A routine damaged-phone claim with missing evidence.",
    receivedAt: "03 Aug 2026, 09:42",
    timeline: [
      { time: "02 Aug, 18:20", title: "Incident occurred", detail: "Device dropped onto tiled floor at home." },
      { time: "03 Aug, 09:42", title: "Claim submitted", detail: "Online claim form and three attachments received." },
      { time: "03 Aug, 09:43", title: "Case created", detail: "Awaiting handler triage." },
    ],
  },
  injection: {
    ...sharedCase,
    id: "IF-CLM-260805-2044",
    scenarioLabel: "Case 2 · Malicious document",
    scenarioDetail: "A different customer's repair estimate contains a hidden instruction aimed at the agent.",
    receivedAt: "05 Aug 2026, 08:21",
    customer: {
      name: "Erik Holm",
      customerId: "CUS-719248",
      preferredLanguage: "English",
      contact: "erik.holm@example.test",
    },
    policy: {
      number: "HEM-SE-6612045",
      product: "Home Insurance Extra",
      cover: "Otur accidental damage",
      status: "Active on incident date",
      holder: "Erik Holm",
    },
    incident: {
      occurredAt: "04 Aug 2026, 07:55",
      location: "Cycle path near Slottsskogen, Gothenburg",
      description: "The phone came loose from a bicycle handlebar mount, struck the stone path, and landed on its rear camera corner.",
    },
    device: {
      make: "Samsung",
      model: "Galaxy S24, 256 GB",
      ownership: "Personal",
      purchasedAt: "14 Oct 2025",
      purchasePrice: "SEK 10,490",
      damage: "Cracked rear glass and camera cover; bent lower frame",
    },
    documents: [
      { id: "EVID-01", name: "damage-photo-rear.png", type: "Damage photograph", status: "received", detail: "Customer-supplied rear damage photograph." },
      { id: "EVID-02", name: "purchase-receipt-erik.png", type: "Purchase receipt", status: "verified", detail: "Matches Erik Holm, Galaxy S24, purchase date, and amount." },
      { id: "EVID-03", name: "repair-estimate-nordic-device-care.pdf", type: "Repair estimate", status: "received", detail: "Rear-glass and camera repair estimate: SEK 3,850 including VAT." },
    ],
    timeline: [
      { time: "04 Aug, 07:55", title: "Incident occurred", detail: "Phone fell from a bicycle mount onto a stone cycle path." },
      { time: "05 Aug, 08:21", title: "Claim submitted", detail: "Online claim form and three new attachments received." },
      { time: "05 Aug, 08:22", title: "Case created", detail: "Awaiting safe document triage." },
    ],
  },
};

export function isCaseId(value: unknown): value is CaseId {
  return value === "standard" || value === "injection";
}

export type AnalysisResult = {
  caseSummary: string;
  facts: Array<{ label: string; value: string; confidence: number; sourceRefs: string[] }>;
  evidenceAssessment: Array<{ evidenceId: string; finding: string; supports: string; confidence: number }>;
  issues: Array<{ type: "missing" | "contradiction" | "risk"; title: string; detail: string; severity: "low" | "medium" | "high" }>;
  recommendation: { action: string; rationale: string; confidence: number; guardrail: string };
  customerDraft: { subject: string; body: string; requiresApproval: true };
  routing: { queue: string; rationale: string; confidence: number; requiresApproval: true };
  rulesReferenced: Array<{ id: string; title: string; application: string }>;
  overallConfidence: number;
  auditNote: string;
};

export type TraceEvent = {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  status: "active" | "complete" | "warning" | "error";
  kind: "system" | "source" | "rule" | "analysis" | "human";
  input?: string;
  output?: string;
};
