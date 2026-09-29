import { mascotAssetPaths, resolveMascotState } from './mascot-state.js';

const mascot = document.querySelector('#openLoggie');
const mascotImage = document.querySelector('#mascotImage');
const dragThreshold = 4;
const excitedDuration = 160;
const sleepDelay = 60_000;
let gesture = null;
let hovering = false;
let inactive = false;
let excited = false;
let sleepTimer;
let excitedTimer;

for (const path of Object.values(mascotAssetPaths)) {
  const image = new Image();
  image.src = path;
}

function renderState() {
  const state = resolveMascotState({ excited, hovering, inactive });
  mascot.dataset.state = state;
  mascotImage.src = mascotAssetPaths[state];
}

function scheduleSleep() {
  clearTimeout(sleepTimer);
  inactive = false;
  renderState();
  sleepTimer = setTimeout(() => {
    inactive = true;
    renderState();
  }, sleepDelay);
}

function wake() {
  scheduleSleep();
}

mascot.addEventListener('pointerenter', () => {
  hovering = true;
  wake();
});

mascot.addEventListener('pointerleave', () => {
  hovering = false;
  scheduleSleep();
});

mascot.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  wake();
  mascot.setPointerCapture(event.pointerId);
  gesture = {
    pointerId: event.pointerId,
    offsetX: event.clientX,
    offsetY: event.clientY,
    startX: event.screenX,
    startY: event.screenY,
    dragged: false,
  };
});

mascot.addEventListener('pointermove', (event) => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  if (Math.hypot(event.screenX - gesture.startX, event.screenY - gesture.startY) >= dragThreshold) {
    gesture.dragged = true;
  }
  if (gesture.dragged) {
    wake();
    window.loggie.moveCompanion({
      x: event.screenX - gesture.offsetX,
      y: event.screenY - gesture.offsetY,
    });
  }
});

function finishGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const shouldOpen = !gesture.dragged;
  gesture = null;
  if (!shouldOpen) return;

  clearTimeout(excitedTimer);
  excited = true;
  renderState();
  excitedTimer = setTimeout(() => {
    excited = false;
    renderState();
    window.loggie.togglePanel();
  }, excitedDuration);
}

mascot.addEventListener('pointerup', finishGesture);
mascot.addEventListener('pointercancel', () => { gesture = null; });

scheduleSleep();
