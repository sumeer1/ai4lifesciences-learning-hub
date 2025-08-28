const TOPICS = ["All","ml-basics","bioinformatics","genomics","medicine","neuroscience","math","programming","tools","datasets"];
const FACETS = { type:"facet-type", format:"facet-format", level:"facet-level" };

let ALL = [];
let ACTIVE = { search:"", year:"", domain:[], type:[], format:[], level:[] };

const els = {
  topicRail: document.getElementById("topic-rail"),
  results: document.getElementById("results"),
  empty: document.getElementById("empty"),
  search: document.getElementById("search"),
  year: document.getElementById("year"),
  count: document.getElementById("count"),
  clear: document.getElementById("clear"),
  sort: document.getElementById("sort"),
  add: document.getElementById("addResourceBtn"),
  repo: document.getElementById("repoLink"),
};

(async function init(){
  ALL = await (await fetch("data/resources.json", {cache:"no-store"})).json();

  // Year options
  const years = Array.from(new Set(ALL.map(r => r.year).filter(Boolean))).sort((a,b)=>b-a);
  for (const y of years){ const o=document.createElement("option"); o.value=y; o.textContent=y; els.year.appendChild(o); }

  // Facets
  for (const [key, containerId] of Object.entries(FACETS)){
    const container = document.getElementById(containerId);
    const set = new Set(); ALL.forEach(r => (r[key]||[]).forEach(v => set.add(v)));
    [...set].sort((a,b)=>a.localeCompare(b)).forEach(v => container.appendChild(makeChip(key, v)));
  }

  // Topics
  buildTopicRail();

  // Events
  els.search.addEventListener("input", ()=>{ ACTIVE.search = els.search.value.trim().toLowerCase(); render(); syncURL(); });
  document.addEventListener("keydown", e => { if (e.key === "/" && document.activeElement !== els.search){ e.preventDefault(); els.search.focus(); }});
  els.year.addEventListener("change", ()=>{ ACTIVE.year = els.year.value; render(); syncURL(); });
  els.clear.addEventListener("click", ()=>{ resetFilters(); render(); syncURL(); });
  els.sort.addEventListener("change", ()=>{ render(); syncURL(); });

  // "+ Add resource" opens Issue Form
  const cfg = window.AI4LS_CFG || {};
  if (cfg.owner && cfg.repo){ els.repo.href = `https://github.com/${cfg.owner}/${cfg.repo}`; }
  if (els.add){
    els.addEventListener("click", ()=>{
      const label = encodeURIComponent(cfg.label || "add-resource");
      const link  = `https://github.com/${cfg.owner}/${cfg.repo}/issues/new?template=add-resource.yml&labels=${label}`;
      window.open(link, "_blank");
    });
  }

  hydrateFromURL(); render(); updateTopicRailState();
})();

