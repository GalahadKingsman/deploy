import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

// Resolve infra/migrations: MIGRATIONS_DIR env override, else from compiled path.
// Compiled path: apps/api/dist/apps/api/src/database/migrations.js -> 7 levels up = repo root.
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..', '..', '..');
const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR ?? join(REPO_ROOT, 'infra', 'migrations');

const MIGRATION_LIST = [
  '001_create_users_table',
  '002_add_users_ban_and_audit_log',
  '003_add_applied_migrations_and_platform_roles',
  '004_add_experts_and_members',
  '005_add_audit_log_read_indexes',
  '006_add_expert_subscriptions',
  '007_add_expert_applications',
  '008_create_courses_modules_lessons',
  '009_create_invites_enrollments_progress',
  '010_create_assignments_and_submissions',
  '011_add_referral_code_to_enrollments',
  '012_create_orders_and_commissions',
  '013_add_referral_code_to_users',
  '014_add_course_pricing_and_orders_provider_fields',
  '015_add_user_contact_fields',
  '016_payment_refunds_and_partner_payouts_stub',
  '017_topics_and_course_topics',
  '018_assignment_files_and_submission_grading',
  '019_email_password_and_telegram_link',
  '020_site_bridge_codes',
  '021_expert_member_course_access',
  '022_password_reset_tokens',
  '023_expert_submission_views',
  '024_lessons_slider',
  '025_user_streak',
  '026_user_avatar_sync',
  '027_user_last_platform_visit',
  '028_lesson_access_and_hidden',
  '029_lesson_presentation',
  '030_lesson_material_files',
  '031_course_author_display_name',
  '032_course_enrollment_contact_url',
  '033_course_estimated_completion_hours',
  '034_course_difficulty_level',
  '035_course_certificate_pdf',
] as const;

export async function runMigrations(pool: Pool): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[migrations] MIGRATIONS_DIR=${MIGRATIONS_DIR}`);
  }
  // Bootstrap: ensure applied_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS applied_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const name of MIGRATION_LIST) {
    const check = await pool.query('SELECT 1 FROM applied_migrations WHERE name = $1', [name]);
    if (check.rows.length > 0) {
      continue; // Already applied
    }

    const sqlPath = join(MIGRATIONS_DIR, `${name}.sql`);
    const sql = readFileSync(sqlPath, 'utf-8');
    await pool.query(sql);

    await pool.query(
      'INSERT INTO applied_migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name],
    );
  }
}
