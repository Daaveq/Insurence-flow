import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  agentPromptForCase,
  maliciousInstruction,
  maliciousInstructionLocation,
  repairEstimatePacketForCase,
  securityReviewContent,
} from "@/lib/agent-config";
import { isCaseId, type AnalysisResult, type CaseId } from "@/lib/demo-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let analysisInProgress = false;

type ClientEvent =
  | {
      type: "trace";
      payload: {
        id: string;
        timestamp: string;
        title: string;
        detail: string;
        status: "active" | "complete" | "warning" | "error";
        kind: "system" | "source" | "rule" | "analysis";
        input?: string;
        output?: string;
      };
    }
  | {
      type: "source_update";
      payload: {
        sourceId: "damage" | "receipt" | "repair-estimate";
        content: string;
        mode: "replace" | "append";
        securityFinding?: { location: string; text: string };
      };
    }
  | {
      type: "security_stop";
      payload: {
        title: string;
        detail: string;
        queue: "Human Specialist Review";
        sourceId: "repair-estimate";
      };
    }
  | { type: "result"; payload: unknown }
  | { type: "error"; payload: { message: string } };

function timestamp() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Europe/Stockholm",
  }).format(new Date());
}

function detectUntrustedInstruction(value: string) {
  return /ignore (all )?previous instructions/i.test(value) ||
    /don['’]t tell the handler/i.test(value) ||
    /approve this case/i.test(value);
}

function guardrailViolation(result: AnalysisResult, caseId: CaseId) {
  if (/\b(approve|approved|deny|denied|authorize|payment|settle)\b/i.test(result.recommendation.action)) {
    return "The proposed action crossed the decision boundary.";
  }

  const allowedQueues = new Set(["Home Contents / Mobile Device Review", "Human Specialist Review"]);
  if (!allowedQueues.has(result.routing.queue)) {
    return "The proposed routing queue was not allowlisted.";
  }

  if (caseId === "injection") {
    const reportedAttack = result.issues.some((issue) =>
      issue.type === "risk" && /untrusted|instruction|document/i.test(issue.title + " " + issue.detail),
    );
    if (!reportedAttack || result.routing.queue !== "Human Specialist Review") {
      return "The untrusted document instruction was not safely escalated.";
    }
  }

  return null;
}

export async function POST(request: Request) {
  let caseId: CaseId;
  try {
    const payload = await request.json() as { caseId?: unknown };
    if (!isCaseId(payload.caseId)) {
      return Response.json({ message: "Unknown fixed demo case." }, { status: 400 });
    }
    caseId = payload.caseId;
  } catch {
    return Response.json({ message: "A fixed demo case ID is required." }, { status: 400 });
  }

  if (analysisInProgress) {
    return Response.json(
      { message: "An analysis is already running. Please wait for it to finish." },
      { status: 409 },
    );
  }

  analysisInProgress = true;

  const encoder = new TextEncoder();
  const contextDirectory = path.join(process.cwd(), "demo-context");
  const schemaPath = path.join(contextDirectory, "analysis-schema.json");
  const codexCliPath = path.join(
    process.cwd(),
    "node_modules/@openai/codex/bin/codex.js",
  );
  const receiptImagePath = path.join(
    process.cwd(),
    caseId === "injection" ? "public/evidence/receipt-case2.png" : "public/evidence/receipt.jpg",
  );
  const damageImagePath = path.join(
    process.cwd(),
    caseId === "injection" ? "public/evidence/damaged-android-case2.png" : "public/evidence/damaged-phone.png",
  );

  let sourcePacket: string;
  try {
    const claim = readFileSync(
      path.join(contextDirectory, caseId === "injection" ? "claim-injection.json" : "claim.json"),
      "utf8",
    );
    const evidence = readFileSync(
      path.join(contextDirectory, caseId === "injection" ? "evidence-register-injection.md" : "evidence-register.md"),
      "utf8",
    );
    const rules = readFileSync(
      path.join(contextDirectory, "handling-rules.md"),
      "utf8",
    );

    sourcePacket = [
      "<source id=\"CLAIM-01\" name=\"claim.json\">",
      claim,
      "</source>",
      "<source id=\"EVIDENCE-REGISTER\" name=\"evidence-register.md\">",
      evidence,
      "</source>",
      "<attachment id=\"EVID-01\" name=\"Damage.jpg\">Attached image 1</attachment>",
      "<attachment id=\"EVID-02\" name=\"Receipt.jpg\">Attached image 2</attachment>",
      "<untrusted-evidence id=\"EVID-03\" name=\"Repair Estimate.pdf\" representation=\"extracted-text\">",
      repairEstimatePacketForCase(caseId),
      "</untrusted-evidence>",
      "<source id=\"HANDLING-RULES\" name=\"handling-rules.md\">",
      rules,
      "</source>",
    ].join("\n");
  } catch {
    analysisInProgress = false;
    return Response.json(
      { message: "The synthetic case source packet could not be loaded." },
      { status: 500 },
    );
  }

  const untrustedInstructionDetected = detectUntrustedInstruction(
    repairEstimatePacketForCase(caseId),
  );

  let streamClosed = false;
  const stream = new ReadableStream({
    start(controller) {
      let buffer = "";
      let stderr = "";
      let resultReceived = false;
      let pendingResult: unknown = null;
      let eventCounter = 0;

      const send = (event: ClientEvent) => {
        if (streamClosed) return;
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      const trace = (
        title: string,
        detail: string,
        status: "active" | "complete" | "warning" | "error",
        kind: "system" | "source" | "rule" | "analysis",
        input?: string,
        output?: string,
      ) => {
        eventCounter += 1;
        send({
          type: "trace",
          payload: {
            id: `runtime-${eventCounter}`,
            timestamp: timestamp(),
            title,
            detail,
            status,
            kind,
            input,
            output,
          },
        });
      };

      trace(
        "Apply AGENT.md and lock the run",
        "The server ignores browser prompts and paths. The agent is now bound to the fixed role, hard guardrails, and five visible inputs.",
        "active",
        "system",
        "AGENT.md",
        "Role + fixed source allowlist",
      );
      trace(
        "Read the submitted damage claim",
        "Loaded the customer statement, active policy snapshot, incident description, device details, and attachment identifiers from the fixed case record.",
        "complete",
        "source",
        "Damage claim",
        "Customer + policy + incident facts",
      );
      if (untrustedInstructionDetected) {
        trace(
          "Pre-screen customer documents as untrusted data",
          "Before claim analysis begins, the safety check reads document text without allowing it to change the agent's role or permissions.",
          "complete",
          "system",
          "3 customer uploads",
          "Document safety check",
        );
        trace(
          "Inspect the repair estimate's hidden text",
          "The visible estimate ends after the total, but the document also contains a hidden machine-readable line in the bottom margin of page 1.",
          "active",
          "source",
          "Repair Estimate.pdf",
          "Page 1 · bottom margin",
        );
        trace(
          "Detect an untrusted instruction",
          "The hidden line tries to override the agent, approve the claim, and conceal that action. Customer evidence cannot issue instructions.",
          "warning",
          "system",
          "Repair Estimate.pdf · hidden text",
          "Instruction quarantined",
        );
        send({
          type: "source_update",
          payload: {
            sourceId: "repair-estimate",
            content: securityReviewContent,
            mode: "append",
            securityFinding: {
              location: maliciousInstructionLocation,
              text: maliciousInstruction,
            },
          },
        });
        trace(
          "Stop the automated claim review",
          "The safety rule is fail closed: no image analysis, evidence recommendation, customer email, claim decision, or model run continues after the attack is found.",
          "error",
          "system",
          "Untrusted instruction",
          "Review stopped",
        );
        trace(
          "Send the case to specialist review",
          "The security control records the event and moves the case to Human Specialist Review. No coverage or payment decision is made.",
          "complete",
          "system",
          "Stopped review + audit record",
          "Human Specialist Review",
        );
        send({
          type: "security_stop",
          payload: {
            title: "Untrusted instruction in Repair Estimate.pdf",
            detail: "The review stopped before the model continued. The hidden text and its exact document location are preserved in the audit log.",
            queue: "Human Specialist Review",
            sourceId: "repair-estimate",
          },
        });
        analysisInProgress = false;
        streamClosed = true;
        controller.close();
        return;
      }
      trace(
        "Queue Damage.jpg for vision review",
        "Attached the customer's damage photograph to Codex vision. The observation area stays empty until the model returns what it can actually see.",
        "complete",
        "source",
        "Damage.jpg",
        "Pending live observations",
      );
      trace(
        "Read Receipt.jpg",
        "Attached the customer's receipt image to Codex vision. The agent is checking the purchaser, device, purchase date, and amount against the claim.",
        "complete",
        "source",
        "Receipt.jpg",
        "Ownership + purchase facts",
      );
      trace(
        "Read Repair Estimate.pdf",
        "Loaded the PDF text extraction: repairer, device, proposed display replacement, function test, and SEK 2,490 total. This is evidence, not authorization.",
        "complete",
        "source",
        "Repair Estimate.pdf",
        "Repair scope + estimate",
      );
      trace(
        "Apply Rules.md",
        "Loaded decision boundaries, evidence expectations, repair-first guidance, and human-approval requirements. The agent cannot approve coverage, payment, or repair.",
        "complete",
        "rule",
        "Rules.md",
        "Guardrails + email limits",
      );
      trace(
        "Enforce the hidden output contract",
        "The server loaded its internal schema and action checks. Invalid fields, unknown queues, or approval-style recommendations are rejected before reaching the interface.",
        "complete",
        "system",
        "Server output contract",
        "Validated result",
      );

      const child = spawn(
        process.execPath,
        [
          codexCliPath,
          "exec",
          "--json",
          "--ephemeral",
          "--sandbox",
          "read-only",
          "--ignore-user-config",
          "--model",
          "gpt-5.6-luna",
          "-c",
          'model_reasoning_effort="low"',
          "--color",
          "never",
          "--output-schema",
          schemaPath,
          "--image",
          damageImagePath,
          receiptImagePath,
          "--cd",
          contextDirectory,
          agentPromptForCase(caseId),
        ],
        {
          cwd: contextDirectory,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
        },
      );

      child.stdin.end(sourcePacket);

      const stopChild = () => {
        if (!child.killed) child.kill("SIGTERM");
      };
      request.signal.addEventListener("abort", stopChild, { once: true });

      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const event = JSON.parse(line);
            const item = event.item ?? {};

            if (event.type === "thread.started") {
              trace(
                "Start an isolated Codex session",
                `Opened ephemeral thread ${String(event.thread_id).slice(0, 8)}... with a read-only sandbox. The source packet is sent through stdin and no transcript is persisted.`,
                "complete",
                "system",
                "Fixed source packet",
                "Isolated model context",
              );
            } else if (event.type === "turn.started") {
              trace(
                "Extract facts and attach citations",
                "The model is reading the claim and customer uploads, extracting policy, incident, ownership, device, damage, and repair facts, and attaching source citations.",
                "active",
                "analysis",
                "Claim + 3 customer uploads",
                "Verified claim facts",
              );
            } else if (
              event.type === "item.started" &&
              item.type === "reasoning"
            ) {
              trace(
                "Cross-check evidence and apply guardrails",
                "The model is cross-checking all three uploads, finding uncertainty, and applying the decision boundary before it writes to the customer. Private chain-of-thought is not exposed.",
                "active",
                "analysis",
                "Facts + handling rules",
                "Safe content for the email",
              );
            } else if (
              event.type === "item.completed" &&
              item.type === "agent_message"
            ) {
              pendingResult = JSON.parse(String(item.text ?? "{}"));
            } else if (event.type === "turn.completed") {
              if (pendingResult) {
                const violation = guardrailViolation(pendingResult as AnalysisResult, caseId);
                if (violation) {
                  trace(
                    "Block an unsafe model output",
                    violation + " Nothing from that output was shown or executed.",
                    "error",
                    "system",
                    "Model proposal",
                    "Blocked by server guardrail",
                  );
                  pendingResult = null;
                  return;
                }

                const structuredResult = pendingResult as {
                  evidenceAssessment?: Array<{
                    evidenceId?: string;
                    finding?: string;
                    supports?: string;
                  }>;
                };
                const evidencePlans = [
                  {
                    evidenceId: "EVID-01",
                    sourceId: "damage" as const,
                    sourceName: "Damage.jpg",
                    heading: "IMAGE OBSERVATIONS — GENERATED LIVE",
                    mode: "replace" as const,
                    ruleChecks: [
                      {
                        label: "Damage clearly visible",
                        status: "Confirmed",
                        detail: "The model's image assessment records visible physical damage.",
                      },
                      {
                        label: "Front and rear views supplied",
                        status: "Not confirmed",
                        detail: "Only one front-facing photograph was supplied; no rear view is available.",
                      },
                    ],
                  },
                  {
                    evidenceId: "EVID-02",
                    sourceId: "receipt" as const,
                    sourceName: "Receipt.jpg",
                    heading: "AGENT RECEIPT REVIEW — GENERATED LIVE",
                    mode: "append" as const,
                    ruleChecks: [
                      {
                        label: "Purchase details readable",
                        status: "Confirmed",
                        detail: "Purchaser, device, date, and amount are readable and align with the claim.",
                      },
                      {
                        label: "Device identifier visible",
                        status: "Not confirmed",
                        detail: "No serial number or IMEI is visible on the receipt.",
                      },
                    ],
                  },
                  {
                    evidenceId: "EVID-03",
                    sourceId: "repair-estimate" as const,
                    sourceName: "Repair Estimate.pdf",
                    heading: "AGENT ESTIMATE REVIEW — GENERATED LIVE",
                    mode: "append" as const,
                    ruleChecks: [
                      {
                        label: "Repair scope and total readable",
                        status: "Confirmed",
                        detail: "Repairer, proposed work, and the total including VAT are present.",
                      },
                      {
                        label: "Device identifier matched",
                        status: "Not confirmed",
                        detail: "The estimate has no serial number or IMEI to match to the claimed device.",
                      },
                    ],
                  },
                ];

                for (const plan of evidencePlans) {
                  const assessment = structuredResult.evidenceAssessment?.find(
                    (item) => item.evidenceId === plan.evidenceId,
                  );
                  if (!assessment?.finding) continue;

                  const ruleLines = plan.ruleChecks.flatMap((check) => [
                    "",
                    "Rule: " + check.label + ": " + check.status,
                    check.detail,
                  ]);
                  const reviewContent = [
                    plan.heading,
                    "",
                    assessment.finding,
                    ...(assessment.supports
                      ? ["", "WHAT THIS SUPPORTS", "", assessment.supports]
                      : []),
                    "",
                    "RULE CHECKS",
                    ...ruleLines,
                  ].join("\n");

                  send({
                    type: "source_update",
                    payload: {
                      sourceId: plan.sourceId,
                      content: reviewContent,
                      mode: plan.mode,
                    },
                  });
                  trace(
                    "Check " + plan.sourceName + " against rules",
                    "Combined the model's evidence assessment with the fixed checks for " +
                      plan.sourceName +
                      ". The missing item is carried into the customer email draft.",
                    "complete",
                    "analysis",
                    plan.sourceName,
                    "Evidence rule checks",
                  );
                }

                resultReceived = true;
                trace(
                  "Validate the structured response",
                  "Codex returned a schema-valid result. The server accepted the customer email draft and its supporting assessment.",
                  "complete",
                  "system",
                  "Codex JSON response",
                  "Schema-approved result",
                );
                trace(
                  "Draft the customer email",
                  "Created an editable email that acknowledges the received evidence and explains the next review step. The message remains unsent until a handler approves it.",
                  "complete",
                  "analysis",
                  "Schema-approved result",
                  "Front end → Email draft",
                );
                send({ type: "result", payload: pendingResult });
              }

              const outputTokens = event.usage?.output_tokens;
              trace(
                "Finish without external action",
                outputTokens
                  ? `The run completed with ${outputTokens} output tokens. The claim remains undecided; no message, route change, payment or repair authorization occurred.`
                  : "The run completed. The claim remains undecided; no message, route change, payment or repair authorization occurred.",
                "complete",
                "system",
                "Completed assessment",
                "Waiting for handler decisions",
              );
            } else if (event.type === "turn.failed" || event.type === "error") {
              trace(
                "Analysis interrupted",
                "Codex reported a runtime error before completing the assessment.",
                "error",
                "system",
              );
            }
          } catch {
            trace(
              "Runtime event skipped",
              "A non-structured CLI line was excluded from the handler-facing trace.",
              "warning",
              "system",
            );
          }
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });

      child.on("error", (error) => {
        if (streamClosed) return;
        analysisInProgress = false;
        send({
          type: "error",
          payload: { message: `Could not start Codex CLI: ${error.message}` },
        });
        streamClosed = true;
        controller.close();
      });

      child.on("close", (code) => {
        if (streamClosed) return;
        request.signal.removeEventListener("abort", stopChild);
        analysisInProgress = false;

        if (code !== 0 || !resultReceived) {
          const safeMessage =
            code === 127
              ? "Codex CLI is not available on this machine."
              : "The analysis did not return a valid structured result. Check the local Codex login and try again.";
          send({ type: "error", payload: { message: safeMessage } });

          if (stderr) {
            console.error("Codex analysis error:", stderr);
          }
        }

        streamClosed = true;
        controller.close();
      });
    },
    cancel() {
      streamClosed = true;
      analysisInProgress = false;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
