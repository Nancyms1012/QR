// GET /api/registro-pending - Returns participants with liberación done but registro pending
// For Mesa 2: shows who is ready for registration (in order of liberación time)
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const raw = await env.CHECKIN_KV.get("participants");
    if (!raw) {
      return Response.json([]);
    }

    let participants;
    try {
      participants = JSON.parse(raw);
    } catch (e) {
      return Response.json({ error: "JSON corrupto" }, { status: 500 });
    }

    // Get all check-in keys
    const list = await env.CHECKIN_KV.list({ prefix: "checkin:" });

    if (list.keys.length === 0) {
      return Response.json([]);
    }

    // Fetch all check-in data
    const checkinPromises = list.keys.map(async (key) => {
      const val = await env.CHECKIN_KV.get(key.name, { type: "json" });
      return { dorsal: key.name.replace("checkin:", ""), data: val };
    });
    const checkins = await Promise.all(checkinPromises);

    // Build map: liberacion done but registro NOT done
    const pending = {};
    for (const { dorsal, data } of checkins) {
      if (data && data.liberacion && !data.checkedIn) {
        pending[dorsal] = data;
      }
    }

    // Filter and sort by liberacion time
    const result = participants
      .filter(p => pending[String(p.dorsal)])
      .map(p => ({
        ...p,
        liberacion: true,
        liberacionTime: pending[String(p.dorsal)].liberacionTime,
        checkedIn: false,
        checkInTime: null,
        kitRetirado: false,
        kitRetiroTime: null
      }))
      .sort((a, b) => new Date(a.liberacionTime) - new Date(b.liberacionTime));

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
