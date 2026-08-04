"use client";

import Image from "next/image";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CircleDashed,
  Clock3,
  FileImage,
  FileText,
  Mail,
  MessageCircle,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoCases, type AnalysisResult, type CaseId, type DemoCase, type TraceEvent } from "@/lib/demo-case";

type RunState = "idle" | "running" | "complete" | "error";
type WorkspaceView = "portfolio" | "claim";
type FollowUpStage = "none" | "drafting_request" | "draft_ready" | "request_sent" | "customer_typing" | "customer_replied" | "agent_replying" | "paused" | "estimate_incoming" | "processing_estimate" | "ready";
type AgentPaneTab = "audit" | "chat";
type SourceGroup = "agent" | "customer";
type SourceKind = "markdown" | "image" | "document";
type SecurityFinding = { location: string; text: string };
type SecurityStop = {
  title: string;
  detail: string;
  queue: "Human Specialist Review";
  sourceId: string;
};

type SourceFile = {
  id: string;
  name: string;
  group: SourceGroup;
  kind: SourceKind;
  purpose: string;
  destination: string;
  content: string;
  generatedContent?: string;
  securityFinding?: SecurityFinding;
  imageSrc?: string;
  observationStatus?: "pending" | "generated";
};

const linaPreparationEmailSubject = "Information needed to prepare your mobile phone claim";
const linaPreparationEmailBody = `Hi Lina,

I’m If’s digital claims assistant. While your claim is waiting to be assigned to a handler, I’m helping prepare the file by collecting the information that is still missing. I do not make decisions about your claim.

Could you please reply with:
• a clear photo of the back of the phone;
• purchase evidence showing the serial number or IMEI; and
• an updated repair estimate showing the same identifier.

Once received, I’ll add the information to the file for your handler to review.

Kind regards,
If digital claims assistant`;

const updatedRepairEstimateSource: SourceFile = {
  id: "updated-repair-estimate",
  name: "Updated Repair Estimate.pdf",
  group: "customer",
  kind: "document",
  purpose: "Revised repair estimate with matching device identifier",
  destination: "Customer follow-up → handler handoff",
  content: [
    "CITY MOBILE REPAIR AB",
    "Updated repair estimate",
    "",
    "Customer: Lina Berg",
    "Device: Apple iPhone 15, 128 GB",
    "IMEI: 35 874312 904216 7",
    "Estimate date: 2026-08-05",
    "",
    "Work:",
    "- Front display assembly replacement",
    "- Function test",
    "",
    "Total including VAT: SEK 2,490",
    "",
    "Customer-supplied synthetic demo document. This is not a repair authorization, settlement, or coverage decision.",
  ].join("\n"),
};

const idleTrace: TraceEvent[] = [{
  id: "idle",
  timestamp: "Ready",
  title: "Waiting for the handler",
  detail: "The agent has not started. Run the copilot to follow every file it reads and every output it creates.",
  status: "active",
  kind: "system",
  input: "Handler action",
  output: "Start analysis",
}];

const startingTrace: TraceEvent[] = [{
  id: "starting",
  timestamp: "Now",
  title: "The handler started the claim review",
  detail: "The front end sent a fixed analysis request. No prompt, file path, or command came from the browser.",
  status: "active",
  kind: "human",
  input: "Run copilot",
  output: "POST /api/analyze",
}];

const portfolioClaims = [
  { caseId: "standard" as const, claim: demoCases.standard.id, customer: demoCases.standard.customer.name, description: "Dropped mobile phone · missing evidence", received: "03 Aug · 09:42", preparation: "Ready to start", tone: "ready" },
  { caseId: "injection" as const, claim: demoCases.injection.id, customer: demoCases.injection.customer.name, description: "Bicycle fall · document safety review", received: "05 Aug · 08:21", preparation: "Safety check required", tone: "attention" },
  { claim: "IF-CLM-260805-1987", customer: "Maja Nilsson", description: "Water leak · kitchen flooring", received: "05 Aug · 07:58", preparation: "Collecting documents", tone: "working" },
  { claim: "IF-CLM-260805-1931", customer: "Oskar Lind", description: "Bicycle theft · station parking", received: "05 Aug · 07:44", preparation: "Waiting for police report", tone: "waiting" },
  { claim: "IF-CLM-260804-1876", customer: "Sara Ahmed", description: "Travel delay · missed connection", received: "04 Aug · 18:12", preparation: "Case prepared", tone: "complete" },
  { claim: "IF-CLM-260804-1803", customer: "Johan Ek", description: "Cracked window · storm damage", received: "04 Aug · 16:49", preparation: "Handler decision needed", tone: "attention" },
  { claim: "IF-CLM-260804-1742", customer: "Elin Borg", description: "Laptop damage · accidental drop", received: "04 Aug · 14:06", preparation: "Collecting information", tone: "working" },
  { claim: "IF-CLM-260804-1698", customer: "Nils Persson", description: "Lost luggage · return journey", received: "04 Aug · 12:38", preparation: "Customer replied", tone: "complete" },
  { claim: "IF-CLM-260804-1621", customer: "Astrid Dahl", description: "Roof damage · fallen branch", received: "04 Aug · 11:16", preparation: "Reviewing evidence", tone: "working" },
  { claim: "IF-CLM-260804-1584", customer: "Viktor Berg", description: "Phone theft · public transport", received: "04 Aug · 10:42", preparation: "Waiting for customer", tone: "waiting" },
  { claim: "IF-CLM-260804-1519", customer: "Freja Holm", description: "Freezer failure · food loss", received: "04 Aug · 09:57", preparation: "Case prepared", tone: "complete" },
  { claim: "IF-CLM-260804-1456", customer: "Leo Andersson", description: "Bathroom leak · water damage", received: "04 Aug · 09:21", preparation: "Handler decision needed", tone: "attention" },
  { claim: "IF-CLM-260803-1394", customer: "Alva Svensson", description: "Camera damage · travel incident", received: "03 Aug · 20:08", preparation: "Collecting documents", tone: "working" },
  { claim: "IF-CLM-260803-1327", customer: "Elias Lund", description: "Garage break-in · stolen tools", received: "03 Aug · 18:35", preparation: "Police report received", tone: "complete" },
  { claim: "IF-CLM-260803-1268", customer: "Ida Nyberg", description: "Sofa damage · accidental spill", received: "03 Aug · 16:19", preparation: "Waiting for photos", tone: "waiting" },
  { claim: "IF-CLM-260803-1192", customer: "Noah Eng", description: "Travel cancellation · illness", received: "03 Aug · 14:03", preparation: "Reviewing documents", tone: "working" },
];

const uploads = [
  { id: "receipt", name: "Receipt.jpg", detail: "Purchase proof", icon: FileImage },
  { id: "damage", name: "Damage.jpg", detail: "Damage photo", icon: FileImage },
  { id: "repair-estimate", name: "Repair Estimate.pdf", detail: "Repair cost", icon: FileText },
] as const;

type TourStep = {
  title: string;
  body: string;
  target?: string;
  placement: "center" | "left" | "right" | "below";
};

