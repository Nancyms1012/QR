// GET /api/liberacion-firmados - Returns participants who signed the waiver (optimized)
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const raw = await env.CHECKIN_KV.get("participants");
    if (!raw) return Response.json([]);

    let participants;
    try {
      participants = JSON.parse(raw);
    } catch (e) {
      return Response.json({ error: "JSON corrupto" }, { status: 500 });
    }

    // Get all check-in keys
    const list = await env.CHECKIN_KV.list({ prefix: "checkin:" });
    if (list.keys.length === 0) return Response.json([]);

    // Fetch check-in data
    const checkinPromises = list.keys.map(async (key) => {
      const val = await env.CHECKIN_KV.get(key.name, { type: "json" });
      return { dorsal: key.name.replace("checkin:", ""), data: val };
    });
    const checkins = await Promise.all(checkinPromises);

    // Build map of signed waivers
    const firmados = {};
    for (const { dorsal, data } of checkins) {
      if (data && data.liberacion) {
        firmados[dorsal] = data;
      }
    }

    // Filter participants with liberacion signed
    const result = participants
      .filter(p => firmados[String(p.dorsal)])
      .map(p => ({
        ...p,
        liberacion: true,
        liberacionTime: firmados[String(p.dorsal)].liberacionTime
      }))
      .sort((a, b) => {
        const tA = a.liberacionTime ? new Date(a.liberacionTime).getTime() : 0;
        const tB = b.liberacionTime ? new Date(b.liberacionTime).getTime() : 0;
        return tB - tA;
      });

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
