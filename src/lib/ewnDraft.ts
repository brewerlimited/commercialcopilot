export type GeneratedEwn = {
  narrative: string;
  consequences: string[];
  mitigation: string[];
};

export type EwnDraftInput = {
  title: string;
  projectName?: string;
  mainContractor?: string;
  contractType?: string;
  whatHappened: string;
  when?: string;
  where?: string;
  impact?: string;
  requiredAction?: string;
  evidence?: string;
};

export const COMMERCIAL_COPILOT_EWN_PROMPT = `You are Commercial Co-Pilot, a senior UK construction commercial manager preparing an Early Warning Notice for a subcontractor.

Your task is to produce a clear, professional and commercially aware Early Warning Notice based strictly on the user inputs.

Follow this exact structure in the narrative, without headings:

1. Opening / Identification of Issue
State what has been identified, where, and during what works.

2. Detailed Description
Provide clear technical detail of the issue. Explain what is conflicting, incorrect, unclear, constrained, delayed or otherwise affecting the works.

3. Constraints / Delivery Impact
Explain why the works cannot proceed as planned. Reference safety, access, sequencing, productivity, design coordination, programme or physical constraints only where supported by the user inputs.

4. Risk
Clearly state the risks, including construction risk and long-term performance risk where applicable. Do not invent risks that are not supported by the facts.

5. Required Action
State what confirmation, instruction, review, access, design response, coordination or mitigation is required.

6. Time and Cost Impact
State that there is likely to be a time and/or cost impact if the issue is not resolved in a reasonable timeframe, but do not overstate entitlement.

Rules:
- Do not include contract clause references.
- Do not invent facts.
- Do not exaggerate.
- Use professional UK construction tone.
- Use clear paragraphs, not bullet points, for the narrative.
- Avoid generic AI wording.
- Avoid unnecessary repetition.
- Write as if the user's subcontractor business is giving early warning. If no company name is provided, use "the Subcontractor" rather than inventing a real company.
- Keep the output concise but commercially useful.
- Return valid JSON only.

Return this JSON shape exactly:
{
  "narrative": "full EWN narrative as paragraphs",
  "consequences": ["commercial/programme consequence", "delivery/safety/productivity consequence", "record/next step consequence"],
  "mitigation": ["required contractor/design team action", "subcontractor mitigation/record keeping action", "follow-up action if unresolved"]
}`;

function cleanString(value: any) {
  return String(value ?? "").trim();
}

function cleanArray(value: any, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const arr = value.map((x) => cleanString(x)).filter(Boolean).slice(0, 5);
  return arr.length ? arr : fallback;
}

function extractJsonText(content: string) {
  const trimmed = String(content || "").trim();
  if (!trimmed) throw new Error("AI response was empty.");
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  }
  return trimmed;
}

export function validateGeneratedEwn(value: any): GeneratedEwn {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("AI EWN response was not a JSON object.");
  }

  const narrative = cleanString(value.narrative);
  if (!narrative) throw new Error("AI EWN response did not include a narrative.");

  return {
    narrative,
    consequences: cleanArray(value.consequences, [
      "Potential disruption to progress, productivity and programme if the matter is not resolved promptly.",
      "Potential time and/or cost impact may arise depending on the contractor/design team response and resulting instruction.",
      "Further records should be maintained to support any subsequent commercial notification.",
    ]),
    mitigation: cleanArray(value.mitigation, [
      "The contractor/design team should provide the required confirmation, instruction or design response as soon as reasonably practicable.",
      "The Subcontractor will continue to maintain records of labour, plant, materials, constraints and correspondence relating to the matter.",
      "If the matter results in a change or recoverable impact, the Subcontractor may convert the EWN into a CE for formal assessment.",
    ]),
  };
}

export function parseGeneratedEwnJson(content: string): GeneratedEwn {
  return validateGeneratedEwn(JSON.parse(extractJsonText(content)));
}

export function makeTemplateEwn(input: EwnDraftInput): GeneratedEwn {
  const issue = cleanString(input.whatHappened) || cleanString(input.title) || "the matter identified on site";
  const location = cleanString(input.where);
  const date = cleanString(input.when);
  const impact = cleanString(input.impact) || "the matter may affect progress, productivity and the commercial position of the Subcontract Works";
  const requiredAction = cleanString(input.requiredAction) || "confirmation of the required way forward";
  const evidence = cleanString(input.evidence) || "site records, photographs, allocation sheets, correspondence and associated records";
  const project = cleanString(input.projectName);

  const opening = `During the progression of the Subcontract Works${project ? ` on ${project}` : ""}, the Subcontractor has identified ${issue}${location ? ` at ${location}` : ""}${date ? ` on ${date}` : ""}.`;
  const detail = `The matter requires review as it may affect the planned method, sequence, productivity and/or safe delivery of the works. Based on the current information, the known impact is ${impact}.`;
  const action = `The Subcontractor requires ${requiredAction} so that the matter can be reviewed, mitigated and progressed without avoidable delay.`;
  const risk = `As it stands, there is a risk that the works cannot proceed as planned and that further time and/or cost impact may arise if the matter is not resolved within a reasonable timeframe.`;
  const records = `Supporting records currently include ${evidence}.`;

  return {
    narrative: [opening, detail, action, risk, records].join("\n\n"),
    consequences: [
      impact,
      "Possible disruption to planned sequence, productivity and programme if the matter is not resolved promptly.",
      "Potential requirement for further commercial notification should the matter result in a recoverable change or impact.",
    ],
    mitigation: [
      `The Subcontractor requires ${requiredAction} from the Contractor/design team as soon as reasonably practicable.`,
      "The Subcontractor will continue to maintain records of labour, plant, materials, site constraints, correspondence and instructions relating to the matter.",
      "Where practical, the Subcontractor will seek to mitigate delay and disruption without waiving entitlement to recover any resulting time or cost impact.",
    ],
  };
}

export async function generateAiEwnFromInput(input: EwnDraftInput): Promise<GeneratedEwn> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return makeTemplateEwn(input);
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o";
  const userContent = [
    "Generate an Early Warning Notice using the following user inputs as the source of truth.",
    "Do not include any contract clause references.",
    "Input JSON:",
    JSON.stringify(input, null, 2),
  ].join("\n\n");

  async function callOpenAi(extraInstruction?: string) {
    const messages = [
      { role: "system", content: COMMERCIAL_COPILOT_EWN_PROMPT },
      { role: "user", content: extraInstruction ? `${extraInstruction}\n\n${userContent}` : userContent },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.error?.message || `OpenAI request failed with status ${res.status}`;
      throw new Error(message);
    }

    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("OpenAI did not return text content.");
    return parseGeneratedEwnJson(content);
  }

  try {
    return await callOpenAi();
  } catch (firstError: any) {
    console.warn("AI EWN validation failed once, retrying:", firstError?.message || firstError);
    return await callOpenAi("Your previous output failed validation. Return valid JSON only with narrative, consequences and mitigation. Do not include contract clause references. No markdown.");
  }
}

// AI FORMAT RULES: Use paragraph breaks between sections. No single block text.
