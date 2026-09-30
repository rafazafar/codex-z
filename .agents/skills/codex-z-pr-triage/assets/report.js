// Browser-only presentation. The renderer validates the embedded report before publication.
(() => {
  const $ = (id) => document.getElementById(id);
  const verdicts = [
    {
      key: "ACCEPT",
      label: "Merge recommended",
      className: "accept",
      hint: "Useful goal; implementation matches benefit",
    },
    {
      key: "SIMPLIFY",
      label: "Merge after simplification",
      className: "simplify",
      hint: "Retain benefit and remove unnecessary mechanisms",
    },
    {
      key: "DISCUSS",
      label: "Discussion needed",
      className: "discuss",
      hint: "Clarify scenario or product decision first",
    },
    {
      key: "DECLINE",
      label: "Do not merge",
      className: "decline",
      hint: "Insufficient added benefit or excessive long-term cost",
    },
  ];
  const ciLabels = {
    pass: "Pass",
    fail: "Failed",
    pending: "Pending",
    cancelled: "Cancelled",
    skipped: "Skipped",
    none: "No checks",
    unknown: "Unknown",
    mixed: "Mixed states",
  };
  const conflictLabels = {
    clear: "No conflicts",
    conflicting: "Conflicts present",
    unknown: "Conflict unknown",
  };

  function element(tag, className = "", text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function link(label, href, className = "") {
    const node = element("a", className, label);
    const url = new URL(href);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
      throw new Error("Report contains unsafe link");
    }
    node.href = url.href;
    node.target = "_blank";
    node.rel = "noopener noreferrer";
    return node;
  }

  function integration(pr) {
    const row = element("div", "integration");
    row.setAttribute("aria-label", "Integration reference; does not affect grouping");
    const tone =
      pr.integration.ci === "pass" ? "good" : pr.integration.ci === "fail" ? "warn" : "neutral";
    row.append(
      element("span", `status ${tone}`, `CI ${ciLabels[pr.integration.ci]}`),
      element(
        "span",
        `status ${pr.integration.conflict === "conflicting" ? "warn" : "neutral"}`,
        conflictLabels[pr.integration.conflict],
      ),
    );
    return row;
  }

  function textSection(title, text) {
    const section = element("section", "detail-section");
    section.append(element("h3", "", title), element("p", "", text));
    return section;
  }

  function listSection(title, items) {
    const section = element("section", "detail-section");
    const list = element("ul");
    list.append(...items.map((item) => element("li", "", item)));
    section.append(element("h3", "", title), list);
    return section;
  }

  try {
    const report = JSON.parse($("report-data").textContent);
    let view = "board";
    const issues = report.issues ?? [];
    const counts = Object.fromEntries(
      verdicts.map((verdict) => [
        verdict.key,
        report.prs.filter((pr) => pr.verdict === verdict.key).length,
      ]),
    );

    function labeledText(label, text, className = "card-copy") {
      const node = element("p", className);
      node.append(element("strong", "", `${label} · `), document.createTextNode(text));
      return node;
    }

    function processingStatus(item) {
      return element(
        "p",
        "snapshot-details",
        item.source
          ? `Processed source snapshot · ${item.source.collectedAt}`
          : item.source === null
            ? "Incomplete · next incremental triage will retry"
            : "Historical assessment · no incremental processing record",
      );
    }

    function followUp(item) {
      return [
        processingStatus(item),
        ...(item.nextActor ? [textSection("Next actor", item.nextActor)] : []),
        ...(item.replyDraft ? [textSection("Reply draft · unpublished", item.replyDraft)] : []),
      ];
    }

    function showIssueDetail(issue) {
      const heading = element("h2", "", issue.title);
      heading.id = "detail-title";
      const body = $("detail-body");
      body.replaceChildren(
        heading,
        element("p", "original-title", `Original title · ${issue.originalTitle}`),
        element("div", "mono muted", `${issue.repository}#${issue.number} · Issue`),
        textSection("Problem", issue.summary),
        textSection("Assessment basis", issue.reason),
        textSection("Category / priority", `${issue.category} / ${issue.priority}`),
        listSection("Required information", issue.missingInfo),
        textSection("Next step", issue.action),
        ...followUp(issue),
      );
      const related = element("section", "detail-section");
      related.append(element("h3", "", "Related items · not a duplicate-close decision"));
      for (const item of issue.related) {
        const row = element("p");
        row.append(link(item.url, item.url), document.createTextNode(` — ${item.reason}`));
        related.append(row);
      }
      body.append(related);
      for (const item of issue.evidence) {
        const row = element("div", "evidence-file");
        row.append(
          item.url ? link(item.label, item.url) : element("span", "", item.label),
          element("small", "", item.detail),
          element("span", "file-revision", item.revision),
        );
        body.append(row);
      }
      body.append(
        link("Open Issue ↗", issue.url, "button"),
        element(
          "p",
          "detail-note",
          "Read-only advice and unpublished drafts; no comments, label changes, or closure.",
        ),
      );
      $("detail").showModal();
      $("detail").scrollTop = 0;
    }

    function showDetail(pr) {
      if (pr.category) return showIssueDetail(pr);
      const verdict = verdicts.find((item) => item.key === pr.verdict);
      const badge = element("div", verdict.className);
      badge.append(element("span", "verdict-pill", `${verdict.label} · ${verdict.key}`));
      const heading = element("h2", "", pr.title);
      heading.id = "detail-title";
      const body = $("detail-body");
      body.replaceChildren(
        badge,
        heading,
        ...(pr.originalTitle
          ? [element("p", "original-title", `Original title · ${pr.originalTitle}`)]
          : []),
        element("div", "mono muted", `${pr.repository}#${pr.number}`),
        element(
          "p",
          "snapshot-details mono",
          `BASE ${pr.baseSha ?? "Unknown"} · HEAD ${pr.headSha ?? "Unknown"}`,
        ),
        ...(pr.effect ? [textSection("Effect", pr.effect)] : []),
        textSection("Value", pr.value),
        textSection("Assessment reason", pr.reason),
        textSection("Implementation scope", pr.scope),
        textSection("Maintenance cost", pr.cost),
      );
      if (pr.simplifications.length)
        body.append(listSection("Suggested simplifications", pr.simplifications));
      if (pr.questions.length) body.append(listSection("Questions to answer", pr.questions));
      body.append(textSection("Next step", pr.action), ...followUp(pr));
      const evidence = element("section", "detail-section");
      evidence.append(element("h3", "", "Key evidence"));
      for (const item of pr.evidence) {
        const file = element("div", "evidence-file mono");
        file.append(
          item.url ? link(item.label, item.url) : element("span", "", item.label),
          element("small", "", item.detail),
          element("span", "file-revision", `Revision / source: ${item.revision}`),
        );
        evidence.append(file);
      }
      if (!pr.evidence.length)
        evidence.append(
          element(
            "p",
            "muted",
            "Evidence unavailable; see reasons and questions for specific gaps.",
          ),
        );
      const status = textSection("Integration reference · not a hard gate", pr.integration.note);
      status.append(
        integration(pr),
        element("small", "muted", `Collected at ${pr.integration.collectedAt}`),
      );
      const actions = element("div", "drawer-actions");
      actions.append(link("Open PR ↗", pr.url, "button"));
      body.append(
        evidence,
        status,
        actions,
        element(
          "div",
          "detail-note",
          "Assessment advice only; no approve, merge, or comments. Links and verdicts reflect the generated snapshot. Maintainers decide merge.",
        ),
      );
      $("detail").showModal();
      $("detail").scrollTop = 0;
    }

    function detailButton(pr, className) {
      const button = element("button", className, "Assessment details →");
      button.setAttribute("aria-label", `View ${pr.repository}#${pr.number} assessment details`);
      button.addEventListener("click", () => showDetail(pr));
      return button;
    }

    function card(pr) {
      const node = element("article", "card");
      const meta = element("div", "card-meta");
      meta.append(
        link(`#${pr.number}`, pr.url, "pr-number mono"),
        element("span", "scope-tag", pr.repository),
      );
      const next = element("div", "next");
      next.append(
        element("span", "next-label", "Next step"),
        element("span", "next-text", pr.action),
      );
      const hasEffect = typeof pr.effect === "string";
      node.append(
        meta,
        element("h3", "", pr.title),
        ...(pr.originalTitle ? [element("p", "card-original", pr.originalTitle)] : []),
        labeledText("Effect", hasEffect ? pr.effect : pr.value, "card-copy card-effect"),
        ...(hasEffect ? [labeledText("Value", pr.value, "card-copy card-value")] : []),
        labeledText("Assessment", pr.reason, "card-copy card-reason"),
        next,
      );
      node.append(
        element("p", "snapshot-details mono", `HEAD ${pr.headSha?.slice(0, 8) ?? "Unknown"}`),
      );
      if (report.schemaVersion === 2) node.append(processingStatus(pr));
      if ($("show-ci").checked) node.append(integration(pr));
      const footer = element("div", "card-footer");
      const stats = pr.stats
        ? `${pr.stats.files} files · +${pr.stats.additions} / −${pr.stats.deletions}`
        : "Change statistics unknown";
      footer.append(element("span", "mono", stats), detailButton(pr, "detail-button"));
      node.append(footer);
      return node;
    }

    function issueCard(issue) {
      const node = element("article", "card issue-card");
      node.append(
        link(`${issue.repository}#${issue.number}`, issue.url, "mono"),
        element("h3", "", issue.title),
        labeledText("Problem", issue.summary),
        labeledText("Assessment", issue.reason),
        labeledText("Next step", `${issue.nextActor}: ${issue.action}`),
        processingStatus(issue),
      );
      const footer = element("div", "card-footer");
      footer.append(
        element("span", "", `${issue.category} · ${issue.priority}`),
        detailButton(issue, "detail-button"),
      );
      node.append(footer);
      return node;
    }

    function renderTable(prs) {
      const table = element("table");
      const head = element("thead");
      const headRow = element("tr");
      const labels = [
        "PR / repository",
        "Merge recommendation",
        "Effect / value",
        "Assessment reason",
        ...($("show-ci").checked ? ["CI / conflict · auxiliary"] : []),
        "Next step",
        "Details",
      ];
      for (const label of labels) {
        const cell = element("th", "", label);
        cell.scope = "col";
        headRow.append(cell);
      }
      head.append(headRow);
      const body = element("tbody");
      for (const pr of prs) {
        const row = element("tr");
        const identity = element("td");
        identity.append(
          link(`${pr.repository}#${pr.number}`, pr.url, "mono"),
          element("span", "table-title", pr.title),
          ...(pr.originalTitle ? [element("span", "table-original", pr.originalTitle)] : []),
        );
        const verdict = verdicts.find((item) => item.key === pr.verdict);
        const badge = element("td", verdict.className);
        badge.append(element("span", "verdict-pill", verdict.label));
        const summary = element("td");
        summary.append(
          labeledText("Effect", pr.effect ?? pr.value, "table-copy"),
          ...(pr.effect ? [labeledText("Value", pr.value, "table-copy")] : []),
        );
        row.append(identity, badge, summary, element("td", "", pr.reason));
        if ($("show-ci").checked) {
          const cell = element("td", "table-ci");
          cell.append(integration(pr));
          row.append(cell);
        }
        const action = element("td");
        action.append(detailButton(pr, "table-open"));
        row.append(element("td", "", pr.action), action);
        body.append(row);
      }
      if (!prs.length) {
        const row = element("tr");
        const cell = element("td", "muted", "No matching PRs.");
        cell.colSpan = labels.length;
        row.append(cell);
        body.append(row);
      }
      table.append(head, body);
      $("table-view").replaceChildren(table);
    }

    function render() {
      const query = $("search").value.trim().toLowerCase().replace(/^#/u, "");
      const prs = report.prs
        .filter((pr) =>
          `${pr.repository}#${pr.number} ${pr.title} ${pr.originalTitle ?? ""} ${pr.effect ?? ""} ${pr.value} ${pr.reason}`
            .toLowerCase()
            .includes(query),
        )
        .sort((a, b) => {
          const order = a.number - b.number || a.repository.localeCompare(b.repository);
          return $("sort").value === "asc" ? order : -order;
        });
      $("board").replaceChildren();
      for (const verdict of verdicts) {
        const items = prs.filter((pr) => pr.verdict === verdict.key);
        const column = element("section", `column ${verdict.className}`);
        column.setAttribute("aria-label", verdict.label);
        const head = element("div", "column-head");
        const heading = element("h2", "column-label");
        heading.append(element("span", "dot"), document.createTextNode(verdict.label));
        head.append(
          heading,
          element(
            "span",
            "column-count",
            query ? `${items.length} / ${counts[verdict.key]}` : counts[verdict.key],
          ),
          element("span", "column-token mono", verdict.key),
        );
        const list = element("div", "card-list");
        list.append(...items.map(card));
        if (!items.length)
          list.append(element("div", "empty", query ? "No matching PRs" : "No PRs in this group"));
        column.append(head, element("p", "column-description", verdict.hint), list);
        $("board").append(column);
      }
      renderTable(prs);
      $("board").hidden = view !== "board";
      $("table-view").hidden = view !== "table";
      $("board-tab").setAttribute("aria-pressed", String(view === "board"));
      $("table-tab").setAttribute("aria-pressed", String(view === "table"));
      $("results").textContent =
        `Showing ${prs.length} / ${report.prs.length} assessed PRs · CI/conflicts do not decide column`;
      const matches = issues
        .filter((issue) =>
          `${issue.repository}#${issue.number} ${issue.title} ${issue.originalTitle} ${issue.summary} ${issue.reason}`
            .toLowerCase()
            .includes(query),
        )
        .sort(
          (a, b) =>
            ($("sort").value === "asc" ? 1 : -1) *
            (a.number - b.number || a.repository.localeCompare(b.repository)),
        );
      $("issue-list").replaceChildren(...matches.map(issueCard));
      $("issue-results").textContent = `Showing ${matches.length} / ${issues.length} Issues`;
      $("issues-section").hidden = report.schemaVersion === 1 && issues.length === 0;
    }

    $("report-scope").textContent = `${report.repositories.join(" · ")} — ${report.scope}`;
    $("completeness").textContent = report.complete
      ? "Collection complete · read-only snapshot"
      : "Partial results · read-only snapshot";
    if (!report.complete) {
      $("collection-note").hidden = false;
      const errors = element("ul");
      errors.append(...report.errors.map((error) => element("li", "", error)));
      $("collection-note").append(
        element(
          "p",
          "",
          "This report has these collection gaps; incomplete items do not advance incremental processing:",
        ),
        errors,
      );
    }
    const total = element("span", "total");
    total.append(
      document.createTextNode("Assessed "),
      element("strong", "", report.prs.length),
      document.createTextNode(` PRs / ${issues.length} Issues / skipped ${report.skipped.length}`),
    );
    $("summary").append(total);
    for (const verdict of verdicts) {
      const item = element("span", `summary-item ${verdict.className}`);
      item.append(
        element("span", "dot tone"),
        document.createTextNode(verdict.label),
        element("strong", "", counts[verdict.key]),
      );
      $("summary").append(item);
    }
    $("generated-time").textContent = new Date(report.generatedAt).toLocaleString("en-US", {
      hour12: false,
    });
    $("generated-time").dateTime = report.generatedAt;
    $("skipped-summary").textContent = `Skipped · ${report.skipped.length} items`;
    if (!report.skipped.length) $("skipped-list").append(element("p", "", "No skipped items."));
    for (const pr of report.skipped) {
      const item = element("div", "skipped-item");
      item.append(
        link(`${pr.repository}#${pr.number}`, pr.url, "mono"),
        element("span", "", pr.title),
        element("span", "muted", pr.reason),
      );
      $("skipped-list").append(item);
    }
    for (const repository of report.repositories)
      $("repository-links").append(
        link(`${repository} PR list ↗`, `https://github.com/${repository}/pulls`),
        link(`${repository} Issue list ↗`, `https://github.com/${repository}/issues`),
      );
    $("search").addEventListener("input", render);
    $("sort").addEventListener("change", render);
    $("show-ci").addEventListener("change", render);
    $("board-tab").addEventListener("click", () => {
      view = "board";
      render();
    });
    $("table-tab").addEventListener("click", () => {
      view = "table";
      render();
    });
    $("close-detail").addEventListener("click", () => $("detail").close());
    $("detail").addEventListener("click", (event) => {
      if (event.target !== $("detail")) return;
      const rect = $("detail").getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        $("detail").close();
    });
    let toastTimer;
    $("export").disabled = false;
    $("export").addEventListener("click", () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "codex-z-pr-report.json";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      $("toast").textContent = "Current assessment snapshot exported; GitHub was not accessed";
      $("toast").hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        $("toast").hidden = true;
      }, 3200);
    });
    render();
    $("load-notice").hidden = true;
  } catch (error) {
    $("load-notice").hidden = false;
    $("load-notice").textContent =
      `Cannot display report: ${error.message}. Check JSON and run the render script again.`;
    $("export").disabled = true;
  }
})();
