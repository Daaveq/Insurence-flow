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
import { useEffect, useMemo, useRef, useState } from "react";
import { demoCases, type AnalysisResult, type CaseId, type DemoCase, type TraceEvent } from "@/lib/demo-case";

type RunState = "idle" | "running" | "complete" | "error";
type WorkspaceView = "portfolio" | "claim";
type FollowUpStage = "none" | "drafting_request" | "request_ready" | "request_sent" | "customer_typing" | "customer_replied" | "ingesting_photo" | "photo_reviewed" | "agent_replying" | "paused" | "estimate_incoming" | "processing_estimate" | "estimate_reviewed" | "final_replying" | "ready";
type SourceGroup = "agent" | "customer";
type SourceKind = "markdown" | "image" | "document";
type PortfolioOutcome = { label: string; tone: "complete" | "attention" };
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

const updatedRepairEstimateReview = [
  "AGENT ESTIMATE REVIEW — FOLLOW-UP",
  "",
  "This is an updated repair estimate supplied after the agent requested a revised document.",
  "It identifies Lina Berg’s Apple iPhone 15 and now includes IMEI 35 874312 904216 7.",
  "The device identifier requested in the earlier email is present, so this evidence gap is resolved.",
  "",
  "RULE CHECKS",
  "",
  "Rule: Requested updated estimate supplied: Confirmed",
  "The document is marked as updated and was received in response to the follow-up request.",
  "",
  "Rule: Device identifier present: Confirmed",
  "The revised estimate includes the missing IMEI for handler review.",
].join("\n");

const rearDevicePhotoSource: SourceFile = {
  id: "rear-device-photo",
  name: "Rear device photo.jpg",
  group: "customer",
  kind: "image",
  purpose: "Customer-supplied rear view of the claimed phone",
  destination: "Customer follow-up → evidence review",
  content: "Customer-supplied rear-device photograph received in the follow-up email.",
  imageSrc: "/evidence/rear-device-photo.png",
  observationStatus: "pending",
};

const rearDevicePhotoReview = [
  "IMAGE OBSERVATIONS — FOLLOW-UP",
  "",
  "A dark blue iPhone 15 is shown from the rear on a pale tiled floor.",
  "The complete rear surface and dual-camera module are visible.",
  "The rear glass appears intact; minor edge scuffing is visible.",
  "",
  "RULE CHECKS",
  "",
  "Rule: Rear view supplied: Confirmed",
  "The full back of the claimed device is visible.",
  "",
  "Rule: Device identifier visible: Not confirmed",
  "No serial number or IMEI is visible in the photograph.",
].join("\n");

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
  { caseId: "injection" as const, claim: demoCases.injection.id, customer: demoCases.injection.customer.name, description: "Bicycle fall · document safety review", received: "05 Aug · 08:21", preparation: "Ready to start", tone: "ready" },
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

const overviewTourSteps: TourStep[] = [
  {
    title: "Welcome to Claims Copilot",
    body: "This demo shows how case-specific AI agents can prepare insurance claims while human handlers retain every decision that requires judgment.",
    placement: "center",
  },
  {
    title: "The Case Handler view",
    body: "On the left, you’ll see the Case Handler view — what the handler actually sees. Right now it shows the handler’s portfolio: everything in the queue and the preparation status of each claim.",
    target: "handler-side",
    placement: "right",
  },
  {
    title: "The AI Agents workspace",
    body: "On the right, you see the AI Agents workspace. This is a window into my actual Codex workspace — ChatGPT’s version of Claude Code or Cowork — so you can see what happens in the background. It populates when you open a claim.",
    target: "agent-side",
    placement: "left",
  },
  {
    title: "Start with Lina’s claim",
    body: "The first two claims are interactive. Lina’s claim shows successful preparation and customer follow-up; Erik’s claim shows the agent stopping safely when a malicious instruction is detected. Begin with Lina Berg, then return here and open Erik Holm yourself.",
    target: "available-claim",
    placement: "right",
  },
];

