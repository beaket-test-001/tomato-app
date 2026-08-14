export function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function recentDateKeys(days = 7, now = new Date()) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    return dateKey(date);
  });
}

export function gardenStage(progress, target) {
  const ratio = progress / target;
  if (ratio >= 1) return { emoji: '🍅', title: 'Harvest ready', copy: 'You reached today’s focus goal.' };
  if (ratio >= 0.75) return { emoji: '🌿', title: 'Almost ripe', copy: 'One more focused push will finish the patch.' };
  if (ratio >= 0.5) return { emoji: '🌱', title: 'Growing steadily', copy: 'Your focused sessions are taking root.' };
  if (ratio > 0) return { emoji: '🌱', title: 'First sprout', copy: 'The garden has started growing.' };
  return { emoji: '🪴', title: 'Ready to plant', copy: 'Complete a focus session to grow today’s garden.' };
}

export function clampDailyTarget(value) {
  return Math.min(12, Math.max(1, Number(value) || 4));
}
