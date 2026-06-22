const nodeMailer = require('nodemailer');
const transporter = nodeMailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
console.log('email user:', process.env.EMAIL_USER);
console.log('email password:', process.env.EMAIL_PASSWORD);
const sendEmail = async (to,nom,ecolName,mts,role) => {
    subject = 'Bienvenue sur Unitech ERP';
    text = `Bonjour ${nom},\n\nBienvenue sur Unitech ERP!\n\nVotre compte a été créé avec succès par l'administrateur de l'école ${ecolName} avec le role ${role}.\n\nVeuillez vous connecter avec votre adresse email et changer votre mot de passe dès que possible , pour cela cliquez le lien https://unitech-erp-318i.onrender.com/connexion-personnel.\n\n Mots de passe par defaut : ${mts}`;
  
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text
  });
};
const sendMailonRegister = async (to,nom,ecolName,mts,role) => {
  subject = 'Bienvenue sur Unitech ERP';
    text = `Bonjour ${nom},\n\nBienvenue sur Unitech ERP!\n\n Votre compte de gestion d'etablissement a été créé avec succès au nom de l'école ${ecolName} avec le role ${role}.\n\nVeuillez vous connecter avec votre addresse mail et changer votre mot de passe dès que possible , pour cela cliquez le lien https://unitech-erp-318i.onrender.com/connexion-personnel.\n\n Mots de passe par defaut : ${mts}`;
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text
  });
};

exports.sendEmail = sendEmail;
exports.sendMailonRegister = sendMailonRegister;