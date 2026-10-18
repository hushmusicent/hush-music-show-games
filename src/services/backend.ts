// Backend, Auth, Wallet, Leaderboard, Friends, Chat, Net, and Voice services

import { Sound } from './sound';

export const DAILY_BONUS = 500;
export const START_POINTS = 1000;
export const PVP_WIN = 200;

export const CPU_PAYOUTS: Record<string, number> = {
  jeopardy: 150,
  wheel: 150,
  millionaire: 200,
  price: 120,
  feud: 150,
  chase: 150,
  matchgame: 80,
  password: 80,
  whatsmline: 100,
  hollywood: 120,
  deal: 150,
  pressluck: 150,
  pyramid: 150,
  weakestlink: 120,
  '1v100': 200,
  fifthgrader: 120,
};

export interface UserAccount {
  uid: string;
  username: string;
  email: string;
  code: string;
  pass?: string;
  points?: number;
  wins?: Record<string, number>;
  created?: number;
  lastDaily?: number;
}

export interface FriendItem {
  uid: string;
  username: string;
  code: string;
  online: boolean;
}

export interface FriendRequest {
  uid: string;
  from: string;
  at: number;
}

export interface ChatMessage {
  id?: string;
  who: string;
  uid: string;
  text: string;
  at: number;
}

export interface RoomState {
  code: string;
  game: string;
  seatsNeeded: number;
  seats: string[];
  names: Record<string, string>;
  state: any;
  turn: number;
  status: string;
  host: string;
  created: number;
  shgNeedQuiz?: number;
}

export const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem('shg_' + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k: string, v: any) {
    try {
      localStorage.setItem('shg_' + k, JSON.stringify(v));
    } catch (e) {}
  },
};

export function genCode(): string {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
}

