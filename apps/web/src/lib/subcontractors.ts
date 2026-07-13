import type { ReviewResult } from '@tl/shared';

export type RequestStatus = 'requested' | 'submitted' | 'incomplete' | 'accepted';

export interface DocumentRequestView {
  id: string;
  status: RequestStatus;
  dueDate: string | null;
  documentType: {
    id: string;
    name: string;
    description: string;
    sortOrder: number;
    requirements: Array<{ id: string; text: string; seeded: boolean }>;
  };
  versions: DocumentVersionView[];
  /** Present only in the subcontractor portal response, when the request is incomplete. */
  incompleteReason?: string;
  /** Present only in the subcontractor portal response: each failed requirement and its message. */
  failingRequirements?: Array<{ requirement: string; reason: string }>;
}

export interface DocumentVersionView {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  aiReview?: ReviewResult | null;
  aiReviewedAt?: string | null;
  aiReviewError?: string | null;
  extracted?: { expiry_date?: string } | null;
  humanReview?: ReviewResult | null;
  decidedAt?: string | null;
  decidedStatus?: 'accepted' | 'incomplete' | null;
}

export interface SubcontractorView {
  id: string;
  name: string;
  email: string;
  portalToken: string;
  note: string;
  certificationType: string | null;
  createdAt: string;
  documentRequests: DocumentRequestView[];
  emailLog: EmailLogView[];
}

export interface EmailLogView {
  id: string;
  kind: 'request' | 'follow_up' | 'incomplete';
  toEmail: string;
  subject: string;
  resendId: string | null;
  previewHtml: string;
  sentAt: string;
}

export interface SentEmailView {
  log: EmailLogView;
  preview: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
  const raw = await response.text();
  const body = (raw ? JSON.parse(raw) : {}) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body;
}

export const subcontractorApi = {
  list: () => request<{ subcontractors: SubcontractorView[] }>('/api/subcontractors'),
  get: (id: string) => request<{ subcontractor: SubcontractorView }>(`/api/subcontractors/${id}`),
  create: (input: {
    name: string;
    email: string;
    dueDate: string;
    documentTypeSlugs: string[];
    sendInitialEmail: boolean;
  }) =>
    request<{ subcontractor: SubcontractorView; email?: SentEmailView; emailError?: string }>('/api/subcontractors', {
      method: 'POST', body: JSON.stringify(input),
    }),
  update: (id: string, input: { name: string; email: string; dueDate: string }) =>
    request<{ subcontractor: SubcontractorView }>(`/api/subcontractors/${id}`, {
      method: 'PATCH', body: JSON.stringify(input),
    }),
  updateNote: (id: string, note: string) =>
    request(`/api/subcontractors/${id}/note`, { method: 'PATCH', body: JSON.stringify({ note }) }),
  sendFollowUp: (id: string) =>
    request<{ email: SentEmailView }>(`/api/subcontractors/${id}/email/follow-up`, { method: 'POST' }),
  portal: (token: string) => request<{ subcontractor: SubcontractorView }>(`/api/portal/${token}`),
  updatePortalEmail: (token: string, email: string) =>
    request<{ subcontractor: SubcontractorView }>(`/api/portal/${token}/email`, {
      method: 'PATCH', body: JSON.stringify({ email }),
    }),
  upload: async (token: string, requestId: string, file: File) => {
    const body = new FormData();
    body.set('file', file);
    const response = await fetch(`/api/portal/${token}/requests/${requestId}/upload`, { method: 'POST', body });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(result.error ?? 'Upload failed');
  },
  download: (subcontractorId: string, requestId: string, versionId: string) =>
    request<{ url: string }>(`/api/subcontractors/${subcontractorId}/requests/${requestId}/versions/${versionId}/download`),
  rerunAiReview: (subcontractorId: string, requestId: string, versionId: string) =>
    request<{ queued: boolean }>(`/api/subcontractors/${subcontractorId}/requests/${requestId}/versions/${versionId}/ai-review`, { method: 'POST' }),
  review: (
    subcontractorId: string,
    requestId: string,
    input: { status: 'accepted' | 'incomplete'; humanReview: ReviewResult },
  ) => request<{ version: DocumentVersionView; email?: SentEmailView; emailError?: string }>(
    `/api/subcontractors/${subcontractorId}/requests/${requestId}/review`,
    { method: 'PATCH', body: JSON.stringify(input) },
  ),
};

export interface SettingsDocumentTypeView {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  requirements: Array<{ id: string; text: string; seeded: boolean }>;
  settings: { documentTypeId: string; additionalInstructions: string } | null;
}

export const settingsApi = {
  list: () => request<{ documentTypes: SettingsDocumentTypeView[] }>('/api/settings'),
  updateInstructions: (documentTypeId: string, additionalInstructions: string) =>
    request(`/api/settings/${documentTypeId}`, { method: 'PUT', body: JSON.stringify({ additionalInstructions }) }),
  addRequirement: (documentTypeId: string, text: string) =>
    request(`/api/settings/${documentTypeId}/requirements`, { method: 'POST', body: JSON.stringify({ text }) }),
  updateRequirement: (documentTypeId: string, requirementId: string, text: string) =>
    request(`/api/settings/${documentTypeId}/requirements/${requirementId}`, { method: 'PATCH', body: JSON.stringify({ text }) }),
  deleteRequirement: (documentTypeId: string, requirementId: string) =>
    request(`/api/settings/${documentTypeId}/requirements/${requirementId}`, { method: 'DELETE' }),
};

export function isOverdue(request: DocumentRequestView) {
  return request.status === 'requested' && !!request.dueDate && request.dueDate < new Date().toISOString().slice(0, 10);
}

export function displayStatus(request: DocumentRequestView) {
  return isOverdue(request) ? 'overdue' : request.status;
}
