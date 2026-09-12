# AI Request Triage Assistant

A lightweight, zero-backend prototype that turns an unstructured client request (email,
web form, chat) into a clear, actionable next step: a summary, a category, a priority with
reason, a routing owner, and a draft first response — all in one screen.

Built for the Node Solutions AI Technical Challenge ("Stage Two — AI Request Triage Assistant").

**Live demo:** enable GitHub Pages on this repo (see [Deployment](#deployment)) and it will
be served at `https://<your-username>.github.io/<repo-name>/`.

## What it does

Given a request like:

> "We accidentally uploaded a spreadsheet containing customer contact information to the
> wrong workspace. We need immediate help removing access."

It returns:

- **Summary** — a one-line extractive summary of the request.
- **Category** — Sales, Support, Billing, Technical, or Other.
- **Priority** — Low, Medium, High, or Urgent, with a plain-language reason.
- **Owner** — Sales Team, Client Success, Finance, or Engineering.
- **Draft response** — an editable, professional first-reply the team can send.

## How it works (architecture)

The whole app is static HTML/CSS/JS with no server, no build step, and no required API keys —
so it runs entirely in the browser and deploys directly to GitHub Pages.

```
index.html        UI shell (textarea, example picker, results panel)
styles.css        Styling
triageEngine.js    Deterministic rule-based "AI" — classification, priority scoring,
                   routing, summarization, response drafting
app.js             Wires the UI to the engine, mock examples, optional AI enhancement
```

### Why rule-based instead of calling an LLM for the core decision?

- **Zero cost** — the challenge explicitly asks not to spend money; this needs no API key
  and no server to run the core workflow.
- **Fully explainable** — every category/priority/routing decision traces back to a specific
  matched keyword or pattern (see `priorityReason` in the UI), which matters for a tool that
  humans need to trust, audit, and override.
- **Deterministic** — the same request always produces the same triage result, which is
  important for consistency across a support team.
- **GitHub Pages friendly** — no backend means no server cost and no secrets to manage for
  the graded/reviewed deployment.

**Classification logic:** keyword/phrase dictionaries per category (Billing, Sales, Technical,
Support), the category with the most matches wins, ties broken by a fixed priority order.

**Priority logic:** an additive score from signals — explicit urgency language ("asap",
"immediately"), service-outage language ("down", "unavailable", "cannot access"), near-term
deadlines ("before Friday"), and a special override for data/security-incident language
(e.g. "accidentally uploaded... to the wrong workspace") which always forces **Urgent** +
**Technical** + **Engineering**, since exposed customer data is a compliance-sensitive issue
regardless of how it's categorized.

**Routing logic:** category → owner mapping (Sales → Sales Team, Billing → Finance,
Technical → Engineering, Support/Other → Client Success), with the security override above
taking precedence.

**Response drafting:** category- and detail-aware templates (e.g. it pulls an invoice number
like `NS-1048` or a mentioned deadline day out of the text and drops it into the reply).

### Optional AI enhancement (bring your own key)

The "Optional: enhance wording with your own OpenAI key" panel lets you paste your own
OpenAI API key (stored only in your browser's `localStorage`, never committed or sent
anywhere except directly to OpenAI's API from your browser). If present, it calls
`gpt-4o-mini` to **polish the wording only** — it is explicitly instructed not to change the
category, priority, or owner, so the deterministic decision stays auditable while the prose
can sound more natural. This is entirely optional and the app works fully without it.

## Handling the 6 mock requests

All six requests in the challenge are built into the "Load a mock request…" dropdown for a
one-click demo, including request 05 (the accidental data exposure case, which is deliberately
the one case designed to override every other signal and force Urgent/Engineering).

## Running locally

No install required — it's static files. Either:

- Open `index.html` directly in a browser, or
- Serve it locally, e.g. `npx serve .` or `python -m http.server`, then visit the printed URL.

## Deployment

This repo includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) that
deploys the static site to GitHub Pages automatically on every push to `main`.

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main` (or re-run the workflow) — the site will be published at
   `https://<your-username>.github.io/<repo-name>/`.

## Decisions & tradeoffs

- Chose a deterministic rule-based engine over a required LLM call so the tool is free to run,
  fast, explainable, and deployable with zero backend/secrets on GitHub Pages.
- Kept the optional LLM integration client-side and wording-only, so it can never silently
  change a routing/priority decision — it's an enhancement, not a dependency.
- Kept the UI to a single screen (input → analyze → result) to match the "simple to understand
  and use" evaluation criterion rather than building multi-page tooling.

## Limitations & what I'd improve next

- Keyword-based classification can miss paraphrased or multi-lingual requests; a production
  version would benchmark this against an LLM classifier and possibly use the LLM as a
  fallback when keyword confidence is low.
- No persistence/queue — each request is triaged independently; a real tool would log
  requests, track SLA timers per priority, and support handoff between owners.
- No authentication — fine for a demo, not for production use with real client data (the
  challenge explicitly asks to only use the provided mock requests).
- The security-incident override is intentionally aggressive (regex-based); it should be
  tuned against a larger, real-world sample of requests to reduce false positives/negatives.

## License

MIT — see [LICENSE](LICENSE).
