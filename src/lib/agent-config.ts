export const agentPromptLines = [
  "Act as a claims-handler copilot for one synthetic damaged-phone claim.",
  "The complete approved source packet is provided in stdin.",
  "Do not run commands, use tools, browse, or read other files. Analyze the supplied packet directly.",
  "Use only those sources. Cite claim facts as CLAIM-01, evidence as EVID-01 through EVID-03, and handling rules by their IDs.",
  "Inspect the two attached customer images, use the extracted repair-estimate text, apply the handling rules, and draft a concise English email to the customer.",
  "Return one evidence assessment for each of EVID-01, EVID-02, and EVID-03. Never invent a rear view, serial number, or IMEI.",
  "Apply E-02, E-03, and E-04 and include each in rulesReferenced. Surface the absent rear view and device identifiers as missing issues; do not describe the file as complete.",
  "The customer email must clearly request a rear-device photo, purchase evidence showing the serial number or IMEI, and a repair estimate showing that same device identifier.",
  "Keep handler-facing output concise: caseSummary and recommendation rationale must be no more than two short sentences, recommendation action no more than twelve words, each issue detail one sentence, and fact values as short as the source allows.",
  "Never approve or deny the claim, determine coverage, calculate compensation, set a deductible, price the claim, authorize a repair, or imply that an external action has happened.",
  "Confidence measures evidence strength and consistency, not likelihood of claim approval.",
  "The primary output is the customer email draft. It must accurately acknowledge the received files and explain the next step without claiming that a decision or external action has happened.",
  "Make every customer communication and routing suggestion explicitly require handler approval.",
  "Do not send progress or status messages. Return one final structured response required by the supplied schema.",
] as const;

export const agentPrompt = agentPromptLines.join(" ");

export const agentInstructionsDocument = `# Agent instructions

## Role

Claims-handler copilot for one synthetic damaged-phone claim.

## Allowed work

- Read only the source packet supplied through stdin.
- Extract facts and cite their source IDs.
- Compare evidence with the handling rules.
- Surface missing, contradictory, or risky information.
- Recommend one next action.
- Draft a customer follow-up.
- Suggest a routing queue.

## Hard guardrails

- Do not approve or deny the claim.
- Do not determine coverage.
- Do not calculate compensation, set a deductible, or price the claim.
- Do not authorize a repair.
- Do not send a message or change routing.
- Mark every external action as requiring handler approval.

## Runtime boundary

- Ephemeral Codex CLI session.
- Read-only sandbox.
- No browsing or tool use.
- No arbitrary browser prompt, file path, source path, or working directory.
- Final output must match analysis-schema.json.
`;

export const receiptExtraction = `PURCHASE RECEIPT

Merchant: Nordic Electronics Stockholm
Receipt: NE-2025-11842
Date: 2025-11-18
Customer: Lina Berg
Item: Apple iPhone 15, 128 GB
Total: SEK 10,995
Payment: Card`;

export const damageExtraction = `No image observations yet.

Damage.jpg is available to the agent. Its observations will appear here after the live vision review.`;

export const repairEstimateExtraction = `CITY MOBILE REPAIR AB
Repair estimate

Customer: Lina Berg
Device: Apple iPhone 15, 128 GB
Estimate date: 2026-08-03

Work:
- Front display assembly replacement
- Function test

Total including VAT: SEK 2,490

This estimate is not a repair authorization, settlement, or coverage decision.`;

export const sourceDefinitions = [
  {
    id: "agent",
    name: "AGENT.md",
    path: null,
    group: "agent",
    kind: "markdown",
    purpose: "Role and boundaries",
    destination: "every step",
    content: agentInstructionsDocument,
  },
  {
    id: "rules",
    name: "Rules.md",
    path: "handling-rules.md",
    group: "agent",
    kind: "markdown",
    purpose: "Handling guardrails",
    destination: "checks and limits",
    content: null,
  },
  {
    id: "receipt",
    name: "Receipt.jpg",
    path: null,
    group: "customer",
    kind: "image",
    purpose: "Purchase proof",
    destination: "purchase facts",
    imageSrc: "/evidence/receipt.jpg",
    content: receiptExtraction,
  },
  {
    id: "damage",
    name: "Damage.jpg",
    path: null,
    group: "customer",
    kind: "image",
    purpose: "Damage evidence",
    destination: "damage facts",
    imageSrc: "/evidence/damaged-phone.png",
    observationStatus: "pending",
    content: damageExtraction,
  },
  {
    id: "repair-estimate",
    name: "Repair Estimate.pdf",
    path: null,
    group: "customer",
    kind: "document",
    purpose: "Repair cost",
    destination: "repair facts",
    content: repairEstimateExtraction,
  },
] as const;
