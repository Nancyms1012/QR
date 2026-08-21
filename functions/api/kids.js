// GET /api/kids - List all registered kids
// POST /api/kids - Register a new kid
const KIDS_CATEGORIES = [
  { name: '2-3 años', minAge: 2, maxAge: 3, capacity: 6 },
  { name: '4-5 años', minAge: 4, maxAge: 5, capacity: 18 },
  { name: '6-7 años', minAge: 6, maxAge: 7, capacity: 15 },
  { name: '8-9 años', minAge: 8, maxAge: 9, capacity: 12 },
  { name: '10-11 años', minAge: 10, maxAge: 11, capacity: 9 },
  { name: '12-13 años', minAge: 12, maxAge: 13, capacity: 9 }
];

export async function onRequestGet(context) {
  try {
    const { env } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    const raw = await env.CHECKIN_KV.get("kids-list");
    if (!raw) return Response.json([]);

    return Response.json(JSON.parse(raw));
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}

export async function onRequestPost(context) {
  try {
    const { env, request } = context;
    if (!env.CHECKIN_KV) return Response.json({ error: "KV no vinculado" }, { status: 500 });

    const body = await request.json();
    const { dorsal, nombre, apellidos, fechaNacimiento, categoria, responsable } = body;

    if (!dorsal || !nombre || !fechaNacimiento || !categoria || !responsable) {
      return Response.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
    }

    // Validate category exists
    const cat = KIDS_CATEGORIES.find(c => c.name === categoria);
    if (!cat) {
      return Response.json({ error: "Categoría no válida" }, { status: 400 });
    }

    // Get current kids list
    const raw = await env.CHECKIN_KV.get("kids-list");
    const kids = raw ? JSON.parse(raw) : [];

    // Check capacity
    const countInCategory = kids.filter(k => k.categoria === categoria).length;
    if (countInCategory >= cat.capacity) {
      return Response.json({ error: `Categoría ${categoria} está llena (${countInCategory}/${cat.capacity})` }, { status: 400 });
    }

    // Check duplicate dorsal
    if (kids.find(k => k.dorsal === dorsal)) {
      return Response.json({ error: `El dorsal ${dorsal} ya está registrado` }, { status: 400 });
    }

    // Add kid
    kids.push({
      dorsal: String(dorsal),
      nombre: String(nombre).trim(),
      apellidos: String(apellidos).trim(),
      fechaNacimiento: String(fechaNacimiento),
      categoria: String(categoria),
      responsable: String(responsable).trim(),
      registeredAt: new Date().toISOString()
    });

    await env.CHECKIN_KV.put("kids-list", JSON.stringify(kids));

    return Response.json({
      success: true,
      message: `${nombre} ${apellidos} inscrito en ${categoria}`,
      total: kids.length,
      categoryCount: countInCategory + 1,
      categoryCapacity: cat.capacity
    });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
