// GET /api/participants/:dorsal - Get a single participant
export async function onRequestGet(context) {
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

    // Get check-in status
    const checkin = await env.CHECKIN_KV.get(`checkin:${dorsal}`, { type: "json" });

    return new Response(JSON.stringify({
      ...participant,
      checkedIn: checkin ? checkin.checkedIn : false,
      checkInTime: checkin ? checkin.checkInTime : null
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
