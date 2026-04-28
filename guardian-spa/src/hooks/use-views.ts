import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Shared sub-types                                                  */
/* ------------------------------------------------------------------ */

export interface PackageSummary {
  total: number;
  open: number;
  staffedTotal: number;
  assigned: number;
  ready: number;
  launched: number;
  rtb: number;
  readyOrLaunched: number;
  readinessLabel: string;
}

export interface RoleCheck {
  key: string;
  label: string;
  requiredCount: number;
  matchedCount: number;
  matchedHandles: string[];
  openCount: number;
  openHandles: string[];
  shortfall: number;
}

export interface PackageDiscipline {
  profileCode: string;
  profileLabel: string;
  coverageLabel: string;
  shortfallCount: number;
  warnings: string[];
  roleChecks: RoleCheck[];
}

export interface MissionSummary {
  id: string;
  callsign: string;
  title: string;
  missionType: string;
  status: string;
  priority: string;
  revisionNumber: number;
  areaOfOperation: string;
  missionBrief: string;
  updatedAtLabel: string;
  leadDisplay: string;
  participantCount: number;
  packageSummary: PackageSummary;
  packageDiscipline: PackageDiscipline;
}

export interface RescueSummary {
  id: string;
  survivorHandle: string;
  locationName: string;
  status: string;
  urgency: string;
  threatSummary: string;
  rescueNotes: string;
  escortRequired: boolean;
  medicalRequired: boolean;
  offeredPayment: string;
}

export interface IntelSummary {
  id: string;
  title: string;
  description: string;
  severity: number;
  reportType: string;
  locationName: string;
  hostileGroup: string;
  confidence: string;
  tags: string[];
}

export interface QrfSummary {
  id: string;
  callsign: string;
  status: string;
  platform: string;
  locationName: string;
  availableCrew: number;
  notes: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAtLabel: string;
}

/* ------------------------------------------------------------------ */
/*  /api/views/command                                                 */
/* ------------------------------------------------------------------ */

export interface CommandOverview {
  orgName: string;
  missions: MissionSummary[];
  rescues: RescueSummary[];
  intel: IntelSummary[];
  qrf: QrfSummary[];
  notifications: Notification[];
  activeMissionCount: number;
  openRescueCount: number;
  activeIntelCount: number;
  qrfReadyCount: number;
  unreadNotificationCount: number;
}

/* ------------------------------------------------------------------ */
/*  /api/views/missions                                                */
/* ------------------------------------------------------------------ */

export interface MissionsView {
  orgName: string;
  items: MissionSummary[];
}

/* ------------------------------------------------------------------ */
/*  /api/views/missions/:id                                            */
/* ------------------------------------------------------------------ */

export interface Participant {
  id: string;
  handle: string;
  role: string;
  platform: string;
  status: string;
  notes: string;
}

export interface MissionLog {
  id: string;
  entryType: string;
  message: string;
  createdAtLabel: string;
  authorDisplay: string;
}

export interface LinkedIntel {
  id: string;
  title: string;
  severity: number;
  reportType: string;
  locationName: string;
  hostileGroup: string;
}

export interface DoctrineTemplate {
  id: string;
  code: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  escalation: string;
}

export interface AvailableCrew {
  handle: string;
  displayName: string;
  orgRole: string;
  membershipTitle: string;
  qrfStatus: string;
  suggestedPlatform: string;
  sourceLabel: string;
  notes: string;
  commitments: string[];
  availabilityLabel: string;
}

export interface MissionDetail {
  id: string;
  callsign: string;
  title: string;
  missionType: string;
  status: string;
  priority: string;
  revisionNumber: number;
  areaOfOperation: string;
  missionBrief: string;
  updatedAtLabel: string;
  leadDisplay: string;
  participantCount: number;
  packageSummary: PackageSummary;
  packageDiscipline: PackageDiscipline;
  closeoutSummary: string;
  aarSummary: string;
  roeCode: string;
  completedAtLabel: string;
  participants: Participant[];
  logs: MissionLog[];
  linkedIntel: LinkedIntel[];
  doctrineTemplate: DoctrineTemplate | null;
  availableDoctrineTemplates: DoctrineTemplate[];
  availableIntel: IntelSummary[];
  availableCrew: AvailableCrew[];
}

export interface MissionDetailView {
  orgName: string;
  error?: string;
  mission?: MissionDetail;
}

/* ------------------------------------------------------------------ */
/*  /api/views/doctrine                                                */
/* ------------------------------------------------------------------ */

export interface DoctrineItem {
  id: string;
  code: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  escalation: string;
  isDefault: boolean;
  missionCount: number;
}

export interface DoctrineView {
  orgName: string;
  items: DoctrineItem[];
}

/* ------------------------------------------------------------------ */
/*  /api/views/roster                                                  */
/* ------------------------------------------------------------------ */

export interface RosterCommitment {
  missionId: string;
  callsign: string;
  missionStatus: string;
  assignmentStatus: string;
  role: string;
}

export interface RosterMember {
  handle: string;
  displayName: string;
  orgRole: string;
  membershipTitle: string;
  qrfStatus: string | null;
  suggestedPlatform: string | null;
  sourceLabel: string;
  notes: string | null;
  commitments: RosterCommitment[];
  availabilityLabel: string;
  userId: string;
  email: string;
  rank: string;
  status: string;
  activityScore: number;
  activityTier: string;
  lastActiveLabel: string | null;
  missionCount: number;
  logCount: number;
}

export interface RosterView {
  orgName: string;
  items: RosterMember[];
}

/* ------------------------------------------------------------------ */
/*  /api/views/intel                                                   */
/* ------------------------------------------------------------------ */

export interface LinkedMission {
  missionId: string;
  callsign: string;
  missionStatus: string;
}

export interface IntelItem extends IntelSummary {
  linkedMissions: LinkedMission[];
}

export interface IntelView {
  orgName: string;
  items: IntelItem[];
}

/* ------------------------------------------------------------------ */
/*  /api/views/rescues                                                 */
/* ------------------------------------------------------------------ */

export interface RescuesView {
  orgName: string;
  items: RescueSummary[];
}

/* ------------------------------------------------------------------ */
/*  Hooks                                                              */
/* ------------------------------------------------------------------ */

export function useCommandOverview() {
  return useQuery({
    queryKey: ["views", "command"],
    queryFn: () => api.get<CommandOverview>("/api/views/command"),
  });
}

export function useMissions() {
  return useQuery({
    queryKey: ["views", "missions"],
    queryFn: () => api.get<MissionsView>("/api/views/missions"),
  });
}

export function useMissionDetail(id: string) {
  return useQuery({
    queryKey: ["views", "missions", id],
    queryFn: () => api.get<MissionDetailView>(`/api/views/missions/${id}`),
    enabled: !!id,
  });
}

export function useDoctrine() {
  return useQuery({
    queryKey: ["views", "doctrine"],
    queryFn: () => api.get<DoctrineView>("/api/views/doctrine"),
  });
}

export function useRoster() {
  return useQuery({
    queryKey: ["views", "roster"],
    queryFn: () => api.get<RosterView>("/api/views/roster"),
  });
}

export function useIntel() {
  return useQuery({
    queryKey: ["views", "intel"],
    queryFn: () => api.get<IntelView>("/api/views/intel"),
  });
}

export function useRescues() {
  return useQuery({
    queryKey: ["views", "rescues"],
    queryFn: () => api.get<RescuesView>("/api/views/rescues"),
  });
}