function getClaimTourSteps(isInjection: boolean): TourStep[] {
  return [
    {
      title: "The Human Agent view",
      body: "This is the Human Agent view: what the case handler actually sees while the claim is being prepared.",
      target: "handler-side",
      placement: "right",
    },
    {
      title: "The claim preparation map",
      body: "These four boxes make the preparation lifecycle visible. Individual checks light up as the agent works, so the handler can see what was found, what remains, and where human judgment begins.",
      target: "claim-timeline",
      placement: "right",
    },
    {
      title: "The Agent window",
      body: "Here you can see a window into my Codex workspace. The agent genuinely runs when you start this demo, using my Codex subscription — so run it sparingly, for the sake of my sourdough recipes.",
      target: "agent-side",
      placement: "left",
    },
    {
      title: "AGENT.md — role and personality",
      body: "AGENT.md defines who this case agent is, how it should communicate, which sources it may trust, and the hard boundaries it must never cross.",
      target: "source-agent",
      placement: "left",
    },
    {
      title: "Rules.md — handling guardrails",
      body: "Rules.md contains the synthetic handling checks and human-control guardrails. The agent uses these rules to prepare the file without approving, denying, pricing, or paying a claim.",
      target: "source-rules",
      placement: "left",
    },
    {
      title: "Customer evidence",
      body: isInjection
        ? "These are Erik’s untrusted uploads. The agent may extract evidence from them, but customer documents can never change its role or instructions."
        : "These are Lina’s customer-supplied files. The agent inspects each source, separates observations from assumptions, and makes missing evidence visible.",
      target: "customer-evidence",
      placement: "left",
    },
    {
      title: "The audit log",
      body: "The audit log shows the agent’s inputs, outputs, timestamps, and concise reasons as the work happens. It makes the process inspectable without exposing private chain-of-thought.",
      target: "audit-log",
      placement: "left",
    },
    {
      title: "Chat with the case agent",
      body: "Open this chat to ask the live, case-scoped Codex agent about the claim, its evidence, current status, or remaining human decisions.",
      target: "case-agent-chat",
      placement: "right",
    },
    {
      title: "Reset this case",
      body: "Reset case returns this claim to its untouched starting state, clears its preparation result, and lets you run the same scenario again.",
      target: "reset-demo",
      placement: "left",
    },
    {
      title: "Start the live preparation pass",
      body: "When you are ready, start preparation. The guide closes so you can watch the timeline, source files, audit events, and customer communication move together.",
      target: "run-copilot",
      placement: "below",
    },
  ];
}

function getCaseIntroSteps(caseId: CaseId): TourStep[] {
  if (caseId === "injection") {
    return [{
      title: "Case 2 — malicious document attempt",
      body: "This time, a customer document contains a hidden instruction that tries to override the agent and approve the claim. Start preparation to see the safety control detect the attempt, stop automation, preserve the evidence, and send the case to a human specialist without making a claim decision.",
      placement: "center",
    }];
  }

  return [{
    title: "Case 1 — guided claim preparation",
    body: "This case shows the complete preparation experience. The flow pauses after selected milestones so you can inspect the handler view, sources, and audit log before continuing.",
    target: "handler-side",
    placement: "right",
  }];
}

type DemoMomentContent = {
  eyebrow: string;
  title: string;
  body: string;
  action?: string;
  working: string;
};

const checkpointStages: FollowUpStage[] = ["request_sent", "photo_reviewed", "estimate_reviewed"];

const checkpointMoments: Partial<Record<FollowUpStage, DemoMomentContent>> = {
  request_sent: {
    eyebrow: "Customer contacted",
    title: "The agent has contacted the customer",
    body: "After reviewing the case, the agent found missing information that it is now requesting from the customer. Explore the files and decisions the agent used to draft it. When you’re ready, click Continue demo.",
    action: "Continue customer exchange",
    working: "Waiting for the customer’s response",
  },
  photo_reviewed: {
    eyebrow: "New evidence reviewed",
    title: "The agent is ready to acknowledge the photo",
    body: "The rear view is confirmed, while the device identifier is still missing. Explore the evidence and audit trail before the agent continues.",
    action: "Send acknowledgement",
    working: "Writing a customer acknowledgement",
  },
  estimate_reviewed: {
    eyebrow: "Updated estimate reviewed",
    title: "All requested evidence is now present",
    body: "The device identifier is confirmed and the preparation file is complete. Explore the result before the agent continues to its final acknowledgement and human handoff.",
    action: "Send final reply",
    working: "Writing the final acknowledgement",
  },
};

const linaDemoDoneMoment: DemoMomentContent = {
  eyebrow: "Demo done",
  title: "The Demo is Done",
  body: "This case is now ready for a handler to pick up. All the information was collected before they opened it. Go and explore Erik’s case to see what happens when a malicious attempt comes through.",
  working: "Case ready for handler review",
};

