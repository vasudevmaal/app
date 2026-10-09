export async function migrateSvgCatalog(db: { query(sql: string, params?: unknown[]): Promise<unknown> }) {
  // Retire the standalone catalog while retaining the shared SVG exporter.
  await db.query(`WITH migration AS (
    INSERT INTO settings(key,value) VALUES('migration:remove-svg-text-v1','true'::jsonb)
    ON CONFLICT DO NOTHING RETURNING key
  ) DELETE FROM styles WHERE kind='svg-text' AND EXISTS (SELECT 1 FROM migration)`);
}
