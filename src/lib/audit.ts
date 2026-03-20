import { db } from '../db';
import { audit_log } from '../db/schema';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'send_email'
  | 'test_smtp'
  | 'generate_pdf'
  | 'move_card'
  | 'assign_card'
  | 'add_comment'
  | 'add_label'
  | 'email_requested'
  | 'email_queued'
  | 'pdf_generated'
  | 'trash_card';

export async function logAudit(params: {
  userId: number;
  username: string;
  action: AuditAction;
  entity: string;
  entityId?: number | null;
  details?: string | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  ipAddress?: string | null;
}) {
  try {
    await db.insert(audit_log).values({
      user_id: params.userId,
      username: params.username,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      details: params.details ?? null,
      old_data: params.oldData ? JSON.stringify(params.oldData) : null,
      new_data: params.newData ? JSON.stringify(params.newData) : null,
      ip_address: params.ipAddress ?? null,
    });
  } catch (e) {
    console.error('Audit log error:', e);
  }
}
