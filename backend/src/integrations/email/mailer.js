const env = require('../../config/env');

function plantillaVerificacion({ nombre, codigo, expiracionMinutos }) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #1f2937; margin: 0 0 16px;">Verifica tu cuenta en SGP</h2>
      <p style="color: #4b5563; line-height: 1.6;">Hola ${nombre},</p>
      <p style="color: #4b5563; line-height: 1.6;">Usa el siguiente codigo para completar la verificacion de tu cuenta:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0f766e; padding: 12px 24px; border: 2px dashed #0f766e; border-radius: 8px;">${codigo}</span>
      </div>
      <p style="color: #4b5563; line-height: 1.6;">El codigo expira en ${expiracionMinutos} minutos.</p>
      <p style="color: #9ca3af; font-size: 13px; line-height: 1.6;">Si no solicitaste este correo, puedes ignorarlo.</p>
    </div>
  `;
}

async function enviarCorreoVerificacion({ email, nombre, codigo, expiracionMinutos = 15 }) {
  if (!env.brevoApiKey) {
    const err = new Error('Brevo no configurado: define BREVO_API_KEY en .env');
    err.statusCode = 500;
    throw err;
  }

  const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': env.brevoApiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: env.brevoSenderName, email: env.brevoSenderEmail },
      to: [{ email, name: nombre }],
      subject: 'Verifica tu cuenta en SGP',
      htmlContent: plantillaVerificacion({ nombre, codigo, expiracionMinutos }),
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    const err = new Error(`Brevo API ${respuesta.status}: ${detalle}`);
    err.statusCode = 502;
    throw err;
  }

  const datos = await respuesta.json();
  return { messageId: datos.messageId };
}

module.exports = { enviarCorreoVerificacion };
