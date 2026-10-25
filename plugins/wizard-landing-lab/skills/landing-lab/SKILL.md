---
name: landing-lab
description: Iterative landing-page lab for any product. Starts a local Python server with a dashboard where the owner briefs the agents (form, toggles, file uploads), answers follow-up questions, then reviews rounds of agent-built landing pages full screen at desktop and mobile size and rates each (Love/Maybe/No, notes, visual references). Every round is designed from all feedback so far, until the owner picks a winner, which is exported as a standalone HTML page. Use on /landing-lab, "landing lab", "design landing page variants", "iterate on the landing page with my feedback", "generate landing pages I can rate", "optimize the ad landing page".
---

# Landing lab

A loop the owner drives from a browser: **brief → questions → round → feedback → round … → winner**. All state is files in one workspace folder; the dashboard and the agents only share those files.

```
<workspace>/brief.json  questions.json  answers.json  uploads/
<workspace>/rounds/<n>/plan.json  <slug>/{index.html,meta.json,desktop.png,mobile.png}  feedback.json
<workspace>/winner.json  winner/{index.html,uploads/,assets/}
```

`SKILL_DIR` below is this skill's folder. The server is `scripts/server.py`, the dashboard `assets/dashboard.html`, the whole loop is `scripts/lab.workflow.js`, the page check `scripts/shot.py` (desktop + mobile screenshots, console errors, broken images, overflow).

The dashboard and everything written for the owner (questions, round summaries, page titles and ideas) is in Romanian; talk to the owner in Romanian. The landing pages themselves use the language of their audience.

## 1. Start

First check the tools: `uv --version` and `uv run --with playwright python -c "from playwright.sync_api import sync_playwright as p; pw=p().start(); pw.chromium.launch().close(); pw.stop()"`. If either fails, stop and run the `wizard-landing-lab:landing-lab-install` skill (it explains and installs, with the owner's consent), then continue here.

1. Workspace: `<project>/.landing-lab/<short-name>/` unless the user names one. Add `.landing-lab/` to the project's `.gitignore` if it is not covered (generated pages and uploads are large). To continue an earlier lab, reuse its workspace: the dashboard resumes from whatever files exist.
2. Free port (default 8790; check with `ss -ltn`). Start the server with Bash `run_in_background`:
   `uv run SKILL_DIR/scripts/server.py --workspace <ws> --port <port>`
   Add `--assets <dir>` when the project already has an image folder the pages may use (served at `/assets/<name>`).
3. Open `http://localhost:<port>` for the owner: WSL `/mnt/c/Windows/System32/cmd.exe /c start "" <url>`, macOS `open <url>`, Linux `xdg-open <url>`. Tell them to fill in the brief there, then go straight to 2 without waiting for it.

## 2. Run the loop — one workflow, no main-session waiting

The whole loop (brief → questions → answers → round → feedback → round … → winner) is one workflow. Start it once and do not wait on anything yourself:

`Workflow({scriptPath: "SKILL_DIR/scripts/lab.workflow.js", args: {workspace: "<ws>", port: <port>, skill_dir: "SKILL_DIR", start: 1}})`

- `start` is the first round still to build: 1 for a new lab. To resume a lab, use the highest number in `<ws>/rounds/` plus one; the loop then first waits for that round's feedback.
- Waiting is done by small agents that each repeat `uv run wait.py <file> 540` up to 6 times (~1 hour) and report found / not yet; the script starts another until the file appears. A new agent costs ~56k tokens of context and a repeat inside one is cheap, so one agent per hour, not per call. The overall wait has no end, the owner can take hours or days. Never hand the whole wait to one agent: an agent once gave up mid-wait and the loop went on without the owner's feedback.
- The questions agent writes `questions.json` (an empty list when `brief.ask_questions` is false or nothing is missing); the loop waits for `answers.json` only when there are questions.
- Its phases repeat every round: **Ideate** (the questions agent, then one ideas agent per round), **Build** (one builder per page), **Wait** (every wait for the owner). Each round plans `brief.per_round` pages from the brief, answers, uploads and all earlier feedback and builds them in parallel; the dashboard fills in live, so the owner needs no message from you between rounds.
- If a round fails partway, stop the workflow and start it again with that round as `start`: builders overwrite their own folders and the dashboard only marks a page ready once its `meta.json` exists.

The workflow ends with `{winner: {round, slug}, path, meta}` when a page is chosen, or `{stopped: "max_rounds"}` after `brief.max_rounds`; then ask the owner whether to continue and, if yes, start again with `start: max_rounds + 1`.

## 3. Winner

The server exports the chosen page when the feedback arrives: `<ws>/winner/index.html`, with the uploads and assets it uses copied next to it and relinked, plus `<ws>/winner.json`. The dashboard shows "Open the page" and "Download HTML + files" (`/api/winner.zip`).

Give the owner the absolute path of `winner/index.html` and the page's `meta.json` "needs" list (data or backend the page assumes). Porting it into a codebase is a separate task; offer it, don't start it.

Leave the server running until the owner says to stop it.
