import { expect, test, type Page } from "@playwright/test";

const mockResult = {
  caseSummary: "A complete synthetic damaged-phone claim.",
  facts: [
    {
      label: "Policy",
      value: "Active on the incident date",
      confidence: 0.96,
      sourceRefs: ["CLAIM-01"],
    },
    {
      label: "Damage",
      value: "Cracked front glass",
      confidence: 0.91,
      sourceRefs: ["CLAIM-01", "EVID-01"],
    },
  ],
  evidenceAssessment: [
    {
      evidenceId: "EVID-01",
      finding: "Cracking is visible across the display.",
      supports: "Visible physical damage only.",
      confidence: 0.9,
      ruleChecks: [
        { ruleId: "E-02.1", label: "Damage clearly visible", status: "confirmed", detail: "Cracking is visible." },
        { ruleId: "E-02.2", label: "Front and rear views supplied", status: "not_confirmed", detail: "No rear view was supplied." },
      ],
    },
    {
      evidenceId: "EVID-02",
      finding: "Purchase details align with the claim.",
      supports: "Purchaser, model, date, and amount.",
      confidence: 0.9,
      ruleChecks: [
        { ruleId: "E-03.1", label: "Purchase details readable", status: "confirmed", detail: "Core fields are readable." },
        { ruleId: "E-03.2", label: "Device identifier visible", status: "not_confirmed", detail: "No serial number or IMEI is shown." },
      ],
    },
    {
      evidenceId: "EVID-03",
      finding: "Repair scope and total are readable.",
      supports: "Screen replacement and SEK 2,490 total.",
      confidence: 0.9,
      ruleChecks: [
        { ruleId: "E-04.1", label: "Repair scope and total readable", status: "confirmed", detail: "Scope and total are present." },
        { ruleId: "E-04.2", label: "Device identifier matched", status: "not_confirmed", detail: "No serial number or IMEI is shown." },
      ],
    },
  ],
  issues: [
    {
      type: "missing",
      title: "Touch fault not independently verified",
      detail: "No diagnostic result confirms the intermittent touch response.",
      severity: "low",
    },
  ],
  recommendation: {
    action: "Send the case to repair-path review",
    rationale: "The file contains a coherent repair estimate and supporting evidence.",
    confidence: 0.9,
    guardrail: "Recommendation only.",
  },
  customerDraft: {
    subject: "Your mobile phone claim",
    body: "Please send a rear-device photo, purchase evidence showing the serial number or IMEI, and an updated repair estimate showing the same identifier.",
    requiresApproval: true,
  },
  routing: {
    queue: "Home Contents / Mobile Device Review",
    rationale: "Complete mobile-device file.",
    confidence: 0.9,
    requiresApproval: true,
  },
  rulesReferenced: [],
  overallConfidence: 0.9,
  auditNote: "No external action was taken.",
};

async function openDemo(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Skip tour" }).click();
}

