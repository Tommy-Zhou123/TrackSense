/** Display label for an accepted type: ".csv" → "csv", "image/jpeg" → "jpeg". */
export function toAcceptedTypeExtension(type: string): string {
  if (type.startsWith(".")) return type.slice(1);
  if (!type.includes("/")) return type;

  const subtype = type.split("/").pop();
  if (subtype) return subtype;

  return type.split("/").filter(Boolean).pop() ?? "";
}
