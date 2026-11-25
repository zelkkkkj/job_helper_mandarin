const $ = id => document.getElementById(id), C = JobCore;
const statuses = {saved:"已保存",preparing:"准备中",applied:"已申请",interview:"面试中",rejected:"已拒绝",withdrawn:"已放弃"};
let profile = {...C.defaults}, jobs = [];
function message(text) { $("message").textContent = text; }
function element(tag,text,cls) {const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if(cls)e.className=cls; return e;}
function list(items,cls) { const ul = element("ul",undefined,cls); for(const item of items)ul.append(element("li",item)); return ul; }
async function persist() { await chrome.storage.local.set({jobs}); }
function fail(e) {message("操作未完成：" + e.message);}
function formLoad() {
  const form = $("settings");
  for(const [key,value] of Object.entries(profile)) {
    const input = form.elements.namedItem(key); if (!input) continue;
    if(key === "sources") input.value = value.map(s => s.type + ":" + s.slug).join("\n");
    else if(input.type === "checkbox") input.checked = value;
    else input.value = Array.isArray(value) ? value.join(", ") : value;
  }
  document.querySelector("header .pill").textContent = "Summer " + profile.targetYear + " · 毕业 " + profile.graduationYear;
}
function render() {
  const root = $("jobs"); root.replaceChildren();
  const q = $("search").value.toLowerCase(), grade = $("grade").value, status = $("status").value;
  const rated = jobs.map(j => ({job:j,r:C.evaluate(j,profile)})).sort((a,b)=>b.r.score-a.r.score);
  const shown = rated.filter(({job:j,r}) => (!q || [j.title,j.company,j.location].join(" ").toLowerCase().includes(q)) && (grade === "all" || r.grade === grade) && (status === "all" || j.status === status));
  $("summary").textContent = `显示 ${shown.length} / ${jobs.length} 个岗位 · 匹配分只衡量关键词，资格需人工核对`;
  if(!shown.length) {root.append(element("div",jobs.length ? "没有匹配当前筛选条件的岗位。" : "先保存个人资料，再读取一个 Handshake 岗位，或配置公司来源开始收集。","empty")); return;}
  for(const {job:j,r} of shown) {
    const card = element("article",undefined,"job"), head = element("div",undefined,"jobhead"), info = element("div");
    info.append(element("h3",j.title),element("div",`${j.company || "公司待补充"} · ${j.location || "地点待核对"}`,"meta"));
    head.append(info,element("span",`${r.score} 分 · ${{potential:"方向匹配",review:"需要查看",skip:"规则排除"}[r.grade]}`,"pill"));
    card.append(head,list(r.rejects,"rejects"),list(r.reasons),list(r.warnings,"warnings"));
    const detail = element("details"), desc = element("pre",j.description || "未读取到正文，请去岗位官网查看。");
    detail.append(element("summary","查看保存的岗位正文与读取时间"),element("p",`${j.source} · 最近读取：${new Date(j.fetchedAt).toLocaleString()}`,"small"),desc);card.append(detail);
    const editDetails=element("details");editDetails.append(element("summary","修正岗位标题、公司、地点或正文"));
    const editFields={};for(const [key,label] of Object.entries({title:"岗位标题",company:"公司名称",location:"岗位地点",description:"岗位正文"})){
      const lab=element("label",label),input=element(key==="description"?"textarea":"input");input.value=j[key]||""; if(key==="description")input.rows=5;lab.append(input);editDetails.append(lab);editFields[key]=input;
    }
    const saveEdit=element("button","保存修正","secondary");saveEdit.addEventListener("click",async()=>{try{
      const next=C.cleanJob({...j,...Object.fromEntries(Object.entries(editFields).map(([k,v])=>[k,v.value]))});
      Object.assign(j,{title:next.title,company:next.company,location:next.location,description:next.description});await persist();render();
    }catch(e){fail(e);}});editDetails.append(saveEdit);card.append(editDetails);
    const actions=element("div",undefined,"actions"), link=element("a","打开岗位 / 申请入口 ↗");
    link.href=C.safeURL(j.url);link.target="_blank";link.rel="noopener noreferrer";
    const select=element("select");select.setAttribute("aria-label",j.title+" 申请进度");
    for(const [key,label] of Object.entries(statuses)){const o=element("option",label);o.value=key;select.append(o);} select.value=j.status;
    select.addEventListener("change",async()=>{try{j.status=select.value;await persist();render();message(j.status==="applied"?"已标记为已申请。此标记是你的手动记录，请以招聘网站成功提示为准。":"进度已保存。");}catch(e){fail(e);}});
    const remove=element("button","移除","quiet");remove.addEventListener("click",async()=>{try{jobs=jobs.filter(x=>C.jobKey(x)!==C.jobKey(j));await persist();render();}catch(e){fail(e);}});
    actions.append(link,select,remove);card.append(actions);
    const notesLabel=element("label","申请备注（离开输入框时保存）"),notes=element("textarea");notes.rows=2;notes.value=j.notes || "";
    notes.addEventListener("change",async()=>{try{j.notes=notes.value;await persist();}catch(e){fail(e);}});notesLabel.append(notes);card.append(notesLabel);root.append(card);
  }
}
document.querySelectorAll("[data-panel]").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".panel").forEach(p=>p.hidden=p.id!==b.dataset.panel);}));
$("settings").addEventListener("submit",async event=>{
  event.preventDefault();try{
    const form=event.target,next={...profile};
    for(const key of Object.keys(C.defaults)) {
      const input=form.elements.namedItem(key);if(!input)continue;
      if(key==="sources")next[key]=C.parseSources(input.value);
      else if(["keywords","locations","excludedCompanies"].includes(key))next[key]=input.value.split(/[,，]/).map(s=>s.trim()).filter(Boolean);
      else if(input.type==="checkbox")next[key]=input.checked;
      else if(input.type==="number")next[key]=Number(input.value);
      else next[key]=input.value.trim();
    }
    if(next.sources.length>30)throw new Error("每次最多配置 30 个公司来源。");
    await chrome.storage.local.set({profile:next});profile=next;formLoad();render();message("资料和规则已保存。所有岗位已按新规则重新评分。");
  }catch(e){fail(e);}
});
for(const id of ["search","grade","status"])$(id).addEventListener("input",render);
$("refresh").addEventListener("click",async()=>{
  if(!profile.sources.length){message("请先到“个人资料与规则”添加公司岗位来源。");return;}
  const button=$("refresh");button.disabled=true;
  const errors=[];let count=0;
  try {
    for(let i=0;i<profile.sources.length;i++){
      const s=profile.sources[i];message(`读取 ${i+1}/${profile.sources.length}：${s.type}:${s.slug}…`);
      try {const incoming=await JobFeeds.load(s);jobs=C.mergeJobs(jobs,incoming);await persist();count+=incoming.length;render();}
      catch(e){errors.push(s.type+":"+s.slug+"："+e.message);}
    }
    message(`读取完成：获取 ${count} 条岗位（包含可能已存在的岗位）；当前共 ${jobs.length} 条。${errors.length?"\n以下来源失败，已有记录保留：\n"+errors.join("\n"):""}`);
  }catch(e){fail(e);}finally{button.disabled=false;}
});
$("export").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify({version:1,jobs},null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=element("a");
  a.href=url;a.download="internship-jobs-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
});
$("import").addEventListener("change",async event=>{
  try{
    const file=event.target.files[0];if(!file)return;if(file.size>5*1024*1024)throw new Error("导入文件不能超过 5 MB。");
    const data=JSON.parse(await file.text()),rows=Array.isArray(data)?data:data.jobs;
    if(!Array.isArray(rows)||rows.length>5000)throw new Error("需要岗位数组或 {jobs:[...]}，最多 5000 条。");
    const validated=rows.map(C.cleanJob); // Validate every row before mutating state.
    const merged=C.mergeJobs(jobs,validated),previous=new Set(jobs.map(C.jobKey));
    const originals=new Map(rows.map(row=>[C.jobKey(row),row]));
    for(const j of merged)if(!previous.has(C.jobKey(j))){const raw=originals.get(C.jobKey(j));j.status=Object.hasOwn(statuses,raw.status)?raw.status:"saved";j.notes=String(raw.notes||"").slice(0,20000);j.fetchedAt=Number.isFinite(Date.parse(raw.fetchedAt))?raw.fetchedAt:j.fetchedAt;}
    await chrome.storage.local.set({jobs:merged});jobs=merged;render();message("已导入并去重；已有岗位的申请状态和备注已保留。");
  }catch(e){fail(e);}finally{event.target.value="";}
});
async function init(){const data=await chrome.storage.local.get(["profile","jobs"]);profile={...C.defaults,...data.profile};jobs=data.jobs || [];formLoad();render();}
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=="local")return;if(changes.jobs){jobs=changes.jobs.newValue||[];render();}if(changes.profile){profile={...C.defaults,...changes.profile.newValue};formLoad();render();}});
init().catch(fail);
