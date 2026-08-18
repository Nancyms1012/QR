// POST /api/upload-participants - Upload/replace participant list from CSV/JSON
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    if (!env.CHECKIN_KV) {
      return new Response(JSON.stringify({ error: "KV no vinculado" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const body = await request.json();
    const { participants, mode } = body;

    // mode: "replace" (default) or "merge"
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return new Response(JSON.stringify({ error: "No se recibieron participantes válidos" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Validate each participant has at least dorsal and nombre
    const valid = [];
    const invalid = [];

    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.dorsal || !p.nombre) {
        invalid.push({ row: i + 1, data: p, reason: "Falta dorsal o nombre" });
        continue;
      }

      valid.push({
        dorsal: parseInt(p.dorsal),
        nombre: String(p.nombre || '').trim(),
        apellidos: String(p.apellidos || '').trim(),
        genero: String(p.genero || '').trim(),
        categoria: String(p.categoria || '').trim(),
        competencia: String(p.competencia || '').trim(),
        talla: String(p.talla || '').trim(),
        color: String(p.color || '').trim(),
        telefono: String(p.telefono || '').trim(),
        email: String(p.email || '').trim()
      });
    }

    if (valid.length === 0) {
      return new Response(JSON.stringify({ 
        error: "Ningún participante válido", 
        invalid 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (mode === 'merge') {
      // Merge: update existing, add new ones
      const existing = await env.CHECKIN_KV.get("participants", { type: "json" }) || [];
      
      for (const newP of valid) {
        const idx = existing.findIndex(e => e.dorsal === newP.dorsal);
        if (idx >= 0) {
          // Update existing - only overwrite non-empty fields
          if (newP.nombre) existing[idx].nombre = newP.nombre;
          if (newP.apellidos) existing[idx].apellidos = newP.apellidos;
          if (newP.genero) existing[idx].genero = newP.genero;
          if (newP.categoria) existing[idx].categoria = newP.categoria;
          if (newP.competencia) existing[idx].competencia = newP.competencia;
          if (newP.talla) existing[idx].talla = newP.talla;
          if (newP.color) existing[idx].color = newP.color;
          if (newP.telefono) existing[idx].telefono = newP.telefono;
          if (newP.email) existing[idx].email = newP.email;
        } else {
          existing.push(newP);
        }
      }

      await env.CHECKIN_KV.put("participants", JSON.stringify(existing));

      return new Response(JSON.stringify({
        success: true,
        message: `Merge completado: ${valid.length} procesados`,
        total: existing.length,
        added: valid.filter(v => !existing.find(e => e.dorsal === v.dorsal)).length,
        updated: valid.filter(v => existing.find(e => e.dorsal === v.dorsal)).length,
        invalid: invalid.length > 0 ? invalid : undefined
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // Replace: overwrite all participants
      await env.CHECKIN_KV.put("participants", JSON.stringify(valid));

      return new Response(JSON.stringify({
        success: true,
        message: `Se cargaron ${valid.length} participantes`,
        total: valid.length,
        invalid: invalid.length > 0 ? invalid : undefined
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: "Error interno", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
