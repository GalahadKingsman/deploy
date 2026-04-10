#!/usr/bin/env node

/**
 * Foundation Smoke Test: Webapp Scroll Management
 * Tests: scroll storage cleanup logic
 * 
 * Minimal tests without jest - uses node:test
 * Tests the cleanup logic directly (not the actual module, which requires browser APIs)
 */

import { test } from 'node:test';

const SCROLL_STORAGE_LIMIT = 50;
const SCROLL_STORAGE_PREFIX = 'scroll-';

/**
 * Test implementation of cleanupOldScrollKeys logic
 * This mirrors the actual implementation in Scrollable.tsx
 */
function cleanupOldScrollKeys(mockStorage) {
  try {
    const keys = Object.keys(mockStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
    if (keys.length > SCROLL_STORAGE_LIMIT) {
      keys.sort();
      const toRemove = keys.slice(0, keys.length - SCROLL_STORAGE_LIMIT);
      toRemove.forEach((key) => delete mockStorage[key]);
    }
  } catch {
    // ignore
  }
}

test('cleanupOldScrollKeys removes oldest keys when limit exceeded', () => {
  const mockStorage = {};
  
  // Fill storage with 60 keys (exceeds limit of 50)
  for (let i = 0; i < 60; i++) {
    mockStorage[`${SCROLL_STORAGE_PREFIX}key-${i.toString().padStart(3, '0')}`] = String(i * 100);
  }
  
  // Verify we have 60 keys
  const keysBefore = Object.keys(mockStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
  if (keysBefore.length !== 60) {
    throw new Error(`Expected 60 keys, got ${keysBefore.length}`);
  }
  
  // Run cleanup
  cleanupOldScrollKeys(mockStorage);
  
  // Verify we have 50 keys (oldest 10 removed)
  const keysAfter = Object.keys(mockStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
  if (keysAfter.length !== 50) {
    throw new Error(`Expected 50 keys after cleanup, got ${keysAfter.length}`);
  }
  
  // Verify oldest keys are removed (alphabetically first)
  const sortedKeys = keysAfter.sort();
  const firstKey = sortedKeys[0];
  const lastRemovedKey = `${SCROLL_STORAGE_PREFIX}key-009`;
  
  // The first key after cleanup should be key-010 (not key-000)
  if (firstKey === `${SCROLL_STORAGE_PREFIX}key-000` || firstKey < `${SCROLL_STORAGE_PREFIX}key-010`) {
    throw new Error(`Oldest keys should be removed. First key: ${firstKey}`);
  }
  
  // Verify lastRemovedKey is not present
  if (mockStorage[lastRemovedKey] !== undefined) {
    throw new Error(`Oldest key ${lastRemovedKey} should be removed`);
  }
});

test('cleanupOldScrollKeys does nothing when limit not exceeded', () => {
  const mockStorage = {};
  
  // Fill storage with 30 keys (below limit of 50)
  for (let i = 0; i < 30; i++) {
    mockStorage[`${SCROLL_STORAGE_PREFIX}key-${i}`] = String(i * 100);
  }
  
  const keysBefore = Object.keys(mockStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
  cleanupOldScrollKeys(mockStorage);
  const keysAfter = Object.keys(mockStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
  
  // Should remain unchanged
  if (keysBefore.length !== keysAfter.length) {
    throw new Error(`Keys should not be removed when below limit. Before: ${keysBefore.length}, After: ${keysAfter.length}`);
  }
  
  // Verify all keys are still present
  for (let i = 0; i < 30; i++) {
    const key = `${SCROLL_STORAGE_PREFIX}key-${i}`;
    if (mockStorage[key] === undefined) {
      throw new Error(`Key ${key} should not be removed when below limit`);
    }
  }
});

test('cleanupOldScrollKeys handles exactly 50 keys', () => {
  const mockStorage = {};
  
  // Fill storage with exactly 50 keys (at limit)
  for (let i = 0; i < 50; i++) {
    mockStorage[`${SCROLL_STORAGE_PREFIX}key-${i.toString().padStart(3, '0')}`] = String(i * 100);
  }
  
  const keysBefore = Object.keys(mockStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
  cleanupOldScrollKeys(mockStorage);
  const keysAfter = Object.keys(mockStorage).filter((k) => k.startsWith(SCROLL_STORAGE_PREFIX));
  
  // Should remain unchanged (exactly at limit, no removal)
  if (keysBefore.length !== keysAfter.length || keysAfter.length !== 50) {
    throw new Error(`Keys at limit should not be removed. Before: ${keysBefore.length}, After: ${keysAfter.length}`);
  }
});
