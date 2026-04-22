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

export enum Gender {
  MALE = 'male',
  FEMALE = 'female',
  DIVERSE = 'diverse',
}

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  EXPORT = 'export',
  PURGE = 'purge',
}
