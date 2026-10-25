export const meta = {
  name: 'landing-lab',
  description: 'Toată bucla laboratorului: brief și întrebări, apoi idei, construcție și așteptarea proprietarului, rundă după rundă până la câștigătoare',
  phases: [
    { title: 'Idei', detail: 'întrebările pentru proprietar, apoi planul fiecărei runde din brief, răspunsuri, fișiere și toate notele de până acum' },
    { title: 'Construcție', detail: 'câte un constructor pe pagină, verificat pe calculator și pe telefon' },
    { title: 'Așteptare', detail: 'așteaptă proprietarul în dashboard: brief-ul, răspunsurile, apoi feedback-ul fiecărei runde' },
  ],
}

// args: { workspace, port, skill_dir, start = 1 }  start = prima rundă care nu e construită încă
// Căile merg cu / pe orice sistem (și C:/Users/... pe Windows) și sunt puse între ghilimele în comenzi, pentru spații.
const slash = p => String(p).replace(/\\/g, '/')
const WS = slash(args.workspace)
const SKILL = slash(args.skill_dir)
const WAIT = `"${SKILL}/scripts/wait.py"`
const SHOT = `uv run "${SKILL}/scripts/shot.py"`
const BASE = `http://localhost:${args.port}`
const START = args.start || 1

// Răbdarea o ține scriptul: fiecare agent de așteptare repetă un wait.py limitat timp de ~1 oră, apoi raportează, iar bucla
// pornește altul. Un agent pe oră, nu pe apel: contextul unui agent nou (~56k tokeni) e costul, o repetare în el e ieftină.
// Un agent care renunță mai devreme raportează doar „încă nu”, deci răspunsul proprietarului nu poate fi sărit.
async function waitFor(file, fields, phaseTitle) {
  const schema = {
    type: 'object',
    properties: { found: { type: 'boolean', description: 'true doar dacă wait.py a afișat fișierul și a ieșit cu codul 0' }, error: { type: 'string', description: 'doar la alt cod de ieșire decât 0 sau 3: codul și mesajul de eroare' }, ...fields },
    required: ['found'],
  }
  for (let attempt = 1; ; attempt++) {
    const r = await agent(`Rulează exact comanda asta cu unealta de terminal pe care o ai (Bash sau PowerShell), timeout 600000, NU în fundal:
uv run --quiet ${WAIT} "${WS}/${file}" 540
Codul de ieșire 3 înseamnă că fișierul nu a apărut încă: rulează aceeași comandă din nou, de cel mult 6 ori în total, fără să scrii nimic între rulări.
Codul de ieșire 0 înseamnă că a afișat JSON-ul fișierului: oprește-te și întoarce {"found": true} plus câmpurile cerute, citite din acel JSON.
Dacă toate cele 6 rulări ies cu 3, întoarce {"found": false}.
Orice alt cod de ieșire e o eroare (de exemplu uv nu găsește scriptul): oprește-te imediat și întoarce {"found": false, "error": "<codul și mesajul>"}.
Nu crea, nu modifica și nu șterge niciun fișier.`,
      { label: `așteptare:${file}#${attempt}`, phase: phaseTitle, schema, model: 'haiku', effort: 'low' })
    if (r?.found) return r
    // O eroare s-ar repeta la fiecare agent nou, deci oprește bucla în loc să ardă agenți.
    if (r?.error) throw new Error(`wait.py nu merge: ${r.error}`)
    log(`Încă aștept ${file} (de aproximativ ${attempt} h)`)
  }
}

const LANG = 'Limba: proprietarul citește dashboard-ul în română, deci tot ce scrii pentru el (întrebări, rezumatul planului, titlurile paginilor, ideea, mecanicile, needs, raportul tău final) e în română, cu diacritice corecte. Paginile de landing sunt scrise în limba publicului lor, după brief, care poate să nu fie româna.'

const SOURCES = `
Tot ce ține de proiect e în dosarul laboratorului, ${WS}. Citește-l și nu te baza pe alte fișiere ale proiectului decât dacă brief-ul trimite la ele:
- brief.json: brief-ul proprietarului (product, audience, offer, action, form_fields, true_claims, forbidden, brand, tone, references, traffic = de unde vin vizitatorii, per_round, notes) și files[] ({path, name, note, use: "page" | "reference"}).
- answers.json (poate lipsi): răspunsurile la întrebări; questions.json conține întrebările.
- uploads/: toate fișierele încărcate; calea "/uploads/x" e uploads/x pe disc. Uită-te la fiecare imagine cu unealta Read și citește și PDF-urile sau documentele. Fișierele cu use "page" pot apărea în design; cele cu "reference" sunt doar inspirație.
- rounds/<n>/plan.json, rounds/<n>/<slug>/meta.json + desktop.png/mobile.png, rounds/<n>/feedback.json: rundele anterioare și feedback-ul proprietarului (rating love/maybe/no, note, fișiere de referință pe pagină și pe rundă, note generale). O rundă fără feedback.json nu a fost notată: nu inventa feedback pentru ea.
- Dacă serverul a fost pornit cu un dosar de imagini, ele sunt la ${BASE}/assets/<nume> (GET ${BASE}/api/state le listează la "assets").
${LANG}
`

