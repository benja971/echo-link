export async function deleteFiles(ids: string[]) {
  const deletedIds: string[] = [];
  const failedIds: string[] = [];
  for (const id of ids) {
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      (response.ok ? deletedIds : failedIds).push(id);
    } catch {
      failedIds.push(id);
    }
  }
  return { deletedIds, failedIds };
}
