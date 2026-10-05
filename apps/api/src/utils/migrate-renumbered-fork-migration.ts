import { sql } from "drizzle-orm";
import db from "../database";

// The fork first shipped workspace_role.assigned_only as migration 0055. Upstream
// later added its own 0055-0059 with earlier timestamps, so the fork migration
// was renumbered to 0060. Drizzle only runs migrations newer than the latest
// applied one, so a database that ran the old 0055 would skip upstream's
// 0055-0059. Forgetting that row lets them run; 0060 uses IF NOT EXISTS.
const OLD_FORK_MIGRATION_HASH =
  "2b08ce172177722cf20f11c3b4bc132e2f0441eee2a55198f4664db312a7faae";
const OLD_FORK_MIGRATION_CREATED_AT = 1791186039997;

export async function forgetRenumberedForkMigration() {
  const table = await db.execute(
    sql`SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS exists`,
  );
  const exists =
    table.rows[0]?.exists === true || table.rows[0]?.exists === "t";
  if (!exists) {
    return;
  }

  const result = await db.execute(sql`
    DELETE FROM drizzle.__drizzle_migrations
    WHERE hash = ${OLD_FORK_MIGRATION_HASH}
      AND created_at = ${OLD_FORK_MIGRATION_CREATED_AT}
  `);

  if (result.rowCount) {
    console.log(
      "📝 Forgot renumbered fork migration 0055 so upstream migrations can run",
    );
  }
}
