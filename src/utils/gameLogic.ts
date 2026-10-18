// Pure game helpers and algorithms for Hush Music Show Games

export function norm(s: any): string {
  return String(s == null ? '' : s).toLowerCase().trim().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function lev(a: string, b: string): number {
  a = norm(a);
  b = norm(b);
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

export function fuzzy(guess: string, answer: string): boolean {
  const g = norm(guess), a = norm(answer);
  if (!g || !a) return false;
  if (g === a) return true;
  if (a.indexOf(g) >= 0 || g.indexOf(a) >= 0) return true;
  const tol = Math.max(1, Math.floor(a.length / 6));
  return lev(g, a) <= tol;
}

export function pickN<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  const a = (arr || []).slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a.slice(0, Math.max(0, Math.min(Math.floor(n), a.length)));
}

export function money(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '?';
  if (v < 1) return Math.round(v * 100) + '¢';
  return '$' + Math.round(v).toLocaleString('en-US');
}

/* --- JEOPARDY --- */
export function jeopardyNorm(s: any): string {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function jeopardyLev(a: string, b: string): number {
  a = jeopardyNorm(a);
  b = jeopardyNorm(b);
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[m][n];
}

export function jeopardyGrade(pa: string, ca: string): boolean {
  const g = jeopardyNorm(pa), a = jeopardyNorm(ca);
  if (!g || !a) return false;
  if (g === a) return true;
  if (a.indexOf(g) >= 0 || g.indexOf(a) >= 0) return true;
  if (Math.min(g.length, a.length) <= 10 && jeopardyLev(g, a) <= 2) return true;
  return false;
}

/* --- WHEEL --- */
export function wheelSegments(): (number | string)[] {
  return [100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 5000, 300, 600, 900, 1000, 'BANKRUPT', 'LOSE A TURN', 'BANKRUPT', 'LOSE A TURN'];
}

export function wheelSpin(rng: () => number = Math.random): number | string {
  const s = wheelSegments();
  return s[Math.floor(rng() * s.length)];
}

/* --- MILLIONAIRE --- */
export function millionaireLadder(): number[] {
  return [100, 200, 300, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 125000, 250000, 500000, 1000000];
}

export function millionaireFifty(choices: string[], correct: number): number[] {
  const o: number[] = [];
  for (let i = 0; i < choices.length; i++) if (i !== correct) o.push(i);
  const k = o[Math.floor(Math.random() * o.length)];
  return [correct, k].sort((x, y) => x - y);
}

/* --- PRICE --- */
export function priceBidWinner(bids: number[], price: number): number {
  let bi = -1, bd = Infinity, ci = 0, cd = Infinity;
  for (let i = 0; i < bids.length; i++) {
    const b = +bids[i];
    const d = Math.abs(b - price);
    if (d < cd) {
      cd = d;
      ci = i;
    }
    if (b <= price && price - b < bd) {
      bd = price - b;
      bi = i;
    }
  }
  return bi >= 0 ? bi : ci;
}

/* --- FEUD --- */
export function feudMatch(g: string, a: string): boolean {
  return jeopardyGrade(g, a);
}

/* --- PASSWORD --- */
export function passwordPoints(x: number): number {
  return Math.max(1, 10 - (x | 0));
}

/* --- CHASE --- */
export function chaseBotCorrect(diff: string, rng: () => number = Math.random): boolean {
  const p = diff === 'easy' ? 0.55 : (diff === 'hard' ? 0.85 : 0.7);
  return rng() < p;
}

/* --- DEAL OR NO DEAL --- */
export function dealCaseValues(): number[] {
  return [0.01, 1, 5, 10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000, 5000, 10000, 25000, 50000, 75000, 100000, 200000, 300000, 400000, 500000, 750000, 1000000];
}

export function dealShuffle(rng: () => number = Math.random): number[] {
  const v = dealCaseValues();
  for (let i = v.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = v[i];
    v[i] = v[j];
    v[j] = t;
  }
  return v;
}

export function dealRoundOpens(): number[] {
  return [6, 5, 4, 3, 2, 1, 1, 1, 1];
}

export function dealOfferFactors(): number[] {
  return [0.35, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
}

export function bankerOffer(remaining: number[], round: number): number {
  if (!remaining || !remaining.length) return 0;
  let sum = 0;
  for (let i = 0; i < remaining.length; i++) sum += remaining[i];
  const ev = sum / remaining.length;
  const f = dealOfferFactors();
  const factor = f[Math.min(Math.max(round | 0, 0), f.length - 1)];
  const offer = ev * factor;
  if (offer < 100) return Math.round(offer);
  if (offer < 1000) return Math.round(offer / 10) * 10;
  if (offer < 10000) return Math.round(offer / 100) * 100;
  return Math.round(offer / 1000) * 1000;
}

/* --- PRESS YOUR LUCK --- */
export interface PressLuckSpinResult {
  type: 'whammy' | 'bigbucks' | 'cash';
  amount?: number;
}

export function pressluckSpin(rng: () => number = Math.random): PressLuckSpinResult {
  const r = rng();
  if (r < 0.16) return { type: 'whammy' };
  if (r < 0.24) return { type: 'bigbucks', amount: 5000 };
  const amounts = [100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500, 2000];
  return { type: 'cash', amount: amounts[Math.floor(rng() * amounts.length)] };
}

export function pressluckStartSpins(): number {
  return 3;
}

export function pressluckSimBot(spins: number, rng: () => number = Math.random): { bank: number; wham: number; out: boolean } {
  let bank = 0, wham = 0, s = spins, out = false;
  while (s > 0 && !out) {
    s--;
    const r = pressluckSpin(rng);
    if (r.type === 'whammy') {
      bank = 0;
      wham++;
      if (wham >= 4) out = true;
    } else {
      bank += r.amount || 0;
      if (r.type === 'bigbucks') s++;
    }
  }
  return { bank, wham, out };
}

/* --- PYRAMID --- */
export function pyramidScore(correct: number, _total?: number): number {
  return Math.max(0, correct | 0);
}

export function pyramidBotScore(rng: () => number = Math.random): number {
  return 4 + Math.floor(rng() * 4);
}

export function pyramidNorm(entry: any): { title: string; items: { clue: string; answer: string }[] } {
  const e = entry || {};
  const title = e.title || e.subject || e.category || e.topic || 'Mystery List';
  const raw = e.items || e.words || e.clues || e.list || e.pairs || [];
  const items = raw.map((it: any) => {
    if (typeof it === 'string') {
      const w = it.trim();
      return { clue: 'Starts with "' + w.charAt(0).toUpperCase() + '" · ' + w.length + ' letters', answer: w };
    }
    if (Array.isArray(it)) return { clue: String(it[0] || ''), answer: String(it[1] || '') };
    it = it || {};
    return { clue: String(it.clue || it.hint || it.q || it.question || ''), answer: String(it.answer || it.word || it.a || '') };
  }).filter((x: any) => !!x.answer);
  return { title: String(title), items };
}

/* --- WEAKEST LINK --- */
export function weakestLinkBank(chain: number): number {
  const L = [0, 1000, 5000, 15000, 30000, 60000, 100000, 150000, 200000];
  chain = Math.max(0, Math.min(chain | 0, L.length - 1));
  return L[chain];
}

export function weakestLinkBots(): string[] {
  return ['Roxanne', 'Marcus', 'Priya', 'Dez'];
}

export function weakestLinkBotSkill(rng: () => number = Math.random): number {
  return 0.55 + rng() * 0.25;
}

export function weakestLinkBotVote(team: { n: string; me: boolean; c: number; w: number }[], rng: () => number = Math.random): string | null {
  const cands = team.filter(m => !m.me);
  if (!cands.length) return null;
  cands.sort((a, b) => (a.c - a.w) - (b.c - b.w));
  const worst = cands[0];
  const tied = cands.filter(m => (m.c - m.w) === (worst.c - worst.w));
  return tied[Math.floor(rng() * tied.length)].n;
}

/* --- 1 VS 100 --- */
export function v100Tiers(): number[] {
  return [1, 1, 1, 1, 2, 2, 2, 3, 3, 3];
}

export function v100QuestionValue(tier: number): number {
  return [0, 1000, 2500, 5000][Math.min(Math.max(tier | 0, 1), 3)];
}

export function v100Pick(bank: any[], rng: () => number = Math.random): any[] {
  const tiers = v100Tiers();
  const byTier: Record<number, any[]> = { 1: [], 2: [], 3: [] };
  (bank || []).forEach(q => {
    const t = Math.min(Math.max(q.tier | 0 || 1, 1), 3);
    byTier[t].push(q);
  });
  const out: any[] = [];
  tiers.forEach(t => {
    const pool = byTier[t].length ? byTier[t] : (bank || []);
    if (pool.length) out.push(pool[Math.floor(rng() * pool.length)]);
  });
  return out;
}

export function mobEliminate(mobCount: number, questionTier: number, rng: () => number = Math.random): number {
  const acc = [0.72, 0.58, 0.42][Math.min(Math.max((questionTier | 0) - 1, 0), 2)];
  let wrong = 0;
  for (let i = 0; i < (mobCount | 0); i++) {
    if (rng() > acc) wrong++;
  }
  return wrong;
}

export function v100MobSplit(tier: number, rng: () => number = Math.random): number[] {
  const acc = [0.72, 0.58, 0.42][Math.min(Math.max((tier | 0) - 1, 0), 2)];
  const c = Math.round(acc * 100);
  const r1 = Math.floor(rng() * (100 - c));
  const r2 = 100 - c - r1;
  return [c, r1, r2];
}

/* --- 5TH GRADER --- */
export function fifthGraderLadder(): number[] {
  return [1000, 2000, 5000, 10000, 25000];
}

export function fifthGraderNorm(bank: any[]): any[] {
  const out: any[] = [];
  (bank || []).forEach(e => {
    e = e || {};
    const grade = e.grade || e.g || 1;
    const choices = e.choices || e.options || [];
    const correct = (e.correct != null) ? e.correct : ((e.answer != null) ? choices.indexOf(e.answer) : 0);
    out.push({
      grade: (grade | 0) || 1,
      subject: String(e.subject || e.category || 'General'),
      q: String(e.q || e.question || ''),
      choices: choices.map(String),
      correct: Math.max(0, correct | 0),
    });
  });
  return out.filter(x => x.q && x.choices.length >= 2 && x.grade >= 1 && x.grade <= 5);
}

export function fifthGraderForGrade(normed: any[], grade: number, rng: () => number = Math.random): any {
  const pool = normed.filter(x => x.grade === (grade | 0));
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)];
}

/* --- WHAT'S MY LINE --- */
export function wmlCheck(guess: string, correct: string): boolean {
  return fuzzy(guess, correct);
}

export function wmlScore(questionsUsed: number): number {
  return 1000 - 50 * (questionsUsed | 0);
}

export function wmlQuestions(): [string, string][] {
  return [
    ['q1', 'Do you work indoors?'],
    ['q2', 'Do you wear a uniform?'],
    ['q3', 'Do you work with your hands?'],
    ['q4', 'Do you provide a service?'],
    ['q5', 'Do you work with children?'],
    ['q6', 'Do you work outdoors?'],
    ['q7', 'Do you need a college degree?'],
    ['q8', 'Do you work nights?'],
    ['q9', 'Do you wear a costume?'],
    ['q10', 'Do you use tools?'],
    ['q11', 'Are you in entertainment?'],
    ['q12', 'Do you work in healthcare?'],
    ['q13', 'Do you work with food?'],
    ['q14', 'Do you drive for work?'],
    ['q15', 'Are you self-employed?'],
    ['q16', 'Do you work with animals?'],
    ['q17', 'Is your job dangerous?'],
    ['q18', 'Do you work in an office?'],
    ['q19', 'Do people recognize you for your job?'],
    ['q20', 'Do you make things?'],
  ];
}

export function wmlPanel(): string[] {
  return ['Arlene', 'Bennett', 'Dorothy', 'Fred'];
}

export function wmlNormOcc(o: any): { name: string; answers: Record<string, string> } {
  o = o || {};
  const name = o.occupation || o.name || o.job || '';
  const answers: Record<string, string> = {};
  if (Array.isArray(o.answers)) {
    o.answers.forEach((v: any, i: number) => {
      answers['q' + (i + 1)] = v ? 'yes' : 'no';
    });
  } else if (o.answers) {
    Object.keys(o.answers).forEach(k => {
      answers[k] = /^\s*y/i.test(String(o.answers[k])) ? 'yes' : 'no';
    });
  } else {
    (o.yes || []).forEach((k: string) => { answers[k] = 'yes'; });
    (o.no || []).forEach((k: string) => { answers[k] = 'no'; });
  }
  return { name: String(name), answers };
}

/* --- HOLLYWOOD GAME NIGHT --- */
export function hollywoodCluePts(cluesShown: number): number {
  return [0, 300, 200, 100][Math.min(Math.max(cluesShown | 0, 1), 3)];
}

export function hollywoodWordPts(): number {
  return 10;
}

export function hollywoodFirePts(): number {
  return 10;
}

export function hollywoodTarget(): number {
  return 250;
}

export function hollywoodNormCeleb(e: any): { name: string; clues: string[] } {
  e = e || {};
  const clues = e.clues || e.hints || [];
  return { name: String(e.name || e.celeb || ''), clues: clues.map(String).slice(0, 3) };
}

export function hollywoodNormWord(e: any): { word: string; hints: string[] } {
  if (typeof e === 'string') return { word: e, hints: [] };
  e = e || {};
  const hints = e.hints || e.clues || [];
  return { word: String(e.word || ''), hints: hints.map(String).slice(0, 3) };
}

export function hollywoodNormFire(e: any): { q: string; choices: string[]; correct: number } {
  e = e || {};
  const choices = e.choices || e.options || [];
  const correct = (e.correct != null) ? e.correct : ((e.answer != null) ? choices.indexOf(e.answer) : 0);
  return { q: String(e.q || e.question || ''), choices: choices.map(String), correct: Math.max(0, correct | 0) };
}
