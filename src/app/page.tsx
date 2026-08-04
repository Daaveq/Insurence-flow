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
  Search,
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
            setAnalysis(result);
            setDraftSubject(result.customerDraft.subject);
            setDraftIsTyping(true);
            void revealText(result.customerDraft.body, setDraftBody, controller.signal)
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
    setDraftApproved(true);
    setTrace((events) => [...events, {
      id: crypto.randomUUID(),
      timestamp: currentTime(),
      title: "The handler approved the email draft",
      detail: "The reviewed draft is locked in this demo. It has not been sent to the customer.",
      status: "complete",
      kind: "human",
      input: "Handler approval",
      output: "Draft approved · not sent",
    }]);
  };

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

      <main className="demoSplit">
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
              <ClaimTimeline demoCase={demoCase} state={runState} securityStop={securityStop} />
              <FrontEndState
                state={runState} analysis={analysis} error={error} trace={trace}
                runAnalysis={runAnalysis} draftSubject={draftSubject} draftBody={draftBody}
                setDraftSubject={setDraftSubject} setDraftBody={setDraftBody}
                draftIsTyping={draftIsTyping} draftApproved={draftApproved} approveDraft={approveDraft}
                demoCase={demoCase} securityStop={securityStop}
              />
              <CommunicationLog demoCase={demoCase} state={runState} draftBody={draftBody} securityStop={securityStop} />
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
          <ActivityPane trace={trace} state={runState} demoCase={demoCase} analysis={analysis} securityStop={securityStop} /></>}
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
  const [notice, setNotice] = useState("");

  return (
    <div className="claimsOverview">
      <header className="overviewHero">
        <div>
          <span>Claims workspace</span>
          <h1>Good morning, Alex</h1>
          <p>AI agents prepare new claims while handlers focus on decisions that require judgment.</p>
        </div>
        <div className="overviewMetric"><strong>8</strong><span>Open claims</span><small>2 available in this demo</small></div>
      </header>
      <div className="overviewTools">
        <label><Search size={14} /><input aria-label="Search claims" placeholder="Search claims" /></label>
        <div><span><Sparkles size={13} />3 agents preparing cases</span><span>2 need human attention</span></div>
      </div>
      {notice && <div className="demoNotice" role="status">{notice}</div>}
      <section className="claimQueue" aria-label="Claims overview">
        <header>
          <span>Claim and customer</span><span>Description</span><span>Received</span><span>Preparation status</span><span />
        </header>
        {portfolioClaims.map((claim, index) => {
          const caseId = "caseId" in claim ? claim.caseId : undefined;
          const isInteractive = Boolean(caseId);
          return (
            <button
              className={isInteractive ? "claimRow claimRow-active" : "claimRow"}
              key={claim.claim}
              onClick={() => {
                if (caseId) selectCase(caseId);
                else setNotice("This claim is not interactive — it is part of the demo portfolio.");
              }}
            >
              <span className="claimPerson"><strong>{claim.customer}</strong><small>{claim.claim}</small></span>
              <span className="claimDescription">{claim.description}{isInteractive && <small>Demo case {index + 1} · Open claim</small>}</span>
              <span className="claimReceived">{claim.received}</span>
              <span className={"preparationPill preparation-" + claim.tone}><i />{claim.preparation}</span>
              <span className="claimOpen">{isInteractive ? <ArrowRight size={15} /> : <small>Demo only</small>}</span>
            </button>
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

function ClaimTimeline({ demoCase, state, securityStop }: {
  demoCase: DemoCase;
  state: RunState;
  securityStop: SecurityStop | null;
}) {
  const isInjection = demoCase === demoCases.injection;
  const steps = isInjection
    ? [
        { label: "Claim received", detail: "Form and uploads captured", status: "complete" },
        { label: "Safety inspection", detail: securityStop ? "Untrusted instruction found" : state === "idle" ? "Waiting to start" : "Inspecting document text", status: securityStop ? "warning" : state === "idle" ? "waiting" : "active" },
        { label: "Customer contact", detail: securityStop ? "Blocked before communication" : "Not started", status: securityStop ? "blocked" : "waiting" },
        { label: "Human review", detail: securityStop ? "Specialist escalation" : "Not started", status: securityStop ? "active" : "waiting" },
      ]
    : [
        { label: "Claim received", detail: "Form and uploads captured", status: "complete" },
        { label: "Evidence checked", detail: state === "idle" ? "Waiting to start" : "Gaps identified", status: state === "idle" ? "waiting" : "complete" },
        { label: "Information collected", detail: state === "complete" ? "Customer and repairer replied" : "Not started", status: state === "complete" ? "complete" : state === "running" ? "active" : "waiting" },
        { label: "Ready for handler", detail: state === "complete" ? "Decision points prepared" : "Not ready", status: state === "complete" ? "ready" : "waiting" },
      ];

  return (
    <section className="claimTimeline">
      <header><div><Clock3 size={15} /><strong>Claim preparation timeline</strong></div><span>AI work and human decisions stay visible</span></header>
      <div className="timelineSteps">
        {steps.map((step, index) => (
          <article className={"timelineStep timeline-" + step.status} key={step.label}>
            <span className="timelineNode">{step.status === "complete" || step.status === "ready" ? <Check size={11} /> : index + 1}</span>
            <div><strong>{step.label}</strong><small>{step.detail}</small></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CommunicationLog({ demoCase, state, draftBody, securityStop }: {
  demoCase: DemoCase;
  state: RunState;
  draftBody: string;
  securityStop: SecurityStop | null;
}) {
  const isInjection = demoCase === demoCases.injection;
  const standardMessages = state === "complete" ? [
    { actor: "AI", direction: "Outgoing", time: "09:45", title: "Missing information requested", body: draftBody || "Requested the missing rear photo and matching device identifier.", tone: "ai" },
    { actor: demoCase.customer.name, direction: "Incoming", time: "10:12", title: "Customer replied with photo", body: "Oh, my bad — I see now that the second photo never uploaded. Here it is. I have asked the repairer to add the IMEI to the estimate; an update is coming soon.", tone: "human" },
    { actor: "AI", direction: "Outgoing", time: "10:13", title: "Receipt confirmed", body: "Thanks, Lina. I have added the photo to your claim. I will keep preparing the case and watch for the updated estimate. I cannot make a decision on the claim; a handler will review it.", tone: "ai" },
    { actor: "City Mobile Repair", direction: "Incoming", time: "11:06", title: "Updated estimate received", body: "Revised estimate received with the device IMEI included.", tone: "external" },
    { actor: "AI", direction: "Internal", time: "11:07", title: "Case prepared for handler", body: "Requested evidence collected and associated with the claim. No coverage, compensation, or repair decision was made.", tone: "system" },
  ] : [];
  const messages = isInjection && securityStop ? [
    { actor: "Safety control", direction: "Internal", time: "08:22", title: "All automated communication stopped", body: "An untrusted instruction was detected in the repair estimate. No customer or vendor message was created or sent.", tone: "security" },
  ] : standardMessages;

  return (
    <section className="communicationLog">
      <header>
        <div><MessageCircle size={15} /><strong>Communication log</strong></div>
        <span>{messages.length ? messages.length + " entries" : "No agent communication yet"}</span>
      </header>
      {!messages.length ? (
        <div className="emptyCommunications"><Mail size={18} /><p>The case agent has not contacted anyone. Communications will appear here with a clear AI or human identity.</p></div>
      ) : <div className="communicationEntries">
        {messages.map((message) => (
          <article className={"communicationEntry communication-" + message.tone} key={message.time + message.title}>
            <span className="actorIcon">{message.tone === "ai" ? <Bot size={14} /> : message.tone === "human" ? <UserRound size={14} /> : message.tone === "security" ? <ShieldAlert size={14} /> : <Mail size={14} />}</span>
            <div>
              <header><strong>{message.title}</strong><time>{message.time}</time></header>
              <div className="communicationMeta"><span>{message.actor}</span><i>{message.direction}</i>{message.tone === "ai" && <em>AI assistant</em>}</div>
              <p>{message.body}</p>
            </div>
          </article>
        ))}
      </div>}
      <footer><ShieldCheck size={13} />Synthetic demo exchange · no real email is sent</footer>
    </section>
  );
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

function FrontEndState({
  state, analysis, error, trace, runAnalysis, draftSubject, draftBody,
  setDraftSubject, setDraftBody, draftIsTyping, draftApproved, approveDraft, demoCase,
  securityStop,
}: {
  state: RunState; analysis: AnalysisResult | null; error: string; trace: TraceEvent[];
  runAnalysis: () => void; draftSubject: string; draftBody: string;
  setDraftSubject: (value: string) => void; setDraftBody: (value: string) => void;
  draftIsTyping: boolean; draftApproved: boolean; approveDraft: () => void;
  demoCase: DemoCase;
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
  if (!analysis) return null;

  const securityIssue = analysis.issues.find((issue) =>
    issue.type === "risk" && /untrusted|instruction|document/i.test(issue.title + " " + issue.detail),
  );

  return (
    <section className="emailResult">
      {securityIssue && (
        <div className="securityOutcome">
          <ShieldAlert size={19} />
          <div><span>Attack prevented</span><strong>{securityIssue.title}</strong><p>{securityIssue.detail}</p></div>
          <em>Human Specialist Review</em>
        </div>
      )}
      <header className="emailResultHeader">
        <span className="emailIcon"><Mail size={19} /></span>
        <div><span>Automated output</span><h2>Email drafted for {demoCase.customer.name}</h2></div>
        <span className="reviewBadge">Review required</span>
      </header>
      <div className="emailMeta"><span>To</span><strong>{demoCase.customer.contact}</strong></div>
      <label className="emailField">Subject<input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} disabled={draftApproved || draftIsTyping} /></label>
      <label className="emailField">Message<textarea className={draftIsTyping ? "emailTyping" : ""} value={draftBody} onChange={(event) => setDraftBody(event.target.value)} disabled={draftApproved || draftIsTyping} rows={9} /></label>
      <footer className="emailActions">
        <span><ShieldCheck size={15} />Not sent automatically</span>
        <button className={draftApproved ? "approvedButton" : "primaryButton"} onClick={approveDraft} disabled={draftApproved || draftIsTyping}>
          {draftApproved ? <Check size={16} /> : <Mail size={16} />}{draftApproved ? "Draft approved" : draftIsTyping ? "Writing draft" : "Approve draft"}
        </button>
      </footer>
    </section>
  );
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

function ActivityPane({ trace, state, demoCase, analysis, securityStop }: {
  trace: TraceEvent[];
  state: RunState;
  demoCase: DemoCase;
  analysis: AnalysisResult | null;
  securityStop: SecurityStop | null;
}) {
  const [tab, setTab] = useState<"audit" | "chat">("audit");
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
      </> : <AgentChat demoCase={demoCase} state={state} analysis={analysis} securityStop={securityStop} />}
    </section>
  );
}

function AgentChat({ demoCase, state, analysis, securityStop }: {
  demoCase: DemoCase;
  state: RunState;
  analysis: AnalysisResult | null;
  securityStop: SecurityStop | null;
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
    if (/human|decision|need|next/.test(lower)) return "The evidence collection is prepared, but coverage, compensation, deductible, repair authorization, and the final claim outcome remain human decisions.";
    return (analysis?.caseSummary ? analysis.caseSummary + " " : "") + "I identified missing evidence, prepared a transparent request, recorded the customer's reply, associated the updated estimate, and left the case ready for handler review. The communication log shows the complete synthetic exchange.";
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
