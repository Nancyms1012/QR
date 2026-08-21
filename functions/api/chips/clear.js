// POST /api/chips/clear - Clear all chip data
export async function onRequestPost(context) {
  try {
    const { env } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    await env.CHECKIN_KV.put("chips-list", "[]");
    return Response.json({ success: true, message: "Datos de chips eliminados" });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
