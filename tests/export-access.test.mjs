import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/lib/export-access.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { isExportLocked } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('free and guest 3D Text exports only allow the three approved presets', () => {
  for (let size = 256; size <= 8192; size++) {
    assert.equal(isExportLocked('3d-text', false, 'png', size), size !== 1280);
    assert.equal(isExportLocked('3d-text', false, 'gif', size), size !== 480 && size !== 768);
    assert.equal(isExportLocked('3d-text', false, 'svg', size), true);
  }
  assert.equal(isExportLocked('3d-text', false, 'unknown', 1280), true);
});

test('paid accounts and other editor kinds retain their existing export access', () => {
  for (const format of ['png', 'gif', 'svg']) {
    assert.equal(isExportLocked('3d-text', true, format, 8192), false);
    for (const kind of ['ai', 'svg-text', 'design']) {
      assert.equal(isExportLocked(kind, false, format, 1280), false);
    }
  }
});
