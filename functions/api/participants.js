// GET /api/participants - List all participants with their check-in status
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

    // Get all check-in data in one batch using KV list
    const checkinData = {};
    const list = await env.CHECKIN_KV.list({ prefix: "checkin:" });
    
    // Fetch check-in values (only if there are any)
    if (list.keys.length > 0) {
      const checkinPromises = list.keys.map(async (key) => {
        const val = await env.CHECKIN_KV.get(key.name, { type: "json" });
        const dorsal = key.name.replace("checkin:", "");
        checkinData[dorsal] = val;
      });
      await Promise.all(checkinPromises);
    }

    // Merge participants with check-in status
    const result = participants.map(p => {
      const checkin = checkinData[String(p.dorsal)];
      return {
        ...p,
        liberacion: checkin ? Boolean(checkin.liberacion) : false,
        liberacionTime: checkin ? checkin.liberacionTime : null,
        checkedIn: checkin ? Boolean(checkin.checkedIn) : false,
        checkInTime: checkin ? checkin.checkInTime : null,
        kitRetirado: checkin ? Boolean(checkin.kitRetirado) : false,
        kitRetiroTime: checkin ? checkin.kitRetiroTime : null
      };
    });

    return Response.json(result);
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
