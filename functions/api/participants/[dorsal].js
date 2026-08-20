// GET /api/participants/:uid - Get a single participant by uid
// PUT /api/participants/:uid - Update participant data
export async function onRequestGet(context) {
  const { env, params } = context;
  const uid = parseInt(params.dorsal); // reusing route param name but it's actually uid

  try {
    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw || !Array.isArray(participantsRaw)) {
      return Response.json({ error: "No hay datos" }, { status: 404 });
    }

    const participant = participantsRaw[uid];
    if (!participant) {
      return Response.json({ error: "Participante no encontrado" }, { status: 404 });
    }

    // Get check-in status
    const checkin = await env.CHECKIN_KV.get(`checkin:uid_${uid}`, { type: "json" }) || {};

    return Response.json({
      ...participant,
      uid: uid,
      liberacion: Boolean(checkin.liberacion),
      liberacionTime: checkin.liberacionTime || null,
      checkedIn: Boolean(checkin.checkedIn),
      checkInTime: checkin.checkInTime || null,
      kitRetirado: Boolean(checkin.kitRetirado),
      kitRetiroTime: checkin.kitRetiroTime || null
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}

export async function onRequestPut(context) {
  const { env, params, request } = context;
  const uid = parseInt(params.dorsal);

  try {
    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const body = await request.json();
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw || !Array.isArray(participantsRaw)) {
      return Response.json({ error: "No hay datos" }, { status: 404 });
    }

    if (!participantsRaw[uid]) {
      return Response.json({ error: "Participante no encontrado" }, { status: 404 });
    }

    // Update allowed fields
    const fields = ['nombre', 'apellidos', 'genero', 'categoria', 'competencia', 'talla', 'color', 'telefono', 'email', 'id_participante', 'socio', 'licencia', 'equipo'];
    for (const field of fields) {
      if (body[field] !== undefined) participantsRaw[uid][field] = body[field];
    }

    await env.CHECKIN_KV.put("participants", JSON.stringify(participantsRaw));

    return Response.json({
      success: true,
      message: `Datos actualizados`,
      participant: participantsRaw[uid]
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
