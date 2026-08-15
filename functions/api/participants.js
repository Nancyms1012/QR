// GET /api/participants - List all participants with their check-in status
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // Get base participants data
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return new Response(JSON.stringify({ error: "No hay datos de participantes" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Merge with check-in status
    const participants = await Promise.all(
      participantsRaw.map(async (p) => {
        const checkin = await env.CHECKIN_KV.get(`checkin:${p.dorsal}`, { type: "json" });
        return {
          ...p,
          checkedIn: checkin ? checkin.checkedIn : false,
          checkInTime: checkin ? checkin.checkInTime : null
        };
      })
    );

    return new Response(JSON.stringify(participants), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error interno", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
