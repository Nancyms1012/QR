// POST /api/checkin/:dorsal - Check in a participant (supports two stages)
// Body: { stage: "registro" | "kit" }
export async function onRequestPost(context) {
  const { env, params, request } = context;
  const dorsal = parseInt(params.dorsal);

  try {
    let stage = "registro";
    try {
      const body = await request.json();
      if (body.stage) stage = body.stage;
    } catch (e) {}

    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return Response.json({ error: "No hay datos" }, { status: 404 });
    }

    const participant = participantsRaw.find(p => p.dorsal === dorsal);
    if (!participant) {
      return Response.json({ error: "Participante no encontrado" }, { status: 404 });
    }

    // Get existing check-in data
    const existing = await env.CHECKIN_KV.get(`checkin:${dorsal}`, { type: "json" }) || {};

    if (stage === "registro") {
      if (existing.checkedIn) {
        return Response.json({
          error: "Ya registrado",
          message: `${participant.nombre} ${participant.apellidos || ''} ya hizo check-in de registro`,
          participant: { ...participant, ...existing }
        }, { status: 400 });
      }

      existing.checkedIn = true;
      existing.checkInTime = new Date().toISOString();
      await env.CHECKIN_KV.put(`checkin:${dorsal}`, JSON.stringify(existing));

      // Add to kit-pending list
      const pendingList = await env.CHECKIN_KV.get("kit-pending-list", { type: "json" }) || [];
      pendingList.push({
        ...participant,
        checkedIn: true,
        checkInTime: existing.checkInTime,
        kitRetirado: false,
        kitRetiroTime: null
      });
      await env.CHECKIN_KV.put("kit-pending-list", JSON.stringify(pendingList));

    } else if (stage === "kit") {
      if (!existing.checkedIn) {
        return Response.json({
          error: "Registro pendiente",
          message: `${participant.nombre} ${participant.apellidos || ''} debe hacer check-in de registro primero`,
          participant: { ...participant, ...existing }
        }, { status: 400 });
      }

      if (existing.kitRetirado) {
        return Response.json({
          error: "Kit ya retirado",
          message: `${participant.nombre} ${participant.apellidos || ''} ya retiró el kit`,
          participant: { ...participant, ...existing }
        }, { status: 400 });
      }

      existing.kitRetirado = true;
      existing.kitRetiroTime = new Date().toISOString();
      await env.CHECKIN_KV.put(`checkin:${dorsal}`, JSON.stringify(existing));

      // Remove from kit-pending list
      const pendingList = await env.CHECKIN_KV.get("kit-pending-list", { type: "json" }) || [];
      const updated = pendingList.filter(p => p.dorsal !== dorsal);
      await env.CHECKIN_KV.put("kit-pending-list", JSON.stringify(updated));

      // Add to completados list
      const completadosList = await env.CHECKIN_KV.get("completados-list", { type: "json" }) || [];
      completadosList.push({
        ...participant,
        checkedIn: true,
        checkInTime: existing.checkInTime,
        kitRetirado: true,
        kitRetiroTime: existing.kitRetiroTime
      });
      await env.CHECKIN_KV.put("completados-list", JSON.stringify(completadosList));
    }

    const stageLabel = stage === "registro" ? "Check-in de registro" : "Retiro de kit";

    return Response.json({
      success: true,
      message: `${stageLabel} exitoso para ${participant.nombre} ${participant.apellidos || ''}`,
      participant: { ...participant, ...existing }
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
