export function formatApiErrorMessage(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : "Error desconocido";
  if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
    return `Error de red/CORS. Detalles: ${errorMessage}`;
  }
  return errorMessage;
}
