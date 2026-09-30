# OMP native questions and tool approval

OMP starts with native `--mode rpc-ui` and uses `extension_ui_request` / `extension_ui_response`. All conversion is in `packages/adapters/omp`; the public Adapter and Host are unchanged.

## Questions

`rpc-ui` is required. Normal `rpc` can forward UI requests from extensions, but does not create the built-in `ask` tool or connect its UI Context at startup. An extension-question event test cannot prove that a model can call `ask`. `rpc-ui` uses the same RPC protocol and enables native interactive tools. It disables PTY under OMP's own rules for external UI use.

Native `select`, `confirm`, `input`, and `editor` map to single-choice, confirmation, single-line text, and multiline text questions. `select.options` preserves native strings as response values. Matching `optionDetails[].description` values appear as option descriptions; absent descriptions support older versions. Invalid types or mismatched lengths are protocol errors. Descriptions must not attach to the wrong options.

OMP's `ask` tool combines these basic interactions for multiple questions, multiple choices, and 'Other' text. The Adapter does not merge interactions or invent a multiple-choice protocol. Each answer returns one string for the current native request. The existing public validator checks user responses. Invalid options, duplicate answers, and late answers are not sent to the native process.

Timeout returns `cancelled: true, timedOut: true`; user cancellation returns only `cancelled: true`. Both close the pending interaction. OMP decides whether to use a default answer after timeout; the Adapter does not select for the user.

## Tool approval

Native `select` options `Approve` / `Deny` map to allow once or deny, without permanent authorization. Session permissions use native `--approval-mode` values `always-ask`, `write`, and `yolo`, separately from individual approvals.

These basic paths already existed. Blank OMP question/tool-approval entries in README were stale. This change added option descriptions, timeout semantics, and regression coverage.

## Native evidence and validation limits

The inspected local version was OMP `18.0.6`; source reference commit: `b4e8e856ad40294167679a3f88417c07429fe59b`:

- [RPC mode](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/modes/rpc/rpc-mode.ts): `requestRpcSelect` emits matching `optionDetails`; dialog responses distinguish timeout from cancellation.
- [Ask tool](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/tools/ask.ts): RPC uses combined select/editor questions.
- [Permission documentation](https://github.com/can1357/oh-my-pi/blob/main/docs/approval-mode.md): OMP owns permission policy.

Focused tests cover option descriptions, invalid metadata, valid/invalid/duplicate answers, native cancellation and timeout responses, and existing approval behavior. A native OMP 18.0.6 RPC extension command also ran in an isolated temporary directory. It returned a select with optionDetails and a native success notification after a JSON choice response. This probe did not issue model requests. Synthetic process tests and native RPC probes do not prove real-model or full Desktop acceptance.

The native regression test uses `CODEX_Z_OMP_NATIVE_TEST_COMMAND` to select an installed OMP; the current wrapper is for macOS/Linux. It uses an isolated Agent directory and a localhost model fixture, creates a Session through the public Adapter, verifies that the real model request contains `ask`, triggers a Host Question from the native tool with option descriptions, and returns the Host answer to the native tool and next model request. This test failed under normal `rpc` because `ask` was missing, then passed with `rpc-ui`. It calls no external model.
