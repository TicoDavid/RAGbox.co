// TypeScript types for audit events

type AuditEvent = {
    id: string;
    userId: string;
    action: string;
    timestamp: Date;
    details?: string;
};

interface AuditLog {
    events: AuditEvent[];
    addEvent(event: AuditEvent): void;
    getEventsByUser(userId: string): AuditEvent[];
}

export { AuditEvent, AuditLog };