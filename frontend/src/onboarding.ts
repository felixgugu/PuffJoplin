import type { BootstrapState } from './types';

export type OnboardingDecision = 'existing-data' | 'prompt-joplin' | 'welcome';

export function onboardingDecision(state: BootstrapState): OnboardingDecision {
  if (state.noteCount > 0) return 'existing-data';
  if (state.onboardingRequired) return 'prompt-joplin';
  return 'welcome';
}
