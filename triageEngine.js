/**
 * Triage Engine - deterministic, explainable NLP heuristics for request triage.
 *
 * Why rule-based instead of calling a paid LLM by default?
 * - Zero cost, zero API key, works fully offline in the browser (GitHub Pages friendly).
 * - Fully explainable/auditable: every decision traces back to a matched keyword or pattern.
 * - Deterministic: same input always produces the same category/priority/routing,
 *   which matters for a triage tool that humans need to trust and debug.
 *
 * app.js optionally layers an LLM call on top of this (see enhanceWithAI) purely to
 * polish the *wording* of the summary/response - never to change the underlying decision.
 */

const CATEGORY_KEYWORDS = {
  Billing: [
    "invoice",
    "charge",
    "charged",
    "overcharge",
    "overcharged",
    "billing",
    "payment",
    "refund",
    "duplicate charge",
    "paid twice",
    "subscription fee",
    "credit card",
    "receipt",
    "pricing error",
  ],
  Sales: [
    "pricing",
    "quote",
    "demo",
    "interested in",
    "purchase",
    "buy",
    "buying",
    "custom solution",
    "custom ai",
    "timeline",
    "cost estimate",
    "upgrade our plan",
    "new client",
    "prospective",
    "how much would",
    "typical timeline",
  ],
  Technical: [
    "bug",
    "error",
    "crash",
    "down",
    "outage",
    "unavailable",
    "not working",
    "broken",
    "integration",
    "api",
    "login issue",
    "access denied",
    "portal",
    "cannot access",
    "can't access",
    "system",
    "malfunction",
    "glitch",
  ],
  Support: [
    "help",
    "question",
    "how do i",
    "feature request",
    "account",
    "assistance",
    "automate",
    "automation",
    "show us how",
    "training",
    "dark mode",
    "dashboard",
    "idea",
    "suggestion",
    "onboard",
  ],
};

// Security / data-incident language forces Technical + Urgent regardless of other signals.
const SECURITY_PATTERN = new RegExp(
  "(accidentally (uploaded|shared|sent|exposed))|" +
    "(wrong (workspace|folder|person|place))|" +
    "(data (breach|leak|exposure))|" +
    "(unauthorized access)|" +
    "(remove(d)? access)|" +
    "(customer (contact|data|information).{0,40}(wrong|expos|leak))",
  "i",
);

const URGENT_PHRASES = [
  "immediately",
  "immediate",
  "as soon as possible",
  "asap",
  "urgent",
  "critical",
  "right away",
  "emergency",
];

const OUTAGE_PHRASES = [
  "down",
  "outage",
  "unavailable",
  "cannot access",
  "can't access",
  "not working",
];

const NEAR_DEADLINE_PATTERN =
  /\b(before|by|due)\b.{0,40}\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of day|eod)\b/i;
const FUTURE_MEETING_PATTERN =
  /\b(next week|no deadline|whenever|future update|collecting ideas)\b/i;
const INVOICE_PATTERN = /\b([A-Z]{1,4}-\d{2,6})\b/;
const DEADLINE_DAY_PATTERN =
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|end of day|eod)\b/i;

const OWNER_BY_CATEGORY = {
  Sales: "Sales Team",
  Billing: "Finance",
  Technical: "Engineering",
  Support: "Client Success",
  Other: "Client Success",
};

function countMatches(text, phrases) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const phrase of phrases) {
    if (lower.includes(phrase)) matched.push(phrase);
  }
  return matched;
}

function classifyCategory(text) {
  let best = { category: "Other", score: 0, matched: [] };
  // Priority order used only to break ties consistently.
  const order = ["Technical", "Billing", "Sales", "Support"];
  for (const category of order) {
    const matched = countMatches(text, CATEGORY_KEYWORDS[category]);
    if (matched.length > best.score) {
      best = { category, score: matched.length, matched };
    }
  }
  return best;
}

function extractDetails(text) {
  const invoiceMatch = text.match(INVOICE_PATTERN);
  const deadlineMatch = text.match(DEADLINE_DAY_PATTERN);
  return {
    invoiceRef: invoiceMatch ? invoiceMatch[1] : null,
    deadline: deadlineMatch ? deadlineMatch[1] : null,
    isSecurityIncident: SECURITY_PATTERN.test(text),
    isNearDeadline: NEAR_DEADLINE_PATTERN.test(text),
    isFutureRequest: FUTURE_MEETING_PATTERN.test(text),
    hasOutageLanguage: countMatches(text, OUTAGE_PHRASES).length > 0,
    hasUrgentLanguage: countMatches(text, URGENT_PHRASES).length > 0,
  };
}

