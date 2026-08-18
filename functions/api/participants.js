// GET /api/participants - List all participants with their check-in status
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const raw = await env.CHECKIN_KV.get("participants");
    if (!raw) {
      return Response.json({ error: "No hay datos", hint: "Sube un CSV desde Admin" }, { status: 404 });
    }

    let participantsRaw;
    try {
      participantsRaw = JSON.parse(raw);
    } catch (e) {
      return Response.json({ error: "JSON corrupto en KV", details: e.message, sample: raw.substring(0, 200) }, { status: 500 });
    }

    if (!Array.isArray(participantsRaw)) {
      return Response.json({ error: "Datos no son array", type: typeof participantsRaw }, { status: 500 });
    }

    // Merge with check-in status
    const participants = [];
    for (const p of participantsRaw) {
      let checkin = null;
      try {
        checkin = await env.CHECKIN_KV.get(`checkin:${p.dorsal}`, { type: "json" });
      } catch (e) {
        // ignore check-in read errors
      }
      participants.push({
        ...p,
        checkedIn: checkin ? Boolean(checkin.checkedIn) : false,
        checkInTime: checkin ? checkin.checkInTime : null,
        kitRetirado: checkin ? Boolean(checkin.kitRetirado) : false,
        kitRetiroTime: checkin ? checkin.kitRetiroTime : null
      });
    }

    return Response.json(participants);
  } catch (err) {
    return Response.json({ error: "Error fatal", message: err.message, stack: err.stack }, { status: 500 });
  }
}
