// GET /api/stats - Check-in statistics by competition
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) return Response.json({ error: "No hay datos" }, { status: 404 });

    const list = await env.CHECKIN_KV.list({ prefix: "checkin:uid_" });
    const checkinData = {};
    if (list.keys.length > 0) {
      const promises = list.keys.map(async (key) => {
        const val = await env.CHECKIN_KV.get(key.name, { type: "json" });
        checkinData[key.name.replace("checkin:uid_", "")] = val;
      });
      await Promise.all(promises);
    }

    const total = participantsRaw.length;
    let liberacion = 0, checkedIn = 0, kitRetirado = 0;
    const competencias = {};

    participantsRaw.forEach((p, index) => {
      const checkin = checkinData[String(index)] || {};
      const isLib = Boolean(checkin.liberacion);
      const isChecked = Boolean(checkin.checkedIn);
      const isKit = Boolean(checkin.kitRetirado);

      if (isLib) liberacion++;
      if (isChecked) checkedIn++;
      if (isKit) kitRetirado++;

      const comp = p.competencia || 'Sin competencia';
      if (!competencias[comp]) competencias[comp] = { total: 0, liberacion: 0, checkedIn: 0, kitRetirado: 0 };
      competencias[comp].total++;
      if (isLib) competencias[comp].liberacion++;
      if (isChecked) competencias[comp].checkedIn++;
      if (isKit) competencias[comp].kitRetirado++;
    });

    return Response.json({
      total, liberacion, checkedIn, kitRetirado,
      pendingLiberacion: total - liberacion,
      pendingRegistro: total - checkedIn,
      pendingKit: total - kitRetirado,
      competencias
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