test.describe("Claims Copilot demo", () => {
  test("introduces the complete demo with a guided spotlight tour", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    const dialog = page.getByRole("dialog", { name: "Demo introduction" });
    await expect(dialog.getByRole("heading")).toHaveText("Welcome to the demo");
    await expect(page.locator(".tourBackdrop")).toBeVisible();

    const remainingSteps = [
      { title: "The claims-handler side" },
      { title: "The AI agent side" },
      { title: "AGENT.md", sourceId: "agent" },
      { title: "Rules.md", sourceId: "rules" },
      { title: "Receipt.jpg", sourceId: "receipt" },
      { title: "Damage.jpg", sourceId: "damage" },
      { title: "Repair Estimate.pdf", sourceId: "repair-estimate" },
      { title: "Reset the demo", target: "reset-demo" },
      { title: "Run the real copilot", target: "run-copilot", spotlightCount: 2 },
    ];
    for (const step of remainingSteps) {
      await dialog.getByRole("button", { name: "Next" }).click();
      await expect(dialog.getByRole("heading")).toHaveText(step.title);
      await expect(page.locator(".tourSpotlight")).toHaveCount(step.spotlightCount ?? 1);
      if (step.sourceId) {
        await expect(page.locator('[data-tour="source-' + step.sourceId + '"]')).toHaveAttribute("aria-pressed", "true");
      }
      if (step.target) {
        await expect(page.locator('[data-tour="' + step.target + '"]')).toHaveCount(step.spotlightCount ?? 1);
      }
    }

    await expect(page.locator('[data-tour="run-copilot"]')).toHaveCount(2);
    await dialog.getByRole("button", { name: "Explore demo" }).click();
    await expect(dialog).toHaveCount(0);
  });
  test("shows uploaded evidence and the grouped dark backend", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openDemo(page);

    await expect(
      page.getByRole("heading", { name: "Damaged mobile phone" }),
    ).toBeVisible();
    await expect(page.locator(".uploadTitle").getByText("Uploaded")).toBeVisible();
    await expect(page.getByText("Agent", { exact: true })).toBeVisible();
    await expect(page.getByText("Why this matters")).toBeVisible();
    await expect(page.getByText("Received from customer")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Rules.md/ }),
    ).toBeVisible();

    await page.getByRole("button", { name: /Rules.md/ }).click();
    await expect(page.getByText("G-01 - Decision boundary")).toBeVisible();
    await expect(page.getByText("checks and limits", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Damage.jpg/ }).first().click();
    await expect(page.getByText("Awaiting agent inspection")).toBeVisible();
    await expect(page.getByText("No image observations yet.")).toBeVisible();
    await expect(page.getByText(/Spiderweb cracking/)).toHaveCount(0);

    await page.getByRole("button", { name: /Receipt.jpg/ }).first().click();
    await expect.poll(() =>
      page.getByAltText("Preview of Receipt.jpg").evaluate(
        (image: HTMLImageElement) =>
          Boolean(image.complete && image.naturalWidth > 0),
      ),
    ).toBe(true);
    await expect(page.getByText("Nordic Electronics Stockholm")).toBeVisible();

    await page.getByRole("button", { name: /Repair Estimate.pdf/ }).first().click();
    await expect(page.getByText("CITY MOBILE REPAIR AB")).toBeVisible();

    const rightBackground = await page.locator(".backendPanel").evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(rightBackground).toBe("rgb(17, 22, 20)");

    const viewportFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(viewportFits).toBe(true);
  });

  test("keeps all three panes accessible on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page);

    await expect(page.getByRole("button", { name: "Reset demo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run copilot" }).first()).toBeVisible();
    await page.getByText("Agent inputs").scrollIntoViewIfNeeded();
    await expect(page.getByText("Agent inputs")).toBeVisible();
    await page.getByText("Agent activity").scrollIntoViewIfNeeded();
    await expect(page.getByText("Agent activity")).toBeVisible();

    const viewportFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(viewportFits).toBe(true);
  });

  test("drafts an email, follows the latest step, and resets", async ({ page }) => {
    let releaseResponse!: () => void;
    const responseGate = new Promise<void>((resolve) => {
      releaseResponse = resolve;
    });

    await page.route("**/api/analyze", async (route) => {
      await responseGate;
      const body = [
        JSON.stringify({
          type: "trace",
          payload: {
            id: "test-step",
            timestamp: "10:00:00",
            title: "Draft the customer email",
            detail: "Created an editable email for handler review.",
            status: "complete",
            kind: "analysis",
            input: "Schema-approved result",
            output: "Front end → Email draft",
          },
        }),
        JSON.stringify({
          type: "source_update",
          payload: {
            sourceId: "damage",
            mode: "replace",
            content: "IMAGE OBSERVATIONS — GENERATED LIVE\n\nThe agent saw cracking across the display.\n\nRULE CHECKS\n\nRule: Damage clearly visible: Confirmed\nCracking is visible.\n\nRule: Front and rear views supplied: Not confirmed\nNo rear view was supplied.",
          },
        }),
        JSON.stringify({
          type: "source_update",
          payload: {
            sourceId: "receipt",
            mode: "append",
            content: "AGENT RECEIPT REVIEW — GENERATED LIVE\n\nRULE CHECKS\n\nRule: Purchase details readable: Confirmed\nCore fields are readable.\n\nRule: Device identifier visible: Not confirmed\nNo serial number or IMEI is shown.",
          },
        }),
        JSON.stringify({
          type: "source_update",
          payload: {
            sourceId: "repair-estimate",
            mode: "append",
            content: "AGENT ESTIMATE REVIEW — GENERATED LIVE\n\nRULE CHECKS\n\nRule: Repair scope and total readable: Confirmed\nScope and total are present.\n\nRule: Device identifier matched: Not confirmed\nNo serial number or IMEI is shown.",
          },
        }),
        JSON.stringify({ type: "result", payload: mockResult }),
        "",
      ].join("\n");

      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body,
      });
    });

    await openDemo(page);
    await page.getByRole("button", { name: "Run copilot" }).first().click();
    await expect(page.getByRole("button", { name: /AGENT.md/ })).toHaveClass(/sourceWorking/);
    await expect(page.getByText("Working with now")).toBeVisible();
    releaseResponse();

    await expect(
      page.getByRole("heading", { name: "Email drafted for Lina Berg" }),
    ).toBeVisible();
    await expect(page.getByLabel("Subject")).toHaveValue(
      "Your mobile phone claim",
    );
    await page.locator('[data-tour="source-damage"]').click();
    await expect(page.locator(".extractionLabel")).toHaveText("Agent observations");
    await expect(page.locator(".sourceText")).toContainText("Rule: Front and rear views supplied: Not confirmed");

    await page.locator('[data-tour="source-receipt"]').click();
    await expect(page.locator(".extractionLabel")).toHaveText("Agent rule review");
    await expect(page.locator(".sourceText")).toContainText("Rule: Device identifier visible: Not confirmed");

    await page.locator('[data-tour="source-repair-estimate"]').click();
    await expect(page.locator(".documentPreview .extractionLabel")).toHaveText("What the agent can read");
    await expect(page.locator(".documentPreview")).not.toContainText("AGENT ESTIMATE REVIEW — GENERATED LIVE");
    await expect(page.locator(".generatedReview .extractionLabel")).toHaveText("Agent rule review");
    await expect(page.locator(".generatedReview")).toContainText("Rule: Device identifier matched: Not confirmed");
    await expect(page.locator(".activityStep.stepLatest")).toContainText(
      "Draft the customer email",
    );
    await page.getByRole("button", { name: "Approve draft" }).click();
    await expect(page.getByText("The handler approved the email draft")).toBeVisible();

    await page.getByRole("button", { name: "Reset demo" }).click();
    await expect(page.getByRole("heading", { name: "Ready for review" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Email drafted for Lina Berg" }),
    ).toHaveCount(0);
    await expect(page.getByText("Waiting for the handler")).toBeVisible();
    await expect(page.getByText("Hard guardrails")).toBeVisible();
    await page.getByRole("button", { name: /Damage.jpg/ }).first().click();
    await expect(page.getByText("No image observations yet.")).toBeVisible();
    await expect(page.getByText(/The agent saw cracking across the display/)).toHaveCount(0);
  });

  test("runs the live Codex flow", async ({ page }) => {
    test.skip(
      process.env.LIVE_CODEX !== "1",
      "Set LIVE_CODEX=1 to run the authenticated CLI flow.",
    );
    test.setTimeout(180_000);

    await openDemo(page);
    await page.getByRole("button", { name: "Run copilot" }).first().click();
    await expect(page.getByRole("heading", { name: "Email drafted for Lina Berg" })).toBeVisible({
      timeout: 150_000,
    });
    await expect(page.getByText("Draft the customer email")).toBeVisible();

    await page.locator('[data-tour="source-damage"]').click();
    await expect(page.locator(".extractionLabel")).toHaveText("Agent observations");
    await expect(page.locator(".sourceText")).toContainText("Confirmed");
    await expect(page.locator(".sourceText")).toContainText("Not confirmed");
    await expect(page.getByText("No image observations yet.")).toHaveCount(0);

    await page.locator('[data-tour="source-receipt"]').click();
    await expect(page.locator(".extractionLabel")).toHaveText("Agent rule review");
    await expect(page.locator(".sourceText")).toContainText("Device identifier visible");
    await expect(page.locator(".sourceText")).toContainText("Not confirmed");

    await page.locator('[data-tour="source-repair-estimate"]').click();
    await expect(page.locator(".documentPreview")).not.toContainText("AGENT ESTIMATE REVIEW — GENERATED LIVE");
    await expect(page.locator(".generatedReview .extractionLabel")).toHaveText("Agent rule review");
    await expect(page.locator(".generatedReview")).toContainText("Device identifier matched");
    await expect(page.locator(".generatedReview")).toContainText("Not confirmed");

    const emailMessage = page.getByRole("textbox", { name: "Message", exact: true });
    await expect(emailMessage).toHaveValue(/rear/i);
    await expect(emailMessage).toHaveValue(/serial number|IMEI/i);
    await page.screenshot({
      path: "test-results/redesign-complete.png",
      fullPage: true,
    });
  });
});