const tourSteps: TourStep[] = [
  {
    title: "Welcome to the demo",
    body: "This is a demo for If. The idea is to show how an AI agent could work with insurance claims.",
    placement: "center",
  },
  {
    title: "The claims-handler side",
    body: "This side shows an uploaded claim already waiting for review. Imagine that the human handler is busy with another case: the agent can do useful pre-work before the handler arrives.",
    target: "handler-side",
    placement: "right",
  },
  {
    title: "The AI agent side",
    body: "Here you can see what the agent is doing, which information it is using from the handler's dashboard, and how the work can remain understandable without an immense amount of technical machinery.",
    target: "agent-side",
    placement: "left",
  },
  {
    title: "AGENT.md",
    body: "This small file defines the agent's role and hard boundaries. It can prepare and recommend, but it cannot approve, deny, pay, authorize repair, or contact the customer.",
    target: "source-agent",
    placement: "left",
  },
  {
    title: "Rules.md",
    body: "These are the synthetic handling and evidence rules the agent must check. They make its assessment visible and repeatable instead of leaving the model to improvise.",
    target: "source-rules",
    placement: "left",
  },
  {
    title: "Receipt.jpg",
    body: "The customer supplied this purchase receipt. The agent reads the purchase details, compares them with the claim, and records both confirmed and missing evidence checks.",
    target: "source-receipt",
    placement: "left",
  },
  {
    title: "Damage.jpg",
    body: "The agent inspects this image live. No observations are prefilled: its description and rule checks appear only after the model has reviewed the photograph.",
    target: "source-damage",
    placement: "left",
  },
  {
    title: "Repair Estimate.pdf",
    body: "The estimate is shown as extracted document text. The agent checks its repair scope, total, and whether the device can be matched to the other evidence.",
    target: "source-repair-estimate",
    placement: "left",
  },
  {
    title: "Reset the demo",
    body: "Reset demo stops an active run and restores the claim to its original state. Use it whenever you want to clear the agent's work and walk through the experience again.",
    target: "reset-demo",
    placement: "below",
  },
  {
    title: "Run the real copilot",
    body: "Click either Run copilot button to start. This is an actual agent doing the work live on my Codex subscription—so, for the sake of my sourdough recipes, please run it sparingly. Feel free to click around and familiarise yourself before you begin.",
    target: "run-copilot",
    placement: "below",
  },
];

function currentTime() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date());
}

function sourceIdsForTraceInput(input?: string) {
  const value = input ?? "";
  const sourceIds: string[] = [];

  if (/AGENT\.md|agent instructions/i.test(value)) sourceIds.push("agent");
  if (/Rules\.md|handling-rules|handling rules/i.test(value)) sourceIds.push("rules");
  if (/Receipt|customer uploads|all three uploads/i.test(value)) sourceIds.push("receipt");
  if (/Damage|customer uploads|all three uploads/i.test(value)) sourceIds.push("damage");
  if (/Repair Estimate|customer uploads|all three uploads/i.test(value)) sourceIds.push("repair-estimate");

  return sourceIds;
}

const EVENT_PACE_MS = 650;
const TYPEWRITER_CHUNK_SIZE = 4;
const TYPEWRITER_INTERVAL_MS = 18;

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function waitForPresentation(milliseconds: number, signal?: AbortSignal) {
  if (prefersReducedMotion()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(finish, milliseconds);

    function finish() {
      signal?.removeEventListener("abort", finish);
      window.clearTimeout(timeout);
      resolve();
    }

    signal?.addEventListener("abort", finish, { once: true });
  });
}

async function revealText(
  text: string,
  setValue: (value: string) => void,
  signal: AbortSignal,
) {
  if (prefersReducedMotion()) {
    setValue(text);
    return;
  }

  setValue("");
  for (let index = TYPEWRITER_CHUNK_SIZE; index < text.length; index += TYPEWRITER_CHUNK_SIZE) {
    if (signal.aborted) return;
    setValue(text.slice(0, index));
    await waitForPresentation(TYPEWRITER_INTERVAL_MS, signal);
  }
  setValue(text);
}

