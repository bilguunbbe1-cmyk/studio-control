const STATUS_LABEL = { ontrack: "Хэвийн", risk: "Эрсдэлтэй", late: "Хоцорсон" };
const RECEIPT_LABEL = { has_receipt: "Баримттай", no_receipt: "Баримтгүй", pending: "Pending" };
const REVIEW_LABEL = { editing: "Edit хийж байна", client_review: "Client review", approved: "Approved" };

function fmtM(n) {
  return `₮${(Number(n || 0) / 1e6).toFixed(1)} сая`;
}

function fmt(n) {
  return new Intl.NumberFormat("mn-MN").format(Math.round(n || 0));
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function table(headers, rows) {
  if (!rows.length) return `<p class="muted">Мэдээлэл алга.</p>`;
  return `
    <table>
      <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

export function printProjectReport(project, generatedBy) {
  const canSeeFinancials = project.contractAmount !== undefined;
  const now = new Date().toLocaleString("mn-MN");

  const checklistDone = project.checklist.filter((c) => c.complete).length;
  const deliverablesRows = project.deliverables.map((d) => [
    esc(d.title),
    `${d.doneCount} / ${d.totalCount}`,
    `${d.totalCount ? Math.round((d.doneCount / d.totalCount) * 100) : 0}%`,
  ]);
  const checklistRows = project.checklist.map((c) => [esc(c.label), c.complete ? "Бүрэн" : "Дутуу"]);
  const reviewRows = project.reviewItems.map((r) => [esc(r.title), esc(r.version || "—"), esc(r.editor || "—"), REVIEW_LABEL[r.reviewStatus] || r.reviewStatus]);
  const fileRows = project.fileFolders.map((f) => [esc(f.category), String(f.count), String(f.missing)]);

  const financeSection = canSeeFinancials
    ? `
    <h2>Санхүү</h2>
    <div class="grid4">
      <div><div class="label">Гэрээний дүн</div><div class="value">${fmtM(project.contractAmount)}</div></div>
      <div><div class="label">Нийт зардал</div><div class="value">${fmtM(project.spent)}</div></div>
      <div><div class="label">Gross profit</div><div class="value">${fmtM(project.grossProfit)}</div></div>
      <div><div class="label">Margin</div><div class="value">${project.marginPct}%</div></div>
    </div>
    <div class="grid4">
      <div><div class="label">Орж ирсэн</div><div class="value">${fmtM(project.received)}</div></div>
      <div><div class="label">Үлдэгдэл авлага</div><div class="value">${fmtM(Math.max(0, project.contractAmount - project.received))}</div></div>
    </div>
    <h3>Орлого</h3>
    ${table(
      ["Дүн", "Огноо", "Тэмдэглэл"],
      (project.payments || []).map((p) => [`₮${fmt(p.amount)}`, esc(p.receivedAt), esc(p.note || "—")])
    )}
    <h3>Зардлын мөрүүд</h3>
    ${table(
      ["Ангилал", "Дүн", "Баримт"],
      project.costItems.map((c) => [esc(c.category), `₮${fmt(c.amount)}`, RECEIPT_LABEL[c.receiptStatus] || c.receiptStatus])
    )}`
    : "";

  const html = `<!doctype html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<title>${esc(project.name)} — Тайлан</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, "Noto Sans", sans-serif; color: #172033; padding: 32px; max-width: 820px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 10px; border-bottom: 1px solid #e5e9f0; padding-bottom: 6px; }
  h3 { font-size: 13px; margin: 16px 0 8px; }
  .meta { color: #596174; font-size: 12px; margin-bottom: 4px; }
  .muted { color: #596174; font-size: 12px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-top: 6px; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 10px; }
  .label { color: #596174; font-size: 10px; }
  .value { font-size: 14px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e9f0; }
  th { color: #596174; font-weight: 600; font-size: 10px; text-transform: uppercase; }
  .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e9f0; color: #596174; font-size: 10px; }
  @media print {
    body { padding: 0; }
    h2 { break-after: avoid; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <h1>${esc(project.name)}</h1>
  <div class="meta">${esc(project.code)} · ${esc(project.client || "—")} · Хариуцагч: ${esc(project.lead || "—")}</div>
  <span class="badge" style="background:#eef1f6">${STATUS_LABEL[project.status] || project.status}</span>

  <h2>Тойм</h2>
  <div class="grid4">
    <div><div class="label">Явц</div><div class="value">${project.progressPct}%</div></div>
    <div><div class="label">Баримт бүрдүүлэлт</div><div class="value">${project.documentationPct}%</div></div>
    <div><div class="label">Дуусах огноо</div><div class="value">${esc(project.dueDate || "—")}</div></div>
    <div><div class="label">Checklist</div><div class="value">${checklistDone}/${project.checklist.length}</div></div>
  </div>

  <h2>Төсөл эхлэх checklist</h2>
  ${table(["Зүйл", "Төлөв"], checklistRows)}

  <h2>Deliverable төлөвлөгөө</h2>
  ${table(["Нэр", "Тоо", "Хувь"], deliverablesRows)}

  ${project.shootDate || project.callSheetTotal != null ? `
  <h2>Продакшн</h2>
  <div class="grid4">
    ${project.shootDate ? `<div><div class="label">Зураг авалт</div><div class="value">${esc(project.shootDate)}</div></div>` : ""}
    ${project.callSheetTotal != null ? `<div><div class="label">Call sheet</div><div class="value">${project.callSheetDone}/${project.callSheetTotal}</div></div>` : ""}
  </div>` : ""}

  <h2>Review pipeline</h2>
  ${table(["Гарчиг", "Хувилбар", "Эдитор", "Төлөв"], reviewRows)}

  ${financeSection}

  <h2>Файл</h2>
  ${table(["Ангилал", "Тоо", "Дутуу"], fileRows)}

  <div class="footer">Үүсгэсэн: ${esc(generatedBy || "—")} · ${esc(now)} · PXL Consulting Project Control</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
  return true;
}
