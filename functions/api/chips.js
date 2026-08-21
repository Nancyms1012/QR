// GET /api/chips - List all chips
export async function onRequestGet(context) {
  try {
    const { env } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    const raw = await env.CHECKIN_KV.get("chips-list");
    if (!raw) return Response.json([]);
    return Response.json(JSON.parse(raw));
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