export function uid(): string {
  return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

declare const window: any;

/* --- BACKEND / FIREBASE INTEGRATION --- */
export class BackendService {
  public mode: 'local' | 'firebase' = 'local';
  private fb: any = null;
  public db: any = null;
  public auth: any = null;

  public readConfig() {
    let cfg: any = { apiKey: '', authDomain: '', databaseURL: '', projectId: '', appId: '' };
    try {
      const raw = localStorage.getItem('shg_fb_config');
      if (raw) {
        const j = JSON.parse(raw);
        if (j && j.apiKey && String(j.apiKey).trim()) cfg = j;
      }
    } catch (e) {}
    return cfg;
  }

  public configured(): boolean {
    const f = this.readConfig();
    return !!(f && f.apiKey && f.databaseURL && f.projectId);
  }

  public async init(): Promise<'local' | 'firebase'> {
    const f = this.readConfig();
    if (this.configured() && typeof window !== 'undefined') {
      try {
        if (!window.firebase) {
          await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
          await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
          await this.loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
        }
        if (window.firebase) {
          if (!window.firebase.apps || !window.firebase.apps.length) {
            this.fb = window.firebase.initializeApp(f);
          } else {
            this.fb = window.firebase.app();
          }
          this.auth = window.firebase.auth();
          this.db = window.firebase.database();
          this.mode = 'firebase';
        }
      } catch (e) {
        console.warn('Firebase init failed, running in demo mode', e);
        this.mode = 'local';
      }
    }
    return this.mode;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
}

export const Backend = new BackendService();

/* --- AUTH --- */
export class AuthService {
  public user: UserAccount | null = null;
  private authListeners: ((user: UserAccount | null) => void)[] = [];

  constructor() {
    // Check initial session
    const session = store.get<UserAccount | null>('session', null);
    if (session) {
      this.user = session;
    }
  }

  public onAuth(cb: (user: UserAccount | null) => void) {
    this.authListeners.push(cb);
    cb(this.user);
  }

  private notify() {
    this.authListeners.forEach(cb => cb(this.user));
  }

  public async signup(username: string, email: string, pass: string): Promise<UserAccount> {
    username = username.trim();
    email = email.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
      throw new Error('Username: 3-16 letters, numbers or _');
    }
    if (pass.length < 6) {
      throw new Error('Password must be 6+ characters');
    }

    if (Backend.mode === 'firebase' && Backend.db && Backend.auth) {
      const un = await Backend.db.ref('shg_usernames/' + username.toLowerCase()).get();
      if (un.exists()) throw new Error('Username taken');
      const cred = await Backend.auth.createUserWithEmailAndPassword(email, pass);
      const code = genCode();
      const u: UserAccount = { uid: cred.user.uid, username, email, code };
      await Backend.db.ref('shg_users/' + u.uid).set({
        username,
        email,
        code,
        points: START_POINTS,
        wins: {},
        created: Date.now(),
        lastDaily: 0,
      });
      await Backend.db.ref('shg_usernames/' + username.toLowerCase()).set(u.uid);
      await Backend.db.ref('shg_codes/' + code).set(u.uid);
      this.user = u;
      store.set('session', u);
      this.notify();
      return u;
    }

    const users = store.get<Record<string, UserAccount>>('users', {});
    if (Object.values(users).some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Username taken');
    }
    if (Object.values(users).some(u => u.email === email)) {
      throw new Error('Email already registered');
    }
    let code = genCode();
    while (Object.values(users).some(u => u.code === code)) code = genCode();

    const u: UserAccount = {
      uid: uid(),
      username,
      email,
      code,
      pass: btoa(unescape(encodeURIComponent(pass))),
    };
    users[u.uid] = u;
    store.set('users', users);

    const wallets = store.get<Record<string, any>>('wallets', {});
    wallets[u.uid] = { points: START_POINTS, wins: {}, lastDaily: 0 };
    store.set('wallets', wallets);

    const sessionUser = { uid: u.uid, username: u.username, email: u.email, code: u.code };
    store.set('session', sessionUser);
    this.user = sessionUser;
    this.notify();
    return this.user;
  }

  public async login(email: string, pass: string): Promise<UserAccount> {
    email = email.trim().toLowerCase();
    if (Backend.mode === 'firebase' && Backend.auth && Backend.db) {
      const cred = await Backend.auth.signInWithEmailAndPassword(email, pass);
      const snap = await Backend.db.ref('shg_users/' + cred.user.uid).get();
      const d = snap.val() || {};
      let code = d.code || '';
      if (!code) {
        code = genCode();
        await Backend.db.ref('shg_users/' + cred.user.uid + '/code').set(code);
        await Backend.db.ref('shg_codes/' + code).set(cred.user.uid);
      }
      this.user = { uid: cred.user.uid, username: d.username || email.split('@')[0], email, code };
      store.set('session', this.user);
      this.notify();
      return this.user;
    }

    const users = store.get<Record<string, UserAccount>>('users', {});
    const u = Object.values(users).find(x => x.email === email);
    if (!u || u.pass !== btoa(unescape(encodeURIComponent(pass)))) {
      throw new Error('Wrong email or password');
    }
    this.user = { uid: u.uid, username: u.username, email: u.email, code: u.code };
    store.set('session', this.user);
    this.notify();
    return this.user;
  }

  public async logout() {
    if (Backend.mode === 'firebase' && Backend.auth) {
      try {
        await Backend.auth.signOut();
      } catch (e) {}
    }
    store.set('session', null);
    this.user = null;
    this.notify();
  }

  public async resetPassword(email: string): Promise<string> {
    email = email.trim().toLowerCase();
    if (Backend.mode === 'firebase' && Backend.auth) {
      await Backend.auth.sendPasswordResetEmail(email);
      return 'reset-email';
    }
    throw new Error('Password reset emails need Firebase connected in Profile → Setup. In demo mode, accounts are stored on this device.');
  }
}

export const Auth = new AuthService();

/* --- WALLET --- */
export class WalletService {
  public balance: number = 0;
  public wins: Record<string, number> = {};
  public lastDaily: number = 0;
  private changeListeners: (() => void)[] = [];

  public onChange(cb: () => void) {
    this.changeListeners.push(cb);
  }

  private notify() {
    this.changeListeners.forEach(cb => cb());
  }

  public async load() {
    if (!Auth.user) {
      this.balance = 0;
      this.wins = {};
      this.notify();
      return;
    }
    if (Backend.mode === 'firebase' && Backend.db) {
      const s = await Backend.db.ref('shg_users/' + Auth.user.uid).get();
      const d = s.val() || {};
      this.balance = d.points || 0;
      this.wins = d.wins || {};
      this.lastDaily = d.lastDaily || 0;
    } else {
      const w = store.get<Record<string, any>>('wallets', {})[Auth.user.uid] || {
        points: START_POINTS,
        wins: {},
        lastDaily: 0,
      };
      this.balance = w.points;
      this.wins = w.wins || {};
      this.lastDaily = w.lastDaily || 0;
    }
    this.notify();
  }

  public async save() {
    if (!Auth.user) return;
    if (Backend.mode === 'firebase' && Backend.db) {
      await Backend.db.ref('shg_users/' + Auth.user.uid).update({
        points: this.balance,
        wins: this.wins,
        lastDaily: this.lastDaily,
      });
    } else {
      const w = store.get<Record<string, any>>('wallets', {});
      w[Auth.user.uid] = { points: this.balance, wins: this.wins, lastDaily: this.lastDaily };
      store.set('wallets', w);
    }
    this.notify();
  }

  public async add(n: number, _reason?: string): Promise<number> {
    this.balance = Math.max(0, this.balance + n);
    await this.save();
    if (n > 0) Sound.win();
    else if (n < 0) Sound.lose();
    return this.balance;
  }

  public bet(amount: number): number {
    amount = Math.floor(amount);
    if (amount <= 0) throw new Error('Bet must be positive');
    if (amount > this.balance) throw new Error('Not enough points');
    this.balance -= amount;
    this.save();
    Sound.click();
    return amount;
  }

  public async recordWin(game: string): Promise<number> {
    this.wins[game] = (this.wins[game] || 0) + 1;
    const payout = CPU_PAYOUTS[game] || 25;
    await this.add(payout, 'win-' + game);
    return payout;
  }

  public canDaily(): boolean {
    return Date.now() - this.lastDaily > 20 * 3600 * 1000;
  }

  public async claimDaily(): Promise<boolean> {
    if (!this.canDaily()) return false;
    this.lastDaily = Date.now();
    await this.add(DAILY_BONUS, 'daily');
    return true;
  }
}

export const Wallet = new WalletService();

/* --- LEADERBOARD --- */
export const DEMO_BOTS = [
  { n: 'BuzzerBetty', p: 7400 },
  { n: 'DailyDouble', p: 6800 },
  { n: 'ShowtimeSam', p: 6100 },
  { n: 'GoldRushGus', p: 5600 },
  { n: 'SpinQueen', p: 4200 },
  { n: 'LuckyLucy', p: 3300 },
  { n: 'BigBucks', p: 2100 },
  { n: 'NewKid', p: 950 },
];

export interface LeaderboardRow {
  uid: string;
  username: string;
  points: number;
  wins?: Record<string, number>;
}

export const Board = {
  async top50(): Promise<LeaderboardRow[]> {
    if (Backend.mode === 'firebase' && Backend.db) {
      const s = await Backend.db.ref('shg_users').orderByChild('points').limitToLast(50).get();
      const rows: LeaderboardRow[] = [];
      s.forEach((c: any) => {
        rows.push({ uid: c.key, ...(c.val() || {}) });
      });
      return rows.reverse().filter(r => r.username);
    }
    const users = store.get<Record<string, UserAccount>>('users', {});
    const wallets = store.get<Record<string, any>>('wallets', {});
    const real: LeaderboardRow[] = Object.values(users).map(u => ({
      uid: u.uid,
      username: u.username,
      points: (wallets[u.uid] || {}).points || 0,
      wins: (wallets[u.uid] || {}).wins || {},
    }));
    const bots: LeaderboardRow[] = DEMO_BOTS.map(b => ({
      uid: 'bot-' + b.n,
      username: b.n,
      points: b.p,
      wins: {},
    }));
    return real.concat(bots).sort((a, b) => b.points - a.points).slice(0, 50);
  },

  async myRank(): Promise<number | null> {
    const top = await this.top50();
    const i = top.findIndex(r => r.uid === (Auth.user && Auth.user.uid));
    return i < 0 ? null : i + 1;
  },
};

/* --- FRIENDS --- */
export const Friends = {
  needNet(): boolean {
    return Backend.mode === 'firebase';
  },

  async list(): Promise<FriendItem[]> {
    if (!this.needNet() || !Auth.user) {
      // In demo mode, show stored local friends
      return store.get<FriendItem[]>('demo_friends', []);
    }
    const s = await Backend.db.ref('shg_friends/' + Auth.user.uid).get();
    const ids = s.val() || {};
    const out: FriendItem[] = [];
    for (const fid of Object.keys(ids)) {
      const p = await Backend.db.ref('shg_users/' + fid).get();
      const d = p.val() || {};
      const pr = await Backend.db.ref('shg_presence/' + fid).get();
      out.push({
        uid: fid,
        username: d.username || '?',
        code: d.code || '',
        online: !!(pr.val() && pr.val().online),
      });
    }
    return out;
  },

  async findByCode(code: string): Promise<UserAccount | null> {
    code = String(code || '').trim().toUpperCase();
    if (code.length !== 6) return null;
    if (!this.needNet()) {
      const users = store.get<Record<string, UserAccount>>('users', {});
      const u = Object.values(users).find(x => x.code === code);
      return u || null;
    }
    const s = await Backend.db.ref('shg_codes/' + code).get();
    if (!s.exists()) return null;
    const p = await Backend.db.ref('shg_users/' + s.val()).get();
    return { uid: s.val(), ...(p.val() || {}) };
  },

  async sendRequest(toUid: string) {
    if (!Auth.user) return;
    if (!this.needNet()) {
      const reqs = store.get<Record<string, any>>('demo_requests', {});
      if (!reqs[toUid]) reqs[toUid] = [];
      reqs[toUid].push({ uid: Auth.user.uid, from: Auth.user.username, at: Date.now() });
      store.set('demo_requests', reqs);
      return;
    }
    await Backend.db.ref('shg_requests/' + toUid + '/' + Auth.user.uid).set({
      from: Auth.user.username,
      at: Date.now(),
    });
  },

  async requests(): Promise<FriendRequest[]> {
    if (!Auth.user) return [];
    if (!this.needNet()) {
      const reqs = store.get<Record<string, any>>('demo_requests', {});
      return reqs[Auth.user.uid] || [];
    }
    const s = await Backend.db.ref('shg_requests/' + Auth.user.uid).get();
    const r = s.val() || {};
    return Object.keys(r).map(k => ({ uid: k, ...r[k] }));
  },

  async accept(otherUid: string) {
    if (!Auth.user) return;
    if (!this.needNet()) {
      const demoFriends = store.get<FriendItem[]>('demo_friends', []);
      const users = store.get<Record<string, UserAccount>>('users', {});
      const other = users[otherUid];
      if (other && !demoFriends.some(f => f.uid === otherUid)) {
        demoFriends.push({ uid: other.uid, username: other.username, code: other.code, online: true });
        store.set('demo_friends', demoFriends);
      }
      return;
    }
    const m: any = {};
    m['shg_friends/' + Auth.user.uid + '/' + otherUid] = true;
    m['shg_friends/' + otherUid + '/' + Auth.user.uid] = true;
    m['shg_requests/' + Auth.user.uid + '/' + otherUid] = null;
    await Backend.db.ref().update(m);
  },

  async decline(otherUid: string) {
    if (!Auth.user) return;
    if (!this.needNet()) {
      const reqs = store.get<Record<string, any>>('demo_requests', {});
      if (reqs[Auth.user.uid]) {
        reqs[Auth.user.uid] = reqs[Auth.user.uid].filter((r: any) => r.uid !== otherUid);
        store.set('demo_requests', reqs);
      }
      return;
    }
    await Backend.db.ref('shg_requests/' + Auth.user.uid + '/' + otherUid).remove();
  },

  async setOnline(on: boolean) {
    if (!this.needNet() || !Auth.user) return;
    const r = Backend.db.ref('shg_presence/' + Auth.user.uid);
    if (on) {
      r.set({ online: true, at: Date.now() });
      r.onDisconnect().set({ online: false, at: Date.now() });
    } else {
      r.set({ online: false, at: Date.now() });
    }
  },
};

/* --- NET (PVP ROOMS) --- */
export class NetService {
  public room: RoomState | null = null;
  private _off: (() => void)[] = [];
  private _onUpdate: ((room: RoomState) => void) | null = null;

  public needNet(): boolean {
    return Backend.mode === 'firebase';
  }

  public async create(game: string, seats: number = 2): Promise<string | null> {
    const code = String(Math.floor(Math.random() * 9000) + 1000);
    const myUid = Auth.user?.uid || 'u_local';
    const myName = Auth.user?.username || 'Player';
    const room: RoomState = {
      code,
      game,
      seatsNeeded: seats,
      seats: [myUid],
      names: { [myUid]: myName },
      state: null,
      turn: 0,
      status: 'waiting',
      host: myUid,
      created: Date.now(),
    };

    if (this.needNet() && Backend.db) {
      await Backend.db.ref('shg_rooms/' + code).set(room);
      this.room = room;
      this._listen(code);
    } else {
      // Local simulated PvP room
      this.room = room;
      store.set('room_' + code, room);
    }
    return code;
  }

  public async join(code: string): Promise<string | null> {
    code = String(code).trim();
    const myUid = Auth.user?.uid || 'u_local';
    const myName = Auth.user?.username || 'Player';

    if (this.needNet() && Backend.db) {
      const s = await Backend.db.ref('shg_rooms/' + code).get();
      if (!s.exists()) return null;
      const room: RoomState = s.val();
      if (room.status !== 'waiting') return null;
      if (!room.seats.includes(myUid)) {
        if (room.seats.length >= room.seatsNeeded) return null;
        room.seats.push(myUid);
        room.names[myUid] = myName;
        await Backend.db.ref('shg_rooms/' + code + '/seats').set(room.seats);
        await Backend.db.ref('shg_rooms/' + code + '/names').set(room.names);
      }
      this.room = room;
      this._listen(code);
      return code;
    } else {
      const room = store.get<RoomState | null>('room_' + code, null);
      if (!room) return null;
      if (!room.seats.includes(myUid)) {
        room.seats.push(myUid);
        room.names[myUid] = myName;
        store.set('room_' + code, room);
      }
      this.room = room;
      return code;
    }
  }

  public mySeat(): number {
    const myUid = Auth.user?.uid || 'u_local';
    return this.room ? this.room.seats.indexOf(myUid) : -1;
  }

  public isHost(): boolean {
    const myUid = Auth.user?.uid || 'u_local';
    return !!(this.room && this.room.host === myUid);
  }

  private _listen(code: string) {
    this.leave(true);
    if (!this.needNet() || !Backend.db) return;
    const ref = Backend.db.ref('shg_rooms/' + code);
    const h = (snap: any) => {
      const r = snap.val();
      if (!r) return;
      this.room = r;
      if (this._onUpdate) this._onUpdate(r);
    };
    ref.on('value', h);
    this._off.push(() => ref.off('value', h));
  }

  public onUpdate(cb: (room: RoomState) => void) {
    this._onUpdate = cb;
  }

  public async push(patch: Partial<RoomState>) {
    if (!this.room) return;
    Object.assign(this.room, patch);
    if (this.needNet() && Backend.db) {
      await Backend.db.ref('shg_rooms/' + this.room.code).update(patch);
    } else {
      store.set('room_' + this.room.code, this.room);
      if (this._onUpdate) this._onUpdate(this.room);
    }
  }

  public async set(path: string, val: any) {
    if (!this.room) return;
    if (this.needNet() && Backend.db) {
      return Backend.db.ref('shg_rooms/' + this.room.code + '/' + path).set(val);
    } else {
      const keys = path.split('/');
      let cur = this.room as any;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]]) cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = val;
      store.set('room_' + this.room.code, this.room);
      if (this._onUpdate) this._onUpdate(this.room);
    }
  }

  public async leave(silent: boolean = false) {
    this._off.forEach(f => {
      try { f(); } catch (e) {}
    });
    this._off = [];
    if (!silent && this.room && this.needNet() && Backend.db) {
      try {
        if (this.isHost()) await Backend.db.ref('shg_rooms/' + this.room.code).remove();
      } catch (e) {}
    }
    this.room = null;
    this._onUpdate = null;
    Voice.leave();
  }
}

