// POST /api/kids/clear - Delete all kids registrations
export async function onRequestPost(context) {
  try {
    const { env } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    await env.CHECKIN_KV.put("kids-list", "[]");

    return Response.json({ success: true, message: "Todos los registros de Kids eliminados" });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
