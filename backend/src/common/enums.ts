export enum StaffRole {
  ADMIN = 'admin',
  LEAD = 'lead',
  EMPLOYEE = 'employee',
  VOLUNTEER = 'volunteer',
  HELPER = 'helper',
  ANALYST = 'analyst',
}

export enum ActivityType {
  OPEN_DOOR = 'open_door',
  PROJECT_OPEN = 'project_open',
  PROJECT_CLOSED = 'project_closed',
  EVENT = 'event',
  OUTREACH = 'outreach',
}

export enum ActivityExecutionStatus {
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  EXPORT = 'export',
  PURGE = 'purge',
}

export enum LogbookEntryType {
  OBSERVATION = 'observation',
  INCIDENT = 'incident',
  SUCCESS = 'success',
  HANDOVER = 'handover',
  DEBRIEF = 'debrief',
  OTHER = 'other',
}

export enum LogbookEntryStatus {
  OPEN = 'open',
  FOLLOW_UP = 'follow_up',
  DISCUSSED = 'discussed',
  ARCHIVED = 'archived',
}

export enum LogbookVisibility {
  TEAM = 'team',
  ADMINS = 'admins',
}
