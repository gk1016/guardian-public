const missionManagerRoles = new Set(["commander", "director", "admin"]);
const operationsManagerRoles = new Set(["commander", "director", "admin", "rescue_coordinator"]);
const administrationRoles = new Set(["commander", "director", "admin"]);

export function canManageMissions(role: string) {
  return missionManagerRoles.has(role);
}
export function canManageOperations(role: string) {
  return operationsManagerRoles.has(role);
}
export function canManageAdministration(role: string) {
  return administrationRoles.has(role);
}
