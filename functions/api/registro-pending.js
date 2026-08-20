// GET /api/registro-pending - This endpoint is no longer needed (no liberacion step)
// Kept for backwards compatibility - returns empty
export async function onRequestGet(context) {
  return Response.json([]);
}
