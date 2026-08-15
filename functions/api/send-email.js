// POST /api/send-email - Send QR code email to a single participant via MailChannels
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const dorsal = body.dorsal;
    const qrImageBase64 = body.qrImage; // Base64 QR image from client

    if (!dorsal) {
      return new Response(JSON.stringify({ error: "Dorsal requerido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return new Response(JSON.stringify({ error: "No hay datos" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const participant = participantsRaw.find(p => p.dorsal === parseInt(dorsal));
    if (!participant) {
      return new Response(JSON.stringify({ error: "Participante no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!participant.email || !participant.email.trim()) {
      return new Response(JSON.stringify({ error: "Participante sin email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const siteUrl = new URL(request.url).origin;
    const qrPageUrl = `${siteUrl}/qr.html?dorsal=${participant.dorsal}`;

    // Send email via MailChannels with QR image embedded
    const emailResult = await sendMailChannels({
      to: participant.email,
      toName: participant.nombre,
      subject: `🏊‍♂️ Tu Código QR - Triatlón Race Club Hub - Dorsal #${participant.dorsal}`,
      htmlBody: generateEmailHTML(participant, qrPageUrl, qrImageBase64),
      textBody: generateEmailText(participant, qrPageUrl),
      fromEmail: env.FROM_EMAIL || "checkin@raceclubhub.com",
      fromName: env.FROM_NAME || "Race Club Hub",
      dkimDomain: env.DKIM_DOMAIN || undefined,
      dkimSelector: env.DKIM_SELECTOR || undefined,
      dkimPrivateKey: env.DKIM_PRIVATE_KEY || undefined
    });

    if (emailResult.success) {
      return new Response(JSON.stringify({
        success: true,
        message: `Email enviado a ${participant.email}`
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({
        error: "Error al enviar email",
        details: emailResult.error
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error interno", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function sendMailChannels({ to, toName, subject, htmlBody, textBody, fromEmail, fromName, dkimDomain, dkimSelector, dkimPrivateKey }) {
  const emailPayload = {
    personalizations: [
      {
        to: [{ email: to, name: toName }]
      }
    ],
    from: { email: fromEmail, name: fromName },
    subject: subject,
    content: [
      { type: "text/plain", value: textBody },
      { type: "text/html", value: htmlBody }
    ]
  };

  if (dkimDomain && dkimSelector && dkimPrivateKey) {
    emailPayload.personalizations[0].dkim_domain = dkimDomain;
    emailPayload.personalizations[0].dkim_selector = dkimSelector;
    emailPayload.personalizations[0].dkim_private_key = dkimPrivateKey;
  }

  try {
    const response = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(emailPayload)
    });

    if (response.status === 202 || response.status === 200) {
      return { success: true };
    } else {
      const errorText = await response.text();
      return { success: false, error: `Status ${response.status}: ${errorText}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function generateEmailHTML(participant, qrPageUrl, qrImageBase64) {
  // If we have a base64 QR image, embed it directly
  const qrImageTag = qrImageBase64
    ? `<img src="${qrImageBase64}" alt="Código QR" style="width:250px;height:250px;display:block;margin:0 auto;" />`
    : `<p style="text-align:center;"><a href="${qrPageUrl}" style="display:inline-block;background:#2563eb;color:white;padding:0.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;">📱 Ver mi Código QR</a></p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; padding: 2rem;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <h1 style="font-size: 1.5rem; color: #1e293b;">🏊‍♂️🚴‍♂️🏃‍♂️ Race Club Hub</h1>
      <p style="color: #64748b;">Sistema de Check-in - Triatlón</p>
    </div>
    
    <div style="text-align: center; padding: 1.5rem; background: #eff6ff; border-radius: 12px; margin-bottom: 1.5rem;">
      <p style="font-size: 3rem; font-weight: 800; color: #2563eb; margin: 0;">#${participant.dorsal}</p>
      <p style="font-size: 1.3rem; font-weight: 600; margin: 0.5rem 0;">${participant.nombre}</p>
      <p style="color: #64748b; margin: 0;">${participant.categoria}</p>
    </div>

    <div style="text-align:center; padding: 1.5rem; border: 2px solid #e2e8f0; border-radius: 12px; margin-bottom: 1.5rem;">
      <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 0.75rem 0; font-weight: 600;">TU CÓDIGO QR:</p>
      ${qrImageTag}
    </div>

    <table style="width:100%; border-collapse:collapse; margin-bottom: 1.5rem;">
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 0.5rem; color: #64748b; font-size: 0.9rem;">👤 Nombre</td>
        <td style="padding: 0.5rem; font-weight: 600; font-size: 0.9rem;">${participant.nombre}</td>
      </tr>
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 0.5rem; color: #64748b; font-size: 0.9rem;">🔢 Dorsal</td>
        <td style="padding: 0.5rem; font-weight: 600; font-size: 0.9rem;">#${participant.dorsal}</td>
      </tr>
      <tr>
        <td style="padding: 0.5rem; color: #64748b; font-size: 0.9rem;">🏷️ Categoría</td>
        <td style="padding: 0.5rem; font-weight: 600; font-size: 0.9rem;">${participant.categoria}</td>
      </tr>
    </table>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 1rem;">
      <p style="font-size: 0.85rem; color: #166534; margin: 0;">
        <strong>📱 Instrucciones:</strong><br>
        Presentá este código QR el día de la carrera para hacer el check-in de forma rápida. 
        Podés guardar una captura de pantalla o descargarlo.
      </p>
    </div>

    <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 0.8rem; color: #94a3b8;">
        Race Club Hub · raceclubhub.com<br>
        ¡Nos vemos en la meta! 🏁
      </p>
    </div>
  </div>
</body>
</html>`;
}

function generateEmailText(participant, qrPageUrl) {
  return `🏊‍♂️🚴‍♂️🏃‍♂️ Race Club Hub - Triatlón

¡Hola ${participant.nombre}! 👋

Tu información para la carrera:
━━━━━━━━━━━━━━━━━━━━
👤 Nombre:    ${participant.nombre}
🔢 Dorsal:    #${participant.dorsal}
🏷️ Categoría: ${participant.categoria}
━━━━━━━━━━━━━━━━━━━━

📱 Descargá tu código QR aquí: ${qrPageUrl}

Presentá tu código QR el día de la carrera para hacer check-in rápido.

¡Nos vemos en la meta! 🏁

- Equipo Race Club Hub
  raceclubhub.com`;
}
