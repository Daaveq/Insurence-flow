# Claims Copilot Demo

A polished Next.js prototype showing how a claims handler can turn an incoming damaged-phone claim into an evidence-grounded, actionable case while keeping every external action under human control.

The case and customer data are synthetic. Public If guidance inspired the terminology and repair-first workflow; this repository does not contain If internal rules or real customer data.

## What The Demo Shows

The case selector contains two fixed synthetic scenarios:

- Case 1: a routine damaged-phone claim with three specific evidence gaps
- Case 2: a repair estimate with a hidden instruction aimed at the agent

The second case shows the document being treated as untrusted evidence, the instruction being quarantined and surfaced, and any approval-style recommendation being rejected before it reaches the handler.

- A recognizable incoming claim, policy snapshot, item details, and evidence
- Live analysis through the locally authenticated Codex CLI
- A bounded activity trace showing source loading, rule consultation, model execution, and validation
- Extracted facts with source references and evidence confidence
- Missing-information and contradiction checks
- A recommended next action with its rule basis
- An editable customer follow-up requiring handler approval
- Suggested routing requiring handler confirmation
- A timestamped audit trail of system, model, and human actions
- Guardrails preventing autonomous approval, denial, pricing, compensation, deductible, or repair authorization

## Run Locally

Requirements:

- Node.js 20 or newer
- Codex CLI installed and authenticated with ChatGPT: `codex login status`

Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is occupied, choose another port:

```bash
npm run build
npm run demo
```

Click **Run copilot**. A live run normally takes roughly one minute, depending on Codex account and model latency. The bounded analysis uses GPT-5.6 Luna with low reasoning effort.

## Architecture

- `src/app/page.tsx`: handler workspace and approval interactions
- `src/app/api/analyze/route.ts`: streamed Codex CLI integration
- `src/lib/demo-case.ts`: typed UI case data
- `demo-context/claim.json` and `claim-injection.json`: two fixed synthetic cases
- `demo-context/evidence-register.md` and `evidence-register-injection.md`: bounded evidence descriptions
- `demo-context/handling-rules.md`: synthetic handling and guardrail rules
- `demo-context/analysis-schema.json`: strict model output contract
- `public/evidence/damaged-phone.png`: generated synthetic evidence photograph

The browser may choose only between the two allowlisted case IDs; it cannot send a prompt or path. The server loads the matching fixed source packet and pipes it to:

```text
codex exec --json --ephemeral --sandbox read-only
```

The browser receives sanitized newline-delimited events. Raw private reasoning is not displayed. The trace shows actual source retrieval, Codex lifecycle events, schema validation, and human approvals.

## Verification

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e
```

The live authenticated browser flow is opt-in:

```bash
LIVE_CODEX=1 npm run test:e2e -- --grep "runs Codex"
```

Playwright requires Chromium and its host libraries.
