// GET /api/liberacion-firmados - Participants who signed the waiver
export async function onRequestGet(context) {
  try {
    const { env } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    const raw = await env.CHECKIN_KV.get("participants");
    if (!raw) return Response.json([]);
    const participants = JSON.parse(raw);
    if (!Array.isArray(participants)) return Response.json([]);

    const list = await env.CHECKIN_KV.list({ prefix: "checkin:uid_" });
    if (list.keys.length === 0) return Response.json([]);

    const checkinData = {};
    const promises = list.keys.map(async (key) => {
      const val = await env.CHECKIN_KV.get(key.name, { type: "json" });
      checkinData[key.name.replace("checkin:uid_", "")] = val;
    });
    await Promise.all(promises);

    const result = participants
      .map((p, index) => ({ ...p, uid: index, checkin: checkinData[String(index)] }))
      .filter(p => p.checkin && p.checkin.liberacion)
      .map(p => ({
        ...p,
        liberacion: true,
        liberacionTime: p.checkin.liberacionTime
      }))
      .sort((a, b) => new Date(b.liberacionTime) - new Date(a.liberacionTime));

    result.forEach(p => delete p.checkin);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
