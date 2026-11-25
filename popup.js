const $ = id => document.getElementById(id);
function show(text) { $("result").textContent = text; }
async function run(task) {
  const buttons = [...document.querySelectorAll("button")]; buttons.forEach(b => b.disabled = true);
  try {await task();} catch (e) {show("操作未完成：" + e.message + "\n请在普通网页打开岗位详情，再点插件。受保护页面或跨域嵌入表单可能需要手填。");}
  finally {buttons.forEach(b => b.disabled = false);}
}
async function inject() {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  if (!tab?.id || !/^https?:/.test(tab.url || "")) throw new Error("请先打开 Handshake / 公司官网网页");
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:["content.js"]});
  return tab.id;
}
$("scan").addEventListener("click", () => run(async () => {
  const id = await inject();
  const [result] = await chrome.scripting.executeScript({target:{tabId:id},func:() => globalThis.JobContent.capture()});
  const job = JobCore.cleanJob(result.result);
  const data = await chrome.storage.local.get(["profile", "jobs"]), p = {...JobCore.defaults, ...data.profile};
  const rating = JobCore.evaluate(job,p);
  await chrome.storage.local.set({jobs:JobCore.mergeJobs(data.jobs || [],[job])});
  show(job.title + "\n匹配分 " + rating.score + " / 100（关键词评分）\n" + [...rating.rejects,...rating.reasons,...rating.warnings].join("\n") + "\n\n已保存。请到岗位列表核对标题、公司与正文；读取列表页可能混入其他岗位。");
}));
$("fill").addEventListener("click", () => run(async () => {
  const id = await inject(), {profile} = await chrome.storage.local.get("profile");
  if (!profile?.email) {show("请先在设置里填写并保存你的邮箱和基本资料。"); return;}
  const [r] = await chrome.scripting.executeScript({target:{tabId:id},func:p => globalThis.JobContent.fill(p),args:[profile]});
  show("已尝试填写 " + r.result.filled.length + " 项：\n" + (r.result.filled.join("\n") || "未发现可填写的空白基本字段") + "\n\n待手动处理：\n" + (r.result.pending.join("\n") || "请检查页面上的其他问题") + (r.result.frames ? "\n检测到嵌入框架；其中的字段可能无法填写。" : "") + "\n\n请确认页面实际保留了填写内容，再自行提交。");
}));
$("manage").addEventListener("click", () => chrome.runtime.openOptionsPage());
