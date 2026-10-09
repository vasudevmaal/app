// The marker prevents a deleted seed from reappearing after a server restart.
export async function migrateVisualCatalog(
  db: { query(sql: string, params?: unknown[]): Promise<unknown> },
  content: unknown,
) {
  await db.query(
    `WITH migration AS (
      INSERT INTO settings(key,value) VALUES('migration:visual-catalog-v1','true'::jsonb)
      ON CONFLICT DO NOTHING RETURNING key
    )
    INSERT INTO styles(id,slug,kind,title,description,seo_title,seo_description,
      seo_keywords,image_url,image_alt,style_category,tags,content_json,metadata)
    SELECT $1,$2,'visual',$3,$4,$5,$6,$7,$8,$9,'Watercolor',$10,$11,$12
    FROM migration ON CONFLICT DO NOTHING`,
    [
      "visual-watercolor-girl",
      "download-girl-image-in-watercolor-style-online",
      "Girl in Watercolor Style",
      "A soft watercolor portrait ready to download or edit.",
      "Download Girl Image in Watercolor Style",
      "Download a girl image in watercolor style or edit it in EXCPIX Design.",
      JSON.stringify(["girl", "watercolor", "visual", "portrait"]),
      "/visual/download-girl-image-in-watercolor-style-online/image.png",
      "Girl portrait painted in watercolor style",
      JSON.stringify(["girl", "watercolor", "portrait"]),
      JSON.stringify(content),
      JSON.stringify({ file_types: ["PNG"] }),
    ],
  );
}
