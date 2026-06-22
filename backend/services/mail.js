// config/email.js
const nodemailer = require('nodemailer');

// Vérification des variables au démarrage
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
  console.error('❌ EMAIL_USER ou EMAIL_PASSWORD non définis dans .env');
  process.exit(1);
}

// Créer le transporteur
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Mot de passe d'application Gmail
  },
});

/**
 * Envoi d'email générique
 * @param {Object} params
 * @param {string} params.to - Destinataire
 * @param {string} params.subject - Sujet
 * @param {string} params.text - Version texte
 * @param {string} params.html - Version HTML (optionnelle)
 */
async function sendEmail({ to, subject, text, html }) {
  if (!to) throw new Error('Destinataire manquant');
  
  try {
    const info = await transporter.sendMail({
      from: `"Unitech ERP" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>'),
    });
    console.log(`✅ Email envoyé à ${to} (ID: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error('❌ Erreur envoi email:', error.message);
    throw error;
  }
}

/**
 * Envoi des identifiants à un enseignant/personnel
 */
async function sendCredentials({ to, nom, ecoleName, tempPassword, role, matricule }) {
  const subject = 'Bienvenue sur Unitech ERP - Vos identifiants';
  const text = `
Bonjour ${nom},

Bienvenue sur Unitech ERP !

Votre compte a été créé avec succès par l'administrateur de l'école "${ecoleName}" avec le rôle "${role}".

🔑 Identifiants :
- Adresse email : ${to}
- Mot de passe temporaire : ${tempPassword}
- Matricule : ${matricule || 'Non défini'}

🔗 Lien de connexion : https://unitech-erp-318i.onrender.com/connexion-personnel

⚠️ Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe dès votre première connexion.

---

UNITECH ERP - Solution de gestion scolaire
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">Bienvenue sur Unitech ERP</h2>
      <p>Bonjour <strong>${nom}</strong>,</p>
      <p>Votre compte a été créé avec succès par l'administrateur de l'école <strong>"${ecoleName}"</strong> avec le rôle <strong>${role}</strong>.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>🔑 Identifiants :</strong></p>
        <p>📧 Adresse email : <strong>${to}</strong></p>
        <p>🔒 Mot de passe temporaire : <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
        <p>🆔 Matricule : <strong>${matricule || 'Non défini'}</strong></p>
      </div>
      <p>
        <a href="https://unitech-erp-318i.onrender.com/connexion-personnel" style="display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">
          🔗 Se connecter
        </a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">⚠️ Pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe dès votre première connexion.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #9CA3AF;">UNITECH ERP - Solution de gestion scolaire</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

/**
 * Envoi des identifiants pour un nouvel établissement (création d'école)
 */
async function sendSchoolAdminCredentials({ to, nom, ecoleName, tempPassword, role }) {
  const subject = 'Bienvenue sur Unitech ERP - Création de votre école';
  const text = `
Bonjour ${nom},

Félicitations ! Votre établissement "${ecoleName}" a été enregistré sur Unitech ERP.

Votre compte administrateur a été créé avec le rôle "${role}".

🔑 Identifiants :
- Adresse email : ${to}
- Mot de passe temporaire : ${tempPassword}

🔗 Lien de connexion : https://unitech-erp-318i.onrender.com/connexion-personnel

⚠️ Changez votre mot de passe dès votre première connexion.

---

UNITECH ERP - Solution de gestion scolaire
  `;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">🏫 Bienvenue sur Unitech ERP</h2>
      <p>Bonjour <strong>${nom}</strong>,</p>
      <p>Félicitations ! Votre établissement <strong>"${ecoleName}"</strong> a été enregistré avec succès.</p>
      <p>Votre compte administrateur a été créé avec le rôle <strong>${role}</strong>.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>🔑 Identifiants :</strong></p>
        <p>📧 Adresse email : <strong>${to}</strong></p>
        <p>🔒 Mot de passe temporaire : <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
      </div>
      <p>
        <a href="https://unitech-erp-318i.onrender.com/connexion-personnel" style="display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; border-radius: 5px; text-decoration: none;">
          🔗 Se connecter
        </a>
      </p>
      <p style="font-size: 13px; color: #6B7280;">⚠️ Changez votre mot de passe dès votre première connexion.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
      <p style="font-size: 12px; color: #9CA3AF;">UNITECH ERP - Solution de gestion scolaire</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

module.exports = {
  sendEmail,
  sendCredentials,
  sendSchoolAdminCredentials,
};