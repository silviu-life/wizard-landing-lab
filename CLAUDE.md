# wizard-landing-lab

Marketplace Claude Code (`.claude-plugin/marketplace.json`) cu un singur plugin, `plugins/wizard-landing-lab`. Test local: `claude --plugin-dir plugins/wizard-landing-lab`. Orice schimbare publicată cere `version` crescut în `plugins/wizard-landing-lab/.claude-plugin/plugin.json`.

- `skills/landing-lab`: laboratorul. `scripts/server.py` (dashboard + fișiere, doar biblioteca standard), `assets/dashboard.html` (interfața, în română), `scripts/lab.workflow.js` (toată bucla, ca Workflow), `scripts/wait.py` (așteaptă un fișier), `scripts/shot.py` (capturi desktop/telefon cu Playwright și verificări).
- `skills/landing-lab-install`: instalează, cu acordul userului, ce îi trebuie laboratorului.

Scripturile se rulează cu `uv run` și trebuie să meargă la fel pe Windows (PowerShell și Git Bash), macOS, Linux și WSL: fișierele se citesc și se scriu în UTF-8, căile se pun între ghilimele, iar `wait.py` iese cu 3 (nu 2, pe care îl folosește uv la erori) când fișierul nu a apărut. Tot ce vede userul e în română; paginile generate sunt în limba publicului lor.