const erikDemoDoneMoment: DemoMomentContent = {
  eyebrow: "Demo done",
  title: "That was the demo",
  body: "Feel free to poke around and look at the files more thoroughly. Or go to the overview and click Reset Demo if you want to run it again.",
  working: "Specialist handoff ready",
};

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
  steps,
  stepIndex,
  sourceCount,
  setStepIndex,
  label,
  finishLabel,
}: {
  steps: TourStep[];
  stepIndex: number;
  sourceCount: number;
  setStepIndex: (step: number) => void;
  label: string;
  finishLabel: string;
}) {
  const step = steps[stepIndex];
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
      if (event.key === "Escape") setStepIndex(steps.length);
      if (event.key === "ArrowRight") {
        setStepIndex(Math.min(stepIndex + 1, steps.length));
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
  }, [sourceCount, step, stepIndex, setStepIndex, steps.length]);

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
        aria-label={label + " walkthrough"}
        aria-modal="true"
        className={"tourCard tourCard-" + step.placement}
        role="dialog"
      >
        <span className="tourEyebrow">{label} · {stepIndex + 1}/{steps.length}</span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <footer>
          <button className="tourSkip" onClick={() => setStepIndex(steps.length)}>Skip guide</button>
          <div>
            {stepIndex > 0 && (
              <button className="tourBack" onClick={() => setStepIndex(stepIndex - 1)}>Back</button>
            )}
            <button
              className="tourNext"
              onClick={() => setStepIndex(stepIndex + 1)}
            >
              {stepIndex === steps.length - 1 ? finishLabel : "Next"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function DemoMoment({ moment, onContinue, delayMs = 0 }: {
  moment: DemoMomentContent;
  onContinue?: () => void;
  delayMs?: number;
}) {
  const [isVisible, setIsVisible] = useState(delayMs === 0);
  const [cardVisible, setCardVisible] = useState(true);

  useEffect(() => {
    if (delayMs === 0) return;
    const timeout = window.setTimeout(() => setIsVisible(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs]);

  if (!isVisible) return null;

  return (
    <aside className="demoMoment" aria-live="polite">
      <div className="demoMomentFlash" aria-hidden="true" />
      {cardVisible && (
        <section className="demoMomentCard" aria-label={moment.eyebrow} role="dialog">
          <span>{moment.action ? "Demo pause · " : ""}{moment.eyebrow}</span>
          <h2>{moment.title}</h2>
          <p>{moment.body}</p>
          <footer><button onClick={() => setCardVisible(false)}>Got it</button></footer>
        </section>
      )}
      {moment.action && onContinue && (
        <button className="demoMomentContinue" onClick={onContinue}>
          <span>Continue demo</span><small>{moment.action}</small><ArrowRight size={14} />
        </button>
      )}
    </aside>
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
  const [overviewTourStep, setOverviewTourStep] = useState(0);
  const [claimTourStep, setClaimTourStep] = useState(-1);
  const [claimTourVariant, setClaimTourVariant] = useState<"full" | "case" | null>(null);
  const [introducedCaseIds, setIntroducedCaseIds] = useState<CaseId[]>([]);
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
  const [followUpStage, setFollowUpStage] = useState<FollowUpStage>("none");
  const [caseChatOpen, setCaseChatOpen] = useState(false);
  const [securityStop, setSecurityStop] = useState<SecurityStop | null>(null);
  const [portfolioOutcomes, setPortfolioOutcomes] = useState<Partial<Record<CaseId, PortfolioOutcome>>>({});
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
  const claimGuideSteps = useMemo(
    () => !demoCase || !selectedCaseId || !claimTourVariant
      ? []
      : claimTourVariant === "full"
        ? getClaimTourSteps(demoCase === demoCases.injection)
        : getCaseIntroSteps(selectedCaseId),
    [claimTourVariant, demoCase, selectedCaseId],
  );
  useEffect(() => {
    const target = claimGuideSteps[claimTourStep]?.target;
    const sourceId = target === "source-agent"
      ? "agent"
      : target === "source-rules"
        ? "rules"
        : target === "customer-evidence"
          ? "damage"
          : null;
    if (!sourceId || !sources.some((source) => source.id === sourceId)) return;

    let scrollFrame = 0;
    const selectionFrame = window.requestAnimationFrame(() => {
      setSelectedSourceId(sourceId);
      scrollFrame = window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(".fileViewer")?.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
    return () => {
      window.cancelAnimationFrame(selectionFrame);
      window.cancelAnimationFrame(scrollFrame);
    };
  }, [claimGuideSteps, claimTourStep, sources]);

  const resetDemo = (clearPortfolioOutcome = true) => {
    requestVersion.current += 1;
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    if (clearPortfolioOutcome && selectedCaseId) {
      setPortfolioOutcomes((current) => {
        const next = { ...current };
        delete next[selectedCaseId];
        return next;
      });
    }
    setRunState("idle");
    setAnalysis(null);
    setTrace(idleTrace);
    setError("");
    setDraftSubject("");
    setDraftBody("");
    setDraftIsTyping(false);
    setFollowUpStage("none");
    setCaseChatOpen(false);
    setSecurityStop(null);
    setSelectedSourceId("agent");
    setWorkingSourceIds([]);
    setTypingSourceId(null);
    setSources(initialSources.current.map((source) => ({ ...source })));
  };
  const resetEntireDemo = () => {
    resetDemo(false);
    setPortfolioOutcomes({});
    initialSources.current = [];
    setSources([]);
    setSourceError("");
    setSelectedCaseId(null);
    setWorkspaceView("portfolio");
    setClaimTourStep(-1);
    setClaimTourVariant(null);
    setIntroducedCaseIds([]);
    setOverviewTourStep(0);
  };

  const selectCase = (caseId: CaseId) => {
    if (runState === "running") return;
    resetDemo(false);
    initialSources.current = [];
    setSources([]);
    setSourceError("");
    setSelectedCaseId(caseId);
    setOverviewTourStep(overviewTourSteps.length);
    const isFirstClaim = introducedCaseIds.length === 0;
    const caseWasIntroduced = introducedCaseIds.includes(caseId);
    setClaimTourVariant(isFirstClaim ? "full" : caseWasIntroduced ? null : "case");
    setClaimTourStep(isFirstClaim || !caseWasIntroduced ? 0 : -1);
    if (!caseWasIntroduced) setIntroducedCaseIds((current) => [...current, caseId]);
    setWorkspaceView("claim");
  };

  const returnToPortfolio = () => {
    resetDemo(false);
    initialSources.current = [];
    setSources([]);
    setSourceError("");
    setSelectedCaseId(null);
    setClaimTourStep(-1);
    setClaimTourVariant(null);
    setWorkspaceView("portfolio");
  };

  const runAnalysis = async () => {
    if (!selectedCaseId) return;
    analysisRequest.current?.abort();
    const controller = new AbortController();
    analysisRequest.current = controller;
    const version = ++requestVersion.current;
    setRunState("running");
    setPortfolioOutcomes((current) => {
      const next = { ...current };
      delete next[selectedCaseId];
      return next;
    });
    setAnalysis(null);
    setTrace(startingTrace);
    setError("");
    setDraftIsTyping(false);
    setFollowUpStage("none");
    setCaseChatOpen(false);
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
            setPortfolioOutcomes((current) => ({
              ...current,
              injection: { label: "Malicious attempt · handler attention", tone: "attention" },
            }));
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

  const continueDemo = () => {
    if (followUpStage === "request_sent") {
      setFollowUpStage("customer_typing");
      return;
    }

    if (followUpStage === "photo_reviewed") {
      setFollowUpStage("agent_replying");
      return;
    }

    if (followUpStage === "estimate_reviewed") {
      setFollowUpStage("final_replying");
      setTrace((events) => [...events, {
        id: crypto.randomUUID(), timestamp: currentTime(), title: "Final acknowledgement drafting",
        detail: "All requested evidence is now present. The agent is preparing the final synthetic acknowledgement and handler handoff.",
        status: "active", kind: "analysis", input: "Completed evidence packet", output: "Final reply in progress",
      }]);
    }
  };

  useEffect(() => {
    if (followUpStage === "none" || checkpointStages.includes(followUpStage)) return;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector(".communicationLog")?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [followUpStage]);

  useEffect(() => {
    if (followUpStage === "drafting_request" && draftIsTyping) return;
    const transitions: Partial<Record<FollowUpStage, { next: FollowUpStage; delay: number }>> = {
      drafting_request: { next: "request_sent", delay: 650 },
      customer_typing: { next: "customer_replied", delay: 5000 },
      customer_replied: { next: "ingesting_photo", delay: 4000 },
      ingesting_photo: { next: "photo_reviewed", delay: 9000 },
      agent_replying: { next: "paused", delay: 5000 },
      paused: { next: "estimate_incoming", delay: 5000 },
      estimate_incoming: { next: "processing_estimate", delay: 4000 },
      processing_estimate: { next: "estimate_reviewed", delay: 5000 },
      final_replying: { next: "ready", delay: 5000 },
    };
    const transition = transitions[followUpStage];
    if (!transition) return;
    const timeout = window.setTimeout(() => {
      setFollowUpStage(transition.next);
      if (transition.next === "request_sent") {
        setWorkingSourceIds([]);
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "AI sent the preparation email",
          detail: "The prepared request is shown as sent inside this synthetic demo. No real external email is sent.",
          status: "complete", kind: "analysis", input: "Prepared information request", output: "Synthetic email sent · awaiting customer",
        }]);
      }
      if (transition.next === "customer_replied") {
        setSources((files) => files.some((source) => source.id === rearDevicePhotoSource.id)
          ? files
          : [...files, rearDevicePhotoSource]);
        setSelectedSourceId(rearDevicePhotoSource.id);
        setWorkingSourceIds([rearDevicePhotoSource.id]);
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Customer reply received",
          detail: "The missing damage photo arrived, and Lina confirmed that the revised estimate is still coming.",
          status: "complete", kind: "analysis", input: "Customer email + attachment", output: "Damage photo received · estimate pending",
        }]);
      }
      if (transition.next === "ingesting_photo") {
        setSelectedSourceId(rearDevicePhotoSource.id);
        setWorkingSourceIds([rearDevicePhotoSource.id]);
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Rear photo ingestion started",
          detail: "The new customer image was registered and opened for evidence review.",
          status: "active", kind: "analysis", input: "Rear device photo.jpg", output: "Image review in progress",
        }]);
      }
      if (transition.next === "photo_reviewed") {
        setWorkingSourceIds([rearDevicePhotoSource.id]);
        setSources((files) => files.map((source) => source.id === rearDevicePhotoSource.id
          ? { ...source, generatedContent: rearDevicePhotoReview, observationStatus: "generated" }
          : source));
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Rear photo processed",
          detail: "The full rear view is present. The image does not expose a serial number or IMEI.",
          status: "complete", kind: "analysis", input: "Rear device photo.jpg", output: "Rear view confirmed · acknowledgement ready",
        }]);
      }
      if (transition.next === "paused") {
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "AI acknowledgement sent in demo",
          detail: "The agent confirmed receipt of the photo and explained that it is waiting for the revised estimate.",
          status: "complete", kind: "analysis", input: "Customer reply", output: "Synthetic acknowledgement logged",
        }]);
      }
      if (transition.next === "estimate_incoming") {
        setSources((files) => files.some((source) => source.id === updatedRepairEstimateSource.id)
          ? files
          : [...files, updatedRepairEstimateSource]);
        setSelectedSourceId(updatedRepairEstimateSource.id);
        setWorkingSourceIds([updatedRepairEstimateSource.id]);
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Updated estimate email received",
          detail: "The customer supplied the revised repair estimate with the missing device identifier.",
          status: "complete", kind: "analysis", input: "Customer email + revised estimate", output: "Estimate queued for agent review",
        }]);
      }
      if (transition.next === "processing_estimate") {
        setSelectedSourceId(updatedRepairEstimateSource.id);
        setWorkingSourceIds([updatedRepairEstimateSource.id]);
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Updated estimate review started",
          detail: "The agent opened the revised estimate and began checking the new device identifier against the prepared file.",
          status: "active", kind: "analysis", input: "Updated Repair Estimate.pdf", output: "Estimate review in progress",
        }]);
      }
      if (transition.next === "estimate_reviewed") {
        setWorkingSourceIds([updatedRepairEstimateSource.id]);
        setSources((files) => files.map((source) => source.id === updatedRepairEstimateSource.id
          ? { ...source, generatedContent: updatedRepairEstimateReview }
          : source));
        setTrace((events) => [...events, {
          id: crypto.randomUUID(), timestamp: currentTime(), title: "Updated estimate processed",
          detail: "The revised estimate contains the missing device identifier. All requested evidence is now present for handler review.",
          status: "complete", kind: "analysis", input: "Updated Repair Estimate.pdf", output: "Identifier confirmed · final acknowledgement ready",
        }]);
      }
      if (transition.next === "ready") {
        setWorkingSourceIds([]);
        setPortfolioOutcomes((current) => ({
          ...current,
          standard: { label: "Ready for handler review", tone: "complete" },
        }));
        setTrace((events) => [...events, {
          id: crypto.randomUUID(),
          timestamp: currentTime(),
          title: "Updated estimate received and processed",
          detail: "The device identifier is now present. The preparation file is complete and ready for a handler to make the remaining decisions.",
          status: "complete",
          kind: "analysis",
          input: "Customer email + revised estimate",
          output: "Case ready for handler review",
        }]);
      }
    }, transition.delay);
    return () => window.clearTimeout(timeout);
  }, [draftIsTyping, followUpStage]);

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="brandLockup">
          <Image className="brandLogo" src="/brand/if-logo.png" alt="If" width={82} height={36} priority />
          <div><strong>Claims Copilot</strong><span>Synthetic damaged-phone demo</span></div>
        </div>
        <div className="workspaceCrumb">
          <span>{workspaceView === "portfolio" ? "Claims overview" : "Active claim"}</span>
          <strong>{demoCase?.id ?? "Nordic Digital Claims"}</strong>
        </div>
        <div className="headerActions">
          {workspaceView === "claim" && <>
            <RunStatus state={runState} />
            <button data-tour="reset-demo" className="secondaryButton" onClick={() => resetDemo()}><RotateCcw size={16} />Reset case</button>
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
            <ClaimsOverview portfolioOutcomes={portfolioOutcomes} resetEntireDemo={resetEntireDemo} selectCase={selectCase} />
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
                draftSubject={draftSubject}
                draftBody={draftBody}
                securityStop={securityStop}
              />
            </div>
            <button
              aria-expanded={caseChatOpen}
              data-tour="case-agent-chat"
              className={"agentChatLauncher" + (caseChatOpen ? " launcherActive" : "")}
              onClick={() => setCaseChatOpen((open) => !open)}
            >
              <MessageCircle size={15} />{caseChatOpen ? "Case agent chat open" : "Chat with this case agent"}
            </button>
            {caseChatOpen && (
              <div className="handlerChatOverlay">
                <div className="handlerChatCard">
                  <button className="handlerChatClose" aria-label="Close case agent chat" onClick={() => setCaseChatOpen(false)}><XCircle size={20} /></button>
                  <AgentChat caseId={selectedCaseId!} demoCase={demoCase} state={runState} securityStop={securityStop} followUpStage={followUpStage} />
                </div>
              </div>
            )}
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
          <ActivityPane trace={trace} state={runState} demoCase={demoCase} /></>}
        </aside>
      </main>
      {workspaceView === "portfolio" ? (
        <DemoTour
          steps={overviewTourSteps}
          stepIndex={overviewTourStep}
          sourceCount={sources.length}
          setStepIndex={setOverviewTourStep}
          label="Overview guide"
          finishLabel="Explore claims"
        />
      ) : demoCase ? (
        <DemoTour
          steps={claimGuideSteps}
          stepIndex={claimTourStep}
          sourceCount={sources.length}
          setStepIndex={setClaimTourStep}
          label="Claim guide"
          finishLabel={claimTourVariant === "case" ? "Got it" : "Watch the agent"}
        />
      ) : null}
      {workspaceView === "claim" && checkpointMoments[followUpStage] && (
        <DemoMoment
          key={followUpStage}
          moment={checkpointMoments[followUpStage]!}
          onContinue={continueDemo}
          delayMs={followUpStage === "request_sent" ? 1000 : 0}
        />
      )}
      {workspaceView === "claim" && followUpStage === "ready" && (
        <DemoMoment key="lina-demo-done" moment={linaDemoDoneMoment} delayMs={1000} />
      )}
      {workspaceView === "claim" && runState === "complete" && securityStop && (
        <DemoMoment key="erik-demo-done" moment={erikDemoDoneMoment} delayMs={5000} />
      )}
    </div>
  );
}

