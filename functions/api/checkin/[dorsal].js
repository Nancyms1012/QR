// POST /api/checkin/:uid - Check in a participant by uid
// Body: { stage: "liberacion" | "registro" | "kit" }
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const uid = parseInt(params.dorsal); // reusing route param but it's uid

  try {
    let stage = "registro";
    try {
      const body = await request.json();
      if (body.stage) stage = body.stage;
    } catch (e) {}

    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw || !Array.isArray(participantsRaw)) {
      return Response.json({ error: "No hay datos" }, { status: 404 });
    }

    const participant = participantsRaw[uid];
    if (!participant) {
      return Response.json({ error: "Participante no encontrado" }, { status: 404 });
    }

    // Get existing check-in data for this uid
    const existing = await env.CHECKIN_KV.get(`checkin:uid_${uid}`, { type: "json" }) || {};

    if (stage === "registro") {
      if (existing.checkedIn) {
        return Response.json({
          error: "Ya registrado",
          message: `${participant.nombre} ${participant.apellidos || ''} ya hizo check-in de registro`,
          participant: { ...participant, uid, ...existing }
        }, { status: 400 });
      }

      existing.checkedIn = true;
      existing.checkInTime = new Date().toISOString();

    } else if (stage === "kit") {
      if (!existing.checkedIn) {
        return Response.json({
          error: "Registro pendiente",
          message: `${participant.nombre} ${participant.apellidos || ''} debe hacer check-in de registro primero`,
          participant: { ...participant, uid, ...existing }
        }, { status: 400 });
      }

      if (existing.kitRetirado) {
        return Response.json({
          error: "Kit ya retirado",
          message: `${participant.nombre} ${participant.apellidos || ''} ya retiró el kit`,
          participant: { ...participant, uid, ...existing }
        }, { status: 400 });
      }

      existing.kitRetirado = true;
      existing.kitRetiroTime = new Date().toISOString();
    }

    await env.CHECKIN_KV.put(`checkin:uid_${uid}`, JSON.stringify(existing));

    const stageLabel = stage === "registro" ? "Check-in de registro" : "Retiro de kit";

    return Response.json({
      success: true,
      message: `${stageLabel} exitoso para ${participant.nombre} ${participant.apellidos || ''}`,
      participant: { ...participant, uid, ...existing }
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
