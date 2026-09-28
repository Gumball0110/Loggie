const COMPANION_SIZE = 112;
const PANEL_WIDTH_RATIO = 0.25;
const PANEL_MIN_WIDTH = 340;
const PANEL_MAX_WIDTH = 460;

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

export function companionBounds(workArea, savedBounds) {
  const fallback = {
    x: workArea.x + workArea.width - COMPANION_SIZE - 24,
    y: workArea.y + Math.round((workArea.height - COMPANION_SIZE) / 2),
  };
  const candidate = savedBounds && Number.isFinite(savedBounds.x) && Number.isFinite(savedBounds.y)
    ? savedBounds
    : fallback;

  return {
    width: COMPANION_SIZE,
    height: COMPANION_SIZE,
    x: clamp(Math.round(candidate.x), workArea.x, workArea.x + workArea.width - COMPANION_SIZE),
    y: clamp(Math.round(candidate.y), workArea.y, workArea.y + workArea.height - COMPANION_SIZE),
  };
}

export function panelBounds(workArea) {
  const width = clamp(
    Math.round(workArea.width * PANEL_WIDTH_RATIO),
    PANEL_MIN_WIDTH,
    Math.min(PANEL_MAX_WIDTH, workArea.width),
  );
  return {
    x: workArea.x + workArea.width - width,
    y: workArea.y,
    width,
    height: workArea.height,
  };
}

export const windowSizes = {
  companion: COMPANION_SIZE,
  panelMinimum: PANEL_MIN_WIDTH,
  panelMaximum: PANEL_MAX_WIDTH,
};
