const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function game() {
  const timers = new Map(); let id = 0;
  const context = {window: {addEventListener() {}}, console, performance, Uint8Array,
    setTimeout(fn) {timers.set(++id, fn); return id;}, clearTimeout(id) {timers.delete(id);},
    document: {querySelectorAll: () => []}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('levels.js', 'utf8'), context);
  // Expose internals only in this isolated test copy. Production keeps its IIFE.
  const source = fs.readFileSync('game.js', 'utf8').replace('  boot();',
    '  window.test = {Platform, G, normalizeSave, defaultSave};');
  vm.runInContext(source, context);
  return {...context.window.test, timers, window: context.window};
}
test('unsupported rewarded ads are never requested', async () => {
  const {Platform} = game(); let calls=0;
  Platform.b = {advertisement: {isRewardedSupported: false, showRewarded() {calls++;}}};
  assert.equal(await Platform.showAd('rewarded'), false); assert.equal(calls, 0);
});
test('async ad rejection resolves false and clears the pending request', async () => {
  const {Platform, G} = game();
  Platform.b = {advertisement: {showRewarded() {return Promise.reject(new Error('no fill'));}}};
  assert.equal(await Platform.showAd('rewarded'), false);
  assert.equal(G.pauses.has('ad'), false); assert.equal(Platform.pendingAd, null);
});
test('only a rewarded state earns a reward, close alone does not', async () => {
  const {Platform} = game(); Platform.b = {advertisement: {showRewarded() {}}};
  const closed = Platform.showAd('rewarded'); Platform.adCb.rewarded('opened'); Platform.adCb.rewarded('closed');
  assert.equal(await closed, false);
  const reward = Platform.showAd('rewarded'); Platform.adCb.rewarded('opened');
  Platform.adCb.rewarded('rewarded'); Platform.adCb.rewarded('closed'); assert.equal(await reward, true);
});
test('slow-opening ads cannot be overwritten by another request', async () => {
  const {Platform, G, timers} = game(); let calls=0;
  Platform.b = {advertisement: {showInterstitial() {calls++;}}};
  const first = Platform.showAd('interstitial'); [...timers.values()][0]();
  assert.equal(await first, false);
  assert.equal(await Platform.showAd('interstitial'), false); assert.equal(calls, 1);
  Platform.adCb.interstitial('opened'); assert.equal(G.pauses.has('ad'), true);
  Platform.adCb.interstitial('closed'); assert.equal(G.pauses.has('ad'), false);
  assert.equal(Platform.pendingAd, null);
});
test('an interstitial close without opening is not counted as an impression', async () => {
  const {Platform} = game(); Platform.b = {advertisement: {showInterstitial() {}}};
  const ad = Platform.showAd('interstitial'); Platform.adCb.interstitial('closed');
  assert.equal(await ad, false); assert.equal(Platform.lastInterstitialAt, 0);
});
test('initial host pause and open ad state are honored', async () => {
  const {Platform, G, window} = game();
  const handlers = {};
  window.bridge = {initialize: async () => {}, platform: {isPaused: true}, advertisement: {interstitialState: 'opened', on(event, fn) {handlers[event] = fn;}}};
  await Platform.init();
  assert.equal(G.pauses.has('platform'), true); assert.equal(G.pauses.has('ad'), true);
  handlers.interstitial_state_changed('closed');
  assert.equal(G.pauses.has('ad'), false);
  handlers.rewarded_state_changed('opened'); assert.equal(G.pauses.has('ad'), true);
  handlers.rewarded_state_changed('closed'); assert.equal(G.pauses.has('ad'), false);
});
test('malformed saves get safe defaults while valid progress is preserved', () => {
  const {normalizeSave} = game();
  for (const bad of [null, [], 'bad', {stars: null, best: false, chapters: []}]) {
    const s=normalizeSave(bad); assert.equal(typeof s.stars, 'object'); assert.notEqual(s.stars, null);
  }
  const s=normalizeSave({yarn: -4, unlocked: 9999, stars: {0:3, 1:8, bogus:2}, best:{0:1200}, muted:true});
  assert.equal(s.yarn, 25); assert.equal(s.unlocked, 45); assert.equal(s.stars[0], 3);
  assert.equal(s.stars[1], undefined); assert.equal(s.stars.bogus, undefined); assert.equal(s.best[0],1200);
});
