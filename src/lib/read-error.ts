export const readApiError = async (response: Response) => {
  const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
  return payload?.error || payload?.message || "Request failed";
};
