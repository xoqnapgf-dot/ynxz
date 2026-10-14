import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./audit-art-scale.mjs',import.meta.url));
const run=spawnSync(process.execPath,[script,'--require-art-gates'],{encoding:'utf8'});
assert.equal(run.status,1,'v10 art-scale gate is expected to fail; it is not an approved art baseline');
const measured=JSON.parse(run.stdout),saved=JSON.parse(fs.readFileSync(new URL('../research/v10-scale-audit.json',import.meta.url),'utf8'));
assert.deepEqual(measured,saved,'baseline report must match actual source/geometry');
assert.equal(measured.person.meshHeightMeters,.4);assert.equal(measured.person.topAbovePlacementMeters,.46);
assert.equal(measured.checks.adultScaleCue,false);assert.equal(measured.checks.hasGroundLevelInspection,false);
const references=JSON.parse(fs.readFileSync(new URL('../research/sources-2026-10-15.json',import.meta.url),'utf8'));
for(const entry of references.repositories){assert(/^[a-f0-9]{40}$/.test(entry.sha));assert(entry.readScope);for(const file of entry.sourceFiles)assert(file.url.includes(entry.sha));}
console.log('PASS: research references pinned; baseline audit reproducible; known art-scale deficiencies correctly remain FAILED, not silently approved.');
