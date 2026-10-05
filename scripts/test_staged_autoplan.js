// scripts/test_staged_autoplan.js
// Verification of auto-plan staged module category credit tallying

import '../public/js/preloaded_degrees.js';
import { readFileSync } from 'node:fs';

const validatorCode = readFileSync('./public/js/validator.js', 'utf-8');
const generatorCode = readFileSync('./public/js/generator.js', 'utf-8');

(new Function(validatorCode + '; globalThis.DegreeValidator = DegreeValidator;'))();
(new Function(generatorCode + '; globalThis.PlanGenerator = PlanGenerator;'))();

const degreePkg = globalThis.PRELOADED_DEGREES_DATA['etit-msc-2025'];
const degree = degreePkg.degree;
const rawModules = Array.isArray(degreePkg.modules) ? degreePkg.modules : Object.values(degreePkg.modules);
const modulesMap = new Map(rawModules.map(m => [m.id, m]));

const validator = new DegreeValidator(modulesMap, degree);
const generator = new PlanGenerator(rawModules, degree);

console.log('=== TEST 1: STAGED MODULES WITHOUT CATALOG FILL ===\n');

// ARSE track
// M-ETIT-106953: Fundamentals, 6 CP, SS
// M-ETIT-100539: Focus Area, 5 CP, WS
// M-ETIT-102264: Lab Course, 6 CP, WS
// M-ETIT-105803: Interdisciplinary (ÜQ), 6 CP, WS+SS
const staged = ['M-ETIT-106953', 'M-ETIT-100539', 'M-ETIT-102264', 'M-ETIT-105803'];

const res = generator.generatePlan({
  specializationId: 'ARSE',
  startTerm: 'WS',
  semestersCount: 4,
  stagedModuleIds: staged,
  fillMissingWithCatalog: false
});

const valResult = validator.validate(res.plan, 'ARSE', 'WS', 4);

console.log('Validation Category Totals:');
for (const [cid, cdata] of Object.entries(valResult.categories)) {
  console.log(`  ${cdata.name} (${cid}): ${cdata.current} / ${cdata.target} CP`);
}

// Assertions
function assert(condition, message) {
  if (!condition) {
    console.error('FAIL: ' + message);
    Deno.exit(1);
  } else {
    console.log('PASS: ' + message);
  }
}

assert(valResult.categories.fundamentals.current === 6, 'Fundamentals should have 6 CP');
assert(valResult.categories.focus.current === 5, 'Focus Area should have 5 CP');
assert(valResult.categories.lab.current === 6, 'Lab Course should have 6 CP');
assert(valResult.categories.uq.current === 6, 'Interdisciplinary (ÜQ) should have 6 CP');
assert(valResult.categories.thesis.current === 30, "Master's Thesis should have 30 CP");
assert(valResult.categories.electives.current === 0, 'Electives should have 0 CP');

console.log('\n=== TEST 2: STAGED MODULES WITH CATALOG FILL ===\n');

const resFilled = generator.generatePlan({
  specializationId: 'ARSE',
  startTerm: 'WS',
  semestersCount: 4,
  stagedModuleIds: staged,
  fillMissingWithCatalog: true
});

const valFilled = validator.validate(resFilled.plan, 'ARSE', 'WS', 4);
console.log('Filled Plan Category Totals:');
for (const [cid, cdata] of Object.entries(valFilled.categories)) {
  console.log(`  ${cdata.name} (${cid}): ${cdata.current} / ${cdata.target} CP [${cdata.ok ? 'OK' : 'INCOMPLETE'}]`);
}

assert(valFilled.categories.fundamentals.ok, 'Fundamentals must reach target with catalog fill');
assert(valFilled.categories.focus.ok, 'Focus Area must reach target with catalog fill');
assert(valFilled.categories.lab.ok, 'Lab Course must reach target with catalog fill');
assert(valFilled.categories.uq.ok, 'ÜQ must reach target with catalog fill');
assert(valFilled.categories.thesis.ok, 'Thesis must reach target with catalog fill');
assert(valFilled.isComplete, 'Plan should be complete with catalog fill');

console.log('\n=== TEST 3: TESTING ALL TRACKS (EPSE, ICT, MPQT) ===\n');

const testTracks = [
  { track: 'EPSE', fundMod: 'M-ETIT-107005', focusMod: 'M-ETIT-100400', labMod: 'M-ETIT-100381' },
  { track: 'ICT', fundMod: 'M-ETIT-106815', focusMod: 'M-ETIT-100539', labMod: 'M-ETIT-107136' },
  { track: 'MPQT', fundMod: 'M-ETIT-106963', focusMod: 'M-ETIT-106956', labMod: 'M-ETIT-100468' },
];

for (const t of testTracks) {
  console.log(`Testing track ${t.track}...`);
  const stagedTrack = [t.fundMod, t.focusMod, t.labMod];
  const p = generator.generatePlan({
    specializationId: t.track,
    startTerm: 'WS',
    semestersCount: 4,
    stagedModuleIds: stagedTrack,
    fillMissingWithCatalog: false
  });
  const v = validator.validate(p.plan, t.track, 'WS', 4);
  const fundCredits = modulesMap.get(t.fundMod).credits;
  const focusCredits = modulesMap.get(t.focusMod).credits;
  const labCredits = modulesMap.get(t.labMod).credits;

  assert(v.categories.fundamentals.current === fundCredits, `${t.track} Fundamentals CP should match ${fundCredits}`);
  assert(v.categories.focus.current === focusCredits, `${t.track} Focus Area CP should match ${focusCredits}`);
  assert(v.categories.lab.current === labCredits, `${t.track} Lab CP should match ${labCredits}`);
  assert(v.categories.electives.current === 0, `${t.track} Electives CP should be 0`);
}

console.log('\nAll staged auto-planning multi-track tests passed successfully!\n');
