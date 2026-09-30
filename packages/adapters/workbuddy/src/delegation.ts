const DELEGATION_ENVIRONMENT_KEYS = [
  "CODEX_Z_CLI_PATH",
  "CODEX_Z_RUNTIME_ENDPOINT",
  "CODEX_Z_RUNTIME_TOKEN",
  "CODEX_Z_THREAD_ID",
] as const;

export const WORKBUDDY_DELEGATION_INSTRUCTIONS = `This WorkBuddy Session runs inside codex-z.
When the user requests cross-Harness agent delegation, use the executable at the CODEX_Z_CLI_PATH environment variable through your native shell tool. Start with its --help and harness list commands, then use delegate start and thread send/read/wait/cancel as documented by the CLI. Pass --format compact when reporting results. Keep the inherited CODEX_Z_RUNTIME_ENDPOINT, CODEX_Z_RUNTIME_TOKEN and CODEX_Z_THREAD_ID environment variables for all such calls; they identify this Runtime and parent Thread. Do not print or expose their values, replace the configured executable, or start delegation unless the user's request authorizes it. Native WorkBuddy Agent subagents remain separate and are not cross-Harness delegation.`;

/** Native CLI arguments that advertise the already-injected delegation environment. */
export function workBuddyDelegationArguments(
  environment: NodeJS.ProcessEnv,
  ephemeral: boolean,
): string[] {
  if (ephemeral || !DELEGATION_ENVIRONMENT_KEYS.every((key) => environment[key])) return [];
  // Runtime secrets remain in the child environment. The fixed prompt contains
  // variable names only, never their values.
  return ["--append-system-prompt", WORKBUDDY_DELEGATION_INSTRUCTIONS];
}
