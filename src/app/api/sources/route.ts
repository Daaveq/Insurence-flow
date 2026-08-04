import { readFileSync } from "node:fs";
import path from "node:path";
import { sourceDefinitions } from "@/lib/agent-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const contextDirectory = path.join(process.cwd(), "demo-context");

  try {
    const files = sourceDefinitions.map((source) => ({
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
