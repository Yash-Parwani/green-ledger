// Generated documents — 80G receipts and GST invoices — stored as real bytes
// and served behind an authorization check.
//
// These used to be a `pdf_url` string pointing at a path nothing served, so the
// link in the console 404'd. A CFO clicks that link during a demo.
//
// Artifacts are org-scoped and immutable: an issued receipt is a record, so
// there is no update() here. Reissuing produces a new artifact.

import crypto from "node:crypto";

export type ArtifactKind = "80g_receipt" | "gst_invoice";

export type Artifact = {
  id: string;
  orgId: string;
  kind: ArtifactKind;
  filename: string;
  bytes: Buffer;
  createdAt: number;
};

export interface ArtifactRepository {
  put(input: Omit<Artifact, "id" | "createdAt">): Promise<Artifact>;
  get(orgId: string, id: string): Promise<Artifact | null>;
  list(orgId: string): Promise<Omit<Artifact, "bytes">[]>;
}

class InMemoryArtifactRepository implements ArtifactRepository {
  private artifacts = new Map<string, Artifact>();

  async put(input: Omit<Artifact, "id" | "createdAt">): Promise<Artifact> {
    const artifact: Artifact = {
      ...input,
      id: `doc_${crypto.randomBytes(12).toString("base64url")}`,
      createdAt: Date.now(),
    };
    this.artifacts.set(artifact.id, artifact);
    return artifact;
  }

  async get(orgId: string, id: string): Promise<Artifact | null> {
    const a = this.artifacts.get(id);
    // Scoped by org: a document id from another tenant must not resolve, even
    // though the id itself is unguessable.
    return a && a.orgId === orgId ? a : null;
  }

  async list(orgId: string): Promise<Omit<Artifact, "bytes">[]> {
    return [...this.artifacts.values()]
      .filter((a) => a.orgId === orgId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ bytes: _bytes, ...rest }) => rest);
  }
}

const globalForArtifacts = globalThis as unknown as { __glArtifactRepo?: ArtifactRepository };

export const artifacts: ArtifactRepository =
  globalForArtifacts.__glArtifactRepo ?? new InMemoryArtifactRepository();
if (process.env.NODE_ENV !== "production") globalForArtifacts.__glArtifactRepo = artifacts;
