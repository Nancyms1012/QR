// GET /api/participants/:dorsal - Get a single participant
export async function onRequestGet(context) {
  const { env, params } = context;
  const dorsal = parseInt(params.dorsal);

  try {
    if (!env.CHECKIN_KV) {
      return new Response(JSON.stringify({ error: "KV no vinculado" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

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
      checkInTime: checkin ? checkin.checkInTime : null,
      kitRetirado: checkin ? checkin.kitRetirado : false,
      kitRetiroTime: checkin ? checkin.kitRetiroTime : null
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

// PUT /api/participants/:dorsal - Update participant contact info
export async function onRequestPut(context) {
  const { env, params, request } = context;
  const dorsal = parseInt(params.dorsal);

  try {
    if (!env.CHECKIN_KV) {
      return new Response(JSON.stringify({ error: "KV no vinculado" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json();
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return new Response(JSON.stringify({ error: "No hay datos" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const index = participantsRaw.findIndex(p => p.dorsal === dorsal);
    if (index === -1) {
      return new Response(JSON.stringify({ error: "Participante no encontrado" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Update allowed fields
    if (body.telefono !== undefined) participantsRaw[index].telefono = body.telefono;
    if (body.email !== undefined) participantsRaw[index].email = body.email;
    if (body.nombre !== undefined) participantsRaw[index].nombre = body.nombre;
    if (body.apellidos !== undefined) participantsRaw[index].apellidos = body.apellidos;
    if (body.genero !== undefined) participantsRaw[index].genero = body.genero;
    if (body.categoria !== undefined) participantsRaw[index].categoria = body.categoria;
    if (body.competencia !== undefined) participantsRaw[index].competencia = body.competencia;
    if (body.talla !== undefined) participantsRaw[index].talla = body.talla;
    if (body.color !== undefined) participantsRaw[index].color = body.color;

    // Save back to KV
    await env.CHECKIN_KV.put("participants", JSON.stringify(participantsRaw));

    return new Response(JSON.stringify({
      success: true,
      message: `Datos actualizados para ${participantsRaw[index].nombre}`,
      participant: participantsRaw[index]
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
