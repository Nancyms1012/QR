// POST /api/reset - Reset all check-ins
export async function onRequestPost(context) {
  const { env } = context;

  try {
    // Delete all uid-based check-in keys
    const list = await env.CHECKIN_KV.list({ prefix: "checkin:uid_" });
    for (const key of list.keys) {
      await env.CHECKIN_KV.delete(key.name);
    }

    // Also clean old dorsal-based keys if any
    const oldList = await env.CHECKIN_KV.list({ prefix: "checkin:" });
    for (const key of oldList.keys) {
      await env.CHECKIN_KV.delete(key.name);
    }

    // Clear legacy lists
    await env.CHECKIN_KV.delete("kit-pending-list");
    await env.CHECKIN_KV.delete("completados-list");

    return Response.json({
      success: true,
      message: "Todos los check-ins han sido reiniciados"
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
