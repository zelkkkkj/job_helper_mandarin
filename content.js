(() => {
  function capture() {
    const nodes = [];
    function walk(x) {
      if (!x || typeof x !== "object") return;
      if (Array.isArray(x)) { x.forEach(walk); return; }
      if ([x["@type"]].flat().includes("JobPosting")) nodes.push(x);
      if (x["@graph"]) walk(x["@graph"]);
    }
    document.querySelectorAll('script[type="application/ld+json"]').forEach(s => { try {walk(JSON.parse(s.textContent));} catch {} });
    const jd = nodes[0];
    function plain(html) { const doc = new DOMParser().parseFromString(String(html || ""), "text/html"); return doc.body.textContent || ""; }
    const main = document.querySelector('[data-testid="job-description"], [data-hook="job-description"], #job-description, .job__description, .posting-page, main, [role="main"]') || document.body;
    const h1 = document.querySelector("h1");
    const location = jd?.jobLocation ? [jd.jobLocation].flat().map(l => {
      const a = l?.address; return typeof a === "string" ? a : [a?.addressLocality, a?.addressRegion, a?.addressCountry].filter(Boolean).join(", ");
    }).filter(Boolean).join("; ") : "";
    return {title: jd?.title || h1?.innerText || document.title, url: window.location.href,
      company: jd?.hiringOrganization?.name || "", location,
      description: (jd?.description ? plain(jd.description) : main.innerText || "").slice(0, 100000),
      source: window.location.hostname.includes("joinhandshake.com") ? "Handshake / 当前详情" : "当前详情"};
  }
  function fill(profile) {
    const filled = [], pending = [];
    const visible = el => !!(el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
    const block = /sponsor|authoriz|citizen|visa|permit|eligible|clearance|ethnic|race|gender|disabil|veteran|salary|compensation|criminal|consent|agree|signature|password|work experience|years of|preferred|emergency|reference|referr|previous|past|former|alternate|middle name/i;
    const norm = v => String(v || "").toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
    for (const el of document.querySelectorAll("input, select, textarea")) {
      if (!visible(el) || el.disabled || el.readOnly) continue;
      const label = norm([...[...(el.labels || [])].map(l => l.innerText),
        el.getAttribute("aria-label"), ...(el.getAttribute("aria-labelledby") || "").split(/\s+/).filter(Boolean).map(id => document.getElementById(id)?.innerText), el.name, el.id, el.placeholder].filter(Boolean).join(" "));
      const name = label.slice(0, 160) || el.type || "未命名字段";
      if (block.test(label) || el.tagName === "TEXTAREA" || el.type === "file") {pending.push(name); continue;}
      if (el.value || el.checked) continue;
      if (el.tagName !== "SELECT" && !["text", "email", "tel", "url"].includes(el.type)) continue;
      let key;
      if (/\b(first|given)\s*name\b|\bfname\b|\bfirstname\b/.test(label)) key = "firstName";
      else if (/\b(last|family|sur)\s*name\b|\bsurname\b|\blname\b|\blastname\b/.test(label)) key = "lastName";
      else if (/\bfull\s*name\b|\bfullname\b/.test(label) || /^(name\s*)+$/.test(label)) key = "fullName";
      else if (/\be\s*mail\b|\bemail\b/.test(label)) key = "email";
      else if (/\bphone\b|\btelephone\b|\bmobile\b/.test(label) && !/country|code|ext/.test(label)) key = "phone";
      else if (/\blinkedin\b/.test(label)) key = "linkedin";
      else if (/\b(personal website|portfolio|website url)\b/.test(label)) key = "website";
      else if (/\b(school|university|college)\b/.test(label) && !/high school|gpa|date|year|address|degree/.test(label)) key = "school";
      else if (/\bmajor\b|field of study/.test(label) && !/minor|second/.test(label)) key = "major";
      if (!key || !String(profile[key] || "").trim()) {if (el.required || el.getAttribute("aria-required") === "true") pending.push(name); continue;}
      const value = String(profile[key]).trim();
      try {
        if (el.tagName === "SELECT") {
          const option = [...el.options].find(o => !o.disabled && o.value && (norm(o.textContent) === norm(value) || norm(o.value) === norm(value)));
          if (!option) {pending.push(name); continue;}
          Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, option.value);
        } else Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value);
        el.dispatchEvent(new Event("input", {bubbles: true}));
        el.dispatchEvent(new Event("change", {bubbles: true}));
        if (!el.value) {pending.push(name + "（网站未接受）"); continue;}
        filled.push(name);
      } catch { pending.push(name); }
    }
    const frames = document.querySelectorAll("iframe").length;
    return {filled, pending: [...new Set(pending)], frames};
  }
  globalThis.JobContent = {capture, fill};
})();
