// GET /api/completados - Returns participants with both check-in AND kit delivered
// Optimized: reads only the completados list key
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const completadosRaw = await env.CHECKIN_KV.get("completados-list", { type: "json" });
    
    if (!completadosRaw || completadosRaw.length === 0) {
      return Response.json([]);
    }

    return Response.json(completadosRaw);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
