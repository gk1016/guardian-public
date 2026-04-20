const missionManagerRoles = new Set(["commander", "director", "admin"]);

export function canManageMissions(role: string) {
  return missionManagerRoles.has(role);
}