const CRAFT = `
Meseria paginii de landing (reguli implicite; orice spune brief-ul sau feedback-ul are prioritate):
- O pagină, o acțiune. Formularul sau butonul acțiunii e punctul central: pe calculator domină vizual și rămâne la îndemână; pe telefon apare devreme.
- Butoanele arată clar a butoane (fundal plin, verb în etichetă, mărime generoasă, hover și focus vizibil). Pasul următor e mereu evident.
- Accesibilitate: contrast WCAG AA, etichete vizibile la fiecare câmp, contur la focus, zone de atingere de 44px, titluri semantice, ordine logică la Tab.
- Mecanici de vânzare directă (urgență, raritate, dovadă socială, garanție, ancorare de preț, progres, termene) DOAR când sunt adevărate după brief. Nu inventa niciodată cifre, recenzii, testimoniale, garanții sau cronometre care se resetează. Orice are nevoie de date sau backend care nu există merge în "needs" din meta.json.
- Nu folosi niciodată o afirmație din lista "forbidden". Când nu ești sigur că o afirmație e adevărată, scoate-o.
- Textul e real și concret, niciodată lorem ipsum.
`

const planSchema = ROUND => ({
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'un paragraf pentru proprietar, în română: ce explorează runda și cum folosește feedback-ul de până acum' },
    variants: { type: 'array', minItems: 1, maxItems: 6, items: { type: 'object', properties: {
      slug: { type: 'string', description: `kebab-case, începe cu "r${ROUND}-", unic în toate rundele` },
      title: { type: 'string', description: 'titlul paginii pentru proprietar, în română' },
      concept: { type: 'string', description: 'ideea de așezare în pagină și de ce ar trebui să convertească' },
      layout: { type: 'string', description: 'structura concretă pe calculator și pe telefon, ordinea secțiunilor, unde stă acțiunea' },
      mechanics: { type: 'array', items: { type: 'string' }, description: 'mecanicile paginii, în română' },
      copy: { type: 'string', description: 'unghiul, titlul principal și direcția textului' },
      references: { type: 'array', items: { type: 'string' }, description: 'fișierele încărcate la care trebuie să se uite sau pe care să le folosească constructorul, ca /uploads/...' } },
      required: ['slug', 'title', 'concept', 'layout', 'mechanics', 'copy', 'references'] } },
  },
  required: ['summary', 'variants'],
})

