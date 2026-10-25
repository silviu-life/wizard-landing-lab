---
name: landing-lab
description: Laborator de pagini de landing pentru orice produs. Pornește un server local cu un dashboard în care proprietarul dă brief-ul agenților (formular, comutatoare, fișiere încărcate), răspunde la câteva întrebări, apoi vede pe tot ecranul, pe calculator și pe telefon, rundele de pagini construite de agenți și le notează (Îmi place / Poate / Nu, note, exemple vizuale). Fiecare rundă pornește din tot feedback-ul de până atunci, până când proprietarul alege câștigătoarea, exportată ca pagină HTML de sine stătătoare. Se activează la /landing-lab, „landing lab”, „fă-mi variante de pagină de landing”, „iterăm pagina cu feedback-ul meu”, „generează pagini pe care să le notez”, „optimizează pagina de landing a reclamei”.
---

# Landing lab

O buclă pe care proprietarul o conduce din browser: **brief → întrebări → rundă → feedback → rundă … → câștigătoare**. Toată starea stă în fișiere, într-un singur dosar de lucru; dashboard-ul și agenții comunică doar prin fișierele astea.

```
<ws>/brief.json  questions.json  answers.json  uploads/
<ws>/rounds/<n>/plan.json  <slug>/{index.html,meta.json,desktop.png,mobile.png}  feedback.json
<ws>/winner.json  winner/{index.html,uploads/,assets/}
```

Mai jos, `SKILL_DIR` e directorul acestui skill. Serverul e `scripts/server.py`, dashboard-ul `assets/dashboard.html`, toată bucla `scripts/lab.workflow.js`, iar verificarea paginilor `scripts/shot.py` (capturi pe calculator și pe telefon, erori din consolă, imagini lipsă, conținut care iese din ecran).

Dashboard-ul și tot ce se scrie pentru proprietar (întrebări, rezumatele rundelor, titlurile și ideile paginilor) sunt în română. Vorbește cu proprietarul în română. Paginile de landing sunt în limba publicului lor, care poate să nu fie româna.

## 1. Pornire

Întâi verifică uneltele: `uv --version` și `uv run --with playwright python -c "from playwright.sync_api import sync_playwright as p; pw=p().start(); pw.chromium.launch().close(); pw.stop()"`. Dacă una pică, oprește-te și rulează skill-ul `wizard-landing-lab:landing-lab-install` (explică și instalează, cu acordul proprietarului), apoi revino aici.

1. Dosarul de lucru (`<ws>`): `<proiect>/.landing-lab/<nume-scurt>/`, dacă userul nu numește altul. Adaugă `.landing-lab/` în `.gitignore`-ul proiectului dacă nu e deja acoperit (paginile generate și fișierele încărcate sunt mari). Ca să continui un laborator mai vechi, folosește același dosar: dashboard-ul reia de unde au rămas fișierele.
2. Pornește serverul în fundal (Bash sau PowerShell cu `run_in_background`):
   `uv run "SKILL_DIR/scripts/server.py" --workspace "<ws>" --open`
   Adaugă `--assets "<dosar>"` când proiectul are deja un dosar de imagini pe care paginile le pot folosi (servite la `/assets/<nume>`). Serverul pornește de la portul 8790 și, dacă e ocupat, ia următorul liber; cu `--open` deschide singur dashboard-ul în browser (Windows, macOS, Linux, WSL). Citește din ieșirea lui primul rând, `Landing lab on http://localhost:<port>`: de acolo iei portul.
3. Spune-i proprietarului adresa și să completeze brief-ul acolo, apoi treci imediat la pasul 2, fără să aștepți.

Pe orice sistem (Windows cu Git Bash sau PowerShell, macOS, Linux, WSL) scrie căile cu `/` (pe Windows `C:/Users/...`) și pune-le între ghilimele, pentru că pot avea spații. Aceleași comenzi merg în Bash și în PowerShell.

## 2. Pornește bucla: un singur workflow, fără să aștepți tu

Toată bucla (brief → întrebări → răspunsuri → rundă → feedback → rundă … → câștigătoare) e un singur workflow. Pornește-l o dată și nu aștepta nimic tu:

`Workflow({scriptPath: "SKILL_DIR/scripts/lab.workflow.js", args: {workspace: "<ws>", port: <portul din rândul serverului>, skill_dir: "SKILL_DIR", start: 1}})`

- `start` e prima rundă care nu e construită încă: 1 la un laborator nou. Ca să reiei un laborator, folosește cel mai mare număr din `<ws>/rounds/` plus unu; bucla așteaptă întâi feedback-ul rundei dinainte.
- Așteptarea o fac agenți mici. Fiecare rulează `uv run wait.py <fișier> 540` de până la 6 ori (~1 oră) și raportează „găsit”, „încă nu” (codul 3) sau o eroare, care oprește workflow-ul, iar scriptul pornește altul până apare fișierul. Un agent nou costă ~56k tokeni de context, iar o repetare în același agent e ieftină, de aceea un agent pe oră, nu unul pe apel. Așteptarea totală nu are capăt: proprietarul poate răspunde după ore sau zile. Nu da niciodată toată așteptarea unui singur agent: odată un agent a renunțat la jumătate și bucla a mers mai departe fără feedback-ul proprietarului.
- Agentul de întrebări scrie `questions.json` (o listă goală când `brief.ask_questions` e false sau nu lipsește nimic). Bucla așteaptă `answers.json` doar când există întrebări.
- Fazele se repetă la fiecare rundă: **Idei** (agentul de întrebări, apoi câte un agent de idei pe rundă), **Construcție** (câte un constructor pe pagină), **Așteptare** (orice așteptare după proprietar). Fiecare rundă plănuiește `brief.per_round` pagini din brief, răspunsuri, fișiere și tot feedback-ul anterior și le construiește în paralel. Dashboard-ul se umple singur, deci proprietarul nu are nevoie de niciun mesaj de la tine între runde.
- Dacă o rundă pică la jumătate, oprește workflow-ul și pornește-l din nou cu runda aceea ca `start`: constructorii își suprascriu propriile dosare, iar dashboard-ul marchează o pagină gata doar după ce există `meta.json`.

Workflow-ul se termină cu `{winner: {round, slug}, path, meta}` când e aleasă o pagină, sau cu `{stopped: "max_rounds"}` după `brief.max_rounds` runde. În al doilea caz, întreabă-l pe proprietar dacă mai continuăm și, dacă da, pornește din nou cu `start: max_rounds + 1`.

## 3. Câștigătoarea

Serverul exportă pagina aleasă în momentul în care vine feedback-ul: `<ws>/winner/index.html`, cu fișierele încărcate și imaginile folosite copiate lângă ea și cu linkurile refăcute, plus `<ws>/winner.json`. Dashboard-ul arată „Deschide pagina” și „Descarcă HTML-ul și fișierele” (`/api/winner.zip`).

Dă-i proprietarului calea absolută a lui `winner/index.html` și lista `needs` din `meta.json`-ul paginii (datele sau backend-ul de care are nevoie pagina). Mutarea ei într-un proiect de cod e o sarcină separată: propune-o, nu o începe.

Lasă serverul pornit până când proprietarul spune să-l oprești.