function DemoTour({
  stepIndex,
  sourceCount,
  setStepIndex,
}: {
  stepIndex: number;
  sourceCount: number;
  setStepIndex: (step: number) => void;
}) {
  const step = tourSteps[stepIndex];
  const [spotlightRects, setSpotlightRects] = useState<Array<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>>([]);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!step) return;

    let frame = 0;

    const updateSpotlight = () => {
      if (!step.target) {
        setSpotlightRects([]);
        return;
      }

      const targets = document.querySelectorAll<HTMLElement>(
        '[data-tour="' + step.target + '"]',
      );
      if (!targets.length) {
        setSpotlightRects([]);
        return;
      }

      const padding = step.target === "handler-side" || step.target === "agent-side" ? 6 : 8;
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setSpotlightRects(Array.from(targets, (target) => {
        const rect = target.getBoundingClientRect();
        return {
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        };
      }));
    };

    frame = window.requestAnimationFrame(updateSpotlight);
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateSpotlight);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStepIndex(tourSteps.length);
      if (event.key === "ArrowRight") {
        setStepIndex(Math.min(stepIndex + 1, tourSteps.length));
      }
      if (event.key === "ArrowLeft") {
        setStepIndex(Math.max(stepIndex - 1, 0));
      }
    };

    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sourceCount, step, stepIndex, setStepIndex]);

  if (!step) return null;

  return (
    <div className="tourLayer">
      {step.target && spotlightRects.length
        ? (
          <>
            <svg
              aria-hidden="true"
              className="tourShade"
              preserveAspectRatio="none"
              viewBox={`0 0 ${viewport.width} ${viewport.height}`}
            >
              <defs>
                <mask id="tour-spotlight-mask">
                  <rect width={viewport.width} height={viewport.height} fill="white" />
                  {spotlightRects.map((rect, index) => (
                    <rect
                      key={index}
                      x={rect.left}
                      y={rect.top}
                      width={rect.width}
                      height={rect.height}
                      rx="9"
                      fill="black"
                    />
                  ))}
                </mask>
              </defs>
              <rect
                width={viewport.width}
                height={viewport.height}
                fill="rgba(5, 9, 7, 0.78)"
                mask="url(#tour-spotlight-mask)"
              />
            </svg>
            {spotlightRects.map((rect, index) => (
              <div className="tourSpotlight" style={rect} aria-hidden="true" key={index} />
            ))}
          </>
        )
        : <div className="tourBackdrop" aria-hidden="true" />}
      <section
        aria-label="Demo introduction"
        aria-modal="true"
        className={"tourCard tourCard-" + step.placement}
        role="dialog"
      >
        <span className="tourEyebrow">Demo guide · {stepIndex + 1}/{tourSteps.length}</span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <footer>
          <button className="tourSkip" onClick={() => setStepIndex(tourSteps.length)}>Skip tour</button>
          <div>
            {stepIndex > 0 && (
              <button className="tourBack" onClick={() => setStepIndex(stepIndex - 1)}>Back</button>
            )}
            <button
              className="tourNext"
              onClick={() => setStepIndex(stepIndex + 1)}
            >
              {stepIndex === tourSteps.length - 1 ? "Explore demo" : "Next"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function TypewriterText({ text, animate }: { text: string; animate: boolean }) {
  const [visibleText, setVisibleText] = useState("");
  const shouldAnimate = animate && !prefersReducedMotion();

  useEffect(() => {
    if (!shouldAnimate) return;

    let cancelled = false;
    let timeout = 0;
    let index = 0;

    const tick = () => {
      if (cancelled) return;
      index = Math.min(index + TYPEWRITER_CHUNK_SIZE, text.length);
      setVisibleText(text.slice(0, index));
      if (index < text.length) {
        timeout = window.setTimeout(tick, TYPEWRITER_INTERVAL_MS);
      }
    };

    timeout = window.setTimeout(tick, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [shouldAnimate, text]);

  if (!shouldAnimate) return <>{text}</>;

  return (
    <>
      {visibleText}
      {visibleText.length < text.length && <span className="typewriterCursor" aria-hidden="true" />}
    </>
  );
}

export default function Home() {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("portfolio");
  const [selectedCaseId, setSelectedCaseId] = useState<CaseId | null>(null);
  const [tourStep, setTourStep] = useState(tourSteps.length);
  const [runState, setRunState] = useState<RunState>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [trace, setTrace] = useState<TraceEvent[]>(idleTrace);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<SourceFile[]>([]);
  const [sourceError, setSourceError] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("agent");
  const [workingSourceIds, setWorkingSourceIds] = useState<string[]>([]);
  const [typingSourceId, setTypingSourceId] = useState<string | null>(null);
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [draftIsTyping, setDraftIsTyping] = useState(false);
  const [draftApproved, setDraftApproved] = useState(false);
  const [followUpStage, setFollowUpStage] = useState<FollowUpStage>("none");
  const [agentPaneTab, setAgentPaneTab] = useState<AgentPaneTab>("audit");
  const [securityStop, setSecurityStop] = useState<SecurityStop | null>(null);
  const analysisRequest = useRef<AbortController | null>(null);
  const initialSources = useRef<SourceFile[]>([]);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (!selectedCaseId) return;
    const controller = new AbortController();
    fetch("/api/sources?case=" + selectedCaseId, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Source files could not be loaded.");
        return response.json() as Promise<{ files: SourceFile[] }>;
      })
      .then((payload) => {
        initialSources.current = payload.files;
        setSources(payload.files);
      })
      .catch((caughtError: unknown) => {
        if (!controller.signal.aborted) {
          setSourceError(caughtError instanceof Error ? caughtError.message : "Source files could not be loaded.");
        }
      });
    return () => controller.abort();
  }, [selectedCaseId]);

  const demoCase = selectedCaseId ? demoCases[selectedCaseId] : null;
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId),
    [selectedSourceId, sources],
  );

  const navigateTour = useCallback((stepIndex: number) => {
    const target = tourSteps[stepIndex]?.target;
    if (target?.startsWith("source-")) {
      setSelectedSourceId(target.slice("source-".length));
    }
    setTourStep(stepIndex);
  }, []);

  const resetDemo = () => {
    requestVersion.current += 1;
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    setRunState("idle");
    setAnalysis(null);
    setTrace(idleTrace);
    setError("");
    setDraftSubject("");
    setDraftBody("");
    setDraftIsTyping(false);
    setDraftApproved(false);
    setFollowUpStage("none");
    setAgentPaneTab("audit");
    setSecurityStop(null);
    setSelectedSourceId("agent");
    setWorkingSourceIds([]);
    setTypingSourceId(null);
    setSources(initialSources.current.map((source) => ({ ...source })));
  };

  const selectCase = (caseId: CaseId) => {
    if (runState === "running") return;
    resetDemo();
    initialSources.current = [];
    setSources([]);
    setSourceError("");
    setSelectedCaseId(caseId);
    setWorkspaceView("claim");
  };

  const returnToPortfolio = () => {
    resetDemo();
    initialSources.current = [];
    setSources([]);
    setSourceError("");
    setSelectedCaseId(null);
    setWorkspaceView("portfolio");
  };

  const runAnalysis = async () => {
    if (!selectedCaseId) return;
    analysisRequest.current?.abort();
    const controller = new AbortController();
    analysisRequest.current = controller;
    const version = ++requestVersion.current;
    setRunState("running");
    setAnalysis(null);
    setTrace(startingTrace);
    setError("");
    setDraftIsTyping(false);
    setDraftApproved(false);
    setFollowUpStage("none");
    setAgentPaneTab("audit");
    setSecurityStop(null);
    setSelectedSourceId("agent");
    setWorkingSourceIds(["agent"]);
    setTypingSourceId(null);
    setSources(initialSources.current.map((source) => ({ ...source })));

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedCaseId }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Analysis could not be started.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "trace") {
            setTrace((events) => [...events, event.payload]);
            const sourceIds = sourceIdsForTraceInput(event.payload.input);
            if (sourceIds.length) {
              setWorkingSourceIds(sourceIds);
              setSelectedSourceId(sourceIds[0]);
            }
            await waitForPresentation(EVENT_PACE_MS, controller.signal);
          }
          if (event.type === "source_update") {
            const { sourceId, content, mode, securityFinding } = event.payload as {
              sourceId: string;
              content: string;
              mode: "replace" | "append";
              securityFinding?: SecurityFinding;
            };
            setSources((files) => files.map((source) =>
              source.id === sourceId
                ? {
                    ...source,
                    content: mode === "replace" ? content : source.content,
                    generatedContent: mode === "append"
                      ? [source.generatedContent, content].filter(Boolean).join("\n\n")
                      : undefined,
                    observationStatus: "generated",
                    securityFinding,
                  }
                : source,
            ));
            setSelectedSourceId(sourceId);
            setWorkingSourceIds([sourceId]);
            setTypingSourceId(sourceId);
            const revealDuration = Math.min(
              900,
              Math.max(600, Math.ceil(content.length / TYPEWRITER_CHUNK_SIZE) * TYPEWRITER_INTERVAL_MS * 0.45),
            );
            await waitForPresentation(revealDuration, controller.signal);
            if (version === requestVersion.current) setTypingSourceId(null);
          }
          if (event.type === "security_stop") {
            const stop = event.payload as SecurityStop;
            setSecurityStop(stop);
            setSelectedSourceId(stop.sourceId);
            setWorkingSourceIds([stop.sourceId]);
          }
          if (event.type === "result") {
            const result = event.payload as AnalysisResult;
            const customerDraft = selectedCaseId === "standard"
              ? { subject: linaPreparationEmailSubject, body: linaPreparationEmailBody }
              : result.customerDraft;
            setAnalysis(result);
            setDraftSubject(customerDraft.subject);
            setDraftIsTyping(true);
            setFollowUpStage("drafting_request");
            void revealText(customerDraft.body, setDraftBody, controller.signal)
              .finally(() => {
                if (version === requestVersion.current) setDraftIsTyping(false);
              });
          }
          if (event.type === "error") throw new Error(event.payload.message);
        }
      }
      if (version === requestVersion.current) {
        setRunState("complete");
        setWorkingSourceIds([]);
      }
    } catch (caughtError) {
      if (version !== requestVersion.current || controller.signal.aborted) return;
      setError(caughtError instanceof Error ? caughtError.message : "Unexpected analysis error.");
      setRunState("error");
    } finally {
      if (analysisRequest.current === controller) analysisRequest.current = null;
    }
  };

  const showSource = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    document.querySelector(".sourcePane")?.scrollIntoView({ behavior: "smooth" });
  };

  const approveDraft = () => {
    if (followUpStage !== "draft_ready") return;
    setDraftApproved(true);
    setFollowUpStage("request_sent");
    setTrace((events) => [...events, {
      id: crypto.randomUUID(),
      timestamp: currentTime(),
      title: "The handler approved the preparation email",
      detail: "The reviewed message is shown as sent inside this synthetic demo. No real external email is sent.",
      status: "complete",
      kind: "human",
      input: "Handler-approved information request",
      output: "Synthetic email sent · awaiting customer",
    }]);
  };

  const receiveUpdatedEstimate = () => {
    if (followUpStage !== "paused") return;
    setSources((files) => files.some((source) => source.id === updatedRepairEstimateSource.id)
      ? files
      : [...files, updatedRepairEstimateSource]);
    setSelectedSourceId(updatedRepairEstimateSource.id);
    setWorkingSourceIds([]);
    setFollowUpStage("estimate_incoming");
    setTrace((events) => [...events, {
      id: crypto.randomUUID(),
      timestamp: currentTime(),
      title: "Updated estimate email received",
      detail: "The customer supplied the revised repair estimate with the missing device identifier.",
      status: "complete",
      kind: "analysis",
      input: "Customer email + revised estimate",
      output: "Estimate queued for agent review",
    }]);
  };

  useEffect(() => {
    if (followUpStage === "none") return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(".communicationLog")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [followUpStage]);

  useEffect(() => {
    if (followUpStage === "drafting_request" && draftIsTyping) return;
    const transitions: Partial<Record<FollowUpStage, { next: FollowUpStage; delay: number }>> = {
      drafting_request: { next: "draft_ready", delay: 700 },
      request_sent: { next: "customer_typing", delay: 2400 },
      customer_typing: { next: "customer_replied", delay: 2500 },
      customer_replied: { next: "agent_replying", delay: 2600 },
      agent_replying: { next: "paused", delay: 2500 },
      estimate_incoming: { next: "processing_estimate", delay: 2600 },
      processing_estimate: { next: "ready", delay: 2500 },
    };
    const transition = transitions[followUpStage];
    if (!transition) return;
    const timeout = window.setTimeout(() => {
      setFollowUpStage(transition.next);
      if (transition.next === "processing_estimate") {
        setSelectedSourceId(updatedRepairEstimateSource.id);
        setWorkingSourceIds([updatedRepairEstimateSource.id]);
      }
      if (transition.next === "customer_replied") {
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Customer reply received",
          detail: "The missing damage photo arrived, and Lina confirmed that the revised estimate is still coming.",
          status: "complete", kind: "analysis", input: "Customer email + attachment", output: "Damage photo received · estimate pending",
        }]);
      }
      if (transition.next === "paused") {
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "AI acknowledgement sent in demo",
          detail: "The agent confirmed receipt of the photo and explained that it is waiting for the revised estimate.",
          status: "complete", kind: "analysis", input: "Customer reply", output: "Synthetic acknowledgement logged",
        }]);
      }
      if (transition.next === "ready") {
        setWorkingSourceIds([]);
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Updated estimate received and processed",
          detail: "The device identifier is now present. The preparation file is complete and ready for a handler to make the remaining decisions.",
          status: "complete", kind: "analysis", input: "Customer email + revised estimate", output: "Case ready for handler review",
        }]);
      }
    }, transition.delay);
    return () => window.clearTimeout(timeout);
  }, [draftIsTyping, followUpStage]);

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="brandLockup">
          <div className="brandMark" aria-hidden="true">if</div>
          <div><strong>Claims Copilot</strong><span>Synthetic damaged-phone demo</span></div>
        </div>
        <div className="workspaceCrumb">
          <span>{workspaceView === "portfolio" ? "Claims overview" : "Active claim"}</span>
          <strong>{demoCase?.id ?? "Nordic Digital Claims"}</strong>
        </div>
        <div className="headerActions">
          {workspaceView === "claim" && <>
            <RunStatus state={runState} />
            <button data-tour="reset-demo" className="secondaryButton" onClick={resetDemo}><RotateCcw size={16} />Reset case</button>
            <button data-tour="run-copilot" className="primaryButton" onClick={runAnalysis} disabled={runState === "running"}>
              {runState === "running" ? <CircleDashed className="spin" size={16} /> : <Play size={16} fill="currentColor" />}
              {runState === "running" ? "Preparing" : runState === "complete" ? "Run again" : "Start preparation"}
            </button>
          </>}
        </div>
      </header>

      <main className={"demoSplit " + (workspaceView === "portfolio" ? "portfolioView" : "claimView")}>
        <section data-tour="handler-side" className="frontPanel" aria-label="Front end handler view">
          {workspaceView === "portfolio" || !demoCase ? (
            <ClaimsOverview selectCase={selectCase} />
          ) : <>
            <div className="claimPanelHeader">
              <button className="backButton" onClick={returnToPortfolio}><ArrowLeft size={15} />All claims</button>
              <PanelHeader label="Front end" title="Claim preparation" detail={demoCase.scenarioLabel} />
            </div>
            <div className="frontScroll">
              <CaseSummary demoCase={demoCase} showSource={showSource} />
              <ClaimTimeline demoCase={demoCase} state={runState} followUpStage={followUpStage} workingSourceIds={workingSourceIds} securityStop={securityStop} />
              <FrontEndState state={runState} analysis={analysis} error={error} trace={trace} runAnalysis={runAnalysis} securityStop={securityStop} />
              <CommunicationLog
                demoCase={demoCase} state={runState} stage={followUpStage}
                draftSubject={draftSubject} setDraftSubject={setDraftSubject}
                draftBody={draftBody} setDraftBody={setDraftBody}
                draftIsTyping={draftIsTyping} draftApproved={draftApproved}
                approveDraft={approveDraft} receiveUpdatedEstimate={receiveUpdatedEstimate}
                securityStop={securityStop}
              />
            </div>
          </>}
        </section>

        <aside data-tour="agent-side" className="backendPanel" aria-label="Back end agent view">
          {workspaceView === "portfolio" || !demoCase ? <DormantAgent /> : <><SourcePane
            sources={sources}
            selectedSource={selectedSource}
            selectedSourceId={selectedSourceId}
            workingSourceIds={workingSourceIds}
            typingSourceId={typingSourceId}
            sourceError={sourceError}
            selectSource={setSelectedSourceId}
          />
          <ActivityPane trace={trace} state={runState} demoCase={demoCase} analysis={analysis} securityStop={securityStop} followUpStage={followUpStage} tab={agentPaneTab} setTab={setAgentPaneTab} />
          <button className={"agentChatLauncher" + (agentPaneTab === "chat" ? " launcherActive" : "")} onClick={() => setAgentPaneTab("chat")}><MessageCircle size={15} />{agentPaneTab === "chat" ? "Case agent chat open" : "Chat with this case agent"}</button></>}
        </aside>
      </main>
      <DemoTour
        stepIndex={tourStep}
        sourceCount={sources.length}
        setStepIndex={navigateTour}
      />
    </div>
  );
}

