// POST /api/chips/checkin - Mark a chip as returned
export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    const { dorsal } = await request.json();
    if (!dorsal) return Response.json({ error: "Dorsal requerido" }, { status: 400 });

    const raw = await env.CHECKIN_KV.get("chips-list");
    const chips = raw ? JSON.parse(raw) : [];

    const index = chips.findIndex(c => c.dorsal.toString() === dorsal.toString());
    if (index === -1) return Response.json({ error: `Dorsal ${dorsal} no está en la lista de chips` }, { status: 404 });

    if (chips[index].devuelto) {
      return Response.json({ error: `Chip #${dorsal} ya fue devuelto` }, { status: 400 });
    }

    chips[index].devuelto = true;
    chips[index].devueltoTime = new Date().toISOString();

    await env.CHECKIN_KV.put("chips-list", JSON.stringify(chips));

    return Response.json({ success: true, message: `Chip #${dorsal} marcado como devuelto` });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
