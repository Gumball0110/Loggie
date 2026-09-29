const mascot = document.querySelector('#openLoggie');
const dragThreshold = 4;
let gesture = null;

mascot.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
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
  if (shouldOpen) window.loggie.togglePanel();
}

mascot.addEventListener('pointerup', finishGesture);
mascot.addEventListener('pointercancel', () => { gesture = null; });
