export function getProfileReadinessStageLabel(score: number) {
  if (score >= 90) {
    return 'Launch-ready';
  }
  if (score >= 70) {
    return 'Almost ready';
  }
  if (score >= 40) {
    return 'In progress';
  }
  return 'Needs setup';
}
