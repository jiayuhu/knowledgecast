import {
  createCollection,
  deleteCollection,
  ensureDefaultCollection,
  getCollection,
  listCollections,
  reorderCollections,
  updateCollection,
  type CollectionRecord
} from "../collection/repository";

export type WorkspaceRecord = CollectionRecord;

export async function createWorkspace(userId: string, name: string, areaId?: string) {
  return createCollection(userId, name, areaId);
}

export async function listWorkspaces(userId: string, areaId?: string | null) {
  return listCollections(userId, areaId);
}

export async function getWorkspace(id: string) {
  return getCollection(id);
}

export async function updateWorkspace(
  id: string,
  input: { name?: string; topic?: string | null; areaId?: string | null }
) {
  return updateCollection(id, input);
}

export async function reorderWorkspaces(orderedIds: string[]) {
  return reorderCollections(orderedIds);
}

export async function deleteWorkspace(id: string) {
  return deleteCollection(id);
}

export async function ensureDefaultWorkspace(userId: string, areaId?: string) {
  return ensureDefaultCollection(userId, areaId);
}
