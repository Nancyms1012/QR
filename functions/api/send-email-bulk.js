// POST /api/send-email-bulk - Send QR code emails to all participants with email via Resend
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    if (!env.RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY no configurada" }), {
        status: 500,
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

    const withEmail = participantsRaw.filter(p => p.email && p.email.trim());

    if (withEmail.length === 0) {
      return new Response(JSON.stringify({ error: "No hay participantes con email" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const siteUrl = new URL(request.url).origin;
    const fromEmail = env.FROM_EMAIL || "checkin@raceclubhub.com";
    const fromName = env.FROM_NAME || "XTERRA CR";

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const participant of withEmail) {
      const qrPageUrl = `${siteUrl}/qr.html?dorsal=${participant.dorsal}`;

      const emailPayload = {
        from: `${fromName} <${fromEmail}>`,
        to: [participant.email],
        subject: `🏊‍♂️ Tu Código QR - XTERRA CR - Dorsal #${participant.dorsal}`,
        html: generateEmailHTML(participant, qrPageUrl),
        text: generateEmailText(participant, qrPageUrl)
      };

      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.RESEND_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(emailPayload)
        });

        if (response.ok) {
          sent++;
        } else {
          failed++;
          const errText = await response.text();
          errors.push({ dorsal: participant.dorsal, email: participant.email, error: errText });
        }
      } catch (err) {
        failed++;
        errors.push({ dorsal: participant.dorsal, email: participant.email, error: err.message });
      }

      // Small delay to respect rate limits (10 req/sec for Resend)
      await new Promise(resolve => setTimeout(resolve, 150));
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

function generateEmailHTML(participant, qrPageUrl) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; padding: 2rem;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="text-align: center; margin-bottom: 1.5rem;">
      <img src="https://checkin.raceclubhub.com/logo-xterra.png" alt="XTERRA CR" style="max-width:200px;height:auto;margin-bottom:0.75rem;" />
      <p style="color: #64748b; font-size: 0.9rem;">Sistema de Check-in - Triatlón</p>
    </div>
    
    <div style="text-align: center; padding: 1.5rem; background: #eff6ff; border-radius: 12px; margin-bottom: 1.5rem;">
      <p style="font-size: 3rem; font-weight: 800; color: #2563eb; margin: 0;">#${participant.dorsal}</p>
      <p style="font-size: 1.3rem; font-weight: 600; margin: 0.5rem 0;">${participant.nombre}</p>
      <p style="color: #64748b; margin: 0;">${participant.categoria}</p>
    </div>

    <div style="text-align:center; padding: 1.5rem; border: 2px solid #e2e8f0; border-radius: 12px; margin-bottom: 1.5rem;">
      <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 0.75rem 0; font-weight: 600;">TU CÓDIGO QR:</p>
      <p style="text-align:center;">
        <a href="${qrPageUrl}" style="display:inline-block;background:#2563eb;color:white;padding:0.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;">📱 Ver y Descargar mi QR</a>
      </p>
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
        Presentá tu código QR el día de la carrera para hacer el check-in de forma rápida.
      </p>
    </div>

    <div style="text-align: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e2e8f0;">
      <p style="font-size: 0.8rem; color: #94a3b8;">
        XTERRA CR · raceclubhub.com<br>
        ¡Nos vemos en la meta! 🏁
      </p>
    </div>
  </div>
</body>
</html>`;
}

function generateEmailText(participant, qrPageUrl) {
  return `🏊‍♂️🚴‍♂️🏃‍♂️ XTERRA CR - Triatlón

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

- XTERRA CR
  raceclubhub.com`;
}
