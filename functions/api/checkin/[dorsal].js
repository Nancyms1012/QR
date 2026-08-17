// POST /api/checkin/:dorsal - Check in a participant (supports two stages)
// Body: { stage: "registro" | "kit" }
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const dorsal = parseInt(params.dorsal);

  try {
    let stage = "registro"; // default stage
    try {
      const body = await request.json();
      if (body.stage) stage = body.stage;
    } catch (e) {
      // No body or invalid JSON, use default
    }

    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return new Response(JSON.stringify({ error: "No hay datos" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const participant = participantsRaw.find(p => p.dorsal === dorsal);
    if (!participant) {
      return new Response(JSON.stringify({ error: "Participante no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get existing check-in data
    const existing = await env.CHECKIN_KV.get(`checkin:${dorsal}`, { type: "json" }) || {};

    if (stage === "registro") {
      if (existing.checkedIn) {
        return new Response(JSON.stringify({
          error: "Ya registrado",
          message: `${participant.nombre} ya hizo check-in de registro a las ${existing.checkInTime}`,
          participant: { ...participant, ...existing }
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      existing.checkedIn = true;
      existing.checkInTime = new Date().toISOString();

    } else if (stage === "kit") {
      if (existing.kitRetirado) {
        return new Response(JSON.stringify({
          error: "Kit ya retirado",
          message: `${participant.nombre} ya retiró el kit a las ${existing.kitRetiroTime}`,
          participant: { ...participant, ...existing }
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      existing.kitRetirado = true;
      existing.kitRetiroTime = new Date().toISOString();
    }

    await env.CHECKIN_KV.put(`checkin:${dorsal}`, JSON.stringify(existing));

    const stageLabel = stage === "registro" ? "Check-in de registro" : "Retiro de kit";

    return new Response(JSON.stringify({
      success: true,
      message: `${stageLabel} exitoso para ${participant.nombre}`,
      participant: { ...participant, ...existing }
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
