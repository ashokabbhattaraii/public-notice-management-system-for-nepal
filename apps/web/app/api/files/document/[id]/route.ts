import { NextResponse } from "next/server"
import { API_URL } from "@/lib/api"

/**
 * Same-origin proxy for RAG document downloads — mirrors
 * app/api/files/attachment/[id]/route.ts. Redirects to the backend's
 * GET /documents/:id/download, which itself redirects to a short-lived
 * presigned S3 URL (see DocumentsService.getDownloadUrl).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return NextResponse.redirect(`${API_URL}/documents/${id}/download`)
}
