const missionManagerRoles = new Set(["commander", "director", "admin"]);
const operationsManagerRoles = new Set([
  "commander",
  "director",
  "admin",
  "rescue_coordinator",
]);

export function canManageMissions(role: string) {
  return missionManagerRoles.has(role);
}

export function canManageOperations(role: string) {
  return operationsManagerRoles.has(role);
}
