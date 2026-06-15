const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const dbPath = path.join(os.tmpdir(), `unitech-erp-inscription-${process.pid}-${Date.now()}.db`);
process.env.UNITECH_DB_PATH = dbPath;

const db = require('../database/db');
const systemController = require('../controllers/systemController');
const {
  computeInscriptionForecast,
  buildInscriptionConflictReport,
} = require('../utils/inscriptionForecast');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function makeRes() {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return response;
}

async function createSchoolFixture(suffix) {
  const schoolYearLabel = `2025-2026-${suffix}`;
  const school = await run(
    `INSERT INTO schools (name, email, plan, billing, current_school_year)
     VALUES (?, ?, 'basic', 'monthly', ?)`,
    [`Ecole test ${suffix}`, `school-${suffix}@example.com`, schoolYearLabel]
  );

  const classRow = await run(
    `INSERT INTO classes (name, cycle, niveau, mensualite, frais_inscription, max_effectif, school_id, annee, effectif)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [`Classe ${suffix}`, 'primaire', '1ere', 15000, 8000, 40, school.id, schoolYearLabel]
  );

  return {
    schoolId: school.id,
    classId: classRow.id,
    schoolYearLabel,
    className: `Classe ${suffix}`,
  };
}

test.before(async () => {
  await get('SELECT 1 AS ok');
});

test.after(async () => {
  await new Promise((resolve) => db.close(resolve));
  try {
    fs.rmSync(dbPath, { force: true });
  } catch {
    // ignore temp file cleanup errors
  }
});

test('setup manual student is created without inscription payment', async () => {
  const fixture = await createSchoolFixture('manual');
  const req = {
    user: { school_id: fixture.schoolId },
    body: {
      nom: 'Diallo',
      prenom: 'Aminata',
      classe: fixture.className,
      sexe: 'F',
      dateNaissance: '2012-04-15',
      telparent: '70000000',
      nomparent: 'Oumar Diallo',
    },
  };
  const res = makeRes();

  await systemController.createSetupStudentManual(req, res);

  assert.equal(res.statusCode, 201);
  assert.ok(res.body?.id);

  const student = await get('SELECT * FROM eleves WHERE id = ?', [res.body.id]);
  assert.equal(Number(student.exonere_frais_inscription || 0), 1);
  assert.equal(Number(student.frais_total || 0), 0);
  assert.equal(Number(student.montant_paye || 0), 0);
  assert.equal(Number(student.reste_a_payer || 0), 0);
  assert.equal(String(student.etat_paiement || ''), 'paye');

  const paymentCount = await get(
    `SELECT COUNT(*) AS total
     FROM paiements
     WHERE eleve_id = ? AND LOWER(COALESCE(mois, '')) = 'inscription'`,
    [res.body.id]
  );
  assert.equal(Number(paymentCount.total || 0), 0);

  const classRow = await get('SELECT effectif FROM classes WHERE id = ?', [fixture.classId]);
  assert.equal(Number(classRow.effectif || 0), 1);
});

test('createPaiement rejects inscription payment for an exempt student', async () => {
  const fixture = await createSchoolFixture('guard');
  const setupReq = {
    user: { school_id: fixture.schoolId },
    body: {
      nom: 'Traore',
      prenom: 'Ibrahim',
      classe: fixture.className,
      sexe: 'M',
      dateNaissance: '2011-09-20',
      telparent: '71000000',
      nomparent: 'Mamadou Traore',
    },
  };
  const setupRes = makeRes();
  await systemController.createSetupStudentManual(setupReq, setupRes);
  const studentId = setupRes.body.id;

  const paymentReq = {
    user: { school_id: fixture.schoolId },
    body: {
      eleve_id: studentId,
      montant: 8000,
      mois: 'inscription',
      date_payement: '2026-06-15',
      mode_payement: 'cash',
      description: "Paiement d'inscription",
    },
  };
  const paymentRes = makeRes();
  await systemController.createPaiement(paymentReq, paymentRes);

  assert.equal(paymentRes.statusCode, 403);
  assert.match(String(paymentRes.body?.error || ''), /exonere/i);

  const paymentCount = await get('SELECT COUNT(*) AS total FROM paiements WHERE eleve_id = ?', [studentId]);
  assert.equal(Number(paymentCount.total || 0), 0);
});

test('forecast helper ignores exempted students for inscription fees', async () => {
  const forecast = computeInscriptionForecast([
    {
      name: 'Classe A',
      effectif: 10,
      free_effectif: 2,
      mensualite: 15000,
      frais_inscription: 8000,
    },
    {
      name: 'Classe B',
      effectif: 5,
      free_effectif: 0,
      mensualite: 12000,
      frais_inscription: 6000,
    },
  ]);

  assert.equal(forecast.totalMensuelPrevu, 210000);
  assert.equal(forecast.totalFraisInscriptionPrevu, 94000);
  assert.equal(forecast.totalCumulePrevu, 304000);
  assert.equal(forecast.rows[0].effectif_inscription, 8);
});

test('startup conflict report detects exempt students with inscription payments', async () => {
  const report = buildInscriptionConflictReport(
    [
      { id: 1, matricule: 'ELV001', nom: 'Diallo', prenom: 'Awa', exonere_frais_inscription: 1 },
      { id: 2, matricule: 'ELV002', nom: 'Barry', prenom: 'Moussa', exonere_frais_inscription: 0 },
    ],
    [
      { eleve_id: 1, mois: 'inscription', montant: 10000 },
      { eleve_id: 2, mois: 'inscription', montant: 10000 },
    ]
  );

  assert.equal(report.conflictCount, 1);
  assert.equal(report.conflictingStudents[0].matricule, 'ELV001');
  assert.equal(report.conflictingStudents[0].inscriptionPayments, 1);
});