export const Net = new NetService();

/* --- QUIZPVP HELPER --- */
export const QuizPVP = {
  hostSet(net: NetService, items: any) {
    if (net && net.isHost()) {
      net.push({ state: { items, scores: {}, done: {} } });
    }
  },
  submit(net: NetService, score: number) {
    const u = Auth.user?.uid || 'u_local';
    net.set('state/scores/' + u, score);
    net.set('state/done/' + u, true);
  },
  allDone(state: any, seats: string[]): boolean {
    if (!state || !state.done || !Array.isArray(seats)) return false;
    return seats.every(suid => !!state.done[suid]);
  },
  winnerUid(scores: Record<string, number>): string | null {
    let best: string | null = null;
    let bv = -Infinity;
    for (const k of Object.keys(scores || {})) {
      if (scores[k] > bv) {
        bv = scores[k];
        best = k;
      }
    }
    return best;
  },
  async award(didWin: boolean) {
    await Wallet.add(didWin ? PVP_WIN : 0, didWin ? 'pvp-win' : 'pvp-loss');
  },
};

/* --- VOICE (LIVEKIT TOKEN SERVER) --- */
export class VoiceService {
  public room: any = null;
  public micMuted: boolean = false;
  public active: boolean = false;

  public workerUrl(): string {
    return store.get<string>('voice_worker', '');
  }