function buildTopicRail(){
  els.topicRail.innerHTML = "";
  for (const t of TOPICS){
    const label = t === "All" ? "All" : t;
    const count = t === "All" ? ALL.length : ALL.filter(r => (r.domain||[]).includes(t)).length;
    const chip = document.createElement("button");
    chip.className = "topic"; chip.dataset.topic = t;
    chip.textContent = count ? `${label} (${count})` : label;
    chip.addEventListener("click", ()=>{
      const same = (ACTIVE.domain.length===1 && ACTIVE.domain[0]===t);
      ACTIVE.domain = (t==="All" || same) ? [] : [t];
      render(); syncURL(); updateTopicRailState();
    });
    els.topicRail.appendChild(chip);
  }
}
function updateTopicRailState(){
  const sel = ACTIVE.domain.length ? ACTIVE.domain[0] : "All";
  document.querySelectorAll(".topic").forEach(c => c.classList.toggle("on", c.dataset.topic === sel));
}
function makeChip(key, value){
  const el = document.createElement("span");
  el.className = "chip"; el.textContent = value; el.dataset.key = key; el.dataset.value = value;
  el.addEventListener("click", ()=>{
    const arr = ACTIVE[key]; const idx = arr.indexOf(value);
    if (idx === -1) arr.push(value); else arr.splice(idx,1);
    el.classList.toggle("on", idx === -1); render(); syncURL();
  });
  return el;
}
function resetFilters(){
  ACTIVE = { search:"", year:"", domain:[], type:[], format:[], level:[] };
  els.search.value = ""; els.year.value = "";
  document.querySelectorAll(".chip").forEach(c => c.classList.remove("on"));
  updateTopicRailState();
}
function hydrateFromURL(){
  const params = new URLSearchParams(location.search);
  els.search.value = ACTIVE.search = (params.get("q") || "");
  els.year.value   = ACTIVE.year   = (params.get("year") || "");
  const srt = params.get("sort"); if (srt) els.sort.value = srt;
  for (const k of Object.keys(FACETS)){
    const v = params.get(k); ACTIVE[k] = v ? v.split(",").filter(Boolean) : [];
  }
  const dom = params.get("domain"); ACTIVE.domain = dom ? dom.split(",").filter(Boolean) : [];
  updateTopicRailState();
}
function syncURL(){
  const p = new URLSearchParams();
  if (ACTIVE.search) p.set("q", ACTIVE.search);
  if (ACTIVE.year)   p.set("year", ACTIVE.year);
  for (const k of Object.keys(FACETS)) if (ACTIVE[k].length) p.set(k, ACTIVE[k].join(","));
  if (ACTIVE.domain.length) p.set("domain", ACTIVE.domain.join(","));
  if (els.sort.value && els.sort.value !== "year-desc") p.set("sort", els.sort.value);
  history.replaceState({}, "", p.toString() ? `?${p}` : location.pathname);
}
function matchesSearch(r){
  if (!ACTIVE.search) return true;
  const hay = [r.title, (r.creators||[]).join(" "), r.venue, String(r.year), r.abstract].join(" ").toLowerCase();
  return hay.includes(ACTIVE.search);
}
function matchesFacets(r){
  if (ACTIVE.year && String(r.year) !== String(ACTIVE.year)) return false;
  if (ACTIVE.domain.length){ const have = r.domain||[]; if (!ACTIVE.domain.some(v => have.includes(v))) return false; }
  for (const k of Object.keys(FACETS)){
    const need = ACTIVE[k]; if (!need.length) continue;
    const have = r[k] || []; const ok = need.some(v => have.includes(v));
    if (!ok) return false;
  }
  return true;
}
function render(){
  let filtered = ALL.filter(r => matchesSearch(r) && matchesFacets(r));
  const s = els.sort.value;
  filtered.sort((a,b)=>{
    if (s==='year-desc') return (b.year||0)-(a.year||0);
    if (s==='year-asc')  return (a.year||0)-(b.year||0);
    if (s==='title-asc') return String(a.title).localeCompare(String(b.title));
    return 0;
  });
  els.count.textContent = `${filtered.length} result${filtered.length!==1?"s":""}`;
  els.results.innerHTML = "";
  if (!filtered.length){ els.empty.classList.remove("hidden"); } else { els.empty.classList.add("hidden"); }
  for (const r of filtered) els.results.appendChild(card(r));
}
function card(r){
  const d = document.createElement("div"); d.className = "card";
  const link = r.url ? `<a href="${r.url}" target="_blank" rel="noopener">Open</a>` : "";
  const code = r.code ? ` • <a href="${r.code}" target="_blank" rel="noopener">Code</a>` : "";
  const creators = (r.creators||[]).join(", ");
  d.innerHTML = `<h3>${escapeHTML(r.title || r.url)}</h3>
    <div class="meta">${creators}${r.venue ? " — "+escapeHTML(r.venue) : ""} ${r.year ? "("+r.year+")" : ""} ${link}${code}</div>
    ${r.abstract ? `<p>${escapeHTML(r.abstract)}</p>` : ""}
    <div class="tags">
      ${renderTags("Domain", r.domain)} ${renderTags("Type", r.type)} ${renderTags("Format", r.format)} ${renderTags("Level", r.level)}
    </div>`;
  return d;
}
function renderTags(label, arr){ if (!arr || !arr.length) return ""; return `<span class="tag"><strong>${label}:</strong> ${arr.join(", ")}</span>`; }
function escapeHTML(s){ return (s||"").replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }
