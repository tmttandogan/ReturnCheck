import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const returns = sqliteTable('return_cases', {
  id: text('id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(0),
});
