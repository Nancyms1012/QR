// POST /api/send-email - Send QR code email to a single participant via Resend
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
    const fromEmail = env.FROM_EMAIL || "checkin@raceclubhub.com";
    const fromName = env.FROM_NAME || "XTERRA CR";

    // Build email payload for Resend
    const emailPayload = {
      from: `${fromName} <${fromEmail}>`,
      to: [participant.email],
      subject: `🏊‍♂️ Tu Código QR - XTERRA CR - Dorsal #${participant.dorsal}`,
      html: generateEmailHTML(participant, qrPageUrl, qrImageBase64),
      text: generateEmailText(participant, qrPageUrl)
    };

    // If we have a QR image, attach it as inline CID image
    if (qrImageBase64 && qrImageBase64.startsWith('data:image/png;base64,')) {
      const base64Data = qrImageBase64.replace('data:image/png;base64,', '');
      emailPayload.attachments = [
        {
          filename: `qr-dorsal-${participant.dorsal}.png`,
          content: base64Data,
          content_type: "image/png"
        }
      ];
      // Update HTML to use the hosted QR page image as fallback
      emailPayload.html = generateEmailHTML(participant, qrPageUrl, qrImageBase64, true);
    }

    // Send via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });

    if (response.ok) {
      const result = await response.json();
      return new Response(JSON.stringify({
        success: true,
        message: `Email enviado a ${participant.email}`,
        id: result.id
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      const errorText = await response.text();
      return new Response(JSON.stringify({
        error: "Error al enviar email",
        details: `Status ${response.status}: ${errorText}`
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

function generateEmailHTML(participant, qrPageUrl, qrImageBase64) {
  let qrSection;
  if (qrImageBase64 && qrImageBase64.startsWith('data:image/png;base64,')) {
    qrSection = `
      <img src="${qrImageBase64}" alt="Código QR - Dorsal #${participant.dorsal}" style="width:250px;height:250px;display:block;margin:0 auto;" />
      <p style="font-size:0.75rem;color:#94a3b8;margin-top:0.5rem;text-align:center;">¿No ves el QR? <a href="${qrPageUrl}" style="color:#2563eb;">Click aquí</a></p>
    `;
  } else {
    qrSection = `
      <p style="text-align:center;">
        <a href="${qrPageUrl}" style="display:inline-block;background:#2563eb;color:white;padding:0.85rem 2rem;border-radius:8px;text-decoration:none;font-weight:600;">📱 Ver mi Código QR</a>
      </p>
    `;
  }

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
    
    <table style="width:100%; border-collapse:collapse; margin-bottom: 1.5rem; background: #eff6ff; border-radius: 12px;">
      <tr>
        <td style="padding: 1.5rem; text-align: center;">
          <p style="font-size: 3rem; font-weight: 800; color: #2563eb; margin: 0;">#${participant.dorsal}</p>
          <p style="font-size: 1.3rem; font-weight: 600; margin: 0.5rem 0;">${participant.nombre}</p>
          <p style="color: #64748b; margin: 0;">${participant.categoria}</p>
        </td>
      </tr>
    </table>

    <div style="text-align:center; padding: 1.5rem; border: 2px solid #e2e8f0; border-radius: 12px; margin-bottom: 1.5rem;">
      <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 0.75rem 0; font-weight: 600;">TU CÓDIGO QR:</p>
      ${qrSection}
    </div>

    <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
      <p style="font-size: 0.85rem; color: #92400e; margin: 0;">
        <strong>⚠️ Verificá tu información:</strong><br>
        Revisá que tu nombre, dorsal y categoría sean correctos. En caso de inconsistencia comunicarse con: info@raceclubhub.com
      </p>
    </div>

    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 1rem;">
      <p style="font-size: 0.85rem; color: #166534; margin: 0;">
        <strong>📱 Instrucciones:</strong><br>
        Presentá este código QR el día de la carrera para hacer el check-in de forma rápida. 
        Podés guardar una captura de pantalla o descargarlo del adjunto.
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