function ClaimsOverview({ portfolioOutcomes, resetEntireDemo, selectCase }: {
  portfolioOutcomes: Partial<Record<CaseId, PortfolioOutcome>>;
  resetEntireDemo: () => void;
  selectCase: (caseId: CaseId) => void;
}) {
  return (
    <div className="claimsOverview">
      <header className="overviewHero">
        <div>
          <span>Claims workspace</span>
          <h1>Good morning, Tobias</h1>
          <p>AI agents prepare new claims while handlers focus on decisions that require judgment.</p>
        </div>
        <div className="overviewHeroActions">
          <button className="secondaryButton overviewResetButton" onClick={resetEntireDemo}><RotateCcw size={14} />Reset Demo</button>
          <div className="overviewMetric"><strong>16</strong><span>Open claims</span><small>2 available in this demo</small></div>
        </div>
      </header>
      <section className="claimQueue" aria-label="Claims overview">
        <header>
          <span>Claim and customer</span><span>Description</span><span>Received</span><span>Preparation status</span><span />
        </header>
        {portfolioClaims.map((claim) => {
          const caseId = "caseId" in claim ? claim.caseId : undefined;
          const outcome = caseId ? portfolioOutcomes[caseId] : undefined;
          const content = <>
            <span className="claimPerson"><strong>{claim.customer}</strong><small>{claim.claim}</small></span>
            <span className="claimDescription">{claim.description}</span>
            <span className="claimReceived">{claim.received}</span>
            <span className={"preparationPill preparation-" + (outcome?.tone ?? claim.tone)}><i />{outcome?.label ?? claim.preparation}</span>
            <span className="claimOpen">{caseId ? <ArrowRight size={15} /> : <small>Demo only</small>}</span>
          </>;
          return caseId ? (
            <button data-tour="available-claim" className={"claimRow claimRow-active" + (outcome ? " claimRowOutcome-" + outcome.tone : "")} key={claim.claim} onClick={() => selectCase(caseId)}>{content}</button>
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
      <p>Start with Lina Berg, then return for Erik Holm. Each claim loads its own bounded agent, case files, rules, and audit history here.</p>
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
  const order: FollowUpStage[] = ["none", "drafting_request", "request_ready", "request_sent", "customer_typing", "customer_replied", "ingesting_photo", "photo_reviewed", "agent_replying", "paused", "estimate_incoming", "processing_estimate", "estimate_reviewed", "final_replying", "ready"];
  const reached = (stage: FollowUpStage) => order.indexOf(followUpStage) >= order.indexOf(stage);
  const reviewed = state === "complete" || followUpStage !== "none";
  const running = state === "running";
  const activeEvidence = running ? workingSourceIds[0] : undefined;
  const followUpActive = !["none", "ready"].includes(followUpStage);

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
      detail: followUpStage === "ready" ? "All requested evidence received" : followUpActive ? "Live customer exchange" : reviewed ? "Request ready to draft" : "Not started",
      items: [
        { label: "Request prepared", done: reached("request_ready"), active: ["drafting_request", "request_ready"].includes(followUpStage) },
        { label: "Preparation request sent", done: reached("request_sent"), active: followUpStage === "request_sent" },
        { label: "Missing photo processed", done: reached("photo_reviewed"), active: ["customer_replied", "ingesting_photo"].includes(followUpStage) },
        { label: "Acknowledgement drafted", done: reached("paused"), active: ["photo_reviewed", "agent_replying"].includes(followUpStage) },
        { label: "Updated estimate processed", done: reached("estimate_reviewed"), active: ["estimate_incoming", "processing_estimate"].includes(followUpStage) },
        { label: "Final acknowledgement sent", done: followUpStage === "ready", active: ["estimate_reviewed", "final_replying"].includes(followUpStage) },
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
    <section data-tour="claim-timeline" className="claimTimeline">
      <header><div><Clock3 size={15} /><strong>Claim preparation timeline</strong></div><span>Every check and handoff remains visible</span></header>
      <div className="timelineStages">
        {stages.map((stage, index) => (
          <article data-tour={"timeline-stage-" + index} className={"timelineStage timeline-" + stage.status} key={stage.label}>
            <header><span className="timelineNode">{stage.status === "complete" || stage.status === "ready" ? <Check size={12} /> : index + 1}</span><div><strong>{stage.label}</strong><small>{stage.detail}</small></div></header>
            <ul>{stage.items.map((item) => <li className={[item.warning ? "itemWarning" : item.done ? "itemDone" : "", item.active ? "itemActive" : ""].filter(Boolean).join(" ")} key={item.label}>{item.done && !item.active ? <Check size={10} /> : <span />}{item.label}</li>)}</ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function CommunicationLog({
  demoCase, state, stage, draftSubject, draftBody, securityStop,
}: {
  demoCase: DemoCase;
  state: RunState;
  stage: FollowUpStage;
  draftSubject: string;
  draftBody: string;
  securityStop: SecurityStop | null;
}) {
  type MessageTone = "ai" | "human" | "system" | "security";
  type CommunicationMessage = { id: string; actor: string; direction: string; time: string; title: string; body: string; tone: MessageTone; attachment?: string };
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const order: FollowUpStage[] = ["none", "drafting_request", "request_ready", "request_sent", "customer_typing", "customer_replied", "ingesting_photo", "photo_reviewed", "agent_replying", "paused", "estimate_incoming", "processing_estimate", "estimate_reviewed", "final_replying", "ready"];
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
    { id: "handler-ready", actor: "Case agent", direction: "Internal", time: "10:17", title: "Case ready for handler review", body: "Evidence and communications prepared. No coverage, compensation, deductible, repair authorization, or claim outcome decision was made.", tone: "system" },
    { id: "preparation-complete", actor: "If digital claims assistant", direction: "Outgoing", time: "10:17", title: "Preparation completed", body: "Super, thank you! I’ve received and processed the updated estimate. That is everything I can collect for now. Your handler will have the prepared information needed to begin reviewing the claim. I have not made any decision about your claim.", tone: "ai" },
  );
  const messages: CommunicationMessage[] = demoCase === demoCases.injection && securityStop ? [
    { id: "security-stop", actor: "Safety control", direction: "Internal", time: "08:22", title: "All automated communication stopped", body: "An untrusted instruction was detected in the repair estimate. No customer or vendor message was created or sent.", tone: "security" },
  ] : [...chronological].reverse();


  const checkpointMoment = checkpointMoments[stage];
  const typing = checkpointMoment
    ? { actor: "AI assistant", label: checkpointMoment.working }
    : stage === "drafting_request"
      ? { actor: "AI assistant", label: "Drafting the missing-information email" }
    : stage === "customer_typing"
      ? { actor: demoCase.customer.name, label: "Customer is writing" }
      : stage === "ingesting_photo"
        ? { actor: "AI assistant", label: "Ingesting and reviewing the rear phone photo" }
        : stage === "agent_replying"
          ? { actor: "AI assistant", label: "Photo processed · drafting an acknowledgement" }
          : stage === "paused"
            ? { actor: demoCase.customer.name, label: "Customer is writing" }
          : stage === "processing_estimate"
          ? { actor: "AI assistant", label: "Reading the updated estimate and drafting a reply" }
          : stage === "final_replying"
            ? { actor: "AI assistant", label: "Sending the final acknowledgement and preparing handoff" }
            : null;

  return (
    <section className={"communicationLog communicationStage-" + stage} aria-live="polite">
      <header>
        <div><MessageCircle size={15} /><strong>Communication log</strong></div>
        <span>{messages.length ? "Newest first · " + messages.length + " entries" : state === "complete" ? "Preparing first message" : "No agent communication yet"}</span>
      </header>
      {stage === "drafting_request" && (
        <div className="logDraftCard">
          <header><span className="emailIcon"><Mail size={17} /></span><div><small>Automatic preparation</small><strong>AI is drafting the customer email</strong></div></header>
        </div>
      )}
      {typing && <WritingIndicator label={typing.label} actor={typing.actor} />}
      {stage === "ready" && <div className="logReady"><span><Check size={18} /></span><div><small>Preparation complete</small><strong>Ready for handler review</strong><p>All available information is organized; human decisions remain pending.</p></div></div>}
      {!messages.length && !typing ? (
        <div className="emptyCommunications"><Mail size={18} /><p>The case agent has not contacted anyone. Communications will appear here with a clear AI or human identity.</p></div>
      ) : <div className="communicationEntries">
        {messages.map((message, index) => {
          const isExpanded = index === 0 || expandedMessageId === message.id;
          return (
          <article
            aria-expanded={isExpanded}
            className={"communicationEntry communication-" + message.tone + (index === 0 ? " communicationLatest communicationExpanded" : "") + (index !== 0 && expandedMessageId === message.id ? " communicationExpanded" : "")}
            key={message.id}
            onClick={() => index === 0 ? undefined : setExpandedMessageId((current) => current === message.id ? null : message.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                if (index !== 0) setExpandedMessageId((current) => current === message.id ? null : message.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span className="actorIcon">{message.tone === "ai" ? <Bot size={14} /> : message.tone === "human" ? <UserRound size={14} /> : message.tone === "security" ? <ShieldAlert size={14} /> : <Mail size={14} />}</span>
            <div>
              <header><strong>{message.title}</strong><time>{message.time}</time></header>
              <div className="communicationMeta"><span>{message.actor}</span><i>{message.direction}</i>{message.tone === "ai" && <em>AI assistant</em>}{message.tone === "human" && <em className="humanBadge">Customer</em>}<small>{index === 0 ? "Latest message" : isExpanded ? "Click to collapse" : "Click to expand"}</small></div>
              <p>{message.body}</p>
              {message.attachment && <span className="messageAttachment"><Paperclip size={11} />{message.attachment}</span>}
            </div>
          </article>
          );
        })}
      </div>}
      <footer><ShieldCheck size={13} />Synthetic demo exchange · no real email is sent</footer>
    </section>
  );
}

function WritingIndicator({ label, actor }: { label: string; actor?: string }) {
  const isCustomer = actor?.includes("Lina");
  return <div className={"writingIndicator " + (isCustomer ? "writing-human" : "writing-ai")}><span className="writingAvatar">{isCustomer ? <UserRound size={13} /> : <Bot size={13} />}</span><div><small>{actor ?? "AI assistant"}</small><strong>{label}</strong></div><i><b /><b /><b /></i></div>;
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
  const threatMarkerRef = useRef<HTMLElement | null>(null);
  const groups: Array<{ id: SourceGroup; title: string }> = [
    { id: "agent", title: "Agent" }, { id: "customer", title: "Received from customer" },
  ];

  useEffect(() => {
    if (!selectedSource?.securityFinding) return;
    const frame = window.requestAnimationFrame(() => {
      const marker = threatMarkerRef.current;
      if (!marker) return;
      marker.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedSource?.securityFinding]);
  return (
    <section className="sourcePane">
      <PanelHeader label="Back end" title="Agent inputs" detail="Click a file to inspect it" />
      <div className="sourceWorkspace">
        <nav className="sourceList" aria-label="Agent source files">
          {groups.map((group) => (
            <div data-tour={group.id === "customer" ? "customer-evidence" : undefined} className="sourceGroup" key={group.id}>
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
                        ? ["damage", "rear-device-photo"].includes(selectedSource.id)
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
                  <aside ref={threatMarkerRef} className="documentThreatMarker" aria-label="Detected hidden document text">
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

function ActivityPane({ trace, state, demoCase }: {
  trace: TraceEvent[];
  state: RunState;
  demoCase: DemoCase;
}) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [trace.length, state]);

  return (
    <section data-tour="audit-log" className="activityPane">
      <div className="agentPaneTabs">
        <strong><Activity size={13} />Audit log</strong>
        <span>Bound to {demoCase.id}</span>
      </div>
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
    </section>
  );
}

function AgentChat({ caseId, demoCase, state, securityStop, followUpStage }: {
  caseId: CaseId;
  demoCase: DemoCase;
  state: RunState;
  securityStop: SecurityStop | null;
  followUpStage: FollowUpStage;
}) {
  type ChatMessage = { role: "handler" | "agent"; body: string };
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const suggestions = securityStop
    ? ["Why did you stop?", "What can the handler do next?"]
    : ["What happened while I was away?", "What still needs a human decision?"];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [busy, messages]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const submit = async (question: string) => {
    const value = question.trim();
    if (!value || busy) return;

    const history = messages.slice(-8);
    const controller = new AbortController();
    requestRef.current = controller;
    setMessages((current) => [...current, { role: "handler", body: value }]);
    setInput("");
    setBusy(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          question: value,
          history,
          stage: followUpStage,
          reviewState: state,
        }),
        signal: controller.signal,
      });
      const payload = await response.json() as { reply?: unknown; message?: unknown };
      if (!response.ok || typeof payload.reply !== "string") {
        throw new Error(typeof payload.message === "string" ? payload.message : "The case agent could not answer.");
      }
      setMessages((current) => [...current, { role: "agent", body: payload.reply as string }]);
    } catch (error) {
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, {
        role: "agent",
        body: error instanceof Error ? error.message : "The case agent could not answer.",
      }]);
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  return (
    <div className="agentChat">
      <header><div><Bot size={18} /><span><strong>{demoCase.customer.name}&apos;s claim agent</strong><small>Live Codex · AGENT.md and current claim only</small></span></div><i>Codex live</i></header>
      <div className="chatMessages" aria-live="polite" aria-busy={busy}>
        {!messages.length && !busy && <div className="chatWelcome"><Sparkles size={18} /><strong>Ask about this claim</strong><p>I can explain the case history, evidence, communications, and preparation work. I cannot make the handler&apos;s decisions.</p></div>}
        {messages.map((message, index) => <article className={"chatMessage chat-" + message.role} key={index}><span>{message.role === "agent" ? <Bot size={13} /> : <UserRound size={13} />}</span><p>{message.body}</p></article>)}
        {busy && <article className="chatMessage chat-agent chatThinking"><span><CircleDashed className="spin" size={13} /></span><p>Thinking with Codex…</p></article>}
        <div ref={endRef} aria-hidden="true" />
      </div>
      <div className="chatSuggestions">{suggestions.map((suggestion) => <button disabled={busy} key={suggestion} onClick={() => void submit(suggestion)}>{suggestion}</button>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); void submit(input); }}>
        <input aria-label="Ask this claim agent" disabled={busy} maxLength={600} placeholder="Ask about this claim…" value={input} onChange={(event) => setInput(event.target.value)} />
        <button aria-label="Send question" disabled={busy || !input.trim()} type="submit"><Send size={14} /></button>
      </form>
    </div>
  );
}
