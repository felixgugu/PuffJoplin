import { describe, expect, it } from 'vitest';
import { onboardingDecision } from './onboarding';
import type { BootstrapState } from './types';

const state = (changes: Partial<BootstrapState>): BootstrapState => ({
  status: 'empty',
  appVersion: '0.1.0',
  dataDir: 'C:\\PuffJoplin\\data',
  uploadToken: '',
  noteCount: 0,
  notebookCount: 1,
  joplinProfile: '',
  canImportJoplin: false,
  onboardingStatus: 'pending',
  onboardingRequired: false,
  message: '',
  ...changes,
});

describe('onboardingDecision', () => {
  it('leaves existing PuffJoplin data untouched', () => {
    expect(onboardingDecision(state({ noteCount: 3, onboardingRequired: true }))).toBe('existing-data');
  });

  it('prompts only when the backend says onboarding is required', () => {
    expect(onboardingDecision(state({ onboardingRequired: true, canImportJoplin: true }))).toBe('prompt-joplin');
  });

  it('creates a welcome note when no Joplin prompt is pending', () => {
    expect(onboardingDecision(state({ onboardingStatus: 'dismissed' }))).toBe('welcome');
    expect(onboardingDecision(state({ onboardingStatus: 'imported' }))).toBe('welcome');
  });
});
