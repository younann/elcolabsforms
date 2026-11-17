import { pgTable, uuid, text, boolean, timestamp, integer, jsonb, serial, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['admin', 'inspector'] }).notNull(),
  active: boolean('active').notNull().default(true),
  signatureKey: text('signature_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const loginAttempts = pgTable(
  'login_attempts',
  {
    id: serial('id').primaryKey(),
    username: text('username').notNull(),
    ip: text('ip'),
    ok: boolean('ok').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('login_attempts_user_at').on(t.username, t.at), index('login_attempts_ip_at').on(t.ip, t.at)],
);

export const settings = pgTable('settings', {
  id: integer('id').primaryKey().default(1),
  recipientEmail: text('recipient_email').notNull().default(''),
  companyName: text('company_name').notNull().default(''),
  companyDetails: text('company_details').notNull().default(''),
  stampKey: text('stamp_key'),
});

export const submissions = pgTable(
  'submissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: text('form_id').notNull(),
    formVersion: integer('form_version').notNull(),
    status: text('status').notNull().default('draft'),
    inspectorId: uuid('inspector_id').notNull().references(() => users.id),
    data: jsonb('data').notNull().default({}),
    revision: integer('revision').notNull().default(0),
    parentId: uuid('parent_id'),
    testNumber: text('test_number'),
    siteName: text('site_name'),
    reviewNote: text('review_note'),
    approvedBy: uuid('approved_by').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
    pdfKey: text('pdf_key'),
    sendError: text('send_error'),
    // mail mode was log: nothing really sent
    mailLogged: boolean('mail_logged').notNull().default(false),
    sendClaimedAt: timestamp('send_claimed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('submissions_status').on(t.status), index('submissions_inspector').on(t.inspectorId), uniqueIndex('submissions_parent').on(t.parentId)],
);

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  fieldId: text('field_id').notNull(),
  kind: text('kind', { enum: ['photo', 'signature', 'drawing'] }).notNull(),
  blobKey: text('blob_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  submissionId: uuid('submission_id').notNull().references(() => submissions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  fieldId: text('field_id'),
  oldValue: jsonb('old_value'),
  newValue: jsonb('new_value'),
  note: text('note'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type Settings = typeof settings.$inferSelect;
