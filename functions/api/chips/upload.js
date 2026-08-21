// POST /api/chips/upload - Upload chip list
export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    const { chips } = await request.json();
    if (!chips || !Array.isArray(chips) || chips.length === 0) {
      return Response.json({ error: "No se recibieron chips" }, { status: 400 });
    }

    await env.CHECKIN_KV.put("chips-list", JSON.stringify(chips));

    return Response.json({ success: true, total: chips.length });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
