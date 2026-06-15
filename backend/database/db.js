const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.UNITECH_DB_PATH
  ? path.resolve(process.env.UNITECH_DB_PATH)
  : path.resolve(__dirname, 'unitech.db');
const db = new sqlite3.Database(dbPath);

function ensureColumn(tableName, columnName, definition, onReady) {
  db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
    if (err) {
      console.error(`Erreur lecture schema ${tableName}:`, err);
      if (typeof onReady === 'function') onReady(err);
      return;
    }

    const exists = Array.isArray(columns) && columns.some((column) => column.name === columnName);
    if (exists) {
      if (typeof onReady === 'function') onReady(null, true);
      return;
    }

    db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`, (alterErr) => {
      if (alterErr) {
        console.error(`Erreur ajout colonne ${tableName}.${columnName}:`, alterErr);
        if (typeof onReady === 'function') onReady(alterErr);
        return;
      }
      if (typeof onReady === 'function') onReady(null, false);
    });
  });
}

function runIfColumnExists(tableName, columnName, sql) {
  db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
    if (err) {
      console.error(`Erreur lecture schema ${tableName}:`, err);
      return;
    }

    const exists = Array.isArray(columns) && columns.some((column) => column.name === columnName);
    if (!exists) return;

    db.run(sql, (runErr) => {
      if (runErr) {
        console.error(`Erreur execution SQL conditionnelle sur ${tableName}.${columnName}:`, runErr);
      }
    });
  });
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS schools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE,
      address TEXT,
      plan TEXT DEFAULT 'basic',
      billing TEXT DEFAULT 'monthly',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price_monthly INTEGER NOT NULL DEFAULT 0,
      price_annual INTEGER NOT NULL DEFAULT 0,
      annual_discount_percent INTEGER NOT NULL DEFAULT 15,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS saas_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      plan_code TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      billing_cycle TEXT NOT NULL DEFAULT 'monthly',
      status TEXT NOT NULL DEFAULT 'pending',
      starts_at DATE,
      expires_at DATE,
      notes TEXT,
      validated_at DATETIME,
      validated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      school_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS school_years (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      is_active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (school_id, label),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      school_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      cycle TEXT NOT NULL,
      niveau TEXT NOT NULL,
      mensualite REAL NOT NULL,
      frais_inscription REAL DEFAULT 0,
      max_effectif INTEGER NOT NULL,
      school_id INTEGER,
      effectif INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS eleves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT UNIQUE NOT NULL,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      date_naissance DATE NOT NULL,
      lieu_naissance TEXT,
      sexe TEXT CHECK(sexe IN ('M', 'F')),
      nationalite TEXT DEFAULT 'MALIENNE',
      adresse TEXT,
      telephone_parent TEXT,
      email_parent TEXT,
      nom_parent TEXT,
      profession_parent TEXT,
      classe_actuelle_id INTEGER,
      ecole_actuelle_id INTEGER,
      date_inscription DATE DEFAULT CURRENT_DATE,
      annee_scolaire_id INTEGER,
      photo TEXT,
      statut TEXT DEFAULT 'actif' CHECK(statut IN ('actif', 'transfere', 'exclu', 'diplome')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (classe_actuelle_id) REFERENCES classes(id) ON DELETE SET NULL,
      FOREIGN KEY (ecole_actuelle_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (annee_scolaire_id) REFERENCES school_years(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS enseignants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT UNIQUE,
      nomComplet TEXT NOT NULL,
      date_naissance DATE,
      lieu_naissance TEXT,
      sexe TEXT CHECK(sexe IN ('M', 'F')),
      nationalite TEXT DEFAULT 'MALIENNE',
      adresse TEXT,
      telephone TEXT UNIQUE,
      email TEXT UNIQUE,
      matiere TEXT NOT NULL,
      typePayement TEXT CHECK(typePayement IN ('salaire', 'tauxHoraire')),
      statut TEXT DEFAULT 'actif' CHECK(statut IN ('actif', 'suspendu')),
      salaire REAL,
      tauxHoraire REAL,
      date_embauche DATE DEFAULT CURRENT_DATE,
      annee_scolaire_id INTEGER,
      photo TEXT,
      school_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      niveau_enseignement TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (annee_scolaire_id) REFERENCES school_years(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS personnels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricule TEXT UNIQUE,
      nomComplet TEXT NOT NULL,
      date_naissance DATE,
      lieu_naissance TEXT,
      sexe TEXT CHECK(sexe IN ('M', 'F')),
      nationalite TEXT DEFAULT 'MALIENNE',
      adresse TEXT,
      telephone TEXT UNIQUE,
      email TEXT UNIQUE,
      poste TEXT NOT NULL,
      typePayement TEXT CHECK(typePayement IN ('salaire', 'tauxHoraire')),
      statut TEXT DEFAULT 'actif' CHECK(statut IN ('actif', 'suspendu')),
      salaire REAL,
      tauxHoraire REAL,
      date_embauche DATE DEFAULT CURRENT_DATE,
      annee_scolaire_id INTEGER,
      photo TEXT,
      school_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (annee_scolaire_id) REFERENCES school_years(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS matieres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      description TEXT,
      coefficient REAL DEFAULT 1,
      school_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS affectation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER,
      school_year_id INTEGER,
      nom_matiere TEXT NOT NULL,
      enseignant_id TEXT NOT NULL,
      classe_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS paiements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      eleve_id INTEGER,
      eleve_matricule TEXT,
      montant REAL NOT NULL,
      mois TEXT,
      date_payement DATE,
      mode_payement TEXT,
      annee_scolaire TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS depenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      categorie TEXT,
      description TEXT,
      motif TEXT NOT NULL,
      montant REAL NOT NULL,
      date_depenses DATE,
      valide_par TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS salaires (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      personnel_matricule TEXT,
      source_type TEXT DEFAULT 'personnel',
      mois TEXT,
      montant REAL NOT NULL,
      mode_payement TEXT,
      date_payement DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS retraits_promoteur (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      montant REAL NOT NULL,
      date_retrait DATE,
      motif TEXT,
      valide_par TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS emplois (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      affectation_id INTEGER,
      jour TEXT NOT NULL,
      heure_debut TEXT NOT NULL,
      heure_fin TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (affectation_id) REFERENCES affectation(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trimestres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      school_year_id INTEGER NOT NULL,
      school_year_label TEXT,
      code TEXT NOT NULL,
      label TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_validated INTEGER NOT NULL DEFAULT 0,
      validated_at DATETIME,
      validated_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (school_id, school_year_id, code),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE CASCADE,
      FOREIGN KEY (validated_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS school_calendar_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      date_value DATE NOT NULL,
      label TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'holiday',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (school_id, date_value),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS trimestre_workloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      trimestre_id INTEGER NOT NULL,
      affectation_id INTEGER,
      classe_id INTEGER,
      classe_nom TEXT,
      matiere TEXT NOT NULL,
      enseignant_id INTEGER,
      enseignant_nom TEXT,
      source_hours REAL NOT NULL DEFAULT 0,
      source_slots INTEGER NOT NULL DEFAULT 0,
      adjusted_hours REAL NOT NULL DEFAULT 0,
      adjusted_slots INTEGER NOT NULL DEFAULT 0,
      adjusted_enseignant_id INTEGER,
      adjusted_enseignant_nom TEXT,
      adjustment_reason TEXT,
      payment_rule TEXT,
      payment_schedule TEXT,
      hourly_rate REAL,
      slot_rate REAL,
      forfait_amount REAL,
      forecast_amount REAL NOT NULL DEFAULT 0,
      is_manual_override INTEGER NOT NULL DEFAULT 0,
      is_validated INTEGER NOT NULL DEFAULT 0,
      validated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (trimestre_id, affectation_id),
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (trimestre_id) REFERENCES trimestres(id) ON DELETE CASCADE,
      FOREIGN KEY (affectation_id) REFERENCES affectation(id) ON DELETE SET NULL,
      FOREIGN KEY (adjusted_enseignant_id) REFERENCES enseignants(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      eleve_id INTEGER,
      eleve_matricule TEXT NOT NULL,
      matiere TEXT NOT NULL,
      trimestre TEXT NOT NULL,
      note REAL NOT NULL,
      annee TEXT,
      note_type TEXT DEFAULT 'devoir',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS absences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      eleve_id INTEGER NOT NULL,
      date DATE NOT NULL,
      type TEXT CHECK(type IN ('absence', 'retard')) DEFAULT 'absence',
      justifie INTEGER DEFAULT 0,
      motif TEXT,
      duree_minutes INTEGER,
      enseignant_id INTEGER,
      school_year_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
      FOREIGN KEY (enseignant_id) REFERENCES enseignants(id) ON DELETE SET NULL,
      FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL,
      UNIQUE (eleve_id, date)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS teacher_absences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      date DATE NOT NULL,
      heure_debut TEXT,
      heure_fin TEXT,
      type TEXT CHECK(type IN ('absence', 'retard', 'conge', 'mission')) DEFAULT 'absence',
      justifie INTEGER DEFAULT 0,
      motif TEXT,
      school_year_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES enseignants(id) ON DELETE CASCADE,
      FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      eleve_id INTEGER NOT NULL,
      matricule TEXT NOT NULL,
      from_classe_id INTEGER,
      to_classe_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      reason TEXT,
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      responded_at DATETIME,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE,
      FOREIGN KEY (eleve_id) REFERENCES eleves(id) ON DELETE CASCADE,
      FOREIGN KEY (from_classe_id) REFERENCES classes(id) ON DELETE SET NULL,
      FOREIGN KEY (to_classe_id) REFERENCES classes(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      school_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_type TEXT,
      entity_ref TEXT,
      metadata TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      unique_key TEXT,
      FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sync_state (
      table_name TEXT PRIMARY KEY,
      last_pulled_at TEXT
    )
  `);

  ensureColumn('eleves', 'motif_statut', 'TEXT');
  ensureColumn('eleves', 'statut_desactive_par', 'INTEGER');
  ensureColumn('eleves', 'statut_desactive_le', 'DATETIME');

  const commonPersonnelColumns = [
    ['situation_matrimoniale', 'TEXT'],
    ['type_personnel', 'TEXT'],
    ['departement', 'TEXT'],
    ['specialite', 'TEXT'],
    ['diplomes', 'TEXT'],
    ['niveau_etude', 'TEXT'],
    ['experience_professionnelle', 'TEXT'],
    ['competences', 'TEXT'],
    ['horaires_travail', 'TEXT'],
    ['numero_employe', 'TEXT'],
    ['type_contrat', 'TEXT'],
    ['date_debut_contrat', 'DATE'],
    ['date_fin_contrat', 'DATE'],
    ['temps_travail', 'TEXT'],
    ['nina', 'TEXT'],
    ['inps', 'TEXT'],
    ['references_administratives', 'TEXT'],
    ['documents_identite', 'TEXT'],
    ['diplomes_scannes', 'TEXT'],
    ['contrat_travail', 'TEXT'],
    ['cv', 'TEXT'],
    ['attestations', 'TEXT'],
    ['date_prise_service', 'DATE'],
    ['prime', 'REAL'],
    ['indemnites', 'REAL'],
    ['mode_paiement', 'TEXT'],
    ['historique_salaires', 'TEXT'],
    ['avances_salaire', 'REAL'],
    ['retenues', 'REAL'],
    ['regle_paiement_partiel', 'TEXT'],
    ['montant_creneau', 'REAL'],
    ['montant_forfait_trimestre', 'REAL'],
    ['echeance_paiement', 'TEXT'],
    ['bulletins_paie', 'TEXT'],
    ['etat_paiements', 'TEXT'],
    ['presences', 'TEXT'],
    ['absences', 'INTEGER'],
    ['retards', 'INTEGER'],
    ['permissions', 'INTEGER'],
    ['conges', 'TEXT'],
    ['sanctions_disciplinaires', 'TEXT'],
    ['historique_pointages', 'TEXT'],
    ['observations_administratives', 'TEXT'],
    ['contact_urgence_nom', 'TEXT'],
    ['contact_urgence_lien', 'TEXT'],
    ['contact_urgence_telephone', 'TEXT'],
    ['contact_urgence_adresse', 'TEXT'],
    ['documents', 'TEXT'],
  ];

  const enseignantOnlyColumns = [
    ['matieres_enseignees', 'TEXT'],
    ['classes_affectees', 'TEXT'],
    ['volume_horaire', 'TEXT'],
    ['emploi_du_temps', 'TEXT'],
    ['professeur_principal', 'TEXT'],
    ['nombre_eleves_suivis', 'INTEGER'],
    ['historique_affectations', 'TEXT'],
    ['resultats_classes', 'TEXT'],
    ['absences_enseignant', 'INTEGER'],
    ['observations_pedagogiques', 'TEXT'],
  ];

  const eleveColumns = [
    ['telephone', 'TEXT'],
    ['email', 'TEXT'],
    ['serie', 'TEXT'],
    ['numero_table', 'TEXT'],
    ['classe_precedente', 'TEXT'],
    ['niveau_etude', 'TEXT'],
    ['etablissement_precedent', 'TEXT'],
    ['redoublant', 'TEXT'],
    ['option_etude', 'TEXT'],
    ['groupe_pedagogique', 'TEXT'],
    ['professeur_principal', 'TEXT'],
    ['lien_tuteur', 'TEXT'],
    ['adresse_tuteur', 'TEXT'],
    ['contact_urgence', 'TEXT'],
    ['frais_total', 'REAL'],
    ['montant_paye', 'REAL'],
    ['reste_a_payer', 'REAL'],
    ['reduction', 'REAL'],
    ['etat_paiement', 'TEXT'],
    ['dernier_paiement', 'DATE'],
    ['moyenne_generale', 'REAL'],
    ['rang_eleve', 'INTEGER'],
    ['nombre_matieres', 'INTEGER'],
    ['notes_matieres', 'TEXT'],
    ['appreciations', 'TEXT'],
    ['nombre_absences', 'INTEGER'],
    ['absences_justifiees', 'INTEGER'],
    ['absences_non_justifiees', 'INTEGER'],
    ['retards', 'INTEGER'],
    ['sanctions', 'TEXT'],
    ['comportement', 'TEXT'],
    ['documents', 'TEXT'],
  ];

  commonPersonnelColumns.forEach(([name, definition]) => {
    ensureColumn('enseignants', name, definition);
    ensureColumn('personnels', name, definition);
  });

  enseignantOnlyColumns.forEach(([name, definition]) => {
    ensureColumn('enseignants', name, definition);
  });

  eleveColumns.forEach(([name, definition]) => {
    ensureColumn('eleves', name, definition);
  });

  ensureColumn('affectation', 'school_id', 'INTEGER');
  ensureColumn('affectation', 'school_year_id', 'INTEGER');
  ensureColumn('classes', 'annee', 'TEXT');
  ensureColumn('paiements', 'school_year_id', 'INTEGER');
  ensureColumn('depenses', 'school_year_id', 'INTEGER');
  ensureColumn('salaires', 'school_year_id', 'INTEGER');
  ensureColumn('retraits_promoteur', 'school_year_id', 'INTEGER');
  ensureColumn('emplois', 'school_year_id', 'INTEGER');
  ensureColumn('notes', 'school_year_id', 'INTEGER');
  ensureColumn('trimestres', 'school_year_id', 'INTEGER');
  ensureColumn('absences', 'school_id', 'INTEGER');
  ensureColumn('absences', 'duree_minutes', 'INTEGER');
  ensureColumn('absences', 'enseignant_id', 'INTEGER');
  ensureColumn('absences', 'school_year_id', 'INTEGER');
  ensureColumn('eleves', 'exonere_frais_inscription', 'INTEGER DEFAULT 0', () => {
    db.run(
      `UPDATE eleves
          SET exonere_frais_inscription = 1,
              frais_total = 0,
              montant_paye = 0,
              reste_a_payer = 0,
              etat_paiement = 'paye'
        WHERE COALESCE(exonere_frais_inscription, 0) = 0
          AND COALESCE(frais_total, 0) > 0
          AND COALESCE(reste_a_payer, 0) = 0
          AND NOT EXISTS (
            SELECT 1
            FROM paiements p
            WHERE p.eleve_id = eleves.id
              AND lower(COALESCE(p.mois, '')) = 'inscription'
          )`,
      (updateErr) => {
        if (updateErr) {
          console.error('Erreur migration eleves.exonere_frais_inscription:', updateErr);
        }
      }
    );

    db.run(`
      CREATE TRIGGER IF NOT EXISTS prevent_inscription_payment_for_exempt_students
      BEFORE INSERT ON paiements
      WHEN LOWER(COALESCE(NEW.mois, '')) = 'inscription'
        AND NEW.eleve_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM eleves e
          WHERE e.id = NEW.eleve_id
            AND COALESCE(e.exonere_frais_inscription, 0) = 1
        )
      BEGIN
        SELECT RAISE(ABORT, 'INSCRIPTION_FEE_WAIVED');
      END;
    `);

    db.run(`
      CREATE TRIGGER IF NOT EXISTS prevent_inscription_payment_update_for_exempt_students
      BEFORE UPDATE OF mois, eleve_id ON paiements
      WHEN LOWER(COALESCE(NEW.mois, '')) = 'inscription'
        AND NEW.eleve_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM eleves e
          WHERE e.id = NEW.eleve_id
            AND COALESCE(e.exonere_frais_inscription, 0) = 1
        )
      BEGIN
        SELECT RAISE(ABORT, 'INSCRIPTION_FEE_WAIVED');
      END;
    `);

    db.get(
      `
        SELECT COUNT(*) AS total
        FROM eleves e
        WHERE COALESCE(e.exonere_frais_inscription, 0) = 1
          AND EXISTS (
            SELECT 1
            FROM paiements p
            WHERE p.eleve_id = e.id
              AND LOWER(COALESCE(p.mois, '')) = 'inscription'
          )
      `,
      (checkErr, row) => {
        if (checkErr) {
          console.error('Erreur controle coherence frais inscription:', checkErr);
          return;
        }

        const total = Number(row?.total || 0);
        if (total > 0) {
          console.warn(
            `Controle coherence: ${total} eleve(s) exonere(s) ont encore un paiement d'inscription.`
          );
        }
      }
    );
  });

  ensureColumn('schools', 'current_school_year', 'TEXT');
  ensureColumn('schools', 'daterentrer', 'TEXT');
  ensureColumn('schools', 'is_active', 'INTEGER DEFAULT 1');
  ensureColumn('schools', 'subscription_plan', 'TEXT');
  ensureColumn('schools', 'localisation', 'TEXT');
  ensureColumn('schools', 'code_postal', 'TEXT');
  ensureColumn('schools', 'logo_url', 'TEXT');
  ensureColumn('schools', 'promoter_name', 'TEXT');
  ensureColumn('schools', 'director_name', 'TEXT');
  ensureColumn('users', 'is_active', 'INTEGER DEFAULT 1');
  ensureColumn('users', 'phone', 'TEXT');
  ensureColumn('users', 'matricule', 'TEXT');
  ensureColumn('transfers', 'transfer_type', "TEXT DEFAULT 'internal'");
  ensureColumn('transfers', 'to_school_id', 'INTEGER');
  ensureColumn('enseignants', 'type_payement', 'TEXT');
  ensureColumn('enseignants', 'salaire_base', 'REAL');
  ensureColumn('enseignants', 'taux_horaire', 'REAL');
  ensureColumn('enseignants', 'status', 'TEXT');
  ensureColumn('personnels', 'type_payement', 'TEXT');
  ensureColumn('personnels', 'salaire_base', 'REAL');
  ensureColumn('personnels', 'taux_horaire', 'REAL');
  ensureColumn('personnels', 'full_name', 'TEXT');
  ensureColumn('personnels', 'role', 'TEXT');

  db.run(`
    UPDATE users
    SET role = 'directeur'
    WHERE lower(trim(role)) IN ('administrateur ecole', 'administrateur_ecole', 'administrateur', 'admin')
  `, (err) => {
    if (err) {
      console.error('Erreur normalisation roles utilisateurs:', err);
    }
  });

  db.run(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_school_unique_key
    ON notifications (school_id, unique_key)
    WHERE TRIM(COALESCE(unique_key, '')) <> ''
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_saas_subscriptions_school_created
    ON saas_subscriptions (school_id, created_at DESC, id DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_activity_logs_school_created
    ON activity_logs (school_id, created_at DESC, id DESC)
  `);

  db.run(`
    INSERT OR IGNORE INTO subscription_plans (code, name, price_monthly, price_annual, annual_discount_percent)
    VALUES
      ('basic', 'Basic', 15000, 153000, 15),
      ('pro', 'Smart', 30000, 306000, 15),
      ('smart', 'Smart', 30000, 306000, 15),
      ('premium', 'Premium', 60000, 612000, 15)
  `);

  db.run(`
    INSERT INTO saas_subscriptions (school_id, plan_code, amount, billing_cycle, status, notes)
    SELECT
      s.id,
      CASE
        WHEN LOWER(COALESCE(s.plan, 'basic')) = 'smart' THEN 'pro'
        ELSE LOWER(COALESCE(s.plan, 'basic'))
      END,
      CASE
        WHEN LOWER(COALESCE(s.plan, 'basic')) IN ('pro', 'smart')
          THEN CASE WHEN LOWER(COALESCE(s.billing, 'monthly')) = 'annual' THEN 306000 ELSE 30000 END
        WHEN LOWER(COALESCE(s.plan, 'basic')) = 'premium'
          THEN CASE WHEN LOWER(COALESCE(s.billing, 'monthly')) = 'annual' THEN 612000 ELSE 60000 END
        ELSE CASE WHEN LOWER(COALESCE(s.billing, 'monthly')) = 'annual' THEN 153000 ELSE 15000 END
      END,
      CASE WHEN LOWER(COALESCE(s.billing, 'monthly')) = 'annual' THEN 'annual' ELSE 'monthly' END,
      'pending',
      'Abonnement initialise automatiquement pour ecole existante'
    FROM schools s
    WHERE NOT EXISTS (
      SELECT 1
      FROM saas_subscriptions ss
      WHERE ss.school_id = s.id
    )
  `);

  runIfColumnExists('schools', 'is_active', `UPDATE schools SET is_active = COALESCE(is_active, 1)`);
  runIfColumnExists('schools', 'subscription_plan', `UPDATE schools SET subscription_plan = COALESCE(NULLIF(subscription_plan, ''), plan, 'basic')`);

  const defaultAdminPassword = bcrypt.hashSync('admin123', 10);
  db.run(`
    INSERT INTO users (name, email, password, role)
    SELECT 'Super Admin', 'admin@unitech.com', ?, 'super@admin'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@unitech.com')
  `, [defaultAdminPassword], (err) => {
    if (err) {
      console.error('Erreur insertion admin par défaut:', err);
    } else {
      console.log('Base de données initialisée avec succès');
    }
  });
});

module.exports = db;
