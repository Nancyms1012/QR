// POST /api/undo-checkin/:uid - Undo all check-ins for a participant
export async function onRequestPost(context) {
  const { env, params } = context;
  const uid = parseInt(params.dorsal);

  try {
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw || !Array.isArray(participantsRaw)) {
      return Response.json({ error: "No hay datos" }, { status: 404 });
    }

    const participant = participantsRaw[uid];
    if (!participant) {
      return Response.json({ error: "Participante no encontrado" }, { status: 404 });
    }

    // Delete check-in data
    await env.CHECKIN_KV.delete(`checkin:uid_${uid}`);

    // Remove from completados list
    const compRaw = await env.CHECKIN_KV.get("completados-list");
    if (compRaw) {
      const completados = JSON.parse(compRaw);
      const updated = completados.filter(p => p.uid !== uid);
      await env.CHECKIN_KV.put("completados-list", JSON.stringify(updated));
    }

    return Response.json({
      success: true,
      message: `Check-ins revertidos para ${participant.nombre} ${participant.apellidos || ''}`,
      participant: { ...participant, uid, liberacion: false, checkedIn: false, kitRetirado: false }
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
