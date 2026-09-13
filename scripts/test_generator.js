// scripts/test_generator.js
// Automated verification of PlanGenerator and DegreeValidator for all 4 ETIT tracks in Deno

import '../public/js/preloaded_degrees.js';
import { readFileSync } from 'node:fs';

// Read validator.js and generator.js into execution scope
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

const tracks = ['ARSE', 'EPSE', 'ICT', 'MPQT'];

console.log('=== RUNNING ETIT TRACK GENERATION & VALIDATION AUDIT ===\n');

for (const track of tracks) {
  console.log(`Testing Track: ${track}...`);
  const generated = generator.generatePlan({
    specialization: track,
    startTerm: 'WS',
    semestersCount: 4,
    stagedModules: [],
    pinnedModules: [],
    fillMissingWithCatalog: true
  });

  const valResult = validator.validate(generated.plan, track, 'WS', 4);

  console.log(`  Total Credits: ${valResult.totalCredits} / ${degree.totalCredits} CP`);
  console.log(`  Permissible: ${valResult.permissible} | Complete: ${valResult.isComplete}`);
  console.log(`  Semester Distribution:`, valResult.semesterCP);
  console.log(`  Categories:`);
  for (const [cid, cdata] of Object.entries(valResult.categories)) {
    console.log(`    - ${cdata.name}: ${cdata.current} / ${cdata.target} CP [${cdata.ok ? 'OK' : 'INCOMPLETE'}]`);
  }
  if (valResult.errors.length > 0) {
    console.log(`  Errors:`, valResult.errors);
  }
  if (valResult.warnings.length > 0) {
    console.log(`  Warnings:`, valResult.warnings.map(w => w.message || w));
  }
  console.log('--------------------------------------------------\n');
}
