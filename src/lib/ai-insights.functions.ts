import { createServerFn } from "@tanstack/react-start";
import type { AssessmentInputs, AssessmentResult } from "./scoring";

export interface AIInsightsResult {
  summary: string;
  strengths: string[];
  concerns: string[];
  missingInformation: string[];
  improvementPlan: string[];
}

/**
 * AI is an EXPLANATION layer — it never recomputes scores.
 * It receives the already-computed result + raw inputs and produces narrative analysis.
 */
export const generateAIInsights = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => input as { inputs: AssessmentInputs; result: AssessmentResult })
  .handler(async ({ data }): Promise<AIInsightsResult> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      return fallback(data.inputs, data.result);
    }

    const { inputs, result } = data;
    const profile = {
      name: inputs.name,
      employmentType: inputs.employmentType,
      city: inputs.city,
      education: inputs.education,
      institutionTier: inputs.institutionTier,
      monthlyIncome: inputs.monthlyIncome,
      monthlyExpenses: inputs.monthlyExpenses,
      savings: inputs.savings,
      emergencyFundMonths: inputs.emergencyFundMonths,
      avgBankBalance: inputs.avgBankBalance,
      monthlyTransactions: inputs.monthlyTransactions,
      jobTenureMonths: inputs.jobTenureMonths,
      offerLetter: inputs.offerLetter,
      placementStatus: inputs.placementStatus,
      expectedSalary: inputs.expectedSalary,
      familySupport: inputs.familySupport,
    };
    const computed = {
      overallScore: result.overallScore,
      confidenceScore: result.confidenceScore,
      riskLevel: result.riskLevel,
      eligibilityStatus: result.eligibilityStatus,
      categories: result.categories.map(c => ({ label: c.label, score: c.score, confidence: c.confidence })),
      advanced: result.advanced,
    };

    const system =
      "You are an alternative credit analyst for CreditVision AI. " +
      "You NEVER calculate or change scores. The scores you receive are final, from a deterministic rule engine. " +
      "Your job is to explain the result in clear human language. " +
      "Core philosophy: missing credit history is treated as MISSING INFORMATION, never as risk. " +
      "Be concise, factual, never invent data. Use only the provided fields. " +
      "Return strict JSON matching the schema requested.";

    const user = `Profile:\n${JSON.stringify(profile, null, 2)}\n\nComputed result:\n${JSON.stringify(computed, null, 2)}\n\n` +
      `Return JSON with this exact shape:\n` +
      `{\n  "summary": "2-3 sentence applicant summary",\n` +
      `  "strengths": ["..."],\n  "concerns": ["..."],\n` +
      `  "missingInformation": ["..."],\n  "improvementPlan": ["actionable step", "..."]\n}\n` +
      `Limit each list to 5 items. Make improvementPlan specific to this applicant.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        console.error("AI gateway error", res.status, await res.text().catch(() => ""));
        return fallback(inputs, result);
      }
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const parsed = JSON.parse(content);
      return {
        summary: String(parsed.summary ?? ""),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 6).map(String) : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 6).map(String) : [],
        missingInformation: Array.isArray(parsed.missingInformation) ? parsed.missingInformation.slice(0, 6).map(String) : [],
        improvementPlan: Array.isArray(parsed.improvementPlan) ? parsed.improvementPlan.slice(0, 6).map(String) : [],
      };
    } catch (e) {
      console.error("AI insights error", e);
      return fallback(inputs, result);
    }
  });

function fallback(inputs: AssessmentInputs, r: AssessmentResult): AIInsightsResult {
  const who = inputs.name?.trim() || "The applicant";
  const summary =
    `${who} is a ${inputs.employmentType.replace("_", " ")} with an overall score of ${Math.round(r.overallScore)}/100 ` +
    `and ${Math.round(r.confidenceScore)}% confidence. Risk level is ${r.riskLevel.toLowerCase()} and the engine recommends: ${r.eligibilityStatus}.`;

  const plan: string[] = [];
  if (inputs.emergencyFundMonths < 3) plan.push("Build an emergency fund covering 3–6 months of expenses.");
  if (inputs.savings < 50000) plan.push("Grow total savings towards ₹50,000 to strengthen capacity.");
  if (inputs.digitalPaymentUsage < 4) plan.push("Use UPI / digital payments more consistently to leave a stronger banking footprint.");
  if (inputs.jobTenureMonths < 24 && inputs.employmentType !== "student") plan.push("Maintain tenure at current employer past 24 months.");
  if (![inputs.rentPayments, inputs.utilityPayments, inputs.telecomPayments, inputs.subscriptionPayments].some(v => v > 0)) {
    plan.push("Start recording on-time bill payments (rent, utilities, telecom) — this is alternative credit history.");
  }
  return {
    summary,
    strengths: r.strengths,
    concerns: r.concerns,
    missingInformation: r.missingInformation,
    improvementPlan: plan.length ? plan : ["Profile already shows strong fundamentals — keep current habits consistent."],
  };
}
