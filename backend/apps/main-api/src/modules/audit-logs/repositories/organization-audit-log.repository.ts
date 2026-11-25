import type { Prisma } from '@sombill/database/organization';
import type { Tx } from '@sombill/database/organization';

export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  organizationId?: string | null;
  targetType?: string;
  targetId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Append-only audit trail, written in the same transaction as the change it records. */
export async function writeAudit(tx: Tx, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      action: entry.action,
      actorUserId: entry.actorUserId ?? null,
      organizationId: entry.organizationId ?? null,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent?.slice(0, 500) ?? null,
      ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
    },
  });
}
