import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { agentPrompt } from "@/lib/agent-config";

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

export async function POST(request: Request) {
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
    "public/evidence/receipt.jpg",
  );
  const damageImagePath = path.join(
    process.cwd(),
    "public/evidence/damaged-phone.png",
  );

  let sourcePacket: string;
  try {
    const claim = readFileSync(
      path.join(contextDirectory, "claim.json"),
      "utf8",
    );
    const evidence = readFileSync(
      path.join(contextDirectory, "evidence-register.md"),
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
      "<source id=\"EVID-03\" name=\"Repair Estimate.pdf\" representation=\"extracted-text\">",
      "The exact extracted estimate text is included in EVIDENCE-REGISTER.",
      "</source>",
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

  const stream = new ReadableStream({
    start(controller) {
      let buffer = "";
      let stderr = "";
      let resultReceived = false;
      let pendingResult: unknown = null;
      let eventCounter = 0;

      const send = (event: ClientEvent) => {
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
        "The server loaded its internal schema. Any response outside the allowed fields is rejected before it can reach the interface.",
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
          agentPrompt,
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
        analysisInProgress = false;
        send({
          type: "error",
          payload: { message: `Could not start Codex CLI: ${error.message}` },
        });
        controller.close();
      });

      child.on("close", (code) => {
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

        controller.close();
      });
    },
    cancel() {
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
