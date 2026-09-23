/**
 * Aster House Guest Assistant - Feature Flags & Emergency Kill Switches
 * Allows operators or automated monitors to disable high-risk capabilities
 * without code deployment or downtime.
 */

export interface SystemFeatureFlags {
  groundedLlmPhrasing: boolean;
  intentClassifierLlm: boolean;
  availabilityProviderEnabled: boolean;
  opsIngestionEnabled: boolean;
  guestFeedbackEnabled: boolean;
  forceDeterministicFaqOnly: boolean;
}

export const DEFAULT_FEATURE_FLAGS: SystemFeatureFlags = {
  groundedLlmPhrasing: true,
  intentClassifierLlm: true,
  availabilityProviderEnabled: true,
  opsIngestionEnabled: true,
  guestFeedbackEnabled: true,
  forceDeterministicFaqOnly: false,
};

export class FeatureFlagManager {
  private flags: SystemFeatureFlags;

  constructor(initial: Partial<SystemFeatureFlags> = {}) {
    this.flags = { ...DEFAULT_FEATURE_FLAGS, ...initial };
  }

  getFlags(): SystemFeatureFlags {
    return { ...this.flags };
  }

  isEnabled(flag: keyof SystemFeatureFlags): boolean {
    return this.flags[flag];
  }

  setFlag(flag: keyof SystemFeatureFlags, value: boolean): void {
    this.flags[flag] = value;
  }

  reset(): void {
    this.flags = { ...DEFAULT_FEATURE_FLAGS };
  }
}

export const featureFlagManager = new FeatureFlagManager();
