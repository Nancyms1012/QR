// GET /api/completados - Only returns participants with both check-in AND kit delivered
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const raw = await env.CHECKIN_KV.get("participants");
    if (!raw) {
      return Response.json([], { status: 200 });
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

    // Build map of fully completed
    const completed = {};
    for (const { dorsal, data } of checkins) {
      if (data && data.checkedIn && data.kitRetirado) {
        completed[dorsal] = data;
      }
    }

    // Filter participants to only completed ones
    const result = participants
      .filter(p => completed[String(p.dorsal)])
      .map(p => ({
        ...p,
        checkedIn: true,
        checkInTime: completed[String(p.dorsal)].checkInTime,
        kitRetirado: true,
        kitRetiroTime: completed[String(p.dorsal)].kitRetiroTime
      }));

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
