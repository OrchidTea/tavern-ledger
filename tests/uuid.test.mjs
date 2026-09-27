import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
const source = (await readFile(new URL('../lib/uuid.mjs', import.meta.url), 'utf8')).replace('export function', 'function');
const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
for (const [name, crypto] of [
    ['native', webcrypto],
    ['HTTP without randomUUID', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }],
    ['no Web Crypto', undefined],
    ['non-callable randomUUID', { randomUUID: null, getRandomValues: webcrypto.getRandomValues.bind(webcrypto) }],
]) {
    test(name + ': valid, distinct UUIDs', () => {
        const sandbox = vm.createContext({ crypto });
        vm.runInContext(source, sandbox);
        const ids = new Set();
        for (let i = 0; i < 10000; i++) { const id = sandbox.uuid(); assert.match(id, pattern); ids.add(id); }
        assert.equal(ids.size, 10000);
    });
}
test('preserves native Crypto receiver', () => {
    const crypto = { randomUUID() { assert.equal(this, crypto); return 'native-id'; } };
    const sandbox = vm.createContext({ crypto });
    vm.runInContext(source, sandbox);
    assert.equal(sandbox.uuid(), 'native-id');
});

test('HTTP collector forwards generation and links message/candidate IDs', async () => {
    const index = await readFile(new URL('../index.js', import.meta.url), 'utf8');
    const collector = index.slice(index.indexOf('function installCollector()'), index.indexOf('\nasync function refresh()'));
    const handlers = {};
    const chat = [{ is_user: false, extra: {} }];
    const c = { chat, eventTypes: Object.fromEntries(['GENERATION_STARTED', 'GENERATION_ENDED', 'MESSAGE_RECEIVED'].map(x => [x, x])), eventSource: { on: (name, fn) => { handlers[name] = fn; } }, saveChat: async () => {} };
    const calls = [], records = [];
    const response = { ok: false, clone: () => ({ body: { cancel: async () => {} } }) };
    const sandbox = vm.createContext({
        crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
        window: {}, document: { addEventListener() {} }, context: () => c,
        chatIdentity: () => ({ chat_id: 'test' }), originalFetch: async (...args) => { calls.push(args); return response; },
        api: async () => null, persist: async row => { records.push(row); }, remember() {},
        paintBadges() {}, render() {}, refreshBalanceAfterGeneration() {}, recoverCost: async () => {},
        location: { origin: 'http://100.64.0.1', href: 'http://100.64.0.1/' }, URL, Request,
    });
    vm.runInContext(`${source}\nconst NAME = 'tavern_ledger'; const SUPPORTED_PROVIDERS = new Set(['openrouter']); let rows = [], run = null, pendingConnectionTestUntil = 0; const liveRequests = new Set();\n${collector}\ninstallCollector();`, sandbox);
    handlers.GENERATION_STARTED('normal');
    const url = '/api/backends/chat-completions/generate';
    const options = { method: 'POST', body: JSON.stringify({ chat_completion_source: 'openrouter', model: 'test' }) };
    assert.equal(await sandbox.window.fetch(url, options), response);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], url);
    assert.equal(calls[0][1], options);
    await handlers.MESSAGE_RECEIVED(0);
    assert.match(records[0].id, pattern);
    assert.match(chat[0].tavern_ledger_id, pattern);
    assert.match(chat[0].extra.tavern_ledger.candidate_id, pattern);
    assert.equal(records[0].message_id, chat[0].tavern_ledger_id);
    const oldMessage = chat[0].tavern_ledger_id, oldCandidate = chat[0].extra.tavern_ledger.candidate_id;
    handlers.GENERATION_STARTED('continue');
    await sandbox.window.fetch(url, options);
    await handlers.MESSAGE_RECEIVED(0);
    assert.equal(chat[0].tavern_ledger_id, oldMessage);
    assert.equal(chat[0].extra.tavern_ledger.candidate_id, oldCandidate);
});
