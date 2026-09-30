# Large native app-server messages

Codex history-page responses can contain images and long tool outputs. Pagination limits the number of Turns, but does not guarantee that a response is smaller than 128 MiB. Host must forward these native responses in full and preserve content and pagination semantics.

`packages/host-runtime/src/remote-official-connection.ts` converts the private official WebSocket connection into an LF-delimited byte stream. This client connects only to local loopback, Unix sockets, or Windows named pipes. Managed loopback backends use a capability header. Native responses have no additional WebSocket message-size limit, consistent with stdio. This prevents large history pages from closing the connection and interrupting other requests. Request-size limits on the external Host listener are maintained separately.

`packages/protocol-core/src/jsonl.ts` searches for newlines only in newly received chunks. Frames that span chunks retain byte fragments and are joined once when the terminating newline arrives. Copy and scan costs grow linearly with input bytes. Complete frames in one chunk use subviews directly. Multiple frames, empty frames, and UTF-8 content that spans chunks preserve original bytes. An explicit `maxFrameBytes` limit applies to each frame, not each transport chunk. A trailing fragment without a terminating newline still causes an error.

This is not streaming JSON parsing. A complete frame and its parsed result still need memory proportional to the response size. Host does not truncate images, rewrite history, or hide transport failures with automatic retries.

Regression coverage is in `packages/protocol-core/test/jsonl.test.ts` and `packages/host-runtime/test/remote-official-connection.test.ts`. It covers chunk-copy volume, frame boundaries and limits, a real WebSocket response larger than 128 MiB, and later requests on the same connection.
