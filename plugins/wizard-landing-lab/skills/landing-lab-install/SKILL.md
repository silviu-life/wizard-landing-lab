---
name: landing-lab-install
description: Pregătește calculatorul pentru skill-ul landing-lab. Află ce sistem de operare are userul, verifică tot ce lipsește (uv, Python, Chromium pentru Playwright, librăriile de sistem, plugin-ul frontend-design, Workflow-urile din Claude Code), explică fiecare componentă cu metafore, pe înțelesul unui om fără cunoștințe tehnice, și instalează fiecare piesă doar după ce userul spune „da”. Se activează la /landing-lab-install, „instalează ce trebuie pentru landing lab”, „pregătește-mi calculatorul”, „de ce am nevoie ca să meargă laboratorul”, „nu-mi merge landing-lab, lipsește ceva”.
---

# landing-lab-install

Pregătește calculatorul ca să meargă `/landing-lab`. `<skill>` e directorul de bază al acestui skill, afișat la încărcare; skill-ul laboratorului e alături, în `<skill>/../landing-lab`.

Userul probabil nu e tehnic și poate nu știe deloc ce se întâmplă. Vorbește în română, simplu, cu fraze scurte. Fiecare program îl explici printr-o metaforă din atelierul de mai jos; termenul tehnic apare doar o dată, în paranteză.

## Metafora de bază: atelierul de croitorie

Folosește-o peste tot, ca userul să vadă cum se leagă piesele:

> Laboratorul e un atelier de croitorie pentru pagini de internet. Tu ești clientul: dai măsurile (brief-ul), croitorii (agenții Claude) coc mai multe modele, tu vii la probă (dashboard-ul), spui ce-ți place și ce nu, și ei fac runda următoare până găsești haina potrivită (pagina câștigătoare).

Fiecare componentă are rolul ei în atelier:

| Componentă | Rolul în atelier | Ce face concret în proiect |
|---|---|---|
| **uv** | **Magazionerul.** Aduce exact uneltele potrivite, în versiunea potrivită, și le ține pe raftul lui, fără să le amestece cu lucrurile din casă. | Descarcă Python și bibliotecile și pornește scripturile laboratorului (serverul, paznicul care așteaptă, fotograful), fiecare cu ce-i trebuie. |
| **Python** | **Curentul din atelier.** Fără el nu se aprinde lumina la recepție și nu merge nicio mașină de cusut. | Limbajul în care sunt scrise serverul (recepția care îți arată dashboard-ul și îți primește notele) și paznicul care anunță când ai trimis feedback-ul. |
| **Playwright + Chromium** | **Manechinele și aparatul foto.** Fiecare haină e probată pe un manechin mare (calculator) și pe unul mic (telefon) și fotografiată, ca să se vadă dacă s-a rupt vreo cusătură. | Un browser separat, pe care agenții îl deschid singuri: fac capturi la fiecare pagină pe desktop și pe telefon, caută erori, imagini lipsă și bucăți care ies din ecran. Nu atinge Chrome-ul tău, istoricul sau parolele. |
| **Librăriile de sistem** (doar Linux/WSL, doar dacă Chromium nu pornește) | **Prizele pentru reflectoare.** Aparatul foto e gata, dar atelierul nu are prizele în care să-l bage. | Câteva piese ale sistemului de care Chromium are nevoie ca să pornească. Cer parola calculatorului, de aceea comanda o scrii tu. |
| **Plugin-ul frontend-design** (opțional) | **Cartea de croitorie a meșterilor.** Fără ea croitorii tot cos, dar cu ea au tipare mai bune. | Ghidul de design pe care îl citesc agenții care construiesc paginile: tipografie, culori, cum să nu arate ca un șablon. |
| **Workflow-urile din Claude Code** | **Șeful de atelier.** Ține caietul: cine lucrează la ce model, când vine clientul la probă și cine se apucă de runda următoare. | Unealta care rulează toată bucla laboratorului singură (gânduri → construcție → așteptare → runda următoare). Vine cu Claude Code, nu se instalează separat. |

## Pasul 1. Ce sistem are userul

Află întâi în ce terminal rulezi comenzile, apoi sistemul:

- **Bash** (Linux, macOS, WSL sau Git Bash pe Windows): `uname -s`. `Linux` → verifică și `grep -qi microsoft /proc/version` (dacă găsește, e WSL, un Linux care trăiește în Windows). `Darwin` → macOS. `MINGW…` sau `MSYS…` → Windows cu Git Bash.
- **PowerShell** (Windows): `$PSVersionTable.Platform` e gol sau `Win32NT` → Windows cu PowerShell.

Spune-i userului într-un rând ce ai găsit și ce înseamnă, de exemplu: „Ești pe Windows, dar lucrăm în WSL, adică într-o cameră cu Linux din calculatorul tău. Comenzile de mai jos sunt pentru camera asta.”

Pe toate sistemele, comenzile din tabel sunt aceleași, cu excepția instalării lui uv (coloana „Instalare”, rândul 1) și a librăriilor de sistem (doar Linux/WSL). Căile le scrii cu `/` și între ghilimele.

