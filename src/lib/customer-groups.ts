export function normalizeCustomerGroupName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export function normalizeCustomerGroupIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    )
  );
}
