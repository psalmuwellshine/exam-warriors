'use strict';
/* Faculties, departments, courses and levels, and the rules that tie students to them. */
const H = require('./helpers');
const D = require('./domain');

const { HttpError } = H;
const LEVELS = [100, 200, 300, 400, 500, 600];
const MATRIC_RE = /^[A-Z0-9][A-Z0-9/._-]{3,24}$/;
const normMatric = (s) => String(s || '').toUpperCase().replace(/\s+/g, '');

const byName = (a, b) => String(a.name).localeCompare(String(b.name));
async function loadAcademics(store) {
  const [faculties, departments, courses] = await Promise.all([store.list('faculties'), store.list('departments'), store.list('courses')]);
  return {
    faculties: faculties.sort(byName),
    departments: departments.sort(byName),
    courses: courses.sort((a, b) => a.level - b.level || String(a.code).localeCompare(b.code)),
  };
}

// First run: turn the old course list into a faculty, a department and real courses so nothing disappears.
async function seedAcademics(store) {
  if (await store.get('settings', 'academics-seeded')) return;
  const [faculties, courses, materials, quizzes, stored] = await Promise.all([store.list('faculties'), store.list('courses'), store.list('materials'), store.list('quizzes'), store.get('settings', 'config')]);
  if (!faculties.length && !courses.length) {
    const fac = { id: H.newId(), name: 'Basic Medical Sciences' };
    const dep = { id: H.newId(), facultyId: fac.id, name: 'Medical Laboratory Science', maxLevel: 500 };
    await store.put('faculties', fac); await store.put('departments', dep);
    const list = (stored && Array.isArray(stored.courses) && stored.courses.length ? stored.courses : D.SEED_COURSES);
    const seen = new Set();
    const add = async (code, name) => {
      code = String(code || '').toUpperCase(); if (!code || seen.has(code)) return; seen.add(code);
      const digit = (code.match(/\d/) || ['2'])[0];
      const level = LEVELS.includes(Number(digit) * 100) ? Number(digit) * 100 : 200;
      const general = /^GST/.test(code);
      await store.put('courses', { id: H.newId(), code, name: name || '', level, departmentIds: general ? [] : [dep.id] });
    };
    for (const c of list) await add(c.code, c.name);
    for (const x of materials.concat(quizzes)) await add(x.course, '');
  }
  await store.put('settings', { id: 'academics-seeded', at: Date.now() });
}

// A course is shown to a student when it is for their level and their department (or for everyone).
function courseApplies(course, user) {
  if (!user || !user.departmentId || !user.level) return false;
  return course.level === user.level && (!course.departmentIds || !course.departmentIds.length || course.departmentIds.includes(user.departmentId));
}

// Checks faculty, department and level picked by a student and returns clean values.
function pickAcademic(b, acad) {
  const facultyId = H.str(b.facultyId, 40); const departmentId = H.str(b.departmentId, 40); const level = Number(b.level);
  const fac = acad.faculties.find((f) => f.id === facultyId);
  if (!fac) throw new HttpError(400, 'Choose your faculty.');
  const dep = acad.departments.find((d) => d.id === departmentId && d.facultyId === facultyId);
  if (!dep) throw new HttpError(400, 'Choose your department from the list.');
  if (!LEVELS.includes(level) || level > (dep.maxLevel || 600)) throw new HttpError(400, 'Choose your level.');
  return { facultyId, departmentId, level };
}
function cleanMatric(raw) {
  const m = normMatric(raw);
  if (!MATRIC_RE.test(m)) throw new HttpError(400, 'Enter your matric or registration number (4 to 25 letters, numbers, / . - or _).');
  return m;
}

module.exports = { LEVELS, loadAcademics, seedAcademics, courseApplies, pickAcademic, cleanMatric, normMatric };
