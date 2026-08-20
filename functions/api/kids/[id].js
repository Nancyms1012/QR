// PUT /api/kids/:index - Update a kid registration
// DELETE /api/kids/:index - Delete a kid registration
export async function onRequestPut(context) {
  const { env, params, request } = context;
  const index = parseInt(params.id);

  try {
    const body = await request.json();
    const raw = await env.CHECKIN_KV.get("kids-list");
    const kids = raw ? JSON.parse(raw) : [];

    if (index < 0 || index >= kids.length) {
      return Response.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    // Update fields
    if (body.dorsal !== undefined) kids[index].dorsal = body.dorsal;
    if (body.nombre !== undefined) kids[index].nombre = body.nombre;
    if (body.fechaNacimiento !== undefined) kids[index].fechaNacimiento = body.fechaNacimiento;
    if (body.categoria !== undefined) kids[index].categoria = body.categoria;
    if (body.responsable !== undefined) kids[index].responsable = body.responsable;

    await env.CHECKIN_KV.put("kids-list", JSON.stringify(kids));

    return Response.json({ success: true, message: "Registro actualizado" });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const index = parseInt(params.id);

  try {
    const raw = await env.CHECKIN_KV.get("kids-list");
    const kids = raw ? JSON.parse(raw) : [];

    if (index < 0 || index >= kids.length) {
      return Response.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    kids.splice(index, 1);
    await env.CHECKIN_KV.put("kids-list", JSON.stringify(kids));

    return Response.json({ success: true, message: "Registro eliminado" });
  } catch (err) {
    return Response.json({ error: "Error interno", details: err.message }, { status: 500 });
  }
}
