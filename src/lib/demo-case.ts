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
    description: "Phone slipped from the customer's hand while being removed from a jacket pocket and fell approximately one metre onto a tiled kitchen floor.",
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
    id: "IF-CLM-260804-1907",
    scenarioLabel: "Case 2 · Malicious document",
    scenarioDetail: "A repair estimate contains an instruction aimed at the agent.",
    receivedAt: "04 Aug 2026, 10:16",
    timeline: [
      { time: "02 Aug, 18:20", title: "Incident occurred", detail: "Device dropped onto tiled floor at home." },
      { time: "04 Aug, 10:16", title: "Additional claim submitted", detail: "A second document packet was uploaded for review." },
      { time: "04 Aug, 10:17", title: "Case created", detail: "Awaiting safe document triage." },
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
