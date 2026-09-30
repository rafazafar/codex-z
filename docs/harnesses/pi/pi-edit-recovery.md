# Pi empty-history editing and recovery

For an empty Session derived by editing the first Turn before the native file is saved, stop the candidate writer, publish the v3 native format exclusively, then cold-resume it. Preserve Model/Thinking. Resume and Fork pass through the current Thread environment. Repeated close calls wait for the same native cleanup result. Startup configuration hints apply only to verified linear empty history. Pi continues to restore nonempty history.

The lifecycle Gate uses a local SSE model, isolated temporary data, and a real CLI: `tools/gate-pi/lifecycle.real.test.mjs`. Set `CODEX_Z_PI_REAL_COMMAND` to the native command. The Gate explicitly skips when no command is supplied.

The Gate covers streaming output, cancellation, empty/retained-history edits, cold recovery, default configuration preservation, unchanged source history, and active close. Default-configuration validation does not prove arbitrary non-default configuration. It does not prove Windows behavior, independent third-party clients, or termination of arbitrary background tool processes.
