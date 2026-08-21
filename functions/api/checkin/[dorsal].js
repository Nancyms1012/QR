// POST /api/checkin/:uid - Check in a participant by uid
// Body: { stage: "registro" | "kit" }
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const uid = parseInt(params.dorsal);

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
      existing.kitRetirado = true;
      existing.kitRetiroTime = existing.checkInTime;
      await env.CHECKIN_KV.put(`checkin:uid_${uid}`, JSON.stringify(existing));

      // Add directly to completados list (no kit step)
      const compRaw = await env.CHECKIN_KV.get("completados-list");
      const completados = compRaw ? JSON.parse(compRaw) : [];
      if (!completados.find(p => p.uid === uid)) {
        completados.push({ ...participant, uid, checkedIn: true, checkInTime: existing.checkInTime, kitRetirado: true, kitRetiroTime: existing.kitRetiroTime });
        await env.CHECKIN_KV.put("completados-list", JSON.stringify(completados));
      }

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
      await env.CHECKIN_KV.put(`checkin:uid_${uid}`, JSON.stringify(existing));

      // Remove from kit-pending list
      const pendingRaw = await env.CHECKIN_KV.get("kit-pending-list");
      const pending = pendingRaw ? JSON.parse(pendingRaw) : [];
      const updatedPending = pending.filter(p => p.uid !== uid);
      await env.CHECKIN_KV.put("kit-pending-list", JSON.stringify(updatedPending));

      // Add to completados list
      const compRaw = await env.CHECKIN_KV.get("completados-list");
      const completados = compRaw ? JSON.parse(compRaw) : [];
      completados.push({ ...participant, uid, checkedIn: true, checkInTime: existing.checkInTime, kitRetirado: true, kitRetiroTime: existing.kitRetiroTime });
      await env.CHECKIN_KV.put("completados-list", JSON.stringify(completados));
    }

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
