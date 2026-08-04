"use client";

import Image from "next/image";
import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  CircleDashed,
  FileImage,
  FileText,
  Mail,
  Paperclip,
  Play,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { demoCase, type AnalysisResult, type TraceEvent } from "@/lib/demo-case";

type RunState = "idle" | "running" | "complete" | "error";
type SourceGroup = "agent" | "customer";
type SourceKind = "markdown" | "image" | "document";

type SourceFile = {
  id: string;
  name: string;
  group: SourceGroup;
  kind: SourceKind;
  purpose: string;
  destination: string;
  content: string;
  generatedContent?: string;
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

const EVENT_PACE_MS = 340;
const TYPEWRITER_CHUNK_SIZE = 5;
const TYPEWRITER_INTERVAL_MS = 12;

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
  const [tourStep, setTourStep] = useState(0);
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
  const analysisRequest = useRef<AbortController | null>(null);
  const initialSources = useRef<SourceFile[]>([]);
  const requestVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/sources", { signal: controller.signal })
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
  }, []);

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
    setSelectedSourceId("agent");
    setWorkingSourceIds([]);
    setTypingSourceId(null);
    setSources(initialSources.current.map((source) => ({ ...source })));
  };

  const runAnalysis = async () => {
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
    setSelectedSourceId("agent");
    setWorkingSourceIds(["agent"]);
    setTypingSourceId(null);
    setSources(initialSources.current.map((source) => ({ ...source })));

    try {
      const response = await fetch("/api/analyze", { method: "POST", signal: controller.signal });
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
            const { sourceId, content, mode } = event.payload as {
              sourceId: string;
              content: string;
              mode: "replace" | "append";
            };
            setSources((files) => files.map((source) =>
              source.id === sourceId
                ? {
                    ...source,
                    content: mode === "replace" ? content : source.content,
                    generatedContent: mode === "append" ? content : undefined,
                    observationStatus: "generated",
                  }
                : source,
            ));
            setSelectedSourceId(sourceId);
            setWorkingSourceIds([sourceId]);
            setTypingSourceId(sourceId);
            const revealDuration = Math.min(
              520,
              Math.max(340, Math.ceil(content.length / TYPEWRITER_CHUNK_SIZE) * TYPEWRITER_INTERVAL_MS * 0.45),
            );
            await waitForPresentation(revealDuration, controller.signal);
            if (version === requestVersion.current) setTypingSourceId(null);
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
        <div className="headerActions">
          <RunStatus state={runState} />
          <button data-tour="reset-demo" className="secondaryButton" onClick={resetDemo}><RotateCcw size={16} />Reset demo</button>
          <button data-tour="run-copilot" className="primaryButton" onClick={runAnalysis} disabled={runState === "running"}>
            {runState === "running" ? <CircleDashed className="spin" size={16} /> : <Play size={16} fill="currentColor" />}
            {runState === "running" ? "Analysing" : analysis ? "Run again" : "Run copilot"}
          </button>
        </div>
      </header>

      <main className="demoSplit">
        <section data-tour="handler-side" className="frontPanel" aria-label="Front end handler view">
          <PanelHeader label="Front end" title="Damage claim" detail="Customer case" />
          <div className="frontScroll">
            <CaseSummary showSource={showSource} />
            <FrontEndState
              state={runState} analysis={analysis} error={error} trace={trace}
              runAnalysis={runAnalysis} draftSubject={draftSubject} draftBody={draftBody}
              setDraftSubject={setDraftSubject} setDraftBody={setDraftBody}
              draftIsTyping={draftIsTyping} draftApproved={draftApproved} approveDraft={approveDraft}
            />
          </div>
        </section>

        <aside data-tour="agent-side" className="backendPanel" aria-label="Back end agent view">
          <SourcePane
            sources={sources}
            selectedSource={selectedSource}
            selectedSourceId={selectedSourceId}
            workingSourceIds={workingSourceIds}
            typingSourceId={typingSourceId}
            sourceError={sourceError}
            selectSource={setSelectedSourceId}
          />
          <ActivityPane trace={trace} state={runState} />
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

function PanelHeader({ label, title, detail }: { label: string; title: string; detail: string }) {
  return <div className="panelHeader"><span>{label}</span><strong>{title}</strong><small>{detail}</small></div>;
}

function RunStatus({ state }: { state: RunState }) {
  const labels: Record<RunState, string> = { idle: "Ready", running: "Agent running", complete: "Email ready", error: "Run failed" };
  return <span className={`runStatus runStatus-${state}`}><span />{labels[state]}</span>;
}

function CaseSummary({ showSource }: { showSource: (id: string) => void }) {
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
  setDraftSubject, setDraftBody, draftIsTyping, draftApproved, approveDraft,
}: {
  state: RunState; analysis: AnalysisResult | null; error: string; trace: TraceEvent[];
  runAnalysis: () => void; draftSubject: string; draftBody: string;
  setDraftSubject: (value: string) => void; setDraftBody: (value: string) => void;
  draftIsTyping: boolean; draftApproved: boolean; approveDraft: () => void;
}) {
  if (state === "idle") return (
    <section className="startState"><Bot size={23} /><div><h2>Ready for review</h2><p>The agent will read the five files shown on the right.</p></div><button data-tour="run-copilot" className="primaryButton" onClick={runAnalysis}><Play size={16} fill="currentColor" />Run copilot</button></section>
  );
  if (state === "running" && !analysis) {
    const currentStep = trace.at(-1);
    return <section className="runningState" aria-live="polite"><CircleDashed className="spin" size={23} /><div><span>Agent running</span><h2>{currentStep?.title ?? "Starting analysis"}</h2><p>{currentStep?.output ?? "Waiting for the next output"}</p></div></section>;
  }
  if (state === "error") return <section className="errorState"><XCircle size={23} /><div><h2>Analysis failed</h2><p>{error}</p></div><button className="secondaryButton" onClick={runAnalysis}>Try again</button></section>;
  if (!analysis) return null;

  return (
    <section className="emailResult">
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
              </div>
              {selectedSource.kind === "document" && selectedSource.generatedContent && (
                <div className="generatedReview">
                  <span className="extractionLabel">Agent rule review</span>
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

function ActivityPane({ trace, state }: { trace: TraceEvent[]; state: RunState }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [trace.length, state]);
  return (
    <section className="activityPane">
      <PanelHeader label="Back end" title="Agent activity" detail="Following latest action" />
      <div className="activityList" aria-live="polite">
        {trace.map((event, index) => (
          <article className={`activityStep step-${event.status} ${index === trace.length - 1 ? "stepLatest" : ""}`} key={event.id}>
            <span className="stepNumber">{event.status === "complete" ? <Check size={12} /> : index + 1}</span>
            <div><header><strong>{event.title}</strong><time>{event.timestamp}</time></header>
              <p aria-label={event.detail}><span aria-hidden="true"><TypewriterText text={event.detail} animate={state === "running"} /></span></p>
              {(event.input || event.output) && <div className="dataFlow"><span>{event.input}</span><ArrowRight size={12} /><strong>{event.output}</strong></div>}
            </div>
          </article>
        ))}
        {state === "running" && <div className="waitingLine"><Activity size={14} />Waiting for the next runtime event</div>}
        <div ref={endRef} aria-hidden="true" />
      </div>
      <footer className="backendGuardrail"><ShieldCheck size={15} />Read-only inputs · constrained output · human approval</footer>
    </section>
  );
}
