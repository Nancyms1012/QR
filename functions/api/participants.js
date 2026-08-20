// GET /api/participants - List all participants with their check-in status
// Uses uid (index in array) as unique identifier per person/row
export async function onRequestGet(context) {
  try {
    const { env } = context;

    if (!env.CHECKIN_KV) {
      return Response.json({ error: "KV no vinculado" }, { status: 500 });
    }

    const raw = await env.CHECKIN_KV.get("participants");
    if (!raw) {
      return Response.json({ error: "No hay datos", hint: "Sube un CSV desde Admin" }, { status: 404 });
    }

    let participants;
    try {
      participants = JSON.parse(raw);
    } catch (e) {
      return Response.json({ error: "JSON corrupto en KV", details: e.message }, { status: 500 });
    }

    if (!Array.isArray(participants)) {
      return Response.json({ error: "Datos no son array" }, { status: 500 });
    }

    // Get all check-in data in one batch
    const checkinData = {};
    const list = await env.CHECKIN_KV.list({ prefix: "checkin:uid_" });
    if (list.keys.length > 0) {
      const promises = list.keys.map(async (key) => {
        const val = await env.CHECKIN_KV.get(key.name, { type: "json" });
        const uid = key.name.replace("checkin:uid_", "");
        checkinData[uid] = val;
      });
      await Promise.all(promises);
    }

    // Merge participants with check-in status
    const result = participants.map((p, index) => {
      const checkin = checkinData[String(index)] || {};
      return {
        ...p,
        uid: index,
        liberacion: Boolean(checkin.liberacion),
        liberacionTime: checkin.liberacionTime || null,
        checkedIn: Boolean(checkin.checkedIn),
        checkInTime: checkin.checkInTime || null,
        kitRetirado: Boolean(checkin.kitRetirado),
        kitRetiroTime: checkin.kitRetiroTime || null
      };
    });

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
