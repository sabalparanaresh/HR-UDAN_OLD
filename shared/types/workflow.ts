export type WorkflowState = 
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'POSTED'
  | 'ARCHIVED';

export type WorkflowAction = 
  | 'SUBMIT'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'POST'
  | 'ARCHIVE'
  | 'REVERT_TO_DRAFT';

export interface WorkflowTransition {
  from: WorkflowState | WorkflowState[];
  to: WorkflowState;
  action: WorkflowAction;
  requiresNotes?: boolean;
}

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  { action: 'SUBMIT', from: 'DRAFT', to: 'SUBMITTED' },
  { action: 'APPROVE', from: 'SUBMITTED', to: 'APPROVED' },
  { action: 'REJECT', from: 'SUBMITTED', to: 'REJECTED', requiresNotes: true },
  { action: 'POST', from: 'APPROVED', to: 'POSTED' },
  { action: 'CANCEL', from: ['DRAFT', 'SUBMITTED', 'APPROVED'], to: 'CANCELLED' },
  { action: 'ARCHIVE', from: ['POSTED', 'CANCELLED', 'REJECTED'], to: 'ARCHIVED' },
  { action: 'REVERT_TO_DRAFT', from: ['REJECTED', 'CANCELLED'], to: 'DRAFT' }
];

export interface WorkflowAuditLog {
  id: number;
  entity_type: string;
  entity_id: string | number;
  action: WorkflowAction;
  previous_state: WorkflowState | null;
  new_state: WorkflowState;
  acted_by: string;
  notes?: string;
  acted_at: string;
}
