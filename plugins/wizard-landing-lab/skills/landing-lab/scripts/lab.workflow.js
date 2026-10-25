export const meta = {
  name: 'landing-lab',
  description: 'The whole landing lab loop: brief and questions, then plan, build and wait for the owner, round after round until a winner',
  phases: [
    { title: 'Ideate', detail: 'questions for the owner, then each round planned from the brief, answers, files and every past rating' },
    { title: 'Build', detail: 'one builder per page, verified at desktop and mobile size' },
    { title: 'Wait', detail: 'wait for the owner in the dashboard: brief, answers, then each round\'s feedback' },
  ],
}

// args: { workspace, port, skill_dir, start = 1 }  start = the first round still to build
const WS = args.workspace
const WAIT = `${args.skill_dir}/scripts/wait.py`
const SHOT = `uv run ${args.skill_dir}/scripts/shot.py`
const BASE = `http://localhost:${args.port}`
const START = args.start || 1

// The script owns the patience: each waiter repeats a bounded wait.py call for up to ~1 hour, then reports back and the loop
// starts another. One agent per hour, not per call: a fresh agent's ~56k-token context is the cost, a repeat within it is cheap.
// An agent that gives up early just reports "not yet", so the owner's answer can never be skipped.
async function waitFor(file, fields, phaseTitle) {
  const schema = {
    type: 'object',
    properties: { found: { type: 'boolean', description: 'true only if wait.py printed the file and exited 0' }, ...fields },
    required: ['found'],
  }
  for (let attempt = 1; ; attempt++) {
    const r = await agent(`Run exactly this command with the Bash tool, timeout 600000, NOT in the background:
uv run --quiet ${WAIT} ${WS}/${file} 540
Exit code 2 means the file has not appeared yet: run the same command again, up to 6 runs in total, saying nothing in between.
Exit code 0 means it printed the file's JSON: stop and return {"found": true} plus the requested fields read from that JSON.
If all 6 runs exit 2, return {"found": false}.
Do not create, edit or delete any file.`,
      { label: `wait:${file}#${attempt}`, phase: phaseTitle, schema, model: 'haiku', effort: 'low' })
    if (r?.found) return r
    log(`Still waiting for ${file} (about ${attempt} h)`)
  }
}

const LANG = 'Language: the owner reads the dashboard in Romanian, so everything written for the owner (questions, plan summary, page titles, idea, mechanics, needs, your final report) is in Romanian with correct diacritics. The landing pages themselves are written in the language of their audience per the brief, which may not be Romanian.'

const SOURCES = `
Everything about this project is in the lab workspace ${WS} — read it, do not rely on any other project files unless the brief points at them:
- brief.json: the owner's brief (product, audience, offer, action, form fields, true claims, forbidden claims, brand, tone, references, traffic = where visitors arrive, per_round, notes) and files[] ({path, name, note, use: "page" | "reference"}).
- answers.json (may be missing): answers to follow-up questions; questions.json has the questions.
- uploads/: every uploaded file; a file's path "/uploads/x" is uploads/x on disk. Look at every image with the Read tool, read PDFs/docs too. Files with use "page" may appear in designs; "reference" files are inspiration only.
- rounds/<n>/plan.json, rounds/<n>/<slug>/meta.json + desktop.png/mobile.png, rounds/<n>/feedback.json: previous rounds and the owner's feedback (rating love/maybe/no, notes, reference files per page and per round, general notes). A round without feedback.json was not rated — do not invent feedback for it.
- If the server was started with an assets folder, its images are at ${BASE}/assets/<name> (GET ${BASE}/api/state lists them under "assets").
${LANG}
`

const CRAFT = `
Landing-page craft (defaults; anything in the brief or feedback overrides them):
- One page, one action. The action's form or button is the focal point: on desktop it is visually dominant and stays reachable; on mobile it comes early.
- Buttons obviously look like buttons (solid fill, verb label, generous size, hover + visible focus). The next step is always obvious.
- Accessible: WCAG AA contrast, visible labels on every input, focus rings, 44px tap targets, semantic headings, logical tab order.
- Direct-response mechanics (urgency, scarcity, social proof, risk reversal, price anchoring, progress, deadlines) ONLY when true per the brief. Never invent numbers, reviews, testimonials, guarantees or resetting timers. Anything that needs data or backend that does not exist goes in meta.json "needs".
- Never use a claim from the "forbidden" list. When unsure whether a claim is true, leave it out.
- Copy is real and specific, never lorem ipsum.
`

const planSchema = ROUND => ({
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'one paragraph for the owner: what this round explores and how it uses the feedback so far' },
    variants: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'object', properties: {
      slug: { type: 'string', description: `kebab-case, starts with "r${ROUND}-", unique across all rounds` },
      title: { type: 'string' },
      concept: { type: 'string', description: 'the layout idea and why it should convert' },
      layout: { type: 'string', description: 'concrete desktop and mobile structure, section order, where the action sits' },
      mechanics: { type: 'array', items: { type: 'string' } },
      copy: { type: 'string', description: 'angle, headline and key copy direction' },
      references: { type: 'array', items: { type: 'string' }, description: 'uploaded files the builder should look at or use, as /uploads/... paths' } },
      required: ['slug', 'title', 'concept', 'layout', 'mechanics', 'copy', 'references'] } },
  },
  required: ['summary', 'variants'],
})

