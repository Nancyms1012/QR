// POST /api/undo-checkin/:dorsal - Undo a check-in
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

    // Remove check-in
    await env.CHECKIN_KV.delete(`checkin:${dorsal}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Check-in revertido para ${participant.nombre}`,
      participant: { ...participant, checkedIn: false, checkInTime: null }
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
