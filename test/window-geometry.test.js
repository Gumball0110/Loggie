import test from 'node:test';
import assert from 'node:assert/strict';
import { companionBounds, panelBounds, shouldCollapsePanel } from '../desktop/window-geometry.js';

test('places the assistant panel on the right edge of the work area', () => {
  const result = panelBounds({ x: 0, y: 25, width: 1440, height: 875 });
  assert.deepEqual(result, { x: 1080, y: 25, width: 360, height: 875 });
});

test('keeps panel width within readable limits', () => {
  assert.equal(panelBounds({ x: 0, y: 0, width: 1000, height: 700 }).width, 340);
  assert.equal(panelBounds({ x: 0, y: 0, width: 3000, height: 1800 }).width, 460);
});

test('restores the companion inside the visible display', () => {
  const result = companionBounds({ x: 1440, y: 0, width: 1280, height: 800 }, { x: 9000, y: -500 });
  assert.deepEqual(result, { x: 2608, y: 0, width: 112, height: 112 });
});

test('collapses the panel after it is dragged past the dismiss threshold', () => {
  assert.equal(shouldCollapsePanel(281), false);
  assert.equal(shouldCollapsePanel(280), true);
  assert.equal(shouldCollapsePanel(260), true);
});
