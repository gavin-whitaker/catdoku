(() => {
  'use strict';

  const LEVELS = window.CATDOKU_LEVELS || [];
  const SAVE_KEY = 'catdoku_save_v1';
  const GAME_VERSION = '1.2.1';

  const CFG = {
    startYarn: 25,
    costs: { hint: 20, catnip: 10, whiskers: 5 },
    rewardedYarn: 20,
    dailyYarn: 10,
    interstitialEvery: 2,
    interstitialMinLevel: 4,
    interstitialPlacement: 'level_completed',
    adOpenWaitMs: 1800,
    par: { 4: 30, 5: 60, 6: 100, 7: 150, 8: 210 },
    chapterBonus: { 4: 30, 5: 40, 6: 50, 7: 60, 8: 100 },
    stuckMs: { 4: 40000, 5: 50000, 6: 60000, 7: 75000, 8: 90000 },
  };

  const SECTIONS = {
    4: 'Kitten Corner',
    5: 'Cardboard Castle',
    6: 'Sunny Windowsill',
    7: 'Fishmonger Alley',
    8: 'Rooftop Kingdom',
  };

  const COACH = {
    start: 'One cat in every row, column and color. Tap a square twice to place a cat.',
    firstCat: 'Nice! Cats can\'t touch, not even diagonally. Tap once to mark X where a cat can\'t go.',
    twoCats: 'Every color room needs exactly one cat. Finish the board!',
    conflict: 'Hiss! Those cats share a row, column or room, or they touch. Tap a cat to move it.',
  };

  const TIPS = {
    1: 'Drag across squares to paint X marks fast.',
    2: 'Cats can\'t touch, not even corners. They hiss!',
    3: 'Stuck? The LASER places a correct cat for you.',
    5: '5x5! Rooms get twistier from here.',
    9: 'CATNIP sniffs out and removes your mistakes.',
    13: '6x6! WHISKERS marks every square your cats block.',
  };

  const ROOM_COLORS = ['#ff77a8', '#29adff', '#ffec27', '#00e436', '#b38df7', '#ffccaa', '#3fd8c8', '#c2c3c7'];
  const INK = '#1a1020';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const now = () => performance.now();
  const rand = (a, b) => a + Math.random() * (b - a);

  function mulberry32(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seededShuffle(arr, seed) {
    const r = mulberry32(seed * 7919), a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  }

  const fmtTime = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  // =====================================================================
  // Pixel art: every sprite is a matrix of palette keys ('.' = transparent)
  // =====================================================================
  const CAT_BASE = [
    '.KK..........KK.',
    '.KPK........KPK.',
    '.KPOK......KOPK.',
    '.KOOOKKKKKKOOOK.',
    'KOOOOODOODOOOOOK',
    'KOOOOODOODOOOOOK',
    'KOOEBOOOOOOEBOOK',
    'KOOEBOOOOOOEBOOK',
    'KDDOOOWPPWOOODDK',
    '.KOOOWWKKWWOOOK.',
    '..KKOWWWWWWOKK..',
    '...KOOWWWWOOK...',
    '..KOOOWWWWOOOK..',
    '..KOOOWWWWOOOKKK',
    '..KOWWOOOOWWOKOK',
    '...KKKKKKKKKKKK.',
  ];
  const CAT_BLINK = { 6: 'KOOOOOOOOOOOOOOK', 7: 'KOOKKOOOOOOKKOOK' };
  const CAT_TAIL_UP = {
    11: '...KOOWWWWOOK.K.',
    12: '..KOOOWWWWOOOKOK',
    13: '..KOOOWWWWOOOKOK',
    14: '..KOWWOOOOWWOKK.',
    15: '...KKKKKKKKKKK..',
  };

  const CAT_COMMON = { K: INK, P: '#ff8fb1', E: '#7ee05a', B: INK };
  const CAT_VARIANTS = [
    { O: '#f08a24', D: '#b5541a', W: '#fff1e0' }, // orange tabby
    { O: '#8b8fa3', D: '#5d6075', W: '#f2f2f2' }, // grey
    { O: '#3b3550', D: '#25203a', W: '#e8e4f0', E: '#ffec27' }, // tuxedo
    { O: '#f6e7c8', D: '#d9b98a', W: '#ffffff' }, // cream
    { O: '#a0623a', D: '#6e3d22', W: '#f7d9b5' }, // chocolate
  ];
  const CAT_HISS = { K: INK, O: '#ff4040', D: '#b3141e', W: '#ffc2c2', P: '#ff8080', E: '#ffe0e0', B: INK };

  const ICONS = {
    yarn: {
      rows: ['..KKKK..', '.KRRrRK.', 'KRrRRrRK', 'KRRrRRrK', 'KrRRrRRK', 'KRrRRrRK', '.KRRrRK.', '..KKKK.K'],
      pal: { K: INK, R: '#ff4fa0', r: '#b0216a' },
    },
    star: {
      rows: ['....K....', '...KYK...', '...KYK...', 'KKKKYKKKK', 'KYYYYYYYK', '.KYYYYYK.', '..KYYYK..', '.KYYKYYK.', '.KKK.KKK.'],
      pal: { K: INK, Y: '#ffec27' },
    },
    starOff: {
      rows: ['....K....', '...KYK...', '...KYK...', 'KKKKYKKKK', 'KYYYYYYYK', '.KYYYYYK.', '..KYYYK..', '.KYYKYYK.', '.KKK.KKK.'],
      pal: { K: INK, Y: '#5a5578' },
    },
    lock: {
      rows: ['..KKKK..', '.K....K.', '.K....K.', 'KKKKKKKK', 'KGGGGGGK', 'KGGKKGGK', 'KGGGGGGK', 'KKKKKKKK'],
      pal: { K: INK, G: '#9aa0b5' },
    },
    laser: {
      rows: ['......KK', '.....KGK', '....KGK.', '...KKK..', '..r.....', '.r......', 'RR......', 'RR......'],
      pal: { K: INK, G: '#c2c3c7', r: '#ff6b8a', R: '#ff004d' },
    },
    catnip: {
      rows: ['.....KKK', '...KKGGK', '..KGGGGK', '.KGGgGK.', '.KGgGGK.', 'KGgKKK..', 'KgK.....', 'K.......'],
      pal: { K: INK, G: '#00e436', g: '#008751' },
    },
    whiskers: {
      rows: ['.K....K.', 'KOK..KOK', 'KOOKKOOK', 'KOEOOEOK', 'WKOOOOKW', 'KOOPPOOK', 'WKOOOOKW', '.KKKKKK.'],
      pal: { K: INK, O: '#f08a24', E: INK, P: '#ff8fb1', W: '#fff1e8' },
    },
    soundOn: {
      rows: ['...K....', '..KK.K..', 'KKWK..K.', 'KWWK.K.K', 'KWWK.K.K', 'KKWK..K.', '..KK.K..', '...K....'],
      pal: { K: INK, W: '#fff1e8' },
    },
    soundOff: {
      rows: ['...K....', '..KK....', 'KKWKK.K.', 'KWWK.K..', 'KWWKK.K.', 'KKWK....', '..KK....', '...K....'],
      pal: { K: INK, W: '#fff1e8' },
    },
  };

  // Rasterises a sprite matrix pixel-by-pixel with fillRect.
  function drawMatrix(ctx, rows, pal, ox = 0, oy = 0, px = 1) {
    for (let y = 0; y < rows.length; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(ox + x * px, oy + y * px, px, px);
      }
    }
  }

  function matrixCanvas(rows, pal) {
    const c = document.createElement('canvas');
    c.width = rows[0].length;
    c.height = rows.length;
    drawMatrix(c.getContext('2d'), rows, pal);
    return c;
  }

  const catRows = (blink, tailUp) =>
    CAT_BASE.map((row, i) => (blink && CAT_BLINK[i]) || (tailUp && CAT_TAIL_UP[i]) || row);

  // FRAMES[hiss][variant][blink + tailUp*2] -> 16x16 offscreen canvas
  let FRAMES = [];
  function buildSprites() {
    FRAMES = [0, 1].map((hiss) =>
      CAT_VARIANTS.map((v) =>
        [0, 1, 2, 3].map((k) => {
          const pal = hiss ? CAT_HISS : Object.assign({}, CAT_COMMON, v);
          return matrixCanvas(catRows(k & 1, k & 2), pal);
        })
      )
    );
  }

  // Idle loop: tail swishes every second, eyes blink every ~3.4s; seed desyncs each cat.
  function catFrame(variant, t, seed, hiss) {
    const tailUp = (Math.floor(t / 1000 + seed * 0.37) & 1) === 1;
    const blink = (t + seed * 997) % 3400 < 170;
    return FRAMES[hiss ? 1 : 0][variant % CAT_VARIANTS.length][(blink ? 1 : 0) + (tailUp ? 2 : 0)];
  }

  const iconURL = {};
  function buildIcons() {
    for (const k in ICONS) iconURL[k] = matrixCanvas(ICONS[k].rows, ICONS[k].pal).toDataURL();
    applyIcons(document);
  }
  function applyIcons(root) {
    $$('.ico[data-ico]', root).forEach((el) => {
      el.style.backgroundImage = `url(${iconURL[el.dataset.ico]})`;
    });
  }
  const ico = (k) => `<i class="ico" data-ico="${k}"></i>`;

  // =====================================================================
  // Save data
  // =====================================================================
  const defaultSave = () => ({
    yarn: CFG.startYarn,
    unlocked: 0,
    stars: {},
    best: {},
    chapters: {},
    muted: false,
    seenHelp: false,
    lastDaily: '',
  });
  // Treat storage as untrusted input. Keep valid progress, not malformed field types.
  function normalizeSave(raw) {
    const clean = defaultSave();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return clean;
    const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
    const level = (key) => /^\d+$/.test(key) && +key < LEVELS.length;
    if (Number.isSafeInteger(raw.yarn) && raw.yarn >= 0) clean.yarn = raw.yarn;
    if (Number.isInteger(raw.unlocked) && raw.unlocked >= 0) clean.unlocked = Math.min(raw.unlocked, LEVELS.length);
    if (record(raw.stars)) for (const [key, value] of Object.entries(raw.stars)) {
      if (level(key) && Number.isInteger(value) && value >= 1 && value <= 3) clean.stars[key] = value;
    }
    if (record(raw.best)) for (const [key, value] of Object.entries(raw.best)) {
      if (level(key) && Number.isFinite(value) && value >= 0) clean.best[key] = value;
    }
    if (record(raw.chapters)) for (const [key, value] of Object.entries(raw.chapters)) {
      if ([4, 5, 6, 7, 8].includes(+key) && value === 1) clean.chapters[key] = 1;
    }
    if (typeof raw.muted === 'boolean') clean.muted = raw.muted;
    if (typeof raw.seenHelp === 'boolean') clean.seenHelp = raw.seenHelp;
    if (typeof raw.lastDaily === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(raw.lastDaily)) clean.lastDaily = raw.lastDaily;
    return clean;
  }
  let save = defaultSave();

  // =====================================================================
  // Game state
  // =====================================================================
  const G = {
    screen: 'loading',
    idx: 0,
    n: 4,
    reg: [],
    sol: [],
    colors: [],
    colorsDark: [],
    attacks: [],
    cells: new Uint8Array(16), // 0 empty, 1 X mark, 2 cat
    locked: new Set(),
    history: [],
    elapsed: 0,
    won: false,
    winAt: 0,
    conflictCats: new Set(),
    badCells: new Set(),
    satisfied: new Set(),
    prevConflicts: 0,
    popAt: new Map(),
    laser: null,
    pauses: new Set(),
    adBusy: false,
    adCounter: 0,
    lastReward: 0,
    doubled: false,
    active: false,
    tutorial: false,
    hints: 0,
    mistakes: 0,
    bestSat: 0,
    lastProgressAt: 0,
    mistakesAtProgress: 0,
    nudged: false,
  };

  function setPause(reason, on) {
    if (on) G.pauses.add(reason);
    else G.pauses.delete(reason);
    Sfx.apply();
  }

  // =====================================================================
  // Playgama Bridge wrapper (falls back to local test mode if the SDK is absent)
  // =====================================================================
  const Platform = {
    b: null,
    adCb: { interstitial: null, rewarded: null },
    pendingAd: null,
    adStates: { interstitial: 'closed', rewarded: 'closed' },

    syncAdPause() {
      setPause('ad', Object.values(this.adStates).some((state) => state === 'opened' || state === 'rewarded'));
    },

    async init() {
      const b = window.bridge;
      if (!b || typeof b.initialize !== 'function') {
        console.info('[CatDoku] Playgama Bridge not loaded - running in local test mode.');
        return;
      }
      try {
        await Promise.race([
          b.initialize(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Bridge init timeout')), 10000)),
        ]);
      } catch (e) {
        console.warn('[CatDoku] Bridge init failed - local test mode.', e);
        return;
      }
      this.b = b;
      console.log('Playgama SDK Initialized');

      const E = b.EVENT_NAME || {};
      const on = (target, key, fallback, fn) => {
        try {
          if (target && typeof target.on === 'function') target.on(E[key] || fallback, fn);
        } catch (e) { /* event unsupported on this platform */ }
      };
      on(b.platform, 'PAUSE_STATE_CHANGED', 'pause_state_changed', (p) => setPause('platform', !!p));
      on(b.platform, 'AUDIO_STATE_CHANGED', 'audio_state_changed', (enabled) => {
        Sfx.platformOn = !!enabled;
        Sfx.apply();
      });
      for (const [kind, event] of [['interstitial', 'INTERSTITIAL_STATE_CHANGED'], ['rewarded', 'REWARDED_STATE_CHANGED']]) {
        on(b.advertisement, event, kind + '_state_changed', (state) => {
          this.adStates[kind] = state;
          if (this.adCb[kind]) this.adCb[kind](state);
          this.syncAdPause();
        });
      }
      try {
        if (b.platform && typeof b.platform.isAudioEnabled === 'boolean') Sfx.platformOn = b.platform.isAudioEnabled;
        setPause('platform', !!b.platform?.isPaused);
        this.adStates.interstitial = b.advertisement?.interstitialState || 'closed';
        this.adStates.rewarded = b.advertisement?.rewardedState || 'closed';
        this.syncAdPause();
      } catch (e) { /* ignore */ }
    },

    message(key) {
      if (!this.b) return;
      try {
        const M = this.b.PLATFORM_MESSAGE || {};
        const p = this.b.platform.sendMessage(M[key] || key.toLowerCase());
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) { /* message unsupported on this platform */ }
    },

    hasStorage() {
      return !!(this.b && this.b.storage && typeof this.b.storage.get === 'function' && typeof this.b.storage.set === 'function');
    },

    async load() {
      let raw = null;
      if (this.hasStorage()) {
        try {
          raw = await Promise.race([this.b.storage.get(SAVE_KEY), new Promise((r) => setTimeout(() => r(null), 3000))]);
        } catch (e) { raw = null; }
      } else {
        try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { raw = null; }
      }
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (e) { return null; }
      }
      return raw && typeof raw === 'object' ? raw : null;
    },

    save(data) {
      const s = JSON.stringify(data);
      if (this.hasStorage()) {
        try {
          const p = this.b.storage.set(SAVE_KEY, s);
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) { /* save skipped */ }
        return;
      }
      try { localStorage.setItem(SAVE_KEY, s); } catch (e) { /* storage unavailable */ }
    },

    track(name, data) {
      const a = this.b && this.b.analytics;
      if (!a || typeof a.send !== 'function') return;
      try { a.send(name, Object.assign({ game_version: GAME_VERSION }, data || {})); } catch (e) { /* analytics unavailable */ }
    },

    lastInterstitialAt: 0,

    interstitialCooldownMs() {
      const adv = this.b && this.b.advertisement;
      const sec = adv && typeof adv.minimumDelayBetweenInterstitial === 'number' ? adv.minimumDelayBetweenInterstitial : 60;
      return sec * 1000;
    },

    interstitialReady() {
      if (!this.b || this.pendingAd || this.b.advertisement?.isInterstitialSupported === false) return false;
      return Date.now() - this.lastInterstitialAt >= this.interstitialCooldownMs();
    },

    preloadInterstitial() {
      const adv = this.b && this.b.advertisement;
      try {
        if (adv && typeof adv.preloadInterstitial === 'function') adv.preloadInterstitial(CFG.interstitialPlacement);
      } catch (e) { /* preload unsupported */ }
    },

    // Resolves true when shown (interstitial) / rewarded (rewarded), false otherwise, 'local' in test mode.
    // If the ad has not opened within openWithinMs the promise resolves false and the game moves on;
    // a late-opening ad still pauses the game through the 'ad' pause reason.
    showAd(kind, openWithinMs = 12000) {
      const b = this.b;
      if (!b) return Promise.resolve(kind === 'rewarded' ? 'local' : false);
      const adv = b.advertisement;
      const supported = kind === 'rewarded' ? adv?.isRewardedSupported : adv?.isInterstitialSupported;
      if (supported === false || this.pendingAd) return Promise.resolve(false);
      return new Promise((resolve) => {
        const request = { kind };
        this.pendingAd = request;
        let opened = false, rewarded = false, done = false;
        const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
        let timer;
        const release = () => {
          clearTimeout(timer);
          if (this.pendingAd === request) this.pendingAd = null;
          if (this.adCb[kind] === onState) this.adCb[kind] = null;
        };
        const onState = (state) => {
          if (this.pendingAd !== request) return;
          if (state === 'opened') { opened = true; setPause('ad', true); }
          else if (state === 'rewarded') rewarded = true;
          else if (state === 'closed' || state === 'failed') {
            setPause('ad', false);
            if (kind === 'interstitial' && opened && state === 'closed') {
              this.lastInterstitialAt = Date.now();
              this.preloadInterstitial();
            }
            release();
            finish(state === 'closed' && (kind === 'rewarded' ? rewarded : opened));
          }
        };
        this.adCb[kind] = onState;
        // A timeout releases the UI, not the SDK request. A late opening must still
        // pause gameplay and must not be confused with a second ad request.
        timer = setTimeout(() => { if (!opened) finish(false); }, openWithinMs);
        let result;
        try {
          if (adv && kind === 'rewarded' && typeof adv.showRewarded === 'function') result = adv.showRewarded();
          else if (adv && kind === 'interstitial' && typeof adv.showInterstitial === 'function') result = adv.showInterstitial(CFG.interstitialPlacement);
          else if (kind === 'rewarded' && typeof b.showRewardedVideo === 'function') {
            result = b.showRewardedVideo({ callbacks: {
              onOpen: () => onState('opened'), onRewarded: () => onState('rewarded'),
              onClose: () => onState('closed'), onError: () => onState('failed'),
            } });
          } else if (kind === 'interstitial' && typeof b.showInterstitial === 'function') {
            result = b.showInterstitial({ callbacks: {
              onOpen: () => onState('opened'), onClose: () => onState('closed'), onError: () => onState('failed'),
            } });
          } else onState('failed');
          if (result && typeof result.catch === 'function') result.catch(() => onState('failed'));
        } catch (e) { onState('failed'); }
      });
    },
  };

  function persist() {
    Platform.save(save);
  }

  // =====================================================================
  // Performance sampling (aggregated, active visible gameplay only)
  // =====================================================================
  const Perf = {
    times: [], activeMs: 0, start: 0, prevActive: false, errors: 0, rejections: 0,

    frame(raw, active) {
      if (!active) { this.prevActive = false; return; }
      if (!this.prevActive) {
        // First active frame after a pause/hide: its gap is not a rendered frame.
        this.prevActive = true;
        if (!this.start) this.start = now();
        return;
      }
      this.times.push(raw);
      this.activeMs += raw;
      if (this.activeMs >= 30000) this.flush();
    },

    reset() {
      this.times = []; this.activeMs = 0; this.start = 0; this.errors = 0; this.rejections = 0;
    },

    flush() {
      const ft = this.times.slice().sort((a, b) => a - b), n = ft.length;
      if (n < 30) { this.reset(); return; }
      const pct = (p) => ft[Math.min(n - 1, Math.ceil(p * n) - 1)];
      const over = (ms) => ft.reduce((c, v) => c + (v > ms ? 1 : 0), 0);
      const r1 = (v) => Math.round(v * 10) / 10;
      Platform.track('performance_sample', {
        target_fps: 60,
        window_ms: Math.round(now() - this.start),
        active_ms: Math.round(this.activeMs),
        frame_count: n,
        fps_avg: r1((n * 1000) / this.activeMs),
        fps_p10: r1(1000 / pct(0.9)),
        frame_time_p50_ms: r1(pct(0.5)),
        frame_time_p95_ms: r1(pct(0.95)),
        frame_time_p99_ms: r1(pct(0.99)),
        frame_time_max_ms: r1(ft[n - 1]),
        frames_over_50ms: over(50),
        frames_over_100ms: over(100),
        frames_over_250ms: over(250),
        frames_over_500ms: over(500),
        frames_over_1000ms: over(1000),
        js_error_count: this.errors,
        unhandled_rejection_count: this.rejections,
      });
      this.reset();
    },
  };
  window.addEventListener('error', () => { Perf.errors++; });
  window.addEventListener('unhandledrejection', () => { Perf.rejections++; });

  // =====================================================================
  // Progression telemetry
  // =====================================================================
  const levelId = (idx) => 'L' + String(idx + 1).padStart(2, '0');
  const levelData = (extra) => Object.assign({
    level_id: levelId(G.idx),
    step_index: G.idx + 1,
    grid: G.n,
  }, extra || {});

  function abandonLevel(reason) {
    if (!G.active || G.won) return;
    G.active = false;
    Platform.track('progression_abandoned', levelData({
      reason,
      duration_sec: Math.round(G.elapsed / 1000),
      hints_used: G.hints,
      mistakes: G.mistakes,
    }));
  }

  // =====================================================================
  // Procedural 8-bit sound (WebAudio, no files)
  // =====================================================================
  const Sfx = {
    ctx: null,
    master: null,
    platformOn: true,

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      }
      this.apply();
    },
    enabled() {
      return !save.muted && this.platformOn && !G.pauses.has('ad') && !G.pauses.has('hidden') && !G.pauses.has('platform');
    },
    apply() {
      if (!this.ctx) return;
      if (this.enabled()) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      } else if (this.ctx.state === 'running') {
        this.ctx.suspend().catch(() => {});
      }
    },
    tone(f, d, { type = 'square', vol = 0.1, to = 0, at = 0 } = {}) {
      if (!this.ctx || !this.enabled()) return;
      const t0 = this.ctx.currentTime + at;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t0);
      if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + d + 0.02);
    },
    noise(d, vol) {
      if (!this.ctx || !this.enabled()) return;
      const len = Math.floor(this.ctx.sampleRate * d);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(), hp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      src.buffer = buf;
      hp.type = 'highpass';
      hp.frequency.value = 2500;
      g.gain.value = vol;
      src.connect(hp).connect(g).connect(this.master);
      src.start();
    },
    mark() { this.tone(420, 0.05, { type: 'triangle', vol: 0.08 }); },
    erase() { this.tone(260, 0.05, { type: 'triangle', vol: 0.06 }); },
    meow() {
      this.tone(520, 0.14, { to: 880, vol: 0.07 });
      this.tone(880, 0.16, { to: 560, at: 0.12, vol: 0.06 });
    },
    hiss() { this.noise(0.32, 0.18); },
    chime() { [784, 988, 1175].forEach((f, i) => this.tone(f, 0.12, { at: i * 0.07, vol: 0.07 })); },
    win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { at: i * 0.11, vol: 0.08 })); },
    coin() {
      this.tone(988, 0.07, { vol: 0.07 });
      this.tone(1319, 0.22, { at: 0.07, vol: 0.07 });
    },
    nope() { this.tone(160, 0.16, { type: 'sawtooth', vol: 0.07 }); },
    laser() { this.tone(1800, 0.5, { to: 300, type: 'sawtooth', vol: 0.04 }); },
    sniff() { [0, 0.1, 0.2].forEach((at, i) => this.tone(600 + i * 150, 0.05, { at, type: 'triangle', vol: 0.06 })); },
  };

  // =====================================================================
  // UI helpers
  // =====================================================================
  let toastTimer = 0;
  function toast(msg, icon) {
    const el = $('#toast');
    el.innerHTML = (icon ? ico(icon) : '') + msg;
    applyIcons(el);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function updateYarn(bump) {
    $$('.yarn-count').forEach((el) => { el.textContent = save.yarn; });
    if (bump) {
      $$('.yarn-pill').forEach((el) => {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      });
    }
    $$('.pu').forEach((el) => {
      const short = save.yarn < CFG.costs[el.dataset.action];
      if (el.dataset.action === 'hint') {
        el.classList.toggle('free', short);
        el.classList.remove('cant');
      } else {
        el.classList.toggle('cant', short);
      }
    });
  }

  function updateSoundBtn() {
    $$('.sound-ico').forEach((el) => {
      el.dataset.ico = save.muted ? 'soundOff' : 'soundOn';
      el.style.backgroundImage = `url(${iconURL[el.dataset.ico]})`;
    });
  }

  function showScreen(name) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    G.screen = name;
  }

  function openModal(html) {
    const card = $('#modalCard');
    card.innerHTML = html;
    applyIcons(card);
    if (Platform.b?.advertisement?.isRewardedSupported === false) {
      $$('[data-action=watchad], [data-action=double], [data-action=freelaser]', card).forEach((el) => { el.classList.add('hidden'); });
    }
    $('#modal').classList.remove('hidden');
    setPause('modal', true);
  }

  function closeModal() {
    $('#modal').classList.add('hidden');
    setPause('modal', false);
  }

  async function rewardedAd() {
    if (G.adBusy) return false;
    G.adBusy = true;
    toast('Loading ad...');
    const r = await Platform.showAd('rewarded');
    G.adBusy = false;
    if (r === 'local') {
      toast('Local test: ad simulated');
      return true;
    }
    if (!r) toast('No ad available right now');
    return !!r;
  }

  // Waits at most CFG.adOpenWaitMs for an interstitial to open, behind a visible "ad break" veil,
  // so a slow ad network never looks like a frozen game.
  async function adBreak() {
    if (G.idx + 1 < CFG.interstitialMinLevel || G.adCounter < CFG.interstitialEvery) return;
    if (!Platform.interstitialReady()) return;
    G.adCounter = 0;
    const veil = $('#adBreak');
    veil.classList.remove('hidden');
    setPause('adwait', true);
    try {
      await Platform.showAd('interstitial', CFG.adOpenWaitMs);
    } finally {
      veil.classList.add('hidden');
      setPause('adwait', false);
    }
  }

  function chapterOf(idx) {
    const n = LEVELS[idx].size;
    const list = [];
    LEVELS.forEach((L, i) => { if (L.size === n) list.push(i); });
    return { n, list, cleared: list.filter((i) => save.stars[i]).length };
  }

  // =====================================================================
  // Level setup & rules
  // =====================================================================
  function startLevel(idx) {
    abandonLevel(idx === G.idx ? 'restart' : 'switch');
    const L = LEVELS[idx];
    const n = L.size;
    G.idx = idx;
    G.n = n;
    G.reg = L.regions.join('').split('').map((ch) => ch.charCodeAt(0) - 65);
    G.sol = L.solution.slice();
    G.colors = seededShuffle(ROOM_COLORS, idx + 1);
    G.colorsDark = G.colors.map((c) => shade(c, 0.9));
    G.cells = new Uint8Array(n * n);
    G.locked = new Set();
    G.history = [];
    G.elapsed = 0;
    G.won = false;
    G.satisfied = new Set();
    G.conflictCats = new Set();
    G.badCells = new Set();
    G.prevConflicts = 0;
    G.popAt = new Map();
    G.laser = null;
    G.doubled = false;
    G.active = true;
    G.tutorial = idx === 0 && !save.stars[0];
    G.hints = 0;
    G.mistakes = 0;
    G.bestSat = 0;
    G.lastProgressAt = 0;
    G.mistakesAtProgress = 0;
    G.nudged = false;
    G.attacks = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, list = [];
      for (let k = 0; k < n * n; k++) {
        if (k === i) continue;
        const kr = Math.floor(k / n), kc = k % n;
        if (kr === r || kc === c || G.reg[k] === G.reg[i] || (Math.abs(kr - r) <= 1 && Math.abs(kc - c) <= 1)) list.push(k);
      }
      G.attacks.push(list);
    }

    $('#levelTitle').textContent = `LEVEL ${idx + 1}`;
    $('#levelSub').textContent = `${n}x${n} ${SECTIONS[n]}`;
    setTip(TIPS[idx] || (idx === 0 ? COACH.start : ''), G.tutorial);
    $$('.pu').forEach((el) => el.classList.remove('nudge'));
    showScreen('game');
    layoutBoard();
    evaluate(true);
    updateTimer(true);
    updateYarn();
    Platform.message('GAMEPLAY_STARTED');
    Platform.track('progression_started', levelData({ replay: !!save.stars[idx] }));
  }

  function setTip(text, coach) {
    const el = $('#tipBar');
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('coach', !!coach);
  }

  function coachTip(cats, conflicts) {
    if (!G.tutorial || G.won) return;
    const text = conflicts ? COACH.conflict : cats >= 2 ? COACH.twoCats : cats === 1 ? COACH.firstCat : COACH.start;
    setTip(text, true);
  }

  function nudgeStuck() {
    G.nudged = true;
    const free = save.yarn < CFG.costs.hint;
    setTip(free ? 'Stuck? Tap the LASER for a free hint.' : 'Stuck? The LASER drops in a correct cat.', true);
    $('.pu[data-action="hint"]').classList.add('nudge');
    Platform.track('stuck_nudge_shown', levelData({ duration_sec: Math.round(G.elapsed / 1000) }));
  }

  function checkStuck() {
    if (G.nudged || G.tutorial || G.won || G.laser) return;
    const idle = G.elapsed - G.lastProgressAt >= CFG.stuckMs[G.n];
    const flailing = G.mistakes - G.mistakesAtProgress >= 3 && G.elapsed - G.lastProgressAt >= 15000;
    if (idle || flailing) nudgeStuck();
  }

  const isSol = (i) => G.sol[Math.floor(i / G.n)] === i % G.n;

  function pushHistory() {
    G.history.push(G.cells.slice());
    if (G.history.length > 200) G.history.shift();
  }

  function evaluate(silent) {
    const { n, cells, reg } = G;
    const rows = new Array(n).fill(0), cols = new Array(n).fill(0), regs = new Array(n).fill(0);
    const cats = [];
    for (let i = 0; i < n * n; i++) {
      if (cells[i] !== 2) continue;
      cats.push(i);
      rows[Math.floor(i / n)]++;
      cols[i % n]++;
      regs[reg[i]]++;
    }
    const conflict = new Set(), bad = new Set();
    for (const i of cats) {
      const r = Math.floor(i / n), c = i % n;
      if (rows[r] > 1 || cols[c] > 1 || regs[reg[i]] > 1) conflict.add(i);
      for (const j of cats) {
        if (j !== i && Math.abs(Math.floor(j / n) - r) <= 1 && Math.abs((j % n) - c) <= 1) conflict.add(i);
      }
    }
    for (let i = 0; i < n * n; i++) {
      if (rows[Math.floor(i / n)] > 1 || cols[i % n] > 1 || regs[reg[i]] > 1) bad.add(i);
    }
    if (!silent && conflict.size > G.prevConflicts) { Sfx.hiss(); G.mistakes++; }
    G.prevConflicts = conflict.size;
    G.conflictCats = conflict;
    G.badCells = bad;

    const sat = new Set();
    for (let g = 0; g < n; g++) {
      if (regs[g] !== 1) continue;
      const cat = cats.find((i) => reg[i] === g);
      if (!conflict.has(cat)) sat.add(g);
    }
    let fresh = false;
    if (!silent) {
      for (const g of sat) {
        if (!G.satisfied.has(g)) { regionConfetti(g); fresh = true; }
      }
    }
    G.satisfied = sat;
    if (sat.size > G.bestSat) {
      G.bestSat = sat.size;
      G.lastProgressAt = G.elapsed;
      G.mistakesAtProgress = G.mistakes;
    }
    if (!silent) coachTip(cats.length, conflict.size);

    $('#catCounter').textContent = `${cats.length}/${n}`;
    if (cats.length === n && conflict.size === 0 && !G.won) win();
    else if (fresh) Sfx.chime();
  }

  function win() {
    G.won = true;
    G.winAt = now();
    Platform.message('GAMEPLAY_STOPPED');
    const n = G.n, par = CFG.par[n], t = G.elapsed / 1000;
    const stars = t <= par ? 3 : t <= par * 2 ? 2 : 1;
    const firstClear = !save.stars[G.idx];
    const fullBase = 5 + (n - 4) * 3;
    const base = firstClear ? fullBase : Math.ceil(fullBase / 2);
    const speed = Math.max(0, Math.round(fullBase * 1.5 * (1 - t / (par * 2))));
    const total = base + speed;
    const prevBest = save.best[G.idx];

    save.yarn += total;
    save.stars[G.idx] = Math.max(save.stars[G.idx] || 0, stars);
    if (!prevBest || G.elapsed < prevBest) save.best[G.idx] = Math.round(G.elapsed);
    save.unlocked = Math.max(save.unlocked, Math.min(G.idx + 1, LEVELS.length));

    const ch = chapterOf(G.idx);
    let chapterBonus = 0;
    if (ch.cleared === ch.list.length && !save.chapters[ch.n]) {
      save.chapters[ch.n] = 1;
      chapterBonus = CFG.chapterBonus[ch.n] || 0;
      save.yarn += chapterBonus;
      Platform.track('chapter_completed', { grid: ch.n });
    }
    persist();
    G.lastReward = total;
    G.adCounter++;
    G.active = false;

    Platform.track('progression_completed', levelData({
      replay: !firstClear,
      stars,
      duration_sec: Math.round(t),
      hints_used: G.hints,
      mistakes: G.mistakes,
    }));
    if (G.tutorial) Platform.track('tutorial_completed', { duration_sec: Math.round(t) });

    Sfx.win();
    bigConfetti();
    setTimeout(() => {
      updateYarn(true);
      showWinModal({ stars, t: G.elapsed, base, speed, total, firstClear, prevBest, ch, chapterBonus });
    }, 900);
  }

  // =====================================================================
  // Player actions
  // =====================================================================
  function tapCell(i) {
    if (G.won || G.pauses.size) return;
    if (G.locked.has(i)) {
      Sfx.nope();
      toast('The laser cat stays put!');
      return;
    }
    pushHistory();
    const next = (G.cells[i] + 1) % 3;
    G.cells[i] = next;
    if (next === 1) Sfx.mark();
    else if (next === 2) { Sfx.meow(); G.popAt.set(i, now()); }
    else Sfx.erase();
    evaluate();
  }

  function spend(kind) {
    const cost = CFG.costs[kind];
    if (save.yarn < cost) {
      Sfx.nope();
      openShop(`You need ${cost} yarn for that. Watch a short ad to get more!`);
      return false;
    }
    save.yarn -= cost;
    persist();
    updateYarn(true);
    Sfx.coin();
    return true;
  }

  function missingRows() {
    const { n, sol, cells } = G;
    const missing = [];
    for (let r = 0; r < n; r++) if (cells[r * n + sol[r]] !== 2) missing.push(r);
    return missing;
  }

  function useHint() {
    if (G.won || G.laser) return;
    if (!missingRows().length) { toast('Every cat is already in place!'); return; }
    if (save.yarn < CFG.costs.hint) {
      Sfx.nope();
      openFreeLaser();
      return;
    }
    if (!spend('hint')) return;
    fireLaser('yarn');
  }

  function fireLaser(paid) {
    const missing = missingRows();
    if (G.won || G.laser || !missing.length) return;
    const r = missing[Math.floor(Math.random() * missing.length)];
    G.laser = { t0: now(), target: r * G.n + G.sol[r] };
    G.hints++;
    $('.pu[data-action="hint"]').classList.remove('nudge');
    Platform.track('powerup_used', levelData({ type: 'laser', paid }));
    Sfx.laser();
  }

  function finishHint(target) {
    const { cells } = G;
    for (const k of G.attacks[target]) if (cells[k] === 2 && !G.locked.has(k)) cells[k] = 0;
    cells[target] = 2;
    G.locked.add(target);
    G.popAt.set(target, now());
    G.history = [];
    Sfx.meow();
    evaluate();
  }

  function useCatnip() {
    if (G.won) return;
    const wrong = [];
    for (let i = 0; i < G.cells.length; i++) {
      if ((G.cells[i] === 2 && !isSol(i)) || (G.cells[i] === 1 && isSol(i))) wrong.push(i);
    }
    const placed = G.cells.some((v) => v);
    if (!placed) { toast('Place some cats or X marks first'); return; }
    if (!spend('catnip')) return;
    Platform.track('powerup_used', levelData({ type: 'catnip', paid: 'yarn' }));
    Sfx.sniff();
    if (!wrong.length) {
      toast('No mistakes. Purrfect so far!', 'catnip');
      return;
    }
    pushHistory();
    for (const i of wrong) {
      G.cells[i] = 0;
      cellPuff(i, ['#00e436', '#008751', '#fff1e8']);
    }
    toast(`Sniffed out ${wrong.length} mistake${wrong.length > 1 ? 's' : ''}!`, 'catnip');
    evaluate(true);
  }

  function useWhiskers() {
    if (G.won) return;
    const targets = new Set();
    G.cells.forEach((v, i) => {
      if (v === 2) for (const k of G.attacks[i]) if (G.cells[k] === 0) targets.add(k);
    });
    if (!G.cells.includes(2)) { toast('Place a cat first'); return; }
    if (!targets.size) { toast('Nothing left to mark'); return; }
    if (!spend('whiskers')) return;
    Platform.track('powerup_used', levelData({ type: 'whiskers', paid: 'yarn' }));
    pushHistory();
    for (const k of targets) G.cells[k] = 1;
    Sfx.mark();
    evaluate(true);
  }

  function undo() {
    if (G.won) return;
    const prev = G.history.pop();
    if (!prev) { Sfx.nope(); return; }
    G.cells = prev;
    for (const i of G.locked) G.cells[i] = 2;
    Sfx.erase();
    evaluate(true);
  }

  function clearBoard() {
    if (G.won || !G.cells.some((v, i) => v && !G.locked.has(i))) return;
    pushHistory();
    G.cells = G.cells.map((v, i) => (G.locked.has(i) ? 2 : 0));
    Sfx.erase();
    evaluate(true);
  }

  // =====================================================================
  // Board rendering
  // =====================================================================
  const B = { canvas: null, ctx: null, dpr: 1, size: 0, cell: 0, pad: 0, stripe: null };

  function layoutBoard() {
    if (G.screen !== 'game') return;
    const wrap = $('#boardWrap');
    const avail = Math.max(140, Math.min(wrap.clientWidth, wrap.clientHeight) - 16);
    const n = G.n;
    const pad = Math.max(4, Math.round(avail * 0.015));
    const cell = Math.floor((avail - pad * 2) / n);
    const size = cell * n + pad * 2;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cv = B.canvas;
    cv.style.width = cv.style.height = size + 'px';
    cv.width = cv.height = Math.round(size * dpr);
    Object.assign(B, { dpr, size, cell, pad });

    const px = Math.max(2, Math.round(cell / 14));
    const tile = document.createElement('canvas');
    tile.width = tile.height = px * 4;
    const tg = tile.getContext('2d');
    tg.fillStyle = 'rgba(255,0,77,0.55)';
    for (let k = 0; k < 4; k++) tg.fillRect(k * px, (3 - k) * px, px, px);
    B.stripe = B.ctx.createPattern(tile, 'repeat');
  }

  function cellAt(e) {
    const rect = B.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - B.pad, y = e.clientY - rect.top - B.pad;
    const c = Math.floor(x / B.cell), r = Math.floor(y / B.cell);
    if (c < 0 || r < 0 || c >= G.n || r >= G.n) return -1;
    return r * G.n + c;
  }

  const X_MARK = ['X...X', '.X.X.', '..X..', '.X.X.', 'X...X'];

  function drawBoard(t) {
    const { ctx, cell, pad, size, dpr } = B;
    const { n, reg, cells } = G;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, x = pad + c * cell, y = pad + r * cell;
      ctx.fillStyle = (r + c) % 2 ? G.colorsDark[reg[i]] : G.colors[reg[i]];
      ctx.fillRect(x, y, cell, cell);
      if (G.badCells.has(i)) {
        ctx.fillStyle = B.stripe;
        ctx.fillRect(x, y, cell, cell);
      }
    }

    ctx.fillStyle = 'rgba(26,16,32,0.25)';
    for (let k = 1; k < n; k++) {
      ctx.fillRect(pad + k * cell, pad, 1, n * cell);
      ctx.fillRect(pad, pad + k * cell, n * cell, 1);
    }

    const bw = Math.max(2, Math.round(cell * 0.08));
    ctx.fillStyle = INK;
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), c = i % n, x = pad + c * cell, y = pad + r * cell;
      if (c < n - 1 && reg[i] !== reg[i + 1]) ctx.fillRect(x + cell - bw / 2, y - bw / 2, bw, cell + bw);
      if (r < n - 1 && reg[i] !== reg[i + n]) ctx.fillRect(x - bw / 2, y + cell - bw / 2, cell + bw, bw);
    }

    const xpx = Math.max(2, Math.floor(cell / 14));
    const xOff = Math.round((cell - xpx * 5) / 2);
    const xPal = { X: 'rgba(26,16,32,0.6)' };
    const scale = Math.floor((cell * 0.8) / 16);
    const baseS = scale >= 2 ? scale * 16 : Math.round(cell * 0.82);
    const hissOn = Math.floor(t / 200) % 2 === 0;

    for (let i = 0; i < n * n; i++) {
      const v = cells[i];
      if (!v) continue;
      const r = Math.floor(i / n), c = i % n, x = pad + c * cell, y = pad + r * cell;
      if (v === 1) {
        drawMatrix(ctx, X_MARK, xPal, x + xOff, y + xOff, xpx);
        continue;
      }
      let s = baseS;
      const pop = G.popAt.get(i);
      if (pop !== undefined) {
        const p = Math.max(0, (t - pop) / 220);
        if (p >= 1) G.popAt.delete(i);
        else {
          const k = 1.70158, q = p - 1;
          s = Math.round(baseS * (0.3 + 0.7 * (1 + (k + 1) * q * q * q + k * q * q)));
        }
      }
      const conflicted = G.conflictCats.has(i);
      let dx = 0, dy = 0;
      if (conflicted) dx = Math.round(Math.sin(t / 30 + i) * Math.max(1, cell * 0.03));
      if (G.won && t - G.winAt < 2500) dy = -Math.round(Math.abs(Math.sin((t - G.winAt) / 140 + i * 0.6)) * cell * 0.12);
      const frame = catFrame(reg[i], t, i, conflicted && hissOn);
      const ox = Math.round(x + (cell - s) / 2) + dx, oy = Math.round(y + (cell - s) / 2) + dy;
      ctx.drawImage(frame, ox, oy, s, s);

      if (G.locked.has(i)) {
        const L = Math.max(4, Math.round(cell * 0.18)), w = Math.max(2, Math.round(cell * 0.05)), m = w;
        ctx.fillStyle = '#fff1e8';
        ctx.fillRect(x + m, y + m, L, w); ctx.fillRect(x + m, y + m, w, L);
        ctx.fillRect(x + cell - m - L, y + m, L, w); ctx.fillRect(x + cell - m - w, y + m, w, L);
        ctx.fillRect(x + m, y + cell - m - w, L, w); ctx.fillRect(x + m, y + cell - m - L, w, L);
        ctx.fillRect(x + cell - m - L, y + cell - m - w, L, w); ctx.fillRect(x + cell - m - w, y + cell - m - L, w, L);
      }
    }

    if (G.laser) drawLaser(t);
  }

  function drawLaser(t) {
    const { ctx, cell, pad, size } = B;
    const L = G.laser, n = G.n;
    const p = Math.max(0, Math.min(1, (t - L.t0) / 650));
    const tx = pad + (L.target % n) * cell + cell / 2, ty = pad + Math.floor(L.target / n) * cell + cell / 2;
    const fx = size - pad, fy = pad;
    const s = Math.max(4, Math.round(cell * 0.14));
    for (let k = 7; k >= 0; k--) {
      const q = Math.max(0, p - k * 0.035), e = 1 - Math.pow(1 - q, 3);
      const wob = Math.sin(q * 18) * cell * 0.25 * (1 - q);
      const x = fx + (tx - fx) * e + wob, y = fy + (ty - fy) * e;
      ctx.fillStyle = k === 0 ? '#ff004d' : `rgba(255,0,77,${0.5 - k * 0.06})`;
      const ss = k === 0 ? s : Math.max(2, s - k);
      ctx.fillRect(Math.round(x - ss / 2), Math.round(y - ss / 2), ss, ss);
    }
    if (p >= 1) {
      G.laser = null;
      finishHint(L.target);
    }
  }

  // =====================================================================
  // Particles (pixel confetti on a full-screen FX canvas)
  // =====================================================================
  const FX = { canvas: null, ctx: null, dpr: 1, parts: [] };
  const CONFETTI = ['#ff77a8', '#29adff', '#ffec27', '#00e436', '#fff1e8', '#ffa300'];

  function resizeFx() {
    FX.dpr = Math.min(2, window.devicePixelRatio || 1);
    FX.canvas.width = Math.round(window.innerWidth * FX.dpr);
    FX.canvas.height = Math.round(window.innerHeight * FX.dpr);
  }

  function cellScreenCenter(i) {
    const rect = B.canvas.getBoundingClientRect();
    return {
      x: rect.left + B.pad + (i % G.n) * B.cell + B.cell / 2,
      y: rect.top + B.pad + Math.floor(i / G.n) * B.cell + B.cell / 2,
    };
  }

  function spawn(x, y, opts) {
    FX.parts.push(Object.assign({
      x, y, vx: rand(-90, 90), vy: rand(-280, -120), g: 600,
      size: Math.round(rand(3, 7)), life: rand(0.8, 1.3), age: 0,
      color: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    }, opts));
  }

  function regionConfetti(g) {
    const color = G.colors[g];
    for (let i = 0; i < G.reg.length; i++) {
      if (G.reg[i] !== g) continue;
      const { x, y } = cellScreenCenter(i);
      for (let k = 0; k < 5; k++) spawn(x + rand(-10, 10), y + rand(-10, 10), Math.random() < 0.4 ? { color } : {});
    }
  }

  function cellPuff(i, colors) {
    const { x, y } = cellScreenCenter(i);
    for (let k = 0; k < 10; k++) {
      spawn(x, y, {
        vx: rand(-60, 60), vy: rand(-90, -20), g: -40, life: rand(0.5, 0.9),
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  function bigConfetti() {
    const w = window.innerWidth;
    for (let k = 0; k < 170; k++) {
      spawn(rand(0, w), rand(-80, -10), { vx: rand(-40, 40), vy: rand(60, 260), g: 120, life: rand(2, 3.5), size: Math.round(rand(4, 9)), sway: rand(0, 6) });
    }
  }

  function updateFx(dt) {
    const s = dt / 1000, ctx = FX.ctx;
    ctx.setTransform(FX.dpr, 0, 0, FX.dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    FX.parts = FX.parts.filter((p) => (p.age += s) < p.life);
    for (const p of FX.parts) {
      p.vy += p.g * s;
      p.x += (p.vx + (p.sway ? Math.sin(p.age * p.sway) * 40 : 0)) * s;
      p.y += p.vy * s;
      const fade = Math.min(1, (p.life - p.age) / (p.life * 0.3));
      ctx.globalAlpha = fade;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  // =====================================================================
  // Input
  // =====================================================================
  let drag = null;

  function bindBoardInput() {
    const cv = B.canvas;
    cv.addEventListener('pointerdown', (e) => {
      Sfx.unlock();
      if (G.won || G.pauses.size) return;
      const i = cellAt(e);
      if (i < 0) return;
      drag = { start: i, last: i, moved: false, mode: null };
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const i = cellAt(e);
      if (i < 0 || i === drag.last) return;
      if (!drag.moved) {
        drag.moved = true;
        const v = G.cells[drag.start];
        drag.mode = v === 0 ? 'mark' : v === 1 ? 'erase' : null;
        if (drag.mode) {
          pushHistory();
          paint(drag.start);
        }
      }
      drag.last = i;
      paint(i);
    });
    const end = () => {
      if (drag && !drag.moved) tapCell(drag.start);
      else if (drag && drag.mode) evaluate(true);
      drag = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function paint(i) {
    if (!drag.mode || G.locked.has(i)) return;
    if (drag.mode === 'mark' && G.cells[i] === 0) { G.cells[i] = 1; Sfx.mark(); }
    else if (drag.mode === 'erase' && G.cells[i] === 1) { G.cells[i] = 0; Sfx.erase(); }
  }

  // =====================================================================
  // HUD
  // =====================================================================
  let lastTimerSec = -1, lastStarCount = -1;
  function updateTimer(force) {
    const sec = Math.floor(G.elapsed / 1000);
    if (sec === lastTimerSec && !force) return;
    lastTimerSec = sec;
    $('#timer').textContent = fmtTime(G.elapsed);
    const par = CFG.par[G.n];
    const stars = sec <= par ? 3 : sec <= par * 2 ? 2 : 1;
    if (stars !== lastStarCount || force) {
      lastStarCount = stars;
      $$('#starMeter .ico').forEach((el, k) => {
        el.dataset.ico = k < stars ? 'star' : 'starOff';
        el.style.backgroundImage = `url(${iconURL[el.dataset.ico]})`;
      });
    }
  }

  // =====================================================================
  // Level map (saga path)
  // =====================================================================
  const MapView = { pts: [], cur: 0, cat: null };

  function buildMap() {
    const scroll = $('#mapScroll'), inner = $('#mapInner');
    $$('.node, .map-header, .map-cat', inner).forEach((el) => el.remove());
    const W = scroll.clientWidth || 360;
    const amp = Math.min(W * 0.26, 120), cx = W / 2;
    const cur = Math.min(save.unlocked, LEVELS.length - 1);
    const pts = [];
    const frag = document.createDocumentFragment();
    let y = 44, lastSize = 0;

    LEVELS.forEach((L, i) => {
      if (L.size !== lastSize) {
        lastSize = L.size;
        const h = document.createElement('div');
        h.className = 'map-header';
        h.style.top = y + 'px';
        h.innerHTML = `<em>${L.size}x${L.size}</em> ${SECTIONS[L.size]}`;
        frag.appendChild(h);
        y += 70;
      }
      const x = Math.round(cx + Math.sin(i * 0.9) * amp);
      pts.push({ x, y });
      const btn = document.createElement('button');
      btn.className = 'node';
      btn.dataset.action = 'level';
      btn.dataset.level = i;
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
      const stars = save.stars[i] || 0;
      if (i > save.unlocked) {
        btn.classList.add('locked');
        btn.innerHTML = ico('lock');
      } else {
        btn.innerHTML = `<span>${i + 1}</span>`;
        if (stars) {
          btn.classList.add('done');
          btn.innerHTML += `<div class="node-stars">${[1, 2, 3].map((k) => ico(k <= stars ? 'star' : 'starOff')).join('')}</div>`;
        }
        if (i === cur && !stars) btn.classList.add('current');
      }
      frag.appendChild(btn);
      y += 100;
    });
    inner.appendChild(frag);
    applyIcons(inner);

    const H = y;
    inner.style.height = H + 'px';
    const cv = $('#mapPath');
    cv.width = W; cv.height = H;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const steps = Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 14);
      g.fillStyle = i < save.unlocked ? '#ffec27' : '#4a4566';
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        g.fillRect(Math.round(a.x + (b.x - a.x) * t) - 3, Math.round(a.y + (b.y - a.y) * t) - 3, 6, 6);
      }
    }

    const mc = document.createElement('canvas');
    mc.className = 'map-cat';
    mc.width = mc.height = 16;
    mc.style.left = pts[cur].x + 'px';
    mc.style.top = pts[cur].y - 76 + 'px';
    inner.appendChild(mc);
    Object.assign(MapView, { pts, cur, cat: mc });
    const play = $('#playBtn');
    if (play) play.textContent = save.stars[cur] ? `REPLAY LEVEL ${cur + 1}` : `PLAY LEVEL ${cur + 1}`;
  }

  function goMap() {
    showScreen('map');
    buildMap();
    const s = $('#mapScroll');
    s.scrollTop = Math.max(0, MapView.pts[MapView.cur].y - s.clientHeight * 0.55);
  }

  function drawMapCat(t) {
    if (!MapView.cat) return;
    const g = MapView.cat.getContext('2d');
    g.clearRect(0, 0, 16, 16);
    g.drawImage(catFrame(0, t, 0, false), 0, 0);
  }

  // =====================================================================
  // Modals
  // =====================================================================
  function openHelp() {
    openModal(`
      <h2>HOW TO PLAY</h2>
      <p>Fill the board with cats. Every rule must hold:</p>
      <ul class="rules">
        <li><b>1</b><span>Only ONE cat per <span class="note">row</span>.</span></li>
        <li><b>2</b><span>Only ONE cat per <span class="note">column</span>.</span></li>
        <li><b>3</b><span>Only ONE cat per colored <span class="note">room</span>.</span></li>
        <li><b>4</b><span>Cats can't touch, <span class="note">not even diagonally</span>. They hiss!</span></li>
      </ul>
      <p>Tap a square once for an <b>X</b> note, twice for a <b>cat</b>, three times to clear. Drag to paint X marks.</p>
      <p>${ico('yarn')} Solve fast to earn more Yarn Balls, then spend them on power-ups.</p>
      <button class="btn" data-action="close">GOT IT!</button>
    `);
  }

  function openShop(message) {
    openModal(`
      <h2>YARN SHOP</h2>
      <div class="big-yarn">${ico('yarn')}<span class="yarn-count">${save.yarn}</span></div>
      ${message ? `<p class="note">${message}</p>` : ''}
      <div class="shop-list">
        <div>${ico('laser')}<span><b>LASER POINTER - ${CFG.costs.hint}</b><br>Places one correct cat on the board.</span></div>
        <div>${ico('catnip')}<span><b>CATNIP - ${CFG.costs.catnip}</b><br>Sniffs out and removes your mistakes.</span></div>
        <div>${ico('whiskers')}<span><b>WHISKERS - ${CFG.costs.whiskers}</b><br>X-marks every square your cats block.</span></div>
      </div>
      <button class="btn ad" data-action="watchad">+${CFG.rewardedYarn} ${ico('yarn')} - WATCH AD</button>
      <button class="btn ghost" data-action="close">CLOSE</button>
    `);
  }

  function openPause() {
    if (G.won) return;
    openModal(`
      <h2>PAUSED</h2>
      <p>Level ${G.idx + 1} - ${fmtTime(G.elapsed)}</p>
      <button class="btn" data-action="close">RESUME</button>
      <button class="btn ghost" data-action="restart">RESTART</button>
      <button class="btn ghost" data-action="help">HOW TO PLAY</button>
      <button class="btn ghost" data-action="tomap">LEVEL MAP</button>
    `);
  }

  function openFreeLaser() {
    openModal(`
      <h2>FREE LASER</h2>
      <div class="big-yarn">${ico('laser')}</div>
      <p>You need ${CFG.costs.hint} yarn for the Laser Pointer. Watch a short ad and it places a correct cat for free.</p>
      <button class="btn ad" data-action="freelaser">WATCH AD: FREE LASER</button>
      <button class="btn ghost" data-action="close">NO THANKS</button>
    `);
  }

  function chapterHTML(r) {
    const { ch, chapterBonus } = r;
    const pct = Math.round((ch.cleared / ch.list.length) * 100);
    const left = ch.list.length - ch.cleared;
    const note = chapterBonus
      ? `<span class="note">CHAPTER COMPLETE! +${chapterBonus}</span> ${ico('yarn')}`
      : !save.chapters[ch.n] && left > 0
        ? `${left} more for a +${CFG.chapterBonus[ch.n]} ${ico('yarn')} chapter bonus`
        : '';
    return `
      <div class="chapter">
        <div class="chapter-label"><span>${SECTIONS[ch.n]}</span><b>${ch.cleared}/${ch.list.length}</b></div>
        <div class="chapter-bar"><i style="width:${pct}%"></i></div>
        ${note ? `<div class="chapter-note">${note}</div>` : ''}
      </div>`;
  }

  function showWinModal(r) {
    const last = G.idx >= LEVELS.length - 1;
    const best = save.best[G.idx];
    const nextSize = last ? 0 : LEVELS[G.idx + 1].size;
    const nextLabel = nextSize && nextSize !== G.n ? `NEXT: ${nextSize}x${nextSize} ROOMS` : 'NEXT LEVEL';
    openModal(`
      <h2>PURRFECT!</h2>
      <div class="win-stars">${[1, 2, 3].map((k) => ico(k <= r.stars ? 'star' : 'starOff')).join('')}</div>
      <p>Time ${fmtTime(r.t)}${r.prevBest && r.t < r.prevBest ? ' <span class="note">NEW BEST!</span>' : best ? ` (best ${fmtTime(best)})` : ''}</p>
      <table class="reward-table">
        <tr><td>${r.firstClear ? 'Solved' : 'Replay'}</td><td>+${r.base}</td></tr>
        <tr><td>Speed bonus</td><td>+${r.speed}</td></tr>
        ${r.chapterBonus ? `<tr><td>Chapter bonus</td><td>+${r.chapterBonus}</td></tr>` : ''}
        <tr class="total"><td>Total</td><td>+${r.total + r.chapterBonus} ${ico('yarn')}</td></tr>
      </table>
      ${chapterHTML(r)}
      ${last ? '<p class="note">You solved every puzzle! More rooms coming soon.</p>' : `<button class="btn" data-action="next">${nextLabel}</button>`}
      <button class="btn ad" data-action="double">WATCH AD: DOUBLE ${ico('yarn')} +${r.total}</button>
      <button class="btn ghost" data-action="winmap">LEVEL MAP</button>
    `);
  }

  // =====================================================================
  // Action routing
  // =====================================================================
  const actions = {
    shop: () => openShop(),
    help: () => openHelp(),
    close: () => closeModal(),
    pause: () => openPause(),
    sound: () => {
      save.muted = !save.muted;
      persist();
      updateSoundBtn();
      Sfx.apply();
      if (!save.muted) Sfx.mark();
    },
    level: (el) => {
      const i = +el.dataset.level;
      if (i > save.unlocked) {
        Sfx.nope();
        toast(`Solve level ${i} first!`, 'lock');
        return;
      }
      Sfx.mark();
      startLevel(i);
    },
    hint: () => useHint(),
    catnip: () => useCatnip(),
    whiskers: () => useWhiskers(),
    undo: () => undo(),
    clear: () => clearBoard(),
    restart: () => { closeModal(); startLevel(G.idx); },
    tomap: () => { closeModal(); abandonLevel('map'); Platform.message('GAMEPLAY_STOPPED'); goMap(); },
    next: async () => {
      if (G.adBusy) return;
      closeModal();
      G.adBusy = true;
      try { await adBreak(); } finally { G.adBusy = false; }
      startLevel(G.idx + 1);
    },
    winmap: async () => {
      if (G.adBusy) return;
      closeModal();
      G.adBusy = true;
      try { await adBreak(); } finally { G.adBusy = false; }
      goMap();
    },
    playcur: () => {
      Sfx.mark();
      startLevel(Math.min(save.unlocked, LEVELS.length - 1));
    },
    freelaser: async (el) => {
      el.disabled = true;
      if (await rewardedAd()) {
        closeModal();
        fireLaser('ad');
      } else {
        el.disabled = false;
      }
    },
    double: async (el) => {
      if (G.doubled) return;
      el.disabled = true;
      if (await rewardedAd()) {
        G.doubled = true;
        save.yarn += G.lastReward;
        persist();
        updateYarn(true);
        Sfx.coin();
        el.textContent = 'DOUBLED!';
      } else {
        el.disabled = false;
      }
    },
    watchad: async (el) => {
      el.disabled = true;
      if (await rewardedAd()) {
        save.yarn += CFG.rewardedYarn;
        persist();
        updateYarn(true);
        Sfx.coin();
        toast(`+${CFG.rewardedYarn} yarn!`, 'yarn');
      }
      el.disabled = false;
    },
  };

  function bindUI() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el || el.disabled || G.adBusy || G.pauses.has('ad')) return;
      Sfx.unlock();
      const fn = actions[el.dataset.action];
      if (fn) fn(el);
    });
    $$('[data-cost]').forEach((el) => { el.textContent = CFG.costs[el.dataset.cost]; });

    document.addEventListener('visibilitychange', () => setPause('hidden', document.hidden));
    document.addEventListener('gesturestart', (e) => e.preventDefault());

    const onResize = () => {
      resizeFx();
      if (G.screen === 'game') layoutBoard();
      else if (G.screen === 'map') {
        const s = $('#mapScroll'), ratio = s.scrollTop / Math.max(1, s.scrollHeight);
        buildMap();
        s.scrollTop = ratio * s.scrollHeight;
      }
    };
    window.addEventListener('resize', onResize);
    if (window.ResizeObserver) new ResizeObserver(() => G.screen === 'game' && layoutBoard()).observe($('#boardWrap'));
  }

  // =====================================================================
  // Main loop & boot
  // =====================================================================
  let lastFrame = 0;
  function loop() {
    const t = now();
    const raw = t - (lastFrame || t);
    const dt = Math.min(100, raw);
    lastFrame = t;
    const paused = G.pauses.size > 0;
    const playing = G.screen === 'game' && !paused && !G.won && !document.hidden;
    Perf.frame(raw, playing);
    if (G.screen === 'game') {
      if (playing) {
        G.elapsed += Math.min(1000, raw);
        updateTimer();
        checkStuck();
      }
      drawBoard(t);
    } else if (G.screen === 'map') {
      drawMapCat(t);
    }
    updateFx(paused ? 0 : dt);
    requestAnimationFrame(loop);
  }

  function localDay() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function startGameLoop() {
    updateYarn();
    updateSoundBtn();
    const firstVisit = !save.seenHelp && save.unlocked === 0 && !Object.keys(save.stars).length;
    save.seenHelp = true;
    Platform.message('GAME_READY');
    Platform.preloadInterstitial();
    // New players go straight into level 1 with the step-by-step coach instead of a rules wall.
    if (firstVisit) startLevel(0);
    else goMap();
    requestAnimationFrame(loop);

    const today = localDay();
    if (save.lastDaily && save.lastDaily !== today) {
      save.yarn += CFG.dailyYarn;
      updateYarn(true);
      setTimeout(() => toast(`Daily gift: +${CFG.dailyYarn} yarn!`, 'yarn'), 400);
    }
    save.lastDaily = today;
    persist();
  }

  async function boot() {
    buildSprites();
    buildIcons();
    const lc = $('#loadingCat');
    lc.getContext('2d').drawImage(catFrame(0, 0, 0, false), 0, 0);

    B.canvas = $('#board');
    B.ctx = B.canvas.getContext('2d');
    FX.canvas = $('#fx');
    FX.ctx = FX.canvas.getContext('2d');
    resizeFx();
    bindUI();
    bindBoardInput();

    // Game stays on the loading screen (no loop, no audio) until the SDK is ready.
    await Platform.init();
    const loaded = await Platform.load();
    save = normalizeSave(loaded);
    startGameLoop();
  }

  boot();
})();