function scorePriority(details) {
  const reasons = [];
  let score = 0;

  if (details.isSecurityIncident) {
    score += 4;
    reasons.push("data/security incident language detected");
  }
  if (details.hasUrgentLanguage) {
    score += 3;
    reasons.push('explicit urgency wording (e.g. "as soon as possible")');
  }
  if (details.hasOutageLanguage) {
    score += 2;
    reasons.push("service outage / inaccessibility affecting operations");
  }
  if (details.isNearDeadline) {
    score += 2;
    reasons.push("near-term deadline mentioned");
  }
  if (details.isFutureRequest) {
    score -= 1;
    reasons.push("no deadline / future-looking request");
  }

  let level;
  if (score >= 6) level = "Urgent";
  else if (score >= 3) level = "High";
  else if (score >= 1) level = "Medium";
  else level = "Low";

  const reason =
    reasons.length ?
      reasons.join("; ")
    : "no urgency indicators found; treated as routine";

  return { level, reason };
}

function routeOwner(category, isSecurityIncident) {
  if (isSecurityIncident) return "Engineering";
  return OWNER_BY_CATEGORY[category] || "Client Success";
}

function summarize(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  const sentences = clean.split(/(?<=[.!?])\s+/);
  let summary = sentences[0];
  if (summary.length < 60 && sentences[1]) {
    summary += " " + sentences[1];
  }
  if (summary.length > 180) {
    summary = summary.slice(0, 177).trim() + "...";
  }
  return summary;
}

function draftResponse({ category, priority, owner, details }) {
  const greeting = "Hi there,\n\nThank you for reaching out.";
  const closing = `\n\nBest regards,\n${owner}`;
  let body;

  if (details.isSecurityIncident) {
    body =
      "We understand this involves potentially exposed customer information and are treating it as our top priority. " +
      "Our Engineering team is restricting access now and will confirm remediation shortly.";
  } else {
    switch (category) {
      case "Billing":
        body =
          details.invoiceRef ?
            `We're looking into ${details.invoiceRef} right away${details.deadline ? ` and will resolve it before ${details.deadline}` : ""}. Our Finance team will follow up with a corrected summary.`
          : "We're reviewing the billing concern you raised and our Finance team will follow up with details shortly.";
        break;
      case "Technical":
        body =
          details.hasOutageLanguage ?
            "We're sorry for the disruption. Our Engineering team has been notified and is actively investigating the outage. We'll share an update as soon as service is restored."
          : "Thanks for flagging this. Our Engineering team will look into the issue and follow up with next steps.";
        break;
      case "Sales":
        body =
          "Thanks for your interest! Our Sales team would love to learn more about your needs and discuss pricing and timelines. We'll reach out shortly to find a time that works for you.";
        break;
      case "Support":
        body =
          priority === "Low" ?
            "Thanks for the suggestion - we've logged it with our Client Success team for consideration in a future update."
          : "Thanks for reaching out. Our Client Success team has logged your request and will follow up shortly with next steps.";
        break;
      default:
        body =
          "Thank you for your message. We've routed this to the right team and will follow up shortly.";
    }
  }

  return `${greeting}\n\n${body}${closing}`;
}

function triage(text) {
  if (!text || !text.trim()) {
    throw new Error("Request text is required.");
  }

  const details = extractDetails(text);
  const catResult = classifyCategory(text);
  const category =
    details.isSecurityIncident ? "Technical" : catResult.category;
  const priorityResult = scorePriority(details);
  const owner = routeOwner(category, details.isSecurityIncident);
  const summary = summarize(text);
  const response = draftResponse({
    category,
    priority: priorityResult.level,
    owner,
    details,
  });

  return {
    summary,
    category,
    categoryMatched: catResult.matched,
    priority: priorityResult.level,
    priorityReason: priorityResult.reason,
    owner,
    response,
    details,
  };
}

// Exposed as a plain global for use from app.js without a build step.
window.TriageEngine = {
  triage,
  classifyCategory,
  scorePriority,
  routeOwner,
  summarize,
  draftResponse,
  extractDetails,
};
