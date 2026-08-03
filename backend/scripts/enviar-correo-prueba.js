const { enviarCorreoVerificacion } = require('../src/integrations/email/mailer');

const email = process.argv[2] || 'juliancr147025@gmail.com';
const codigo = process.argv[3] || String(Math.floor(100000 + Math.random() * 900000));

enviarCorreoVerificacion({ email, nombre: 'Prueba SGP', codigo })
  .then((info) => {
    console.log(`Correo enviado a ${email} con codigo ${codigo}`);
    console.log(`MessageId: ${info.messageId}`);
  })
  .catch((err) => {
    console.error('Error al enviar el correo:', err.message);
    process.exit(1);
  });
