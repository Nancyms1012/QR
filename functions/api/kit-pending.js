// GET /api/kit-pending - Returns participants with check-in done but kit pending
// Optimized: reads only the kit-pending list key instead of all check-in records
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    // Read the pre-built kit-pending list
    const pendingRaw = await env.CHECKIN_KV.get("kit-pending-list", { type: "json" });
    
    if (!pendingRaw || pendingRaw.length === 0) {
      return Response.json([]);
    }

    return Response.json(pendingRaw);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
