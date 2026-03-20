export function getApiErrorMessage(err: any, fallback: string) {
  const msg =
    err?.response?.data?.message ??
    err?.response?.data?.error ??
    err?.message ??
    fallback;

  const status = err?.response?.status;
  return status ? `${msg} (HTTP ${status})` : msg;
}
