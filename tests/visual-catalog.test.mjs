import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { schema } from '../src/lib/schema.ts';
import { migrateVisualCatalog } from '../src/lib/visual-seeds.ts';

test('Visual seed is stored once and respects database edits and deletion', async () => {
  const db = new PGlite();
  try {
    await db.exec(schema);
    await migrateVisualCatalog(db, {});
    const { rows } = await db.query("SELECT * FROM styles WHERE kind='visual'");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'download-girl-image-in-watercolor-style-online');
    assert.equal(rows[0].is_active, true);
    assert.equal(rows[0].status, 'approved');
    assert.deepEqual(rows[0].metadata.file_types, ['PNG']);
    await db.query("UPDATE styles SET title='Owner title',is_active=false WHERE kind='visual'");
    await migrateVisualCatalog(db, {});
    const edited = (await db.query("SELECT * FROM styles WHERE kind='visual'")).rows;
    assert.equal(edited.length, 1);
    assert.equal(edited[0].title, 'Owner title');
    assert.equal(edited[0].is_active, false);
    await db.query("DELETE FROM styles WHERE kind='visual'");
    await migrateVisualCatalog(db, {});
    assert.equal((await db.query("SELECT * FROM styles WHERE kind='visual'")).rows.length, 0);
  } finally {
    await db.close();
  }
});

test('Visual migration does not replace an existing owner-managed record', async () => {
  const db = new PGlite();
  try {
    await db.exec(schema);
    await db.query(
      "INSERT INTO styles(id,slug,kind,title,content_json,is_active) VALUES('owner-visual',$1,'visual','Owner image','{}',false)",
      ['download-girl-image-in-watercolor-style-online'],
    );
    await migrateVisualCatalog(db, {});
    const { rows } = await db.query("SELECT * FROM styles WHERE kind='visual'");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, 'owner-visual');
    assert.equal(rows[0].title, 'Owner image');
    assert.equal(rows[0].is_active, false);
  } finally {
    await db.close();
  }
});
