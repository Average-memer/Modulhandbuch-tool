// scripts/test_category_attribution.js
// Automated verification for category attribution and credit tallying

import '../public/js/preloaded_degrees.js';
import { readFileSync } from 'node:fs';

const validatorCode = readFileSync('./public/js/validator.js', 'utf-8');
(new Function(validatorCode + '; globalThis.DegreeValidator = DegreeValidator;'))();

const degreePkg = globalThis.PRELOADED_DEGREES_DATA['etit-msc-2025'];
const degree = degreePkg.degree;
const rawModules = Array.isArray(degreePkg.modules) ? degreePkg.modules : Object.values(degreePkg.modules);
const modulesMap = new Map(rawModules.map(m => [m.id, m]));
const validator = new DegreeValidator(modulesMap, degree);

console.log('=== RUNNING CATEGORY ATTRIBUTION & CREDIT TALLY AUDIT ===\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// TEST 1: Radio Frequency Integrated Circuits and Systems (M-ETIT-105123, 6 CP)
console.log('1. Testing "Radio Frequency Integrated Circuits and Systems" (M-ETIT-105123, 6 CP) in ICT track:');
const rfMod = modulesMap.get('M-ETIT-105123');
assert(rfMod && rfMod.credits === 6, 'Module exists with 6 CP');

const rfAllowed = validator.getAvailableCategoryIds(rfMod, 'ICT');
console.log('   Allowed category IDs for RF circuits in ICT:', rfAllowed);
assert(rfAllowed.includes('focus') && rfAllowed.includes('electives'), 'Eligible for both Focus Area and Electives');

// Test 1A: Booked under Focus Area
const planFocus = {
  specialization: 'ICT',
  startTerm: 'WS',
  semesters: {
    1: [{ id: 'M-ETIT-105123', category: 'Focus Area' }]
  }
};
const resFocus = validator.validate(planFocus, 'ICT', 'WS', 4);
assert(resFocus.categories.focus.current === 6, `Focus Area receives exactly 6 CP (got ${resFocus.categories.focus.current} CP)`);
assert(resFocus.categories.electives.current === 0, `Electives receives 0 CP (no 1 CP leak! got ${resFocus.categories.electives.current} CP)`);

// Test 1B: Booked under Electives
const planElectives = {
  specialization: 'ICT',
  startTerm: 'WS',
  semesters: {
    1: [{ id: 'M-ETIT-105123', category: 'Electives' }]
  }
};
const resElectives = validator.validate(planElectives, 'ICT', 'WS', 4);
assert(resElectives.categories.electives.current === 6, `Electives receives exactly 6 CP (got ${resElectives.categories.electives.current} CP)`);
assert(resElectives.categories.focus.current === 0, `Focus Area receives 0 CP (got ${resElectives.categories.focus.current} CP)`);

// TEST 2: Numerical Methods with Programming Practice (M-MATH-106972, 6 CP)
console.log('\n2. Testing "Numerical Methods with Programming Practice" (M-MATH-106972, 6 CP) in ICT track:');
const numMod = modulesMap.get('M-MATH-106972');
assert(numMod && numMod.credits === 6, 'Module exists with 6 CP');

const numAllowed = validator.getAvailableCategoryIds(numMod, 'ICT');
console.log('   Allowed category IDs for Numerical Methods in ICT:', numAllowed);
assert(
  numAllowed.includes('fundamentals') && numAllowed.includes('focus') && numAllowed.includes('electives'),
  'Eligible for Fundamentals, Focus Area, and Electives'
);

// Test 2A: Fundamentals
const planNumFund = {
  specialization: 'ICT',
  startTerm: 'WS',
  semesters: { 1: [{ id: 'M-MATH-106972', category: 'Fundamentals' }] }
};
const resNumFund = validator.validate(planNumFund, 'ICT', 'WS', 4);
assert(resNumFund.categories.fundamentals.current === 6, `Fundamentals receives 6 CP (got ${resNumFund.categories.fundamentals.current} CP)`);
assert(resNumFund.categories.focus.current === 0, `Focus Area receives 0 CP`);
assert(resNumFund.categories.electives.current === 0, `Electives receives 0 CP`);

// Test 2B: Focus Area
const planNumFoc = {
  specialization: 'ICT',
  startTerm: 'WS',
  semesters: { 1: [{ id: 'M-MATH-106972', category: 'Focus Area' }] }
};
const resNumFoc = validator.validate(planNumFoc, 'ICT', 'WS', 4);
assert(resNumFoc.categories.fundamentals.current === 0, `Fundamentals receives 0 CP`);
assert(resNumFoc.categories.focus.current === 6, `Focus Area receives 6 CP`);
assert(resNumFoc.categories.electives.current === 0, `Electives receives 0 CP`);

// Test 2C: Electives
const planNumElec = {
  specialization: 'ICT',
  startTerm: 'WS',
  semesters: { 1: [{ id: 'M-MATH-106972', category: 'Electives' }] }
};
const resNumElec = validator.validate(planNumElec, 'ICT', 'WS', 4);
assert(resNumElec.categories.fundamentals.current === 0, `Fundamentals receives 0 CP`);
assert(resNumElec.categories.focus.current === 0, `Focus Area receives 0 CP`);
assert(resNumElec.categories.electives.current === 6, `Electives receives 6 CP`);

// TEST 3: Capping & Overflow Elimination
console.log('\n3. Testing elimination of fractional overflow splitting:');
const specICT = degree.specializations.find(s => s.id === 'ICT');
// Pick focus modules until we have at least 20 CP
const focusMods = [];
let fSum = 0;
for (const id of specICT.focus) {
  if (id === 'M-ETIT-105123') continue;
  const m = modulesMap.get(id);
  if (m) {
    focusMods.push(m);
    fSum += m.credits;
    if (fSum >= 20) break;
  }
}

const planFullFocus = {
  specialization: 'ICT',
  startTerm: 'WS',
  semesters: {
    1: focusMods.map(m => ({ id: m.id, category: 'Focus Area' })),
    2: [{ id: 'M-ETIT-105123', category: 'Focus Area' }] // Extra 6 CP
  }
};
const expectedFocusCP = fSum + 6;
const resFullFocus = validator.validate(planFullFocus, 'ICT', 'WS', 4);
assert(
  resFullFocus.categories.focus.current === expectedFocusCP,
  `Focus Area contains full sum of ${expectedFocusCP} CP without splitting (got ${resFullFocus.categories.focus.current} CP)`
);
assert(
  resFullFocus.categories.electives.current === 0,
  `Electives remains 0 CP without artificial overflow spillage (got ${resFullFocus.categories.electives.current} CP)`
);
assert(resFullFocus.categories.focus.ok === true, `Focus Area marked OK (target >= 24 satisfied: ${expectedFocusCP} >= 24)`);

// TEST 4: App UI Category Detection Helpers
console.log('\n4. Testing App UI category helpers:');
const appCode = readFileSync('./public/js/app.js', 'utf-8');
const AppClass = (new Function(appCode + '; return UniversalStudyPlannerApp;'))();
const appInstance = Object.create(AppClass.prototype);
appInstance.modulesMap = modulesMap;
appInstance.activeDegree = degree;
appInstance.currentSpecialization = 'ICT';

const rfAppCats = appInstance.getAvailableCategoriesForModule(rfMod);
console.log('   App detected available categories for RF circuits:', rfAppCats.map(c => c.label));
assert(rfAppCats.some(c => c.label === 'Focus Area'), 'App offers Focus Area for RF circuits');
assert(rfAppCats.some(c => c.label === 'Electives'), 'App offers Electives for RF circuits');
assert(rfAppCats.length === 2, 'App offers exactly 2 choices for RF circuits');

const numAppCats = appInstance.getAvailableCategoriesForModule(numMod);
console.log('   App detected available categories for Numerical Methods:', numAppCats.map(c => c.label));
assert(numAppCats.some(c => c.label === 'Fundamentals'), 'App offers Fundamentals for Numerical Methods');
assert(numAppCats.some(c => c.label === 'Focus Area'), 'App offers Focus Area for Numerical Methods');
assert(numAppCats.some(c => c.label === 'Electives'), 'App offers Electives for Numerical Methods');
assert(numAppCats.length === 3, 'App offers exactly 3 choices for Numerical Methods');

const catInfoFocus = appInstance.getModuleCategoryInfo(rfMod, 'Focus Area');
assert(catInfoFocus.label === 'Focus Area' && catInfoFocus.cssClass === 'cat-focus', 'App styles Focus Area correctly');

const catInfoElec = appInstance.getModuleCategoryInfo(rfMod, 'Electives');
assert(catInfoElec.label === 'Electives' && catInfoElec.cssClass === 'cat-electives', 'App styles Electives correctly');

console.log(`\n=== AUDIT COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ===\n`);