function ClaimsOverview({ selectCase }: { selectCase: (caseId: CaseId) => void }) {
  return (
    <div className="claimsOverview">
      <header className="overviewHero">
        <div>
          <span>Claims workspace</span>
          <h1>Good morning, Alex</h1>
          <p>AI agents prepare new claims while handlers focus on decisions that require judgment.</p>
        </div>
        <div className="overviewMetric"><strong>16</strong><span>Open claims</span><small>2 available in this demo</small></div>
      </header>
      <section className="claimQueue" aria-label="Claims overview">
        <header>
          <span>Claim and customer</span><span>Description</span><span>Received</span><span>Preparation status</span><span />
        </header>
        {portfolioClaims.map((claim, index) => {
          const caseId = "caseId" in claim ? claim.caseId : undefined;
          const content = <>
            <span className="claimPerson"><strong>{claim.customer}</strong><small>{claim.claim}</small></span>
            <span className="claimDescription">{claim.description}{caseId && <small>Demo case {index + 1} · Open claim</small>}</span>
            <span className="claimReceived">{claim.received}</span>
            <span className={"preparationPill preparation-" + claim.tone}><i />{claim.preparation}</span>
            <span className="claimOpen">{caseId ? <ArrowRight size={15} /> : <small>Demo only</small>}</span>
          </>;
          return caseId ? (
            <button className="claimRow claimRow-active" key={claim.claim} onClick={() => selectCase(caseId)}>{content}</button>
          ) : (
            <div className="claimRow claimRow-disabled" key={claim.claim} tabIndex={0}>
              {content}
              <span className="demoHoverMessage" role="tooltip">This claim cannot be opened — only the first two work in this demo.</span>
            </div>
          );
        })}
      </section>
      <footer className="overviewFootnote"><ShieldCheck size={14} />AI preparation never approves, denies, prices, or pays a claim. Human decisions stay with the handler.</footer>
    </div>
  );
}

