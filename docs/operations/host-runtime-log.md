# Host Runtime logs

Codex Desktop owns Host Runtime stderr and keeps only its last line. `npm start` also detaches from the terminal after startup. Runtime therefore saves a separate copy of its diagnostics to a file for investigation after a crash.

- Location: `<data-directory>/logs/host-runtime-<pid>.log`. The data directory is `CODEX_Z_DATA_DIR`, or `~/.codex-z` when unset.
- Logging is always enabled and needs no configuration. Each process writes and rotates its own file to avoid contention between Runtime processes. Each file has a 5 MiB limit and rotates to the same name with `.log.1`. Each process keeps at most one old file. If one output exceeds the limit, only the trailing complete UTF-8 characters are retained.
- Each line includes UTC time and the process ID. At startup and rotation, Runtime removes old `host-runtime-<pid>.log[.1]` files by modification time, reserves space for the current file, and limits these logs to 20 files and 50 MiB. Current files of running processes are retained, so many concurrent Runtime processes can temporarily exceed these limits. Other diagnostic logs in the directory are excluded from cleanup.
- The log directory uses `0700`; current and rotated files use `0600`. Startup also restricts existing permissions where the platform supports these permission bits.

The fork uses `CODEX_Z_*` environment variables and its own `~/.codex-z` state directory. It does not automatically import the previous product's configuration, plugins, mappings, logs, or credentials. Configure the fork explicitly; native Harness data remains owned by each Harness.

Recorded content:

- Runtime stderr diagnostics, such as `codex-z Host Runtime: ...`;
- Full stacks for uncaught exceptions and unhandled Promise rejections (`FATAL <source>: ...`). The process exits after recording them, with its original behavior;
- Runtime startup and exit code.

Short-lived subcommands, such as the delegation CLI, do not write this file. They write errors to their own stderr as their contracts require.

Log-write and cleanup failures, such as an unwritable directory, are ignored and do not affect Runtime.
