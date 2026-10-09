import test from 'node:test';
import assert from 'node:assert/strict';
import {isAllowedRequestOrigin} from '../src/lib/origin.ts';

test('request origin accepts the active host', () => {
  assert.equal(
    isAllowedRequestOrigin(
      'http://127.0.0.1:3010',
      'http://127.0.0.1:3010/api/auth/login',
      'http://localhost:3000',
      '127.0.0.1:3010',
    ),
    true,
  );
});

test('request origin treats loopback names as equivalent on the same port', () => {
  assert.equal(
    isAllowedRequestOrigin(
      'http://localhost:3010',
      'http://127.0.0.1:3010/api/auth/login',
      'http://localhost:3000',
      '127.0.0.1:3010',
    ),
    true,
  );
});

test('request origin rejects external origins', () => {
  assert.equal(
    isAllowedRequestOrigin(
      'https://other.example',
      'http://127.0.0.1:3010/api/projects',
      'http://localhost:3000',
      '127.0.0.1:3010',
    ),
    false,
  );
});

test('request origin rejects malformed origins', () => {
  assert.equal(
    isAllowedRequestOrigin(
      'not a url',
      'http://127.0.0.1:3010/api/projects',
      'http://localhost:3000',
      '127.0.0.1:3010',
    ),
    false,
  );
});