  public configured(): boolean {
    return !!this.workerUrl();
  }

  public async join(roomName: string): Promise<boolean> {
    if (!this.configured()) return false;
    if (this.active) return true;
    try {
      if (!window.LivekitClient) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js';
        await new Promise((res, rej) => { s.onload = res; s.onerror = rej; document.head.appendChild(s); });
      }
      const username = Auth.user?.username || 'Player';
      const res = await fetch(this.workerUrl() + '?room=' + encodeURIComponent(roomName) + '&identity=' + encodeURIComponent(username));
      if (!res.ok) throw new Error('token server HTTP ' + res.status);
      const txt = (await res.text()).trim();
      let token = txt;
      let lkUrl = '';
      try {
        const j = JSON.parse(txt);
        if (j && j.token) {
          token = String(j.token);
          if (j.url) lkUrl = String(j.url);
        }
      } catch (e) {}
      if (!token) throw new Error('empty token');
      const r = new window.LivekitClient.Room();
      await r.connect(lkUrl, token);
      await r.localParticipant.setMicrophoneEnabled(true);
      this.room = r;
      this.active = true;
      this.micMuted = false;
      return true;
    } catch (e) {
      console.warn('Voice connection error', e);
      return false;
    }
  }

  public toggleMic(): boolean {
    if (!this.room) return false;
    this.micMuted = !this.micMuted;
    try {
      this.room.localParticipant.setMicrophoneEnabled(!this.micMuted);
    } catch (e) {}
    return this.micMuted;
  }

  public leave() {
    if (this.room) {
      try { this.room.disconnect(); } catch (e) {}
    }
    this.room = null;
    this.active = false;
  }
}

export const Voice = new VoiceService();
