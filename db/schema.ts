import { text, timestamp, uuid, varchar, boolean, integer, jsonb, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'rescheduled',
  'no_show'
]);

export const appointmentPriorityEnum = pgEnum('appointment_priority', [
  'low',
  'medium',
  'high',
  'urgent'
]);

export const noteTypeEnum = pgEnum('note_type', [
  'pre_appointment',
  'during_appointment',
  'post_appointment',
  'follow_up'
]);

export const organisationTypeEnum = pgEnum('organisation_type', [
  'retail',
  'corporate',
  'government',
  'education',
  'healthcare',
  'other'
]);

// Users Table
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text().notNull(),
  firstName: varchar({ length: 100 }),
  lastName: varchar({ length: 100 }),
  phone: varchar({ length: 20 }),
  avatar: text(),
  isActive: boolean().default(true).notNull(),
  emailVerified: boolean().default(false).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
  uniqueIndex('email_idx').on(table.email),
]);

// Organisations Table
export const organisations = pgTable('organisations', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 255 }).notNull(),
  email: text('email'),
  phone: varchar({ length: 20 }),
  address: text(),
  city: varchar({ length: 100 }),
  state: varchar({ length: 100 }),
  country: varchar({ length: 100 }),
  postalCode: varchar({ length: 20 }),
  latitude: varchar({ length: 50 }),
  longitude: varchar({ length: 50 }),
  type: organisationTypeEnum(),
  website: text(),
  description: text(),
  isActive: boolean().default(true).notNull(),
  contactPerson: varchar({ length: 255 }),
  createdBy: uuid().references(() => users.id),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
  index('org_name_idx').on(table.name),
  index('org_location_idx').on(table.latitude, table.longitude),
]);

// Appointments Table
export const appointments = pgTable('appointments', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }).notNull(),
  organisationId: uuid().references(() => organisations.id, { onDelete: 'cascade' }).notNull(),
  title: varchar({ length: 255 }).notNull(),
  description: text(),
  scheduledDate: timestamp().notNull(),
  scheduledTime: varchar({ length: 10 }).notNull(), // e.g., "14:30"
  duration: integer().default(60), // in minutes
  status: appointmentStatusEnum().default('scheduled').notNull(),
  priority: appointmentPriorityEnum().default('medium'),
  reminderSent: boolean().default(false),
  checkInTime: timestamp(),
  checkOutTime: timestamp(),
  cancellationReason: text(),
  cancelledAt: timestamp(),
  rescheduledFrom: uuid(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
  index('appointment_user_idx').on(table.userId),
  index('appointment_org_idx').on(table.organisationId),
  index('appointment_date_idx').on(table.scheduledDate),
  index('appointment_status_idx').on(table.status),
]);

// Notes Table
export const notes = pgTable('notes', {
  id: uuid().primaryKey().defaultRandom(),
  appointmentId: uuid().references(() => appointments.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }).notNull(),
  type: noteTypeEnum().default('during_appointment').notNull(),
  content: text().notNull(),
  attachments: jsonb().$type<string[]>(), // Array of URLs
  isImportant: boolean().default(false),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
  index('note_appointment_idx').on(table.appointmentId),
  index('note_user_idx').on(table.userId),
]);

// Routes Table (for optimized daily routes)
export const routes = pgTable('routes', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }).notNull(),
  routeDate: timestamp().notNull(),
  startLocation: jsonb().$type<{ lat: number; lng: number; address?: string }>(),
  endLocation: jsonb().$type<{ lat: number; lng: number; address?: string }>(),
  appointmentSequence: jsonb().$type<string[]>(), // Array of appointment IDs in order
  totalDistance: varchar({ length: 50 }), // e.g., "25.5 km"
  estimatedDuration: integer(), // in minutes
  routePolyline: text(), // Google Maps polyline
  isOptimized: boolean().default(false),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
}, (table) => [
  index('route_user_date_idx').on(table.userId, table.routeDate),
]);

// Appointment Tags (for categorization)
export const tags = pgTable('tags', {
  id: uuid().primaryKey().defaultRandom(),
  name: varchar({ length: 50 }).notNull(),
  color: varchar({ length: 7 }).default('#3B82F6'), // hex color
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
}, (table) => [
  uniqueIndex('tag_user_name_idx').on(table.userId, table.name),
]);

// Appointment Tags Junction Table
export const appointmentTags = pgTable('appointment_tags', {
  appointmentId: uuid().references(() => appointments.id, { onDelete: 'cascade' }).notNull(),
  tagId: uuid().references(() => tags.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
}, (table) => [
  index('appointment_tag_idx').on(table.appointmentId, table.tagId),
]);

// Activity Log (for tracking changes)
export const activityLogs = pgTable('activity_logs', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }).notNull(),
  appointmentId: uuid().references(() => appointments.id, { onDelete: 'cascade' }),
  action: varchar({ length: 100 }).notNull(), // e.g., "created", "updated", "cancelled"
  details: jsonb(), // Store old and new values
  ipAddress: varchar({ length: 45 }),
  userAgent: text(),
  createdAt: timestamp().defaultNow().notNull(),
}, (table) => [
  index('activity_user_idx').on(table.userId),
  index('activity_appointment_idx').on(table.appointmentId),
  index('activity_created_idx').on(table.createdAt),
]);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  appointments: many(appointments),
  organisations: many(organisations),
  notes: many(notes),
  routes: many(routes),
  tags: many(tags),
  activityLogs: many(activityLogs),
}));

export const organisationsRelations = relations(organisations, ({ one, many }) => ({
  creator: one(users, {
    fields: [organisations.createdBy],
    references: [users.id],
  }),
  appointments: many(appointments),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  user: one(users, {
    fields: [appointments.userId],
    references: [users.id],
  }),
  organisation: one(organisations, {
    fields: [appointments.organisationId],
    references: [organisations.id],
  }),
  notes: many(notes),
  tags: many(appointmentTags),
  activityLogs: many(activityLogs),
  rescheduledFromAppointment: one(appointments, {
    fields: [appointments.rescheduledFrom],
    references: [appointments.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  appointment: one(appointments, {
    fields: [notes.appointmentId],
    references: [appointments.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

export const routesRelations = relations(routes, ({ one }) => ({
  user: one(users, {
    fields: [routes.userId],
    references: [users.id],
  }),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  user: one(users, {
    fields: [tags.userId],
    references: [users.id],
  }),
  appointments: many(appointmentTags),
}));

export const appointmentTagsRelations = relations(appointmentTags, ({ one }) => ({
  appointment: one(appointments, {
    fields: [appointmentTags.appointmentId],
    references: [appointments.id],
  }),
  tag: one(tags, {
    fields: [appointmentTags.tagId],
    references: [tags.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
  appointment: one(appointments, {
    fields: [activityLogs.appointmentId],
    references: [appointments.id],
  }),
}));
