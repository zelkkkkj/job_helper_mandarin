(() => {
  function plain(html) {
    let value = String(html || "");
    // Greenhouse may HTML-encode the entire description. Decode with inert documents.
    for (let i = 0; i < 3; i++) {
      const doc = new DOMParser().parseFromString(value, "text/html");
      doc.querySelectorAll("script,style").forEach(el => el.remove());
      const next = doc.body.textContent || "";
      if (next === value) return next;
      value = next;
    }
    return value;
  }
  async function getJSON(url) {
    const response = await fetch(url, {credentials: "omit", redirect: "error", signal: AbortSignal.timeout(25000)});
    if (!response.ok) throw new Error("HTTP " + response.status + "；请检查公司标识或稍后重试");
    return response.json();
  }
  async function load(source) {
    const slug = encodeURIComponent(source.slug), tag = source.type + ":" + source.slug;
    if (source.type === "greenhouse") {
      const data = await getJSON(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
      if (!Array.isArray(data.jobs)) throw new Error("返回格式不正确");
      return data.jobs.map(j => ({title:j.title,company:source.slug,location:j.location?.name || "",url:j.absolute_url,description:plain(j.content),source:tag}));
    }
    if (!["lever", "lever-eu"].includes(source.type)) throw new Error("不支持的来源");
    const base = source.type === "lever-eu" ? "https://api.eu.lever.co" : "https://api.lever.co";
    const all = [];
    for (let page = 0; page < 30; page++) {
      const jobs = await getJSON(`${base}/v0/postings/${slug}?mode=json&limit=100&skip=${page * 100}`);
      if (!Array.isArray(jobs)) throw new Error("返回格式不正确");
      all.push(...jobs.map(j => ({title:j.text,company:source.slug,location:j.categories?.location || "",url:j.hostedUrl || j.applyUrl,
        description:plain([j.descriptionPlain || j.description, ...(j.lists || []).map(l => l.text + " " + plain(l.content)), j.additionalPlain || j.additional].filter(Boolean).join("\n")),source:tag})));
      if (jobs.length < 100) return all;
    }
    throw new Error("超过 3000 个岗位或分页异常，本来源未导入；请缩小来源范围");
  }
  globalThis.JobFeeds = {load};
})();
