const API_URL = process.env.API_URL ?? "http://127.0.0.1:8000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const approach = new URL(request.url).searchParams.get("approach");
  const selected = approach === "protocol" || approach === "protocol_rag"
    ? approach
    : "rag_pairwise";
  const query = `?approach=${selected}`;
  const response = await fetch(`${API_URL}/lds/${encodeURIComponent(id)}/conversation-relations${query}`, {
    method: "POST",
    cache: "no-store",
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("Content-Type") ?? "application/json" },
  });
}
