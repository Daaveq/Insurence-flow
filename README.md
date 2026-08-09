# Claims Copilot Demo

A polished Next.js prototype showing how a claims handler can turn an incoming damaged-phone claim into an evidence-grounded, actionable case while keeping every external action under human control.

The case and customer data are synthetic. Public If guidance inspired the terminology and repair-first workflow; this repository does not contain If internal rules or real customer data.

## Public Demo

The supervised VPS deployment is available at [co-pilot-ai.daviddemos.com](https://co-pilot-ai.daviddemos.com). The Next.js production server and its named Cloudflare Tunnel run as independent user-level systemd services defined under `ops/`; both are enabled for reboot startup and automatic recovery. Tunnel credentials remain outside the repository.

## Production deployment

Install or refresh the user services once:

```bash
./ops/install-production-services.sh
```

Deploy the committed `main` revision:

```bash
./ops/deploy-production.sh main
```

The deployment script pauses automated recovery during deployment, builds an immutable release under `.deploy/releases/`, switches `.deploy/current` only after a successful build, restarts the application, rolls back automatically if the local health check fails, verifies the public hostname, and resumes monitoring. It retains the three newest releases. Do not run `next build` directly in the directory used by a running production server.

`if-claims-copilot-health.timer` checks both the local application and public hostname every minute. Each check loads the home page, all JavaScript and CSS bundles referenced by it, and the fixed-source API. It restarts the application when the origin is unhealthy and restarts the tunnel independently when only public access is unhealthy. Inspect it with:

```bash
systemctl --user status if-claims-copilot-health.timer
journalctl --user -u if-claims-copilot-health.service --since today
```

## What The Demo Shows

The case selector contains two fixed synthetic scenarios:

- Case 1: a routine damaged-phone claim with three specific evidence gaps
- Case 2: a completely different Erik Holm / Galaxy S24 claim whose repair estimate contains a hidden instruction aimed at the agent

The second case shows exactly where the hidden text was found and what it says. A fixed security pre-check stops the run before the model continues, preserves the finding in the audit log, and sends the case to Human Specialist Review without drafting an email or making a claim decision.

- A recognizable incoming claim, policy snapshot, item details, and evidence
- Live analysis through the locally authenticated Codex CLI
- A timestamped audit log showing what happened, which source was involved, and why each step was taken
- Extracted facts with source references and evidence confidence
- Missing-information and contradiction checks
- A recommended next action with its rule basis
- An editable customer follow-up requiring handler approval
- Suggested routing requiring handler confirmation
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
- `src/app/api/chat/route.ts`: bounded case-chat Codex CLI integration
- `src/lib/demo-case.ts`: typed UI case data
- `demo-context/claim.json` and `claim-injection.json`: two fixed synthetic cases
- `demo-context/evidence-register.md` and `evidence-register-injection.md`: bounded evidence descriptions
- `demo-context/handling-rules.md`: synthetic handling and guardrail rules
- `demo-context/analysis-schema.json`: strict model output contract
- `public/evidence/damaged-phone.png`: Case 1 synthetic evidence photograph
- `demo-context/chat-schema.json`: strict case-chat output contract
- `public/evidence/damaged-android-case2.png` and `receipt-case2.png`: Case 2 synthetic evidence images

For analysis, the browser may choose only between the two allowlisted case IDs; it cannot send a prompt or path. Case 1 loads its fixed source packet and pipes it to:

```text
codex exec --json --ephemeral --sandbox read-only
```

The browser receives sanitized newline-delimited events. Raw private reasoning is not displayed. Case 1's audit log shows actual source retrieval, Codex lifecycle events, schema validation, and human approvals. Case 2 stops in the fixed document-safety pre-check and never launches Codex.

Case chat accepts a length-limited handler question, up to eight bounded transcript messages, and allowlisted workflow state. The server selects AGENT.md, rules, case sources, model, schema, command, and working directory; all conversation content is supplied through stdin as untrusted content to an ephemeral read-only Codex session.

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
