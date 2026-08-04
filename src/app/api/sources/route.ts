import { readFileSync } from "node:fs";
import path from "node:path";
import { sourceDefinitionsForCase } from "@/lib/agent-config";
import { isCaseId } from "@/lib/demo-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const requestedCase = new URL(request.url).searchParams.get("case") ?? "standard";
  if (!isCaseId(requestedCase)) {
    return Response.json({ message: "Unknown fixed demo case." }, { status: 400 });
  }

  const contextDirectory = path.join(process.cwd(), "demo-context");

  try {
    const files = sourceDefinitionsForCase(requestedCase).map((source) => ({
      ...source,
      content: source.path === null
        ? source.content
        : readFileSync(path.join(contextDirectory, source.path), "utf8"),
    }));

    return Response.json({ files });
  } catch {
    return Response.json(
      { message: "The fixed demo sources could not be loaded." },
      { status: 500 },
    );
  }
}
