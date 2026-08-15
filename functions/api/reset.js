// POST /api/reset - Reset all check-ins
export async function onRequestPost(context) {
  const { env } = context;

  try {
    const participantsRaw = await env.CHECKIN_KV.get("participants", { type: "json" });
    if (!participantsRaw) {
      return new Response(JSON.stringify({ error: "No hay datos" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Delete all check-in keys
    for (const p of participantsRaw) {
      await env.CHECKIN_KV.delete(`checkin:${p.dorsal}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Todos los check-ins han sido reiniciados"
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
