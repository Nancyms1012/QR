// GET /api/stats - Get check-in statistics
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return new Response(JSON.stringify({ error: "No hay datos" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const total = participantsRaw.length;
    let checkedIn = 0;
    const categories = {};

    for (const p of participantsRaw) {
      const checkin = await env.CHECKIN_KV.get(`checkin:${p.dorsal}`, { type: "json" });
      const isChecked = checkin ? checkin.checkedIn : false;

      if (isChecked) checkedIn++;

      if (!categories[p.categoria]) {
        categories[p.categoria] = { total: 0, checkedIn: 0 };
      }
      categories[p.categoria].total++;
      if (isChecked) categories[p.categoria].checkedIn++;
    }

    return new Response(JSON.stringify({
      total,
      checkedIn,
      pending: total - checkedIn,
      categories
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error interno" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