async function runRound(ROUND) {
  const plan = await agent(`${SOURCES}
  You are the IDEAS agent for round ${ROUND} of a landing-page lab. Read the whole workspace first. If brief.current_url is set, screenshot it with: ${SHOT} <current_url> ${WS}/rounds/${ROUND} --prefix _current- — and look at both images.
  ${ROUND === 1
    ? 'Round 1: make the pages genuinely different from each other — different layout, dominant mechanic and angle.'
    : 'Build on what was loved, drop what was rejected, follow the round notes and the reference files literally, and never repeat a slug. Say in the summary how each page answers the feedback.'}
  ${CRAFT}
  Plan exactly brief.per_round pages (default 4). Then write ${WS}/rounds/${ROUND}/plan.json containing exactly your structured output, so the dashboard shows them as "Building…". Do not create the page folders.`,
    { label: `ideas:r${ROUND}`, phase: 'Ideate', schema: planSchema(ROUND), effort: 'high' })
  if (!plan) throw new Error('ideas agent failed')
  log(`Round ${ROUND}: ${plan.variants.map(v => v.title).join(' · ')}`)

  const built = await parallel(plan.variants.map(v => () => agent(`${SOURCES}
  You are a BUILDER in round ${ROUND}. Build this one landing page:
  ${JSON.stringify(v, null, 1)}
  Round context: ${plan.summary}
  ${CRAFT}
  Write ONLY inside ${WS}/rounds/${ROUND}/${v.slug}/:
  1. index.html — ONE self-contained file with inline CSS and JS. Google Fonts allowed. Images only from /uploads/<name> (files with use "page") or /assets/<name>; reference them with those absolute paths (the winner export rewrites them). The form or action is an interactive mock: it validates and then shows an inline "This is a preview, nothing was sent" note; never call a real API. Load the frontend-design:frontend-design skill for craft guidance if it is available.
  2. Verify: running ${SHOT} ${BASE}/rounds/${ROUND}/${v.slug}/index.html ${WS}/rounds/${ROUND}/${v.slug} writes desktop.png and mobile.png there and prints console errors, broken images and horizontal overflow. Look at both images. Fix and re-run until there are no errors, no broken images, overflow_px is 0 on mobile and the action is the focal point.
  3. LAST write meta.json: {"title": "...", "idea": "<one sentence for the owner>", "mechanics": ["..."], "needs": ["<data/backend a mechanic needs, if any>"]}. Writing meta.json marks the page ready in the dashboard, so write it only when the page is done.
  Return one line: the URL and anything the owner should know.`,
    { label: `build:${v.slug}`, phase: 'Build' })))

  return { round: ROUND, summary: plan.summary, pages: plan.variants.map((v, i) => ({ slug: v.slug, title: v.title, url: `${BASE}/rounds/${ROUND}/${v.slug}/index.html`, report: built[i] })) }
}

const brief = await waitFor('brief.json', {
  max_rounds: { type: 'number', description: 'max_rounds as a number (default 10 if missing)' },
  ask_questions: { type: 'boolean', description: 'ask_questions (default true if missing)' },
}, 'Wait')
const MAX = brief.max_rounds || 10

if (START === 1) {
  const q = await agent(`You prepare the follow-up questions of a landing-page lab whose workspace is ${WS}.
If ${WS}/questions.json already exists, change nothing and return the number of questions in it.
${brief.ask_questions === false
  ? `The owner turned questions off: write ${WS}/questions.json as {"questions": []} and return 0.`
  : `Read ${WS}/brief.json and every file in ${WS}/uploads/ (look at images with Read). Then write ${WS}/questions.json:
{"intro": "one line", "questions": [
  {"id": "price_anchor", "label": "…?", "help": "why it matters", "type": "single", "options": ["…", "…"], "allow_other": true},
  {"id": "tone", "label": "…", "type": "multi", "options": ["…"]},
  {"id": "has_reviews", "label": "…", "type": "toggle", "toggle_label": "Yes, with permission"},
  {"id": "story", "label": "…", "type": "text"},
  {"id": "photos", "label": "…", "type": "file"}
]}
At most 6 questions, only about gaps that change the designs (truth of a claim, the real offer, assets they have). Prefer single/multi/toggle over free text. Write the intro and every label, help, option and toggle_label in Romanian with correct diacritics: the owner reads them in a Romanian dashboard. If nothing is missing, write {"questions": []}. Return the number of questions.`}`,
    { label: 'questions', phase: 'Ideate', schema: { type: 'object', properties: { count: { type: 'number' } }, required: ['count'] } })
  if (q?.count) await waitFor('answers.json', {}, 'Wait')
}

for (let n = START; ; n++) {
  if (n > 1) {
    const fb = await waitFor(`rounds/${n - 1}/feedback.json`, {
      chosen: { type: 'string', description: 'the "chosen" value, or "" if it is null or missing' },
    }, 'Wait')
    if (fb.chosen) {
      return { winner: { round: n - 1, slug: fb.chosen }, path: `${WS}/winner/index.html`, meta: `${WS}/rounds/${n - 1}/${fb.chosen}/meta.json` }
    }
  }
  if (n > MAX) return { stopped: 'max_rounds', rounds: MAX }
  const r = await runRound(n)
  log(`Round ${n} ready: ${r.pages.map(p => p.title).join(' · ')}`)
}
