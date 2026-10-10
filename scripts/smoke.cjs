// Runtime smoke test of the built package (CommonJS entry); see smoke.mjs.
"use strict";
const assert = require("node:assert/strict");
const { detectBot, normalize, parse, UaLensError, BOT_DEFINITIONS } = require("ua-lens");

const r = parse("Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1");
assert.equal(r.browser.name, "Mobile Safari");
assert.equal(r.os.name, "iOS");
assert.deepEqual(r.frozen, ["os.version"]);
assert.equal(normalize("curl/8.14.1").label, "curl 8.14.1 / bot (http-library)");
assert.equal(detectBot("ClaudeBot").operator, "Anthropic");
assert.ok(Object.isFrozen(BOT_DEFINITIONS));
assert.throws(() => parse(42), UaLensError);

console.log(`CJS smoke test passed on Node ${process.version}`);