async function runRound(ROUND) {
  const plan = await agent(`${SOURCES}
  Ești agentul de IDEI pentru runda ${ROUND} a unui laborator de pagini de landing. Citește întâi tot dosarul. Dacă brief.current_url e completat, fă-i capturi cu: ${SHOT} <current_url> "${WS}/rounds/${ROUND}" --prefix _current- — și uită-te la ambele imagini.
  ${ROUND === 1
    ? 'Runda 1: fă paginile cu adevărat diferite între ele: altă așezare, altă mecanică dominantă, alt unghi.'
    : 'Construiește pe ce i-a plăcut proprietarului, renunță la ce a respins, urmează întocmai notele rundei și fișierele de referință și nu repeta niciun slug. Spune în rezumat cum răspunde fiecare pagină la feedback.'}
  ${CRAFT}
  Plănuiește exact brief.per_round pagini (implicit 4). Apoi scrie ${WS}/rounds/${ROUND}/plan.json cu exact ce întorci ca rezultat structurat, ca dashboard-ul să le arate ca „Se construiește…”. Nu crea dosarele paginilor.`,
    { label: `idei:r${ROUND}`, phase: 'Idei', schema: planSchema(ROUND), effort: 'high' })
  if (!plan) throw new Error('agentul de idei a eșuat')
  log(`Runda ${ROUND}: ${plan.variants.map(v => v.title).join(' · ')}`)

  const built = await parallel(plan.variants.map(v => () => agent(`${SOURCES}
  Ești un CONSTRUCTOR în runda ${ROUND}. Construiește această pagină de landing:
  ${JSON.stringify(v, null, 1)}
  Contextul rundei: ${plan.summary}
  ${CRAFT}
  Scrie DOAR în ${WS}/rounds/${ROUND}/${v.slug}/:
  1. index.html — UN singur fișier, cu CSS și JS în el. Google Fonts e permis. Imagini doar din /uploads/<nume> (fișiere cu use "page") sau /assets/<nume>, cu exact aceste căi absolute (exportul câștigătoarei le rescrie). Formularul sau acțiunea e o machetă interactivă: validează, apoi arată în pagină nota „This is a preview, nothing was sent”, tradusă în limba paginii; nu apela niciodată un API real. Încarcă skill-ul frontend-design:frontend-design pentru îndrumări de design, dacă e disponibil.
  2. Verifică: comanda ${SHOT} ${BASE}/rounds/${ROUND}/${v.slug}/index.html "${WS}/rounds/${ROUND}/${v.slug}" scrie acolo desktop.png și mobile.png și afișează erorile din consolă, imaginile lipsă și depășirea pe orizontală. Uită-te la ambele imagini. Repară și rulează din nou până nu mai sunt erori, nici imagini lipsă, overflow_px e 0 pe telefon și acțiunea e punctul central.
  3. LA URMĂ scrie meta.json: {"title": "...", "idea": "<o propoziție pentru proprietar>", "mechanics": ["..."], "needs": ["<date sau backend de care are nevoie o mecanică, dacă e cazul>"]}, cu title, idea, mechanics și needs în română. meta.json marchează pagina ca gata în dashboard, deci scrie-l doar când pagina e terminată.
  Întoarce un singur rând, în română: URL-ul și ce ar trebui să știe proprietarul.`,
    { label: `construcție:${v.slug}`, phase: 'Construcție' })))

  return { round: ROUND, summary: plan.summary, pages: plan.variants.map((v, i) => ({ slug: v.slug, title: v.title, url: `${BASE}/rounds/${ROUND}/${v.slug}/index.html`, report: built[i] })) }
}

const brief = await waitFor('brief.json', {
  max_rounds: { type: 'number', description: 'max_rounds ca număr (implicit 10 dacă lipsește)' },
  ask_questions: { type: 'boolean', description: 'ask_questions (implicit true dacă lipsește)' },
}, 'Așteptare')
const MAX = brief.max_rounds || 10

if (START === 1) {
  const q = await agent(`Pregătești întrebările unui laborator de pagini de landing al cărui dosar e ${WS}.
Dacă ${WS}/questions.json există deja, nu schimba nimic și întoarce numărul de întrebări din el.
${brief.ask_questions === false
  ? `Proprietarul a oprit întrebările: scrie ${WS}/questions.json ca {"questions": []} și întoarce 0.`
  : `Citește ${WS}/brief.json și fiecare fișier din ${WS}/uploads/ (la imagini uită-te cu Read). Apoi scrie ${WS}/questions.json:
{"intro": "un rând", "questions": [
  {"id": "price_anchor", "label": "…?", "help": "de ce contează", "type": "single", "options": ["…", "…"], "allow_other": true},
  {"id": "tone", "label": "…", "type": "multi", "options": ["…"]},
  {"id": "has_reviews", "label": "…", "type": "toggle", "toggle_label": "Da, cu acordul lor"},
  {"id": "story", "label": "…", "type": "text"},
  {"id": "photos", "label": "…", "type": "file"}
]}
Cel mult 6 întrebări, doar despre golurile care schimbă designul (dacă o afirmație e adevărată, oferta reală, ce materiale are). Preferă single/multi/toggle în locul textului liber. Scrie intro-ul și fiecare label, help, opțiune și toggle_label în română, cu diacritice corecte: proprietarul le citește într-un dashboard în română. Dacă nu lipsește nimic, scrie {"questions": []}. Întoarce numărul de întrebări.`}`,
    { label: 'întrebări', phase: 'Idei', schema: { type: 'object', properties: { count: { type: 'number' } }, required: ['count'] } })
  if (q?.count) await waitFor('answers.json', {}, 'Așteptare')
}

for (let n = START; ; n++) {
  if (n > 1) {
    const fb = await waitFor(`rounds/${n - 1}/feedback.json`, {
      chosen: { type: 'string', description: 'valoarea lui "chosen", sau "" dacă e null sau lipsește' },
    }, 'Așteptare')
    if (fb.chosen) {
      return { winner: { round: n - 1, slug: fb.chosen }, path: `${WS}/winner/index.html`, meta: `${WS}/rounds/${n - 1}/${fb.chosen}/meta.json` }
    }
  }
  if (n > MAX) return { stopped: 'max_rounds', rounds: MAX }
  const r = await runRound(n)
  log(`Runda ${n} e gata: ${r.pages.map(p => p.title).join(' · ')}`)
}