function DormantAgent() {
  return (
    <section className="dormantAgent">
      <div className="dormantMark"><Bot size={28} /></div>
      <span>Agent workspace</span>
      <h2>No claim agent loaded</h2>
      <p>Select one of the two available claims. Its own bounded agent, case files, rules, and audit history will load here.</p>
      <div><i /><span>Portfolio view is read-only</span></div>
    </section>
  );
}

function ClaimTimeline({ demoCase, state, followUpStage, workingSourceIds, securityStop }: {
  demoCase: DemoCase;
  state: RunState;
  followUpStage: FollowUpStage;
  workingSourceIds: string[];
  securityStop: SecurityStop | null;
}) {
  type TimelineItem = { label: string; done: boolean; active?: boolean; warning?: boolean };
  type TimelineStage = { label: string; status: string; detail: string; items: TimelineItem[] };
  const isInjection = demoCase === demoCases.injection;
  const order: FollowUpStage[] = ["none", "drafting_request", "draft_ready", "request_sent", "customer_typing", "customer_replied", "agent_replying", "paused", "estimate_incoming", "processing_estimate", "ready"];
  const reached = (stage: FollowUpStage) => order.indexOf(followUpStage) >= order.indexOf(stage);
  const reviewed = state === "complete" || followUpStage !== "none";
  const running = state === "running";
  const activeEvidence = running ? workingSourceIds[0] : undefined;
  const followUpActive = !["none", "paused", "ready"].includes(followUpStage);

  const stages: TimelineStage[] = isInjection ? [
    {
      label: "Claim intake", status: "complete", detail: "Initial submission captured",
      items: [
        { label: "Loss details registered", done: true },
        { label: "Customer and policy linked", done: true },
        { label: "Three uploads received", done: true },
      ],
    },
    {
      label: "Document safety", status: securityStop ? "warning" : running ? "active" : "waiting",
      detail: securityStop ? "Untrusted instruction detected" : "Waiting for safety inspection",
      items: [
        { label: "Visible content isolated", done: Boolean(securityStop), active: running && !securityStop },
        { label: "Hidden machine text scanned", done: Boolean(securityStop) },
        { label: "Override attempt identified", done: Boolean(securityStop), warning: Boolean(securityStop) },
      ],
    },
    {
      label: "Automation stop", status: securityStop ? "warning" : "waiting",
      detail: securityStop ? "All further actions blocked" : "Not started",
      items: [
        { label: "No customer communication", done: Boolean(securityStop) },
        { label: "No model claim analysis", done: Boolean(securityStop) },
        { label: "No claim decision made", done: Boolean(securityStop) },
      ],
    },
    {
      label: "Specialist handoff", status: securityStop ? "active" : "waiting",
      detail: securityStop ? "Human Specialist Review" : "Not started",
      items: [
        { label: "Finding and location preserved", done: Boolean(securityStop) },
        { label: "Clean estimate required", done: Boolean(securityStop) },
        { label: "Human review pending", done: false, active: Boolean(securityStop) },
      ],
    },
  ] : [
    {
      label: "Claim intake", status: "complete", detail: "Submission captured",
      items: [
        { label: "Loss details registered", done: true },
        { label: "Customer and policy linked", done: true },
        { label: "Three uploads received", done: true },
      ],
    },
    {
      label: "Evidence review", status: reviewed ? "complete" : running ? "active" : "waiting",
      detail: reviewed ? "Evidence gaps identified" : running ? "Checking each source" : "Waiting to start",
      items: [
        { label: "Damage photo assessed", done: reviewed, active: activeEvidence === "damage" },
        { label: "Purchase details checked", done: reviewed, active: activeEvidence === "receipt" },
        { label: "Repair estimate checked", done: reviewed, active: activeEvidence === "repair-estimate" },
        { label: "Missing identifiers found", done: reviewed, active: running && ["rules", "repair-estimate"].includes(activeEvidence ?? "") },
      ],
    },
    {
      label: "Customer follow-up", status: followUpStage === "ready" ? "complete" : followUpActive ? "active" : "waiting",
      detail: followUpStage === "ready" ? "All requested evidence received" : followUpStage === "paused" ? "Waiting for updated estimate" : followUpActive ? "Live customer exchange" : reviewed ? "Request ready to draft" : "Not started",
      items: [
        { label: "Request prepared", done: reached("draft_ready"), active: followUpStage === "drafting_request" },
        { label: "Approved request sent in demo", done: reached("request_sent"), active: followUpStage === "request_sent" },
        { label: "Missing photo processed", done: reached("paused"), active: ["customer_replied", "agent_replying"].includes(followUpStage) },
        { label: "Updated estimate processed", done: followUpStage === "ready", active: ["estimate_incoming", "processing_estimate"].includes(followUpStage) },
      ],
    },
    {
      label: "Handler handoff", status: followUpStage === "ready" ? "ready" : "waiting",
      detail: followUpStage === "ready" ? "Ready for handler review" : "Waiting for complete file",
      items: [
        { label: "Evidence grouped", done: followUpStage === "ready" },
        { label: "Communications summarized", done: followUpStage === "ready" },
        { label: "Human claim decision pending", done: false, active: false },
      ],
    },
  ];

  return (
    <section className="claimTimeline">
      <header><div><Clock3 size={15} /><strong>Claim preparation timeline</strong></div><span>Every check and handoff remains visible</span></header>
      <div className="timelineStages">
        {stages.map((stage, index) => (
          <article className={"timelineStage timeline-" + stage.status} key={stage.label}>
            <header><span className="timelineNode">{stage.status === "complete" || stage.status === "ready" ? <Check size={12} /> : index + 1}</span><div><strong>{stage.label}</strong><small>{stage.detail}</small></div></header>
            <ul>{stage.items.map((item) => <li className={[item.warning ? "itemWarning" : item.done ? "itemDone" : "", item.active ? "itemActive" : ""].filter(Boolean).join(" ")} key={item.label}>{item.done && !item.active ? <Check size={10} /> : <span />}{item.label}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function CommunicationLog({
  demoCase, state, stage, draftSubject, setDraftSubject, draftBody, setDraftBody,
  draftIsTyping, draftApproved, approveDraft, receiveUpdatedEstimate, securityStop,
}: {
  demoCase: DemoCase;
  state: RunState;
  stage: FollowUpStage;
  draftSubject: string;
  setDraftSubject: (value: string) => void;
  draftBody: string;
  setDraftBody: (value: string) => void;
  draftIsTyping: boolean;
  draftApproved: boolean;
  approveDraft: () => void;
  receiveUpdatedEstimate: () => void;
  securityStop: SecurityStop | null;
}) {
  type MessageTone = "ai" | "human" | "system" | "security";
  type CommunicationMessage = { id: string; actor: string; direction: string; time: string; title: string; body: string; tone: MessageTone; attachment?: string };
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const order: FollowUpStage[] = ["none", "drafting_request", "draft_ready", "request_sent", "customer_typing", "customer_replied", "agent_replying", "paused", "estimate_incoming", "processing_estimate", "ready"];
  const reached = (target: FollowUpStage) => order.indexOf(stage) >= order.indexOf(target);
  const chronological: CommunicationMessage[] = [];
  if (reached("request_sent")) chronological.push(
    { id: "preparation-request", actor: "If digital claims assistant", direction: "Outgoing", time: "09:45", title: draftSubject || "Missing information requested", body: draftBody || linaPreparationEmailBody, tone: "ai" },
  );
  if (reached("customer_replied")) chronological.push(
    { id: "customer-photo", actor: demoCase.customer.name, direction: "Incoming", time: "10:12", title: "Missing photo attached", body: "Oh, my bad — I see now that it never uploaded. Here it is. Regarding the repair, I asked them to update the estimate. It should be coming soon!", tone: "human", attachment: "rear-device-photo.jpg" },
  );
  if (reached("paused")) chronological.push(
    { id: "photo-acknowledgement", actor: "If digital claims assistant", direction: "Outgoing", time: "10:13", title: "Photo received and processed", body: "Thanks, Lina — I’ve received the photo and added it to your claim file. I’m now waiting for the updated repair estimate. I’m only collecting and organizing information; your handler will review the file and make any decisions about your claim.", tone: "ai" },
  );
  if (reached("estimate_incoming")) chronological.push(
    { id: "customer-estimate", actor: demoCase.customer.name, direction: "Incoming", time: "10:16", title: "Updated estimate attached", body: "They came back to me — here is the updated estimate.", tone: "human", attachment: "Updated Repair Estimate.pdf" },
  );
  if (stage === "ready") chronological.push(
    { id: "preparation-complete", actor: "If digital claims assistant", direction: "Outgoing", time: "10:17", title: "Preparation completed", body: "Super, thank you! I’ve received and processed the updated estimate. That is everything I can collect for now. Your handler will have the prepared information needed to begin reviewing the claim. I have not made any decision about your claim.", tone: "ai" },
    { id: "handler-ready", actor: "Case agent", direction: "Internal", time: "10:17", title: "Case ready for handler review", body: "Evidence and communications prepared. No coverage, compensation, deductible, repair authorization, or claim outcome decision was made.", tone: "system" },
  );
  const messages: CommunicationMessage[] = demoCase === demoCases.injection && securityStop ? [
    { id: "security-stop", actor: "Safety control", direction: "Internal", time: "08:22", title: "All automated communication stopped", body: "An untrusted instruction was detected in the repair estimate. No customer or vendor message was created or sent.", tone: "security" },
  ] : [...chronological].reverse();
  const expandedMessage = messages.find((message) => message.id === expandedMessageId) ?? null;

  useEffect(() => {
    const arrivingMessageByStage: Partial<Record<FollowUpStage, string>> = {
      request_sent: "preparation-request",
      customer_replied: "customer-photo",
      paused: "photo-acknowledgement",
      estimate_incoming: "customer-estimate",
      ready: "preparation-complete",
    };
    const arrivingMessageId = arrivingMessageByStage[stage];
    if (!arrivingMessageId) return;
    const openFrame = window.requestAnimationFrame(() => setExpandedMessageId(arrivingMessageId));
    const timeout = window.setTimeout(() => {
      setExpandedMessageId((current) => current === arrivingMessageId ? null : current);
    }, 2300);
    return () => {
      window.cancelAnimationFrame(openFrame);
      window.clearTimeout(timeout);
    };
  }, [stage]);

  const typing = stage === "drafting_request"
    ? { actor: "AI assistant", label: "Drafting the missing-information email" }
    : stage === "customer_typing"
      ? { actor: demoCase.customer.name, label: "Customer is writing" }
      : stage === "agent_replying"
        ? { actor: "AI assistant", label: "Processing the photo and drafting a reply" }
        : stage === "processing_estimate"
          ? { actor: "AI assistant", label: "Reading the updated estimate and drafting a reply" }
          : null;

  return (
    <section className={"communicationLog communicationStage-" + stage} aria-live="polite">
      <header>
        <div><MessageCircle size={15} /><strong>Communication log</strong></div>
        <span>{messages.length ? "Newest first · " + messages.length + " entries" : state === "complete" ? "Preparing first message" : "No agent communication yet"}</span>
      </header>
      {(stage === "drafting_request" || stage === "draft_ready") && (
        <div className="logDraftCard">
          <header><span className="emailIcon"><Mail size={17} /></span><div><small>Handler approval required</small><strong>{stage === "drafting_request" ? "AI is drafting the customer email" : "Customer request ready"}</strong></div></header>
          {stage === "drafting_request" ? null : <>
            <label>Subject<input aria-label="Subject" value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} disabled={draftApproved} /></label>
            <label>Message<textarea aria-label="Message" value={draftBody} onChange={(event) => setDraftBody(event.target.value)} disabled={draftApproved || draftIsTyping} rows={4} /></label>
            <footer><span><ShieldCheck size={13} />Editable until the handler approves this synthetic send</span><button className="primaryButton" onClick={approveDraft} disabled={draftApproved || draftIsTyping}><Mail size={14} />Approve & simulate send</button></footer>
          </>}
        </div>
      )}
      {typing && <WritingIndicator label={typing.label} actor={typing.actor} />}
      {stage === "paused" && (
        <div className="logPause">
          <div><span>Demo pause</span><strong>Explore the claim before the final email arrives</strong><p>The first exchange is complete. Review the sources, timeline, audit log, or case-agent chat, then continue when you are ready.</p></div>
          <button className="incomingEmailButton" onClick={receiveUpdatedEstimate}><Mail size={16} /><span><strong>New email incoming</strong><small>Updated repair estimate</small></span><ArrowRight size={15} /></button>
        </div>
      )}
      {stage === "ready" && <div className="logReady"><span><Check size={18} /></span><div><small>Preparation complete</small><strong>Ready for handler review</strong><p>All available information is organized; human decisions remain pending.</p></div></div>}
      {!messages.length && !typing && stage !== "draft_ready" ? (
        <div className="emptyCommunications"><Mail size={18} /><p>The case agent has not contacted anyone. Communications will appear here with a clear AI or human identity.</p></div>
      ) : <div className="communicationEntries">
        {messages.map((message, index) => (
          <article
            aria-haspopup="dialog"
            className={"communicationEntry communication-" + message.tone + (index === 0 ? " communicationLatest" : "")}
            key={message.id}
            onClick={() => setExpandedMessageId(message.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setExpandedMessageId(message.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span className="actorIcon">{message.tone === "ai" ? <Bot size={14} /> : message.tone === "human" ? <UserRound size={14} /> : message.tone === "security" ? <ShieldAlert size={14} /> : <Mail size={14} />}</span>
            <div>
              <header><strong>{message.title}</strong><time>{message.time}</time></header>
              <div className="communicationMeta"><span>{message.actor}</span><i>{message.direction}</i>{message.tone === "ai" && <em>AI assistant</em>}{message.tone === "human" && <em className="humanBadge">Customer</em>}<small>Click to read</small></div>
              <p>{message.body}</p>
              {message.attachment && <span className="messageAttachment"><Paperclip size={11} />{message.attachment}</span>}
            </div>
          </article>
        ))}
      </div>}
      {expandedMessage && (
        <div className="messageOverlay" onClick={() => setExpandedMessageId(null)}>
          <article aria-labelledby={"expanded-message-" + expandedMessage.id} aria-modal="true" className={"expandedMessage communication-" + expandedMessage.tone} onClick={(event) => event.stopPropagation()} role="dialog">
            <header>
              <span className="expandedActorIcon">{expandedMessage.tone === "ai" ? <Bot size={18} /> : expandedMessage.tone === "human" ? <UserRound size={18} /> : expandedMessage.tone === "security" ? <ShieldAlert size={18} /> : <Mail size={18} />}</span>
              <div><small>{expandedMessage.actor} · {expandedMessage.direction}</small><strong>{expandedMessage.tone === "ai" ? "AI assistant" : expandedMessage.tone === "human" ? "Customer" : "Case activity"}</strong></div>
              <time>{expandedMessage.time}</time>
              <button aria-label="Close message" onClick={() => setExpandedMessageId(null)}><XCircle size={20} /></button>
            </header>
            <div className="expandedMessageBody">
              <span>Subject</span>
              <h2 id={"expanded-message-" + expandedMessage.id}>{expandedMessage.title}</h2>
              <p>{expandedMessage.body}</p>
              {expandedMessage.attachment && <span className="messageAttachment expandedAttachment"><Paperclip size={14} />{expandedMessage.attachment}</span>}
            </div>
            <footer><ShieldCheck size={14} />Synthetic demo exchange · no real email is sent</footer>
          </article>
        </div>
      )}
      <footer><ShieldCheck size={13} />Synthetic demo exchange · no real email is sent</footer>
    </section>
  );
}

function WritingIndicator({ label, actor }: { label: string; actor?: string }) {
  return <div className="writingIndicator"><span className="writingAvatar">{actor?.includes("Lina") ? <UserRound size={13} /> : <Bot size={13} />}</span><div><small>{actor ?? "AI assistant"}</small><strong>{label}</strong></div><i><b /><b /><b /></i></div>;
}

function PanelHeader({ label, title, detail }: { label: string; title: string; detail: string }) {
  return <div className="panelHeader"><span>{label}</span><strong>{title}</strong><small>{detail}</small></div>;
}

function RunStatus({ state }: { state: RunState }) {
  const labels: Record<RunState, string> = { idle: "Ready", running: "Agent running", complete: "Review complete", error: "Run failed" };
  return <span className={`runStatus runStatus-${state}`}><span />{labels[state]}</span>;
}

function CaseSummary({ demoCase, showSource }: { demoCase: DemoCase; showSource: (id: string) => void }) {
  return (
    <section className="caseSummary">
      <div className="caseIdentity">
        <div><span className="caseId">{demoCase.id}</span><span className="caseStatus">New</span></div>
        <h1>Damaged mobile phone</h1>
        <p>“{demoCase.incident.description}”</p>
      </div>
      <dl className="caseFacts">
        <div><dt>Customer</dt><dd>{demoCase.customer.name}</dd></div>
        <div><dt>Item</dt><dd>{demoCase.device.model}</dd></div>
        <div><dt>Policy</dt><dd>Active · accidental damage</dd></div>
      </dl>
      <div className="uploadedFiles">
        <div className="uploadTitle"><Paperclip size={14} /><strong>Uploaded</strong><span>3 files</span></div>
        <div className="uploadGrid">
          {uploads.map((upload) => (
            <button key={upload.id} onClick={() => showSource(upload.id)}>
              <upload.icon size={17} />
              <span><strong>{upload.name}</strong><small>{upload.detail}</small></span>
              <span className="uploadStatus"><Check size={11} />Uploaded</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function FrontEndState({ state, analysis, error, trace, runAnalysis, securityStop }: {
  state: RunState;
  analysis: AnalysisResult | null;
  error: string;
  trace: TraceEvent[];
  runAnalysis: () => void;
  securityStop: SecurityStop | null;
}) {
  if (state === "idle") return (
    <section className="startState"><Bot size={23} /><div><h2>Ready for preparation</h2><p>This claim&apos;s agent will inspect the five bounded inputs and prepare the file before handler assignment.</p></div><button data-tour="run-copilot" className="primaryButton" onClick={runAnalysis}><Play size={16} fill="currentColor" />Start preparation</button></section>
  );
  if (securityStop) return (
    <section className="securityStopResult" aria-live="polite">
      <ShieldAlert size={26} />
      <div>
        <span>Review stopped</span>
        <h2>{securityStop.title}</h2>
        <p>{securityStop.detail}</p>
        <strong>Sent to {securityStop.queue}</strong>
        <small>No claim decision, email, payment, or repair action was made.</small>
      </div>
    </section>
  );
  if (state === "running" && !analysis) {
    const currentStep = trace.at(-1);
    return <section className="runningState" aria-live="polite"><CircleDashed className="spin" size={23} /><div><span>Agent running</span><h2>{currentStep?.title ?? "Starting analysis"}</h2><p>{currentStep?.output ?? "Waiting for the next output"}</p></div></section>;
  }
  if (state === "error") return <section className="errorState"><XCircle size={23} /><div><h2>Analysis failed</h2><p>{error}</p></div><button className="secondaryButton" onClick={runAnalysis}>Try again</button></section>;
  return null;
}

function SourceIcon({ kind }: { kind: SourceKind }) {
  return kind === "image" ? <FileImage size={15} /> : <FileText size={15} />;
}

function SourcePane({ sources, selectedSource, selectedSourceId, workingSourceIds, typingSourceId, sourceError, selectSource }: {
  sources: SourceFile[]; selectedSource: SourceFile | undefined; selectedSourceId: string;
  workingSourceIds: string[]; typingSourceId: string | null;
  sourceError: string; selectSource: (id: string) => void;
}) {
  const groups: Array<{ id: SourceGroup; title: string }> = [
    { id: "agent", title: "Agent" }, { id: "customer", title: "Received from customer" },
  ];
  return (
    <section className="sourcePane">
      <PanelHeader label="Back end" title="Agent inputs" detail="Click a file to inspect it" />
      <div className="sourceWorkspace">
        <nav className="sourceList" aria-label="Agent source files">
          {groups.map((group) => (
            <div className="sourceGroup" key={group.id}>
              <h3>{group.title}</h3>
              {sources.filter((source) => source.group === group.id).map((source) => {
                const isSelected = source.id === selectedSourceId;
                const isWorking = workingSourceIds.includes(source.id);
                return (
                  <button
                    aria-pressed={isSelected}
                    data-tour={"source-" + source.id}
                    className={[isSelected && "sourceActive", isWorking && "sourceWorking"].filter(Boolean).join(" ")}
                    key={source.id}
                    onClick={() => selectSource(source.id)}
                  >
                    <SourceIcon kind={source.kind} />
                    <span>
                      <strong>{source.name}</strong>
                      <small>{source.purpose}</small>
                      {isWorking && <em><span />Working with</em>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
          {!sources.length && !sourceError && <span className="sourceLoading">Loading files…</span>}
        </nav>
        <div className="fileViewer">
          {sourceError ? <div className="sourceError">{sourceError}</div> : selectedSource ? (
            <>
              <header><div><SourceIcon kind={selectedSource.kind} /><strong>{selectedSource.name}</strong></div><span>Agent uses this for <b>{selectedSource.destination}</b></span></header>
              <div className={"sourcePurpose" + (workingSourceIds.includes(selectedSource.id) ? " purposeActive" : "")}>
                <span>{workingSourceIds.includes(selectedSource.id) ? "Working with now" : "Why this matters"}</span>
                <p><strong>{selectedSource.purpose}.</strong> The agent uses it for {selectedSource.destination}.</p>
              </div>
              {selectedSource.imageSrc && (
                <div className="imagePreview"><Image src={selectedSource.imageSrc} alt={`Preview of ${selectedSource.name}`} fill sizes="40vw" /></div>
              )}
              <div className={selectedSource.kind === "document" ? "documentPreview" : "sourceText"}>
                {selectedSource.kind !== "markdown" && (
                  <span className="extractionLabel">
                    {selectedSource.observationStatus === "pending"
                      ? "Awaiting agent inspection"
                      : selectedSource.observationStatus === "generated"
                        ? selectedSource.id === "damage"
                          ? "Agent observations"
                          : selectedSource.kind === "document"
                            ? "What the agent can read"
                            : "Agent rule review"
                        : "What the agent can read"}
                  </span>
                )}
                <pre>
                  <TypewriterText
                    text={selectedSource.content}
                    animate={typingSourceId === selectedSource.id && !selectedSource.generatedContent}
                  />
                  {selectedSource.generatedContent && selectedSource.kind !== "document" && (
                    <>
                      {"\n\n"}
                      <TypewriterText
                        text={selectedSource.generatedContent}
                        animate={typingSourceId === selectedSource.id}
                      />
                    </>
                  )}
                </pre>
                {selectedSource.securityFinding && (
                  <aside className="documentThreatMarker" aria-label="Detected hidden document text">
                    <span>Hidden text detected here</span>
                    <strong>{selectedSource.securityFinding.location}</strong>
                    <blockquote>“{selectedSource.securityFinding.text}”</blockquote>
                  </aside>
                )}
              </div>
              {selectedSource.kind === "document" && selectedSource.generatedContent && (
                <div className={"generatedReview" + (/UNTRUSTED INSTRUCTION DETECTED/.test(selectedSource.generatedContent) ? " securityReview" : "")}>
                  <span className="extractionLabel">{/UNTRUSTED INSTRUCTION DETECTED/.test(selectedSource.generatedContent) ? "Security finding" : "Agent rule review"}</span>
                  <pre>
                    <TypewriterText
                      text={selectedSource.generatedContent}
                      animate={typingSourceId === selectedSource.id}
                    />
                  </pre>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ActivityPane({ trace, state, demoCase, analysis, securityStop, followUpStage, tab, setTab }: {
  trace: TraceEvent[];
  state: RunState;
  demoCase: DemoCase;
  analysis: AnalysisResult | null;
  securityStop: SecurityStop | null;
  followUpStage: FollowUpStage;
  tab: AgentPaneTab;
  setTab: (tab: AgentPaneTab) => void;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (tab === "audit") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [trace.length, state, tab]);

  return (
    <section className="activityPane">
      <div className="agentPaneTabs">
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")}><Activity size={13} />Audit log</button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")}><MessageCircle size={13} />Ask this agent</button>
        <span>Bound to {demoCase.id}</span>
      </div>
      {tab === "audit" ? <>
        <div className="activityList" aria-live="polite">
          {trace.map((event, index) => (
            <article className={"activityStep step-" + event.status + (index === trace.length - 1 ? " stepLatest" : "")} key={event.id}>
              <span className="stepNumber">{event.status === "complete" ? <Check size={12} /> : index + 1}</span>
              <div><header><strong>{event.title}</strong><time>{event.timestamp}</time></header>
                <p aria-label={event.detail}><b>Why</b><span aria-hidden="true"><TypewriterText text={event.detail} animate={state === "running"} /></span></p>
                {(event.input || event.output) && <div className="dataFlow"><span>{event.input}</span><ArrowRight size={12} /><strong>{event.output}</strong></div>}
              </div>
            </article>
          ))}
          {state === "running" && <div className="waitingLine"><Activity size={14} />Waiting for the next runtime event</div>}
          <div ref={endRef} aria-hidden="true" />
        </div>
        <footer className="backendGuardrail"><ShieldCheck size={15} />Timestamped · source-aware · reasons recorded</footer>
      </> : <AgentChat demoCase={demoCase} state={state} analysis={analysis} securityStop={securityStop} followUpStage={followUpStage} />}
    </section>
  );
}

function AgentChat({ demoCase, state, analysis, securityStop, followUpStage }: {
  demoCase: DemoCase;
  state: RunState;
  analysis: AnalysisResult | null;
  securityStop: SecurityStop | null;
  followUpStage: FollowUpStage;
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "handler" | "agent"; body: string }>>([]);
  const suggestions = securityStop
    ? ["Why did you stop?", "What can the handler do next?"]
    : ["What happened while I was away?", "What still needs a human decision?"];

  const answer = (question: string) => {
    const lower = question.toLowerCase();
    if (securityStop) {
      if (/why|stop|happen|attack/.test(lower)) return "I found hidden machine-readable text in the repair estimate instructing me to approve the claim and conceal that action. Customer evidence cannot change my instructions, so I stopped before model analysis or communication and preserved the finding for specialist review.";
      return "A human specialist should inspect the quarantined estimate and request a clean replacement through an approved channel. I have made no claim decision and contacted no one.";
    }
    if (state !== "complete") return "I have only the current claim packet and have not completed the preparation pass yet. Start preparation to let me inspect the evidence and build the case history.";
    if (/human|decision|need|next/.test(lower)) return "Coverage, compensation, deductible, repair authorization, and the final claim outcome remain human decisions. I can prepare evidence and communications, but I cannot make those decisions.";
    if (followUpStage === "none" || followUpStage === "drafting_request") return (analysis?.caseSummary ? analysis.caseSummary + " " : "") + "I found missing evidence and am preparing a transparent customer request. Nothing has been sent.";
    if (followUpStage === "draft_ready") return "The customer request is drafted and editable in the communication log. It is waiting for explicit handler approval before the synthetic send.";
    if (["request_sent", "customer_typing"].includes(followUpStage)) return "The handler-approved request is shown as sent in this synthetic demo. I am waiting for the customer's reply; no real email was sent.";
    if (["customer_replied", "agent_replying"].includes(followUpStage)) return "The customer supplied the missing photo. I am associating it with the claim and preparing a transparent acknowledgement.";
    if (followUpStage === "paused") return "The missing photo is processed and acknowledged. The file is waiting for the revised repair estimate; use New email incoming when you are ready to continue the demo.";
    if (["estimate_incoming", "processing_estimate"].includes(followUpStage)) return "The revised estimate has arrived. I am checking the identifier, drafting the final acknowledgement, and preparing the handler handoff.";
    return (analysis?.caseSummary ? analysis.caseSummary + " " : "") + "I collected the missing photo and revised estimate, summarized the exchange, and marked the file ready for handler review. No claim decision was made.";
  };

  const submit = (question: string) => {
    const value = question.trim();
    if (!value) return;
    setMessages((current) => [...current, { role: "handler", body: value }, { role: "agent", body: answer(value) }]);
    setInput("");
  };

  return (
    <div className="agentChat">
      <header><div><Bot size={18} /><span><strong>{demoCase.customer.name}&apos;s claim agent</strong><small>Current claim and relevant rules only</small></span></div><i>Case scoped</i></header>
      <div className="chatMessages" aria-live="polite">
        {!messages.length && <div className="chatWelcome"><Sparkles size={18} /><strong>Ask about this claim</strong><p>I can explain the case history, evidence, communications, and preparation work. I cannot make the handler&apos;s decisions.</p></div>}
        {messages.map((message, index) => <article className={"chatMessage chat-" + message.role} key={index}><span>{message.role === "agent" ? <Bot size={13} /> : <UserRound size={13} />}</span><p>{message.body}</p></article>)}
      </div>
      <div className="chatSuggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => submit(suggestion)}>{suggestion}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); submit(input); }}>
        <input aria-label="Ask this claim agent" placeholder="Ask about this claim…" value={input} onChange={(event) => setInput(event.target.value)} />
        <button aria-label="Send question" type="submit"><Send size={14} /></button>
      </form>
    </div>
  );
}