**După ce instalezi uv**, terminalul tău nu îl vede încă (fiecare comandă pornește cu setările vechi). Până la sfârșitul instalării, pune în fața fiecărei comenzi calea lui:
- Bash (Linux, macOS, WSL, Git Bash): `export PATH="$HOME/.local/bin:$PATH"; uv ...`
- PowerShell: `$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"; uv ...`
La final spune-i userului să repornească Claude Code, ca uv să fie găsit direct.

## Pasul 2. Verifică totul, fără să instalezi nimic

Rulează toate verificările, apoi arată-i userului un tabel: componentă, ✓ există / ✗ lipsește, și rolul ei din atelier într-o propoziție.

| # | Componentă | Verificare | Instalare |
|---|---|---|---|
| 1 | uv | `uv --version` | Linux / macOS / WSL: `curl -LsSf https://astral.sh/uv/install.sh \| sh`. Windows, atât din PowerShell cât și din Git Bash: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 \| iex"`. ~30 MB, sub un minut. |
| 2 | Python 3.10+ | `uv python find ">=3.10"` | `uv python install 3.12`. ~50 MB, într-un folder al lui uv, nu atinge Python-ul sistemului. |
| 3 | Playwright + Chromium | `uv run --with playwright python -c "from playwright.sync_api import sync_playwright as p; pw=p().start(); pw.chromium.launch().close(); pw.stop()"` | `uv run --with playwright playwright install chromium`. ~150 MB, 1–2 minute. |
| 4 | Librăriile de sistem (doar Linux/WSL; pe Windows și macOS nu există pasul ăsta; doar dacă 3 pică și după instalare cu „missing dependencies” sau „shared libraries”) | aceeași ca la 3 | Nu o rulezi tu. Userul scrie: `! sudo $(which uv) run --with playwright playwright install-deps chromium` și își pune singur parola. |
| 5 | Plugin-ul frontend-design (opțional) | apare `frontend-design:frontend-design` în lista ta de skill-uri | Userul scrie: `/plugin install frontend-design@claude-plugins-official`, apoi `/reload-plugins`. |
| 6 | Workflow-urile din Claude Code | ai unealta `Workflow` printre uneltele tale | Nu se instalează. Dacă lipsește: `claude update`, apoi repornește Claude Code. Dacă tot lipsește, spune-i că laboratorul are nevoie de ea și nu merge fără. |

Dacă totul are ✓, spune-i asta, sari la „Final” și nu mai pune nicio întrebare.

## Pasul 3. Explică întâi tot atelierul

Înainte de orice întrebare, povestește metafora de bază și apoi, pentru **fiecare** componentă din tabel (și cele care există deja), 2–4 rânduri: rolul ei în atelier și ce face concret în proiect. Încheie cu ce lipsește și în ce ordine le vei lua.

## Pasul 4. Câte o componentă lipsă, în ordine, cu acordul userului

Pentru fiecare componentă cu ✗, una câte una:

1. **Explică-i încă o dată, chiar înainte de întrebare, ce face piesa asta în tot proiectul.** Leag-o de parcursul complet al laboratorului: brief → întrebări → runde → probă → câștigătoare. Spune ce se oprește fără ea (de ex. „Fără manechine, croitorii coc pagini pe care nu le-a probat nimeni pe telefon”). Arată comanda exactă, cât ocupă, cât durează și că se poate dezinstala oricând.
2. **Întreabă cu `AskUserQuestion`**: „Instalez <componentă>?”, cu opțiunile:
   - „Da, instalează”
   - „Nu, sar peste”
   - „Mai explică-mi”
   O singură întrebare odată, niciodată mai multe componente într-o întrebare.
3. La **„Mai explică-mi”**: explică altfel, cu o metaforă nouă (alta decât atelierul) și un exemplu concret din laborator, de exemplu ce vede userul în dashboard datorită piesei ăsteia. Răspunde și la ce a întrebat, dacă a scris ceva la „Other”. Apoi pune din nou aceeași întrebare. Repetă cât timp cere.
4. La **„Da”**: rulează comanda, refă verificarea și spune rezultatul într-un rând. La eroare, explică pe înțeles ce s-a întâmplat și ce poate face; nu reîncerca în buclă.
5. La **„Nu”**: nu rula nimic. Spune într-un rând ce nu va merge fără ea și treci mai departe.

Componentele 4 și 5 le rulează userul, cu `!` sau `/plugin` în față. La „Da”, dă-i comanda de copiat și așteaptă să-ți spună că a terminat, apoi refă verificarea.

Ordinea contează: fără 1 nu se poate instala 2 sau 3. Dacă userul sare peste uv, spune-i că 2 și 3 nu se pot instala nici ele și oprește-te.

Nu instala nimic în afara tabelului și nu rula niciodată `sudo` tu.

## Final

Un tabel scurt: fiecare componentă cu ✓ instalată / ✗ sărită. Pentru cele sărite, ce nu merge:
- fără uv sau Python: laboratorul nu pornește deloc (nu are recepție);
- fără Chromium: paginile se construiesc, dar nimeni nu le probează pe desktop și pe telefon, deci pot avea erori pe care nu le vede nimeni;
- fără frontend-design: totul merge, doar că agenții au mai puține tipare de design;
- fără Workflow: bucla nu poate rula singură.

Apoi pasul următor: „Scrie `/landing-lab` și spune pentru ce produs vrei pagina.”
