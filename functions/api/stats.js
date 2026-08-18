// GET /api/stats - Get check-in statistics by competition
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return Response.json({ error: "No hay datos" }, { status: 404 });
    }

    // Get all check-in data in batch
    const checkinData = {};
    const list = await env.CHECKIN_KV.list({ prefix: "checkin:" });
    if (list.keys.length > 0) {
      const promises = list.keys.map(async (key) => {
        const val = await env.CHECKIN_KV.get(key.name, { type: "json" });
        checkinData[key.name.replace("checkin:", "")] = val;
      });
      await Promise.all(promises);
    }

    const total = participantsRaw.length;
    let checkedIn = 0;
    let kitRetirado = 0;
    const competencias = {};

    for (const p of participantsRaw) {
      const checkin = checkinData[String(p.dorsal)];
      const isChecked = checkin ? Boolean(checkin.checkedIn) : false;
      const isKit = checkin ? Boolean(checkin.kitRetirado) : false;

      if (isChecked) checkedIn++;
      if (isKit) kitRetirado++;

      const comp = p.competencia || 'Sin competencia';
      if (!competencias[comp]) {
        competencias[comp] = { total: 0, checkedIn: 0, kitRetirado: 0 };
      }
      competencias[comp].total++;
      if (isChecked) competencias[comp].checkedIn++;
      if (isKit) competencias[comp].kitRetirado++;
    }

    return Response.json({
      total,
      checkedIn,
      kitRetirado,
      pendingRegistro: total - checkedIn,
      pendingKit: total - kitRetirado,
      competencias
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
