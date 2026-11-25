/* Rule scores measure keyword fit, never a hiring probability or legal eligibility. */
(() => {
  const defaults = {
    firstName: "", lastName: "", fullName: "", email: "", phone: "", linkedin: "", website: "",
    school: "University of Southern California", major: "Economics and Data Science",
    graduationYear: 2028, targetYear: 2027, internshipsOnly: true,
    keywords: ["data", "analytics", "analyst", "economics", "finance", "research", "business intelligence", "sales"],
    locations: [], excludedCompanies: [], sources: [],
    needsSponsorship: "unknown"
  };
  const normalize = value => String(value || "").replace(/\s+/g, " ").trim();
  function safeURL(value) {
    try { const u = new URL(value); return /^(https?:)$/.test(u.protocol) && !u.username && !u.password ? u.href : ""; }
    catch { return ""; }
  }
  function canonical(value) {
    const safe = safeURL(value);
    if (!safe) return "";
    const u = new URL(safe);
    for (const key of [...u.searchParams.keys()]) if (/^(utm_|trk$|trackingId$|ref$)/i.test(key)) u.searchParams.delete(key);
    u.hash = "";
    u.searchParams.sort();
    return u.href;
  }
  function jobKey(job) { return canonical(job.url); }
  function cleanJob(raw) {
    const url = canonical(raw.url);
    const title = normalize(raw.title).slice(0, 500);
    if (!url || !title) throw new Error("每个岗位都需要 title 和有效的 http/https url。");
    return {title, url, company: normalize(raw.company).slice(0, 300), location: normalize(raw.location).slice(0, 500),
      description: String(raw.description || "").slice(0, 150000), source: normalize(raw.source || "import").slice(0, 200),
      fetchedAt: new Date().toISOString()};
  }
  function mergeJobs(existing, incoming) {
    const map = new Map(existing.map(j => [jobKey(j), j]));
    for (const raw of incoming) {
      const j = cleanJob(raw), key = jobKey(j), old = map.get(key);
      map.set(key, {...old, ...j, status: old?.status || "saved", notes: old?.notes || "", savedAt: old?.savedAt || j.fetchedAt});
    }
    return [...map.values()];
  }
  function evaluate(job, p = defaults) {
    const title = normalize(job.title), text = normalize(title + " " + job.description), lower = text.toLowerCase();
    const reasons = [], warnings = [], rejects = [];
    let score = 0;
    const note = (pattern, message, target = warnings) => { const m = text.match(pattern); if (m) target.push(message + "：「" + m[0] + "」"); return !!m; };
    if (p.excludedCompanies.some(c => normalize(c).toLowerCase() === normalize(job.company).toLowerCase())) rejects.push("公司在你的排除名单中");
    if (/\b(senior|sr\.?|principal|staff|director|vice president|manager)\b/i.test(title) && !/\bintern(ship)?\b/i.test(title)) rejects.push("标题显示为资深或管理岗位");
    const internship = /\bintern(?:ship|ships|s)?\b|\bsummer\s+(analyst|associate)\b/i.test(title);
    if (internship) {score += 25; reasons.push("标题为实习 / Summer Analyst");}
    else if (p.internshipsOnly) rejects.push("标题未明确显示为实习（可关闭“仅实习”重新查看）");
    const years = title.match(/\b20\d{2}\b/g) || [];
    if (years.includes(String(p.targetYear))) {score += 20; reasons.push("标题包含目标年份 " + p.targetYear);}
    else if (years.length) warnings.push("标题年份与目标年份不同，请核对实际实习日期：" + years.join(", "));
    else warnings.push("标题未注明实习年份，请核对日期");
    if (!/\bsummer\b/i.test(title)) warnings.push("标题未注明 Summer，请核对实习季节");
    const matches = p.keywords.filter(k => normalize(k) && lower.includes(normalize(k).toLowerCase()));
    if (matches.length) {score += Math.min(35, matches.length * 7); reasons.push("方向关键词：" + matches.join(", "));}
    else warnings.push("未匹配方向关键词");
    if (p.locations.length) {
      if (p.locations.some(l => normalize(job.location).toLowerCase().includes(normalize(l).toLowerCase()))) {score += 10; reasons.push("地点匹配偏好");}
      else warnings.push("地点未匹配偏好：" + (job.location || "未注明"));
    }
    note(/(?:must|required to|only|requires?)[^.!?]{0,65}(?:U\.?S\.?\s+citizen(?:ship|s)?|security clearance)|(?:U\.?S\.?\s+citizen(?:ship|s)?)[^.!?]{0,35}(?:required|only)/i, "公民身份 / clearance 条件需要核对");
    note(/(?:ITAR|export\s+control(?:led)?|U\.?S\.?\s+persons?)/i, "涉及出口管制条件，需要核对完整原文");
    const noSponsor = note(/(?:will not|cannot|does not|do not|unable to)[^.!?]{0,50}sponsor[^.!?]{0,65}|(?:no|without)\s+(?:visa\s+)?sponsorship[^.!?]{0,65}|sponsorship\s+(?:is\s+)?(?:not available|not offered|not provided)[^.!?]{0,65}/i, "可能不提供 sponsorship");
    if (noSponsor && p.needsSponsorship === "yes") warnings.push("你设置了需要 sponsorship：请核对是否包含当前或未来需求，以及实习资格的具体定义");
    note(/(?:CPT|OPT|F-?1)\b[^.!?]{0,80}/i, "原文提到学生工作许可");
    note(/(?:graduat\w*|class of)[^.!?]{0,100}\b20\d{2}\b[^.!?]{0,50}|\b20\d{2}\b[^.!?]{0,40}(?:graduat\w*)/i, "请与毕业年份 " + p.graduationYear + " 核对");
    note(/\b(?:master'?s?|ph\.?d\.?|doctoral)\b[^.!?]{0,45}(?:required|only)|(?:must|required)[^.!?]{0,45}\b(?:master'?s?|ph\.?d\.?|doctoral)\b/i, "可能要求研究生学历");
    note(/(?:minimum|at least|requires?|required)[^.!?]{0,30}\b[3-9]\+?\s+years?[^.!?]{0,40}/i, "可能要求较多工作经验");
    if (!normalize(job.description)) warnings.push("缺少岗位正文，无法检查资格要求");
    warnings.push("工作授权、sponsorship 与其他资格须逐条人工确认；关键词不能确定 eligibility");
    const grade = rejects.length ? "skip" : matches.length && internship ? "potential" : "review";
    return {score: Math.min(100, score), grade, reasons, warnings, rejects};
  }
  function parseSources(text) {
    return text.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => {
      const m = s.match(/^(greenhouse|lever|lever-eu):([a-zA-Z0-9_-]+)$/);
      if (!m) throw new Error("来源格式：greenhouse:公司标识 或 lever:公司标识，每行一个。");
      return {type: m[1], slug: m[2]};
    });
  }
  globalThis.JobCore = {defaults, normalize, safeURL, canonical, jobKey, cleanJob, mergeJobs, evaluate, parseSources};
})();
