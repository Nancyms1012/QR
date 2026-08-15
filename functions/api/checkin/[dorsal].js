// POST /api/checkin/:dorsal - Check in a participant
export async function onRequestPost(context) {
  const { env, params } = context;
  const dorsal = parseInt(params.dorsal);

  try {
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

    // Check if already checked in
    const existing = await env.CHECKIN_KV.get(`checkin:${dorsal}`, { type: "json" });
    if (existing && existing.checkedIn) {
      return new Response(JSON.stringify({
        error: "Ya registrado",
        message: `${participant.nombre} ya hizo check-in a las ${existing.checkInTime}`,
        participant: { ...participant, ...existing }
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Perform check-in
    const checkInData = {
      checkedIn: true,
      checkInTime: new Date().toISOString()
    };

    await env.CHECKIN_KV.put(`checkin:${dorsal}`, JSON.stringify(checkInData));

    return new Response(JSON.stringify({
      success: true,
      message: `Check-in exitoso para ${participant.nombre}`,
      participant: { ...participant, ...checkInData }
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
