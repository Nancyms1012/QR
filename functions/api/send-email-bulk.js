// POST /api/send-email-bulk - Send QR code emails to all participants with email addresses
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return new Response(JSON.stringify({ error: "No hay datos" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const withEmail = participantsRaw.filter(p => p.email && p.email.trim());

    if (withEmail.length === 0) {
      return new Response(JSON.stringify({ error: "No hay participantes con email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const siteUrl = new URL(request.url).origin;
    const fromEmail = env.FROM_EMAIL || "checkin@raceclubhub.com";
    const fromName = env.FROM_NAME || "Race Club Hub";

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const participant of withEmail) {
      const qrPageUrl = `${siteUrl}/qr.html?dorsal=${participant.dorsal}`;

      const result = await sendMailChannels({
        to: participant.email,
        toName: participant.nombre,
        subject: `🏊‍♂️ Tu Código QR - Triatlón Race Club Hub - Dorsal #${participant.dorsal}`,
        htmlBody: generateEmailHTML(participant, qrPageUrl),
        textBody: generateEmailText(participant, qrPageUrl),
        fromEmail,
        fromName,
        dkimDomain: env.DKIM_DOMAIN || undefined,
        dkimSelector: env.DKIM_SELECTOR || undefined,
        dkimPrivateKey: env.DKIM_PRIVATE_KEY || undefined
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
        errors.push({ dorsal: participant.dorsal, email: participant.email, error: result.error });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return new Response(JSON.stringify({
      success: true,
      sent,
      failed,
      total: withEmail.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      headers: { "Content-Type": "application/json" }
    });
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

function generateEmailHTML(participant, qrPageUrl) {
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

    <p style="color: #334155; line-height: 1.6;">
      ¡Hola <strong>${participant.nombre}</strong>! 👋
    </p>
    <p style="color: #334155; line-height: 1.6;">
      Tu número de dorsal para el triatlón es <strong>#${participant.dorsal}</strong>. 
      Hacé click en el botón de abajo para ver y descargar tu código QR personal.
    </p>

    <div style="text-align: center; margin: 2rem 0;">
      <a href="${qrPageUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 0.85rem 2rem; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 1rem;">
        📱 Ver mi Código QR
      </a>
    </div>

    <div style="background: #f8fafc; border-radius: 10px; padding: 1rem; border: 1px solid #e2e8f0;">
      <p style="font-size: 0.85rem; color: #475569; margin: 0;">
        <strong>📋 Instrucciones:</strong><br>
        Presentá tu código QR el día de la carrera para hacer el check-in de forma rápida. 
        Podés guardar una captura de pantalla o descargarlo desde el link.
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

Tu número de dorsal es: #${participant.dorsal}
Categoría: ${participant.categoria}

📱 Descargá tu código QR aquí: ${qrPageUrl}

Presentá tu código QR el día de la carrera para hacer check-in rápido.

¡Nos vemos en la meta! 🏁

- Equipo Race Club Hub
  raceclubhub.com`;
}
