export const mascotAssetPaths = Object.freeze({
  idle: '../../assets/idle.png',
  sleeping: '../../assets/sleeping.png',
  happy: '../../assets/happy.png',
  excited: '../../assets/excited.png',
});

export function resolveMascotState({ excited = false, hovering = false, inactive = false } = {}) {
  if (excited) return 'excited';
  if (hovering) return 'happy';
  if (inactive) return 'sleeping';
  return 'idle';
}
