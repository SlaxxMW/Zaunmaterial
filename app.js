(() => {
  "use strict";

  // --- Airbag: zeigt JS-Fehler sofort im Toast (damit Tabs/Dropdowns nicht "still" sterben)
  window.addEventListener("error", (e)=>{
    try{
      console.error("[Zaunplaner JS-Error]", e.error || e.message || e);
      const t=document.getElementById("toast");
      if(t){
        t.style.display="block";
        t.textContent="⚠️ JS-Fehler: " + String(e.message||e.error||e);
      }
    }catch(_){}
  });
  window.addEventListener("unhandledrejection", (e)=>{
    try{
      console.error("[Zaunplaner Promise-Error]", e.reason || e);
      const t=document.getElementById("toast");
      if(t){
        t.style.display="block";
        t.textContent="⚠️ JS-Fehler: " + String(e.reason||e);
      }
    }catch(_){}
  });



  const STORAGE_KEY = "zaunteam_zaunplaner_state";
  const LEGACY_KEYS = ["js_zaunmaterial_deluxe_v1_1","js_zaunmaterial_deluxe_v1_2","js_zaunmaterial_deluxe_v1_3","js_zaunmaterial_deluxe_v1_0"];

  const DEFAULT_HEIGHTS = [60,80,100,120,140,160,180,200];
  const PANEL_W = 2.50;

  const ZAUNTEAM_FARBEN = ["Anthrazit (RAL 7016)","Schwarz (RAL 9005)","Grau (RAL 7030/7035)","Grün","Weiß","Verzinkt / Natur","Holz Natur","Holz Lasur"];
  const HOLZARTEN = ["—","Lärche","Douglasie","Kiefer","Fichte","Eiche"];
  const WPC_VARIANTEN = ["—","glatt","geriffelt","co-extrudiert"];

  const el = (id) => document.getElementById(id);
  const toastEl = el("toast");
  function toast(a,b="") {
    toastEl.style.display="block";
    toastEl.textContent = b ? (a + " — " + b) : a;
    setTimeout(()=> toastEl.style.display="none", 2200);
  }
  const fmt = (n) => {
    const x = Number(n);
    if(!Number.isFinite(x)) return "0";
    return (Math.round(x*100)/100).toString().replace(".", ",");
  };
  const toNum = (v, d=0) => {
    if(v==null) return d;
    const s = String(v).trim().replace(",", ".");
    const x = Number(s);
    return Number.isFinite(x) ? x : d;
  };
  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36).slice(3);
  const nowISO = () => new Date().toISOString();

  function escapeHtml(s) {
    return String(s||"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

    const APP_VERSION = "1.4.27";
  const APP_BUILD = "2025-12-19";
let state = { version:"1.4.27", selectedProjectId:null, projects:[] };

  function blankProject(name) {
    return {
      id: uid(),
      title: name || "Neuer Kunde",
      createdAt: nowISO(),
      plannedDate: "",
      phone: "",
      email: "",
      addr: "",
      objAddr: "",
      customer: {
        length: "", height:160, system:"Doppelstab", color:"Anthrazit (RAL 7016)",
        woodType:"", wpcType:"", slopeType:"flat", slopePct:"", corners:0,
        concreteMode:"sacks", concreteValue:"", note:"", privacy:"no", privacyLen:"", gateType:"none", gates:[]
      },
      chef: { bagger:"no", ramme:"no", handbohr:"no", schubkarre:"no", haenger:"no", note:"", materials:[], photos:[] },
      status:"Entwurf"
    };
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    updateStatusPill();
  }

  function migrateLegacy() {
    const stable = localStorage.getItem(STORAGE_KEY);
    if(stable) {
      try {
        const s = JSON.parse(stable);
        if(s && Array.isArray(s.projects)) { state = {...state, ...s, version:APP_VERSION}; return; }
      } catch(e){}
    }
    for(const k of LEGACY_KEYS) {
      const raw = localStorage.getItem(k);
      if(!raw) continue;
      try {
        const s = JSON.parse(raw);
        if(Array.isArray(s.projects) && s.projects.length) {
          const converted = s.projects.map(p => {
            const np = blankProject(p.title || p.name || "Projekt");
            np.id = p.id || np.id;
            np.createdAt = p.createdAt || np.createdAt;
            np.plannedDate = p.plannedDate || "";
            np.phone = p.phone || "";
            np.email = p.email || "";
            np.addr = p.addr || "";
            np.objAddr = p.objAddr || "";
            if(p.plan) {
              np.customer.length = p.plan.length || "";
              np.customer.height = Number(p.plan.height) || 160;
              np.customer.system = p.plan.system || "Doppelstab";
              np.customer.color = p.plan.color || "Anthrazit (RAL 7016)";
              np.customer.woodType = p.plan.woodType || "";
              np.customer.slopeType = p.plan.slopeType || "flat";
              np.customer.slopePct = p.plan.slopePct || "";
              np.customer.corners = Number(p.plan.corners)||0;
              np.customer.concreteMode = p.plan.concreteMode || "sacks";
              np.customer.concreteValue = p.plan.concreteValue || "";
            }
            if(Array.isArray(p.items)) {
              const banned = ["zinkspray","schnur","bodenhülsen","bodenhuelsen","markierungsspray","zink spray","pfosten","eckpfosten","endpfosten","matten","elemente","u-leisten","uleisten","torleisten","beton"];
              np.chef.materials = p.items.filter(it => {
                const n = String(it.name||"").toLowerCase();
                return !banned.some(b=>n.includes(b));
              }).map(it => ({
                id: it.id || uid(),
                name: it.name || "",
                qty: toNum(it.qty, 0),
                unit: it.unit || "Stk",
                note: it.note || ""
              }));
            }
            return np;
          });
          state.projects = converted;
          state.selectedProjectId = (s.selectedProjectId && converted.some(p=>p.id===s.selectedProjectId)) ? s.selectedProjectId : ((converted[0] && converted[0].id) ? converted[0].id : null);
          save();
          toast("Daten übernommen", "aus älterer Version");
          return;
        }
      } catch(e){}
    }
    const demo = blankProject("Demo – Kunde Beispiel");
    demo.plannedDate = "2025-12-16";
    state.projects = [demo];
    state.selectedProjectId = demo.id;
    save();
  }

  function currentProject() {
    return state.projects.find(p=>p.id===state.selectedProjectId) || null;
  }

  function updateStatusPill() {
    const p = currentProject();
    el("statusPill").textContent = p ? (`aktiv: ${p.title} • ${p.status}`) : "kein Kunde";
    const vp = el("verPill");
    if(vp){
      const v = (state && state.version) ? state.version : APP_VERSION;
      vp.textContent = "v" + v;
      vp.title = "Zaunplaner v" + v + " • Build " + APP_BUILD;
    }
  }

  // Header Refresh (safe alias)
  function refreshHeader(){
    updateStatusPill();
  }


  // Tabs
  function setTab(name) {
    document.querySelectorAll(".tabBtn").forEach(b=>b.classList.toggle("active", b.dataset.tab===name));
    document.querySelectorAll(".panel.tab").forEach(p=>p.style.display = (p.dataset.tab===name) ? "" : "none");
  }
  // Kunde UI: Liste <-> Bearbeiten
  function showCustomerList(){
    const lv=el("kundenListView"), ev=el("kundenEditView");
    if(lv) lv.style.display="block";
    if(ev) ev.style.display="none";
    state.selectedProjectId = null;
    const ps = el("projSel");
    if(ps) ps.value="";
    save(); refreshHeader();
  }
  function showCustomerEdit(){
    const lv=el("kundenListView"), ev=el("kundenEditView");
    if(lv) lv.style.display="none";
    if(ev) ev.style.display="block";
    refreshHeader();
  }


  document.querySelectorAll(".tabBtn").forEach(b=>b.addEventListener("click", ()=> setTab(b.dataset.tab)));
  setTab("kunde");
  showCustomerList();

  // Fill
  function fillHeights(sel, heights=DEFAULT_HEIGHTS) {
    const s = sel || el("kHeight");
    if(!s) return;
    s.innerHTML="";
    heights.forEach(h => {
      const o=document.createElement("option");
      o.value=String(h);
      o.textContent=`${h} cm`;
      s.appendChild(o);
    });
  }
  function fillSelect(sel, arr, defVal) {
    sel.innerHTML="";
    arr.forEach(v => {
      const o=document.createElement("option");
      o.value=v; o.textContent=v;
      sel.appendChild(o);
    });
    if(defVal!=null) sel.value=defVal;
  }

  // Projects UI
  const pName=el("pName"), pCreated=el("pCreated"), pDate=el("pDate"), pPhone=el("pPhone"), pEmail=el("pEmail"), pAddr=el("pAddr"), pObj=el("pObj");
  const projSel=el("projSel"), sortSel=el("sortSel"), projCards=el("projCards"), projCountPill=el("projCountPill");

  function refreshProjectSelectors() {
    const list=[...state.projects];
    // sort
    if(sortSel && sortSel.value==="name") list.sort((a,b)=>(a.title||"").localeCompare(b.title||"","de"));
    if(sortSel && sortSel.value==="date") list.sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||""));
    if(sortSel && sortSel.value==="status") list.sort((a,b)=>(a.status||"").localeCompare(b.status||"","de"));

    const ps = el("projSel");
    if(ps){
      ps.innerHTML = "";
      const o0=document.createElement("option");
      o0.value="";
      o0.textContent="— Kunden auswählen —";
      ps.appendChild(o0);

      list.forEach(p=>{
        const o=document.createElement("option");
        o.value=p.id;
        o.textContent=`${p.title}${p.plannedDate?(" • "+p.plannedDate):""}`;
        ps.appendChild(o);
      });
      ps.value = state.selectedProjectId || "";
    }

    if(projCards) projCards.innerHTML="";
    const pc = el("projCountPill");
    if(pc) pc.textContent = String(state.projects.length);
  }

  el("btnAdd").addEventListener("click", ()=>{
    const name=(pName.value||"").trim() || "Neuer Kunde";
    const p = blankProject(name);
    if(pCreated && (pCreated.value||"").trim()) p.createdAt = (pCreated.value.trim()+"T12:00:00.000Z");
    p.plannedDate = pDate.value || "";
    p.phone = (pPhone.value||"").trim();
    p.email = (pEmail ? (pEmail.value||"").trim() : "");
    p.addr = (pAddr.value||"").trim();
    p.objAddr = (pObj.value||"").trim();
    state.projects.unshift(p);
    state.selectedProjectId = p.id;
    pName.value=""; if(pCreated) pCreated.value=""; pDate.value=""; pPhone.value=""; if(pEmail) pEmail.value=""; pAddr.value=""; pObj.value="";
    state.selectedProjectId = p.id;
    save(); refreshAll();
    showCustomerEdit();
    toast("Kunde erstellt", p.title);
    setTimeout(()=>{ try{ el("kLen").focus(); }catch(_){} }, 120);
  });

  if(el("btnCall")){
    el("btnCall").addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      callPhone(p.phone || pPhone.value || "");
    });
  }

  if(el("btnMail")){
    el("btnMail").addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      sendEmail(p.email || (pEmail ? pEmail.value : "") || "", `Zaunprojekt: ${p.title}`, customerWhatsText(p));
    });
  }


  el("btnDel").addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return;
    if(!confirm(`Kunde wirklich löschen?

${p.title}`)) return;
    state.projects = state.projects.filter(x=>x.id!==p.id);
    state.selectedProjectId = (state.projects[0] && state.projects[0].id) ? state.projects[0].id : null;
    save(); refreshAll();
    toast("Gelöscht");
  });

  sortSel.addEventListener("change", refreshProjectSelectors);
  projSel.addEventListener("change", ()=>{
    state.selectedProjectId = projSel.value || null;
    save(); refreshAll();
    if(state.selectedProjectId) showCustomerEdit(); else showCustomerList();
  });


  const btnOpenCustomer = el("btnOpenCustomer");
  const btnBackToList = el("btnBackToList");
  if(btnOpenCustomer){
    btnOpenCustomer.addEventListener("click", ()=>{
      const id = (projSel && projSel.value) ? projSel.value : "";
      if(!id){ toast("Hinweis","Bitte erst einen Kunden auswählen"); return; }
      state.selectedProjectId = id;
      save(); refreshAll();
      showCustomerEdit();
      setTimeout(()=>{ try{ el("kLen").focus(); }catch(_){} }, 120);
    });
  }
  if(btnBackToList){
    btnBackToList.addEventListener("click", ()=>{
      showCustomerList();
    });
  }
// Kunde
  let kCreated=null, kPlanned=null, kPhone=null, kEmail=null;
  kCreated=el("kCreated"); kPlanned=el("kPlanned"); kPhone=el("kPhone"); kEmail=el("kEmail");
  const kLen=el("kLen"), kHeight=el("kHeight"), kSystem=el("kSystem"), kColor=el("kColor"), kPrivacy=el("kPrivacy"), kPrivacyLen=el("kPrivacyLen"), kWood=el("kWood"), kWpc=el("kWpc");
  const kSlopeType=el("kSlopeType"), kSlopePct=el("kSlopePct"), kCorners=el("kCorners"), kConcreteMode=el("kConcreteMode"), kConcreteVal=el("kConcreteVal"), kNote=el("kNote");
  const kundeKpi=el("kundeKpi");

  const dateFromIso = (iso) => String(iso||"").slice(0,10);
  const isoFromDate = (d) => {
    const s=String(d||"").trim();
    if(!s) return "";
    return (/^\d{4}-\d{2}-\d{2}$/.test(s)) ? (s+"T12:00:00.000Z") : s;
  };

  function persistProjectMeta(){
    const p=currentProject(); if(!p) return;
    if(kCreated && (kCreated.value||"").trim()) p.createdAt = isoFromDate(kCreated.value);
    if(kPlanned) p.plannedDate = kPlanned.value || "";
    if(kPhone) p.phone = (kPhone.value||"").trim();
    if(kEmail) p.email = (kEmail.value||"").trim();
    save();
  }
  
  function bindProjectMetaAutosave(){
    [kCreated,kPlanned,kPhone,kEmail].forEach(x=>{
      if(!x) return;
      x.addEventListener("input", persistProjectMeta);
      x.addEventListener("change", persistProjectMeta);
    });
  }
  bindProjectMetaAutosave();

  function togglePrivacyDependent(){
    if(!kPrivacy || !kPrivacyLen) return;
    const on = (kPrivacy.value === "yes");
    kPrivacyLen.disabled = !on;
    if(!on) kPrivacyLen.value = "";
  }
  if(kPrivacy){ kPrivacy.addEventListener("change", ()=>{ togglePrivacyDependent(); persistCustomer(); }); }

  // Tore (Varianten)
  const kGateType=el("kGateType");
  const gateVariants=el("gateVariants");
  const gateRows=el("gateRows");
  const btnGateAdd=el("btnGateAdd");
  const btnGateClear=el("btnGateClear");


  function clampInt(v, lo=0, hi=99) {
    const n=Math.trunc(Number(v));
    if(!Number.isFinite(n)) return lo;
    return Math.max(lo, Math.min(hi, n));
  }
  function setCorners(v){ kCorners.value = String(clampInt(v)); }
  el("kCornersMinus").addEventListener("click", ()=>{ setCorners(clampInt(kCorners.value)-1); persistCustomer(); });
  el("kCornersPlus").addEventListener("click", ()=>{ setCorners(clampInt(kCorners.value)+1); persistCustomer(); });
  kCorners.addEventListener("change", ()=>{ setCorners(kCorners.value); persistCustomer(); });

  function updateConcretePlaceholder(){ kConcreteVal.placeholder = (kConcreteMode.value==="m3") ? "Auto (m³)" : "Auto (Sack)"; }
  kConcreteMode.addEventListener("change", ()=>{ updateConcretePlaceholder(); persistCustomer(); });

  function toggleMaterialDependent(){
    const sys = kSystem.value;
    const woodOn = (sys==="Holz");
    const wpcOn  = (sys==="WPC");
    kWood.disabled = !woodOn;
    kWpc.disabled = !wpcOn;
    if(!woodOn) kWood.value="—";
    if(!wpcOn)  kWpc.value="—";
  }
  kSystem.addEventListener("change", ()=>{ toggleMaterialDependent(); persistCustomer(); });

  function togglePrivacyDependent(){
    if(!kPrivacy || !kPrivacyLen) return;
    const on = (kPrivacy.value==="yes");
    kPrivacyLen.disabled = !on;
    if(!on) kPrivacyLen.value="";
  }
  if(kPrivacy){
    kPrivacy.addEventListener("change", ()=>{ togglePrivacyDependent(); persistCustomer(); });
  }


  function persistCustomer() {
    const p=currentProject(); if(!p) return;
    const c=p.customer;
    c.length=(kLen.value||"").trim();
    c.height=Number(kHeight.value)||160;
    c.system=kSystem.value;
    c.color=kColor.value;
    c.woodType=(c.system==="Holz") ? ((kWood.value==="—")?"":kWood.value) : "";
    c.wpcType=(c.system==="WPC") ? ((kWpc.value==="—")?"":kWpc.value) : "";
    c.slopeType=kSlopeType.value;
    c.slopePct=(kSlopePct.value||"").trim();
    c.corners=clampInt(kCorners.value);
    c.concreteMode=kConcreteMode.value;
    c.privacy = (kPrivacy ? (kPrivacy.value||"no") : (c.privacy||"no"));
    c.privacyLen = (c.privacy==="yes") ? ((kPrivacyLen ? (kPrivacyLen.value||"") : "").trim()) : "";
    c.note=(kNote.value||"").trim();
    ensureGateDefaults(c);
    if(kGateType) c.gateType = kGateType.value || c.gateType || "none";
    if(c.gateType==="none") c.gates = [];
    c.concreteValue="";
    try{
      const cc = computeConcrete(c);
      c.concreteValue = concreteDisplayValue(c, cc);
      c.concreteAuto = cc;
    }catch(_){ c.concreteAuto = null; }
    renderConcreteAutoUI(c);
    ensureChefAutoMaterials(p);
    save();
    refreshKpi();
    refreshChefPill();
  }

  [kLen,kHeight,kSystem,kColor,kPrivacy,kPrivacyLen,kWood,kWpc,kSlopeType,kSlopePct,kConcreteVal,kNote].forEach(x=>{
    x.addEventListener("input", persistCustomer);
    x.addEventListener("change", persistCustomer);
  });

  function computeTotals(c){
    const lengthM=Math.max(0, toNum(c.length,0));
    const panels=lengthM ? Math.ceil(lengthM/PANEL_W) : 0;
    const posts=panels ? (panels+1) : 0;
    const corners=clampInt(c.corners||0);
    const cornerPosts=corners;
    const postStrips=posts ? (posts+corners) : 0;
    return {lengthM, panels, posts, cornerPosts, postStrips};
  }
  function sysLabel(c){
    const h=Number(c.height)||160;
    const base = (c.system==="Doppelstab")?"Doppelstab‑Matten":(c.system==="Aluminium")?"Alu‑Elemente":(c.system==="Holz")?"Holz‑Elemente":(c.system==="WPC")?"WPC‑Elemente":(c.system==="Diagonal Geflecht")?"Diagonal‑Geflecht":(c.system==="Tornado")?"Tornado‑Zaun":(c.system==="Elektrozaun")?"Elektrozaun":"Zaun‑Elemente";
    return `${base} 2,50m • ${h} cm`;
  }

  // Tore (Varianten)
  function ensureGateDefaults(c){
    if(!c) return;
    if(!c.gateType) c.gateType="none";
    if(!Array.isArray(c.gates)) c.gates=[];
  }
  function gateTypeLabel(t){
    return ({gate1:"1‑flügelig", gate2:"2‑flügelig", gate3:"3‑flügelig", slide:"Schiebetor", none:"kein Tor"})[t] || (t||"Tor");
  }
  function gateSummary(c){
    ensureGateDefaults(c);
    if(!c || c.gateType==="none") return {total:0, rows:[], text:""};
    const rows=(c.gates||[]).map(g=>({
      height:Number(g.height)||160,
      widthCm: clampInt((g.widthCm!=null ? g.widthCm : (g.width!=null ? g.width : 125)), 50, 400),
      qty: clampInt((g.qty!=null ? g.qty : (g.count!=null ? g.count : 1)), 0, 20),
    })).filter(g=>g.qty>0);
    const total=rows.reduce((s,g)=>s+g.qty,0);
    const text=rows.map(g=>`H${g.height} / B${g.widthCm}cm × ${g.qty}`).join(" | ");
    return {total, rows, text};
  }


  function computeConcrete(c){
    const t = computeTotals(c);
    const g = gateSummary(c);
    const gateCount = Number(g.total||0);
    const gateHoles = gateCount*2; // Torpfosten (2 pro Tor)
    const normalHoles = (Number(t.posts||0) + Number(t.cornerPosts||0));
    const sacks = (normalHoles*1.5) + (gateHoles*3);
    const m3 = (normalHoles*0.025) + (gateHoles*0.05);
    return {normalHoles, gateHoles, totalHoles: normalHoles+gateHoles, gateCount, sacks, m3};
  }
  function concreteDisplayValue(c, cc){
    const lengthM = Math.max(0, toNum(c.length,0));
    if(!lengthM) return "";
    if((c.concreteMode||"sacks")==="m3") return fmtN(cc.m3, 3);
    return fmtN(cc.sacks, 1);
  }
  function concreteHintText(c, cc){
    const lengthM = Math.max(0, toNum(c.length,0));
    if(!lengthM) return "Beton wird automatisch berechnet, sobald die Zaunlänge gesetzt ist.";
    const parts = [];
    parts.push(`Auto: ${cc.totalHoles} Löcher`);
    if(cc.gateHoles>0) parts.push(`(normal ${cc.normalHoles}, Torpfosten ${cc.gateHoles})`);
    else parts.push(`(normal ${cc.normalHoles})`);
    parts.push(`→ ${fmtN(cc.sacks,1)} Sack / ${fmtN(cc.m3,3)} m³`);
    return parts.join(" ");
  }
  function renderConcreteAutoUI(c){
    if(!kConcreteVal) return;
    try{
      kConcreteVal.readOnly = true;
      const cc = computeConcrete(c);
      kConcreteVal.value = concreteDisplayValue(c, cc);
      const h = el("kConcreteAutoHint");
      if(h) h.textContent = concreteHintText(c, cc);
    }catch(_){ }
  }

  function refreshKpi(){
    const p=currentProject(); if(!p) return;
    const c=p.customer;
    renderConcreteAutoUI(c);
    const t=computeTotals(c);
    const ok=!!(c.length||"").trim();
    const pill=el("kundePill");
    pill.textContent = ok ? "gesetzt" : "leer";
    pill.className = "pill " + (ok ? "good" : "");
    el("kundeTitle").textContent = `👤 Kunde: ${p.title}`;
    if(kCreated) kCreated.value = dateFromIso(p.createdAt||"");
    if(kPlanned) kPlanned.value = p.plannedDate || "";
    if(kPhone) kPhone.value = p.phone || "";
    if(kEmail) kEmail.value = p.email || "";
    kundeKpi.innerHTML="";
    if(!ok) return;
    const add = (txt)=>{ const sp=document.createElement("span"); sp.className="pill"; sp.innerHTML=txt; kundeKpi.appendChild(sp); };
    add(`Matten/Elemente: <b>${t.panels}</b>`);
    add(`Pfosten: <b>${t.posts}</b>`);
    if(t.cornerPosts) add(`Eckpfosten: <b>${t.cornerPosts}</b>`);
    const g=gateSummary(c);
    if(g.total) add(`Tore: <b>${g.total}</b>`);
    add(`Pfostenleisten: <b>${t.postStrips}</b>`);
  }

  function upsertMat(list, name, qty, unit, note){
    const key=String(name||"").toLowerCase();
    const it=list.find(x=>String(x.name||"").toLowerCase()===key);
    if(it){ it.qty=Number(qty)||0; it.unit=unit||"Stk"; if(note) it.note=note; }
    else list.unshift({id:uid(), name, qty:Number(qty)||0, unit:unit||"Stk", note:note||""});
  }

  el("btnKCalc").addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return;
    const c=p.customer;
    const t=computeTotals(c);
    if(!t.lengthM) return toast("Länge fehlt","Bitte Zaunlänge eingeben");
    const mats=p.chef.materials;
    upsertMat(mats, "Zaun‑Übersicht", 1, "Stk", `${fmt(t.lengthM)} m • ${c.height} cm • ${c.system} • ${c.color}${(c.system==="Holz"&&c.woodType)?(" • "+c.woodType):""}${(c.system==="WPC"&&c.wpcType)?(" • "+c.wpcType):""}`);
    upsertMat(mats, sysLabel(c), t.panels, "Stk", "gesamt");
    upsertMat(mats, "Pfosten", t.posts, "Stk", "gesamt");
    if(t.cornerPosts) upsertMat(mats, "Eckpfosten", t.cornerPosts, "Stk", "gesamt");
    {
      const g=gateSummary(c);
      if(g.total) upsertMat(mats, `Tor (${gateTypeLabel(c.gateType)})`, g.total, "Stk", g.text||"");
    }
    upsertMat(mats, "Pfostenleisten", t.postStrips, "Stk", "gesamt");
    if((c.privacy||"no")==="yes"){
      let pm = toNum(c.privacyLen, 0);
      if(!pm && t.lengthM) pm = t.lengthM;
      if(pm>0) upsertMat(mats, "Sichtschutz", pm, "m", "Kunde");
    }
    {
      const cc = computeConcrete(c);
      const unit=(c.concreteMode==="m3")?"m³":"Sack";
      const qty=(c.concreteMode==="m3")?cc.m3:cc.sacks;
      upsertMat(mats, "Beton", qty, unit, `Auto: ${cc.totalHoles} Löcher` + (cc.gateHoles?` (normal ${cc.normalHoles}, Torpfosten ${cc.gateHoles})`:` (normal ${cc.normalHoles})`));
    }
    save();
    refreshChefUI();
    toast("Übernommen","→ Chef‑Materialliste");
    setTab("chef");
  });

  function customerWhatsText(p){
    const c=p.customer;
    const t=computeTotals(c);
    const lines=[];
    lines.push(`ZAUN – ${p.title}`);
    if(p.createdAt) lines.push(`Erstellt: ${(p.createdAt||"").slice(0,10)}`);
    if(p.plannedDate) lines.push(`Ausführung: ${p.plannedDate}`);
    if(p.phone) lines.push(`Tel: ${p.phone}`);
    if(p.email) lines.push(`E‑Mail: ${p.email}`);
    if(p.addr) lines.push(`Adresse: ${p.addr}`);
    if(p.objAddr) lines.push(`Objekt: ${p.objAddr}`);
    lines.push("");
    if(t.lengthM) lines.push(`• Länge: ${fmt(t.lengthM)} m`);
    if(c.height) lines.push(`• Höhe: ${c.height} cm`);
    if(c.system){
      let sys=c.system;
      if(c.system==="Holz" && c.woodType) sys += ` (${c.woodType})`;
      if(c.system==="WPC" && c.wpcType) sys += ` (${c.wpcType})`;
      lines.push(`• System: ${sys}`);
    }
    if(c.color) lines.push(`• Farbe: ${c.color}`);
    if((c.privacy||"no")==="yes"){
      let pm = toNum(c.privacyLen, 0);
      if(!pm && t.lengthM) pm = t.lengthM;
      if(pm>0) lines.push(`• Sichtschutz: ja (${fmt(pm)} m)`);
    }
    const g=gateSummary(c);
    if(g.total){
      lines.push(`• Tore: ${gateTypeLabel(c.gateType)} (${g.total} Stk)`);
      g.rows.forEach(r=>lines.push(`  - H${r.height} / B${r.widthCm}cm × ${r.qty}`));
    }
    const slopeTxt=({flat:"gerade",slope:"abschüssig",hang:"am Hang",steep:"steil"})[c.slopeType] || "gerade";
    if(c.slopeType && c.slopeType!=="flat") lines.push(`• Gelände: ${slopeTxt}${(c.slopePct||"").trim()?(" ("+c.slopePct.trim()+"%)"):""}`);
    if(clampInt(c.corners||0)>0) lines.push(`• Ecken: ${clampInt(c.corners||0)}`);
    const cc = computeConcrete(c);
    const cv = concreteDisplayValue(c, cc);
    if(cv) lines.push(`• Beton: ${cv} ${(c.concreteMode==="m3")?"m³":"Sack"}`);
    lines.push("");
    if(t.lengthM){
      lines.push("Material (Übersicht):");
      lines.push(`- Matten/Elemente: ${t.panels} Stk`);
      lines.push(`- Pfosten: ${t.posts} Stk`);
      if(t.cornerPosts) lines.push(`- Eckpfosten: ${t.cornerPosts} Stk`);
      lines.push(`- Pfostenleisten: ${t.postStrips} Stk`);
      if((c.privacy||"no")==="yes"){
        let pm = toNum(c.privacyLen, 0);
        if(!pm && t.lengthM) pm = t.lengthM;
        if(pm>0) lines.push(`- Sichtschutz: ${fmt(pm)} m`);
      }
      if(cv) lines.push(`- Beton: ${cv} ${(c.concreteMode==="m3")?"m³":"Sack"}`);
    }
    if(c.note){
      lines.push("");
      lines.push("Notiz:");
      lines.push(c.note);
    }
    return lines.join("\n");
}

  async function shareText(text, title){
    try{
      if(navigator.share){ await navigator.share({title:title||"Zaunplaner", text}); return; }
    }catch(e){}
    try{ await navigator.clipboard.writeText(text); toast("Kopiert","in Zwischenablage"); }
    catch(e){ prompt("Kopieren:", text); }
  }

  function openWhatsAppText(text){
    const url = "https://wa.me/?text=" + encodeURIComponent(String(text||""));
    try{
      const w = window.open(url, "_blank");
      return !!w;
    }catch(_){ return false; }
  }


  // -------------------------------------------------------
  // Fotos: ZIP-Download (Desktop-Fallback)
  // - WhatsApp Desktop/Web erlaubt Anhänge nicht per Link -> wir liefern ein Fotos.zip
  // -------------------------------------------------------
  const _crcTable = (()=> {
    const t = new Uint32Array(256);
    for (let i=0;i<256;i++){
      let c=i;
      for (let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1);
      t[i]=c>>>0;
    }
    return t;
  })();
  function crc32(u8){
    let c = 0xFFFFFFFF;
    for(let i=0;i<u8.length;i++){
      c = _crcTable[(c ^ u8[i]) & 0xFF] ^ (c>>>8);
    }
    return (c ^ 0xFFFFFFFF)>>>0;
  }
  function u16(n){ const a=new Uint8Array(2); a[0]=n&255; a[1]=(n>>>8)&255; return a; }
  function u32(n){ const a=new Uint8Array(4); a[0]=n&255; a[1]=(n>>>8)&255; a[2]=(n>>>16)&255; a[3]=(n>>>24)&255; return a; }
  function concatU8(chunks){
    let len=0; for(const c of chunks) len += c.length;
    const out=new Uint8Array(len);
    let off=0;
    for(const c of chunks){ out.set(c, off); off += c.length; }
    return out;
  }
  function encodeUtf8(s){ return new TextEncoder().encode(String(s||"")); }

  function buildZipStore(files){
    // files: [{name, dataU8, mtimeDate}]
    const localParts=[];
    const centralParts=[];
    let offset=0;

    const dtToDos = (d)=>{
      const dt = d instanceof Date ? d : new Date();
      const year = Math.max(1980, dt.getFullYear());
      const month = dt.getMonth()+1;
      const day = dt.getDate();
      const hour = dt.getHours();
      const min = dt.getMinutes();
      const sec = Math.floor(dt.getSeconds()/2);
      const dosTime = (hour<<11) | (min<<5) | sec;
      const dosDate = ((year-1980)<<9) | (month<<5) | day;
      return {dosTime, dosDate};
    };

    for(const f of files){
      const name = encodeUtf8(f.name);
      const data = f.dataU8;
      const {dosTime, dosDate} = dtToDos(f.mtimeDate);
      const crc = crc32(data);
      const compSize = data.length;
      const uncompSize = data.length;

      // Local file header
      // signature 0x04034b50
      const lh = concatU8([
        u32(0x04034b50),
        u16(20),           // version needed
        u16(0),            // flags
        u16(0),            // compression (0=store)
        u16(dosTime),
        u16(dosDate),
        u32(crc),
        u32(compSize),
        u32(uncompSize),
        u16(name.length),
        u16(0)             // extra len
      ]);

      localParts.push(lh, name, data);

      // Central directory header
      const ch = concatU8([
        u32(0x02014b50),
        u16(20),           // version made by
        u16(20),           // version needed
        u16(0),            // flags
        u16(0),            // compression
        u16(dosTime),
        u16(dosDate),
        u32(crc),
        u32(compSize),
        u32(uncompSize),
        u16(name.length),
        u16(0),            // extra len
        u16(0),            // comment len
        u16(0),            // disk start
        u16(0),            // int attrs
        u32(0),            // ext attrs
        u32(offset)        // local header offset
      ]);
      centralParts.push(ch, name);

      offset += lh.length + name.length + data.length;
    }

    const centralDir = concatU8(centralParts);
    const localDir = concatU8(localParts);

    const eocd = concatU8([
      u32(0x06054b50),
      u16(0), u16(0),
      u16(files.length),
      u16(files.length),
      u32(centralDir.length),
      u32(localDir.length),
      u16(0)
    ]);

    return new Blob([localDir, centralDir, eocd], {type:"application/zip"});
  }

  async function downloadInternPhotosZip(p){
    const ph = (p && p.chef && Array.isArray(p.chef.photos)) ? p.chef.photos : [];
    if(!ph.length) return toast("Keine Fotos", "im Chef‑Tab gespeichert");
    const files=[];
    const max = Math.min(60, ph.length);
    for(let i=0;i<max;i++){
      const x = ph[i];
      if(!x || !x.dataUrlSmall) continue;
      const safeName = fileSafe(x.name || `Foto_${i+1}.jpg`);
      const res = await fetch(x.dataUrlSmall);
      const ab = await res.arrayBuffer();
      files.push({name:safeName, dataU8:new Uint8Array(ab), mtimeDate:new Date()});
    }
    if(!files.length) return toast("Keine Fotos", "konnten gelesen werden");
    const zipBlob = buildZipStore(files);
    const url = URL.createObjectURL(zipBlob);
    const a=document.createElement("a");
    a.href=url;
    a.download = fileSafe(`${(p && p.title) ? p.title : "Zaunplaner"}_Fotos.zip`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
    toast("Download", "Fotos.zip erstellt");
  }

  async function dataUrlToFile(dataUrl, filename, mime){
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const type = mime || blob.type || "image/jpeg";
    return new File([blob], filename, { type });
  }

  async function shareInternWithPhotos(p){
    const text = chefWhatsText(p);
    const ph = (p && p.chef && Array.isArray(p.chef.photos)) ? p.chef.photos : [];

    // Wenn Fotos vorhanden sind: iPhone/iPad Share-Sheet nutzen (Fotos teilen),
    // ABER Text vorher in die Zwischenablage kopieren, weil WhatsApp bei "Text+Files"
    // manchmal nicht in der Auswahl erscheint.
    if(ph.length && navigator.share){
      try{
        const files = [];
        const max = Math.min(6, ph.length);
        for(let i=0;i<max;i++){
          const x = ph[i];
          if(!x || !x.dataUrlSmall) continue;
          const rawName = x.name || `Foto_${i+1}.jpg`;
          const safeName = String(rawName).replace(/[\\/:*?"<>|]+/g,"_");
          // WhatsApp mag am zuverlässigsten echte JPG/PNG; type kommt aus x.type
          files.push(await dataUrlToFile(x.dataUrlSmall, safeName, x.type));
        }

        if(files.length && (!navigator.canShare || navigator.canShare({ files }))){
          // Text kopieren (dann in WhatsApp einfügen)
          try{ await navigator.clipboard.writeText(text); }catch(_){}
          await navigator.share({ title:"Intern Fotos", files });
          toast("Fotos teilen", "Text ist kopiert → in WhatsApp einfügen");
          return;
        }
      }catch(e){}
    }

    // Desktop/Browser-Fallback: WhatsApp Web mit Text öffnen (Fotos lassen sich dort nicht automatisch anhängen)
    if(openWhatsAppText(text)){
      try{ await navigator.clipboard.writeText(text); }catch(_){}
      if(ph.length){
        try{ await downloadInternPhotosZip(p); }catch(_){}
        toast("WhatsApp geöffnet", "Text kopiert + Fotos.zip geladen (bitte manuell anhängen)");
      }else{
        toast("WhatsApp geöffnet", "Text kopiert");
      }
      return;
    }

    // Letzter Fallback
    await shareText(text, "Intern");
    if(ph.length) toast("Hinweis", "Fotos sind im Backup.json enthalten (WhatsApp‑Text ist kopiert).");
  }

  async function shareCustomerToWhatsApp(p){
    const text = customerWhatsText(p);
    if(openWhatsAppText(text)){
      try{ await navigator.clipboard.writeText(text); }catch(_){}
      return;
    }
    await shareText(text, "Kundenübersicht");
  }


  function downloadText(text, filename, mime="text/plain"){
    const blob=new Blob([text], {type:mime+";charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 800);
  }
  function fileSafe(name){ return String(name||"Datei.txt").replace(/[\/:*?"<>|]+/g,"_").trim(); }

  function callPhone(raw){
    const cleaned = String(raw||"").trim();
    if(!cleaned) { toast("Telefon fehlt","Bitte Telefonnummer eintragen"); return; }
    const tel = cleaned.replace(/[^0-9+]/g,"");
    try { window.location.href = `tel:${tel}`; }
    catch(e){ toast("Kann nicht anrufen", String(e && e.message || e)); }
  }

  function sendEmail(rawEmail, subject="", body=""){
    const email = String(rawEmail||"").trim();
    if(!email){ toast("E‑Mail fehlt","Bitte E‑Mail eintragen"); return; }
    const to = email.replace(/\s+/g,"");
    const q = [];
    if(subject) q.push("subject="+encodeURIComponent(subject));
    if(body) q.push("body="+encodeURIComponent(body));
    const href = "mailto:"+encodeURIComponent(to) + (q.length?("?"+q.join("&")):"");
    try { window.location.href = href; }
    catch(e){ toast("Kann keine E‑Mail öffnen", String(e && e.message || e)); }
  }
  function sendMailAny(subject="", body=""){
    const q = [];
    if(subject) q.push("subject="+encodeURIComponent(subject));
    if(body) q.push("body="+encodeURIComponent(body));
    const href = "mailto:" + (q.length?("?"+q.join("&")):"");
    try { window.location.href = href; }
    catch(e){ toast("Kann keine E‑Mail öffnen", String(e && e.message || e)); }
  }



  el("btnKWhats").addEventListener("click", async ()=>{ const p=currentProject(); if(!p) return; await shareCustomerToWhatsApp(p); });

  if(el("btnKDown")){ el("btnKDown").addEventListener("click", ()=>{ const p=currentProject(); if(!p) return; downloadText(customerWhatsText(p), fileSafe(`${p.title}_Kunde.txt`)); }); }

  if(el("btnKCall")){
    el("btnKCall").addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      callPhone(p.phone || "");
    });
  }

  if(el("btnKMail")){
    el("btnKMail").addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      sendEmail(p.email || (el("kEmail")?el("kEmail").value:"") || "", `Zaunprojekt: ${p.title}`, customerWhatsText(p));
    });
  }

  // Gate UI (Varianten)
  const GATE_QTYS = Array.from({length:11}, (_,i)=>i); // 0..10
  const GATE_HEIGHTS = [60,80,100,120,140,160,180,200];
  function gateDefaultRow(c){
    let h = Number(c.height)||160;
    h = Math.round(h/20)*20;
    h = Math.max(60, Math.min(200, h));
    return {height:h, widthCm:125, qty:1};
  }
  function renderGateUI(){
    const p=currentProject(); if(!p) return;
    const c=p.customer; ensureGateDefaults(c);
    if(!kGateType || !gateVariants || !gateRows) return;
    kGateType.value = c.gateType || "none";
    const active = (kGateType.value !== "none");
    gateVariants.style.display = active ? "" : "none";
    if(!active){ gateRows.innerHTML=""; return; }
    if(c.gates.length===0) c.gates=[gateDefaultRow(c)];
    gateRows.innerHTML="";
    c.gates.forEach((g, idx)=>gateRows.appendChild(buildGateRow(g, idx)));
  }
  function buildGateRow(g, idx){
    const row=document.createElement("div");
    row.className="gateRow";
    row.dataset.idx=String(idx);
    row.innerHTML = `
      <div>
        <label>Tor‑Höhe</label>
        <select class="gateH"></select>
      </div>
      <div>
        <label>Breite (cm)</label>
        <input class="gateW" list="gateWidthList" inputmode="numeric" placeholder="80 / 100 / 125 / 150 / 200" />
      </div>
      <div>
        <label>Menge</label>
        <select class="gateQ"></select>
      </div>
      <div class="gateAct">
        <button class="btn bad" type="button" title="Variante löschen">✕</button>
      </div>
    `;
    const selH=row.querySelector(".gateH");
    fillHeights(selH, GATE_HEIGHTS);
    const hh = Math.max(60, Math.min(200, Math.round((Number(g.height)||160)/20)*20));
    selH.value=String(hh);

    const inpW=row.querySelector(".gateW");
    inpW.value=String(clampInt((g.widthCm!=null ? g.widthCm : (g.width!=null ? g.width : 125)), 50, 400));

    const selQ=row.querySelector(".gateQ");
    fillSelect(selQ, GATE_QTYS.map(String), String(clampInt((g.qty!=null ? g.qty : (g.count!=null ? g.count : 1)), 0, 20)));

    const sync = ()=>{ persistGatesFromUI(); };
    [selH, inpW, selQ].forEach(elm=>{
      elm.addEventListener("input", sync);
      elm.addEventListener("change", sync);
    });

    row.querySelector(".gateAct button").addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      const c=p.customer; ensureGateDefaults(c);
      const i=Number(row.dataset.idx)||0;
      c.gates.splice(i,1);
      if(c.gates.length===0) c.gates=[gateDefaultRow(c)];
      save(); renderGateUI(); refreshKpi();
    });

    return row;
  }
  function persistGatesFromUI(){
    const p=currentProject(); if(!p) return;
    const c=p.customer; ensureGateDefaults(c);
    if(!gateRows) return;
    const rows=[...gateRows.querySelectorAll(".gateRow")];
    c.gates = rows.map(r=>{
      const hEl = r.querySelector(".gateH");
      const wEl = r.querySelector(".gateW");
      const qEl = r.querySelector(".gateQ");
      const h = Number(hEl && hEl.value) || 160;
      const w = clampInt((wEl && wEl.value) || "", 50, 400);
      const q = clampInt((qEl && qEl.value) || "", 0, 20);
      return {height:h, widthCm:w, qty:q};
    });
    try{
      const cc = computeConcrete(c);
      c.concreteValue = concreteDisplayValue(c, cc);
      c.concreteAuto = cc;
    }catch(_){ }
    save(); refreshKpi();
  }

  if(kGateType){
    kGateType.addEventListener("change", ()=>{
      const p=currentProject(); if(!p) return;
      const c=p.customer; ensureGateDefaults(c);
      c.gateType = kGateType.value || "none";
      if(c.gateType==="none"){ c.gates=[]; }
      save(); renderGateUI(); refreshKpi();
    });
  }
  if(btnGateAdd){
    btnGateAdd.addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      const c=p.customer; ensureGateDefaults(c);
      if(c.gateType==="none") return;
      c.gates.push(gateDefaultRow(c));
      save(); renderGateUI(); refreshKpi();
    });
  }
  if(btnGateClear){
    btnGateClear.addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      const c=p.customer; ensureGateDefaults(c);
      c.gates=[];
      save(); renderGateUI(); refreshKpi();
    });
  }
  

  // -------------------------------------------------------
  // Material: Auto-Sync (aus Kunde) + Sortierung
  // -------------------------------------------------------
  const MAT_ORDER = ["matten","pfosten","eckpfosten","leisten","beton","other"];
  function matCategory(name){
    const n = String(name||"").toLowerCase();
    if(n.indexOf("beton")!==-1) return "beton";

    // Matten/Elemente: Doppelstab, Alu, Holz, WPC, Tornado, Diagonal, Elektro
    if(
      n.indexOf("matte")!==-1 ||
      n.indexOf("element")!==-1 ||
      n.indexOf("doppelstab")!==-1 ||
      n.indexOf(" alu")!==-1 || n.startsWith("alu") ||
      n.indexOf(" wpc")!==-1 || n.startsWith("wpc") ||
      n.indexOf(" holz")!==-1 || n.startsWith("holz") ||
      n.indexOf("tornado")!==-1 ||
      n.indexOf("diagonal")!==-1 ||
      n.indexOf("elektrozaun")!==-1
    ) return "matten";

    if(n.indexOf("eckpf")!==-1 || n.indexOf("eck pf")!==-1 || n.indexOf("eck-pf")!==-1) return "eckpfosten";

    // Leisten vor Pfosten (damit "Pfostenleisten" korrekt einsortiert wird)
    if(n.indexOf("leiste")!==-1 || n.indexOf("u-leist")!==-1 || n.indexOf("u leist")!==-1 || n.indexOf("torleiste")!==-1) return "leisten";

    if(n.indexOf("pfosten")!==-1 && n.indexOf("eck")===-1) return "pfosten";
    return "other";
  }
  function sortMaterials(list){
    const arr = Array.isArray(list) ? list.slice() : [];
    arr.sort((a,b)=>{
      const ca = MAT_ORDER.indexOf(matCategory(a && a.name));
      const cb = MAT_ORDER.indexOf(matCategory(b && b.name));
      if(ca!==cb) return ca-cb;
      return String((a&&a.name)||"").localeCompare(String((b&&b.name)||""),"de",{sensitivity:"base",numeric:true});
    });
    return arr;
  }

  function ensureChefAutoMaterials(p){
    if(!p || !p.customer) return;
    if(!p.chef) p.chef = { bagger:"no", ramme:"no", handbohr:"no", schubkarre:"no", haenger:"no", note:"", materials:[], photos:[] };
    if(!Array.isArray(p.chef.materials)) p.chef.materials = [];
    const c = p.customer;
    const t = computeTotals(c);
    let cc = null;
    try{ cc = computeConcrete(c); }catch(_){}
    const concreteQty = (c.concreteMode==="m3") ? (cc ? cc.m3 : 0) : (cc ? cc.sacks : 0);
    const concreteUnit = (c.concreteMode==="m3") ? "m³" : "Sack";
    const auto = [
      // Matten/Elemente: Name soll wie im Chef‑Tab sein (z.B. "Alu‑Elemente 2,50m • 100 cm")
      { k:"auto_matten", label: sysLabel(c), qty:t.panels||0, unit:"Stk" },
      { k:"auto_pfosten", label:"Pfosten", qty:t.posts||0, unit:"Stk" },
      { k:"auto_eckpfosten", label:"Eckpfosten", qty:t.cornerPosts||0, unit:"Stk" },
      { k:"auto_leisten", label:"Pfostenleisten", qty:t.postStrips||0, unit:"Stk" },
      { k:"auto_beton", label:"Beton", qty:concreteQty||0, unit:concreteUnit }
    ];
    const mats = p.chef.materials;

    function norm(s){ return String(s||"").toLowerCase().replace(/[^a-z0-9äöüß]+/g," ").trim(); }

    const byKey = {};
    for(let i=0;i<mats.length;i++){
      const it=mats[i];
      if(it && it.autoKey && !byKey[it.autoKey]) byKey[it.autoKey]=it;
    }

    for(let i=0;i<auto.length;i++){
      const a=auto[i];
      const want = Number(a.qty)||0;
      let it = byKey[a.k];

      if(!it){
        // Spezial: Matten/Elemente möglichst mit bestehender Zeile zusammenführen
        if(a.k==="auto_matten"){
          for(let j=0;j<mats.length;j++){
            const x=mats[j];
            if(!x || x.autoKey) continue;
            if(matCategory(x.name)==="matten"){ it=x; break; }
          }
        }
      }

      if(!it){
        const wantNames = [a.label];
        if(a.k==="auto_matten"){ wantNames.push("Matten","Matten/Elemente","Elemente"); }
        if(a.k==="auto_leisten") wantNames.push("Leisten");
        for(let j=0;j<mats.length;j++){
          const x=mats[j];
          if(!x || x.autoKey) continue;
          const nn = norm(x.name);
          for(const wn of wantNames){
            if(nn===norm(wn)){ it=x; break; }
          }
          if(it) break;
        }
      }

      if(!it){
        if(!want) continue;
        mats.push({ id: uid(), name: a.label, qty: want, unit: a.unit, note:"", autoKey:a.k, override:false });
      } else {
        it.autoKey = a.k;
        if(typeof it.override !== "boolean") it.override = ((it.qty!=="" && it.qty!==null && it.qty!==undefined) && (Number(it.qty||0)!==0) && (Number(it.qty)!=want));
        it.autoQty = want;
        it.autoUnit = a.unit;
        if(!it.override){
          // Auto darf Name/Qty/Unit aktualisieren (z.B. Systemwechsel → anderer Matten‑Name)
          it.name = a.label;
          it.qty = want;
          it.unit = a.unit;
        }
      }
    }

    // Auto-Zeilen entfernen, wenn sie 0 sind und nicht überschrieben wurden
    p.chef.materials = mats.filter(it=>{
      if(it && it.autoKey && !it.override && (Number(it.qty)||0)===0) return false;
      return true;
    });

    // de-dupe autoKey
    const seen = {};
    p.chef.materials = p.chef.materials.filter(it=>{
      if(!it || !it.autoKey) return true;
      if(seen[it.autoKey]) return false;
      seen[it.autoKey]=true;
      return true;
    });

    // Extra: doppelte Matten/Elemente‑Zeilen entfernen (Alt + Auto), wenn sie offensichtlich identisch sind
    const mAuto = p.chef.materials.find(x=>x && x.autoKey==="auto_matten");
    if(mAuto){
      const autoQtyNum = Number(mAuto.qty)||0;
      const autoName = norm(mAuto.name);
      const dupNames = { "matten":1, "matten elemente":1, "matten elemente gesamt":1, "elemente":1 };
      p.chef.materials = p.chef.materials.filter(x=>{
        if(!x || x===mAuto) return true;
        if(x.autoKey) return true;
        if(matCategory(x.name)!=="matten") return true;
        const q = Number(x.qty)||0;
        const nn = norm(x.name);
        if(nn===autoName && q===autoQtyNum) return false;
        if(dupNames[nn] && q===autoQtyNum) return false;
        return true;
      });
    }
  }

// Chef
  const cBagger=el("cBagger"), cRamme=el("cRamme"), cHaenger=el("cHaenger"), cNote=el("cNote");
  const matPill=el("matPill"), matList=el("matList"), mName=el("mName"), mQty=el("mQty"), mUnit=el("mUnit"), mNote=el("mNote");
  const photoGrid=el("photoGrid"), photoPill=el("photoPill");

  function persistChef(){
    const p=currentProject(); if(!p) return;
    p.chef.bagger=cBagger.value; p.chef.ramme=cRamme.value; p.chef.handbohr=(el("cHandbohr")?el("cHandbohr").value:"no"); p.chef.schubkarre=(el("cSchubkarre")?el("cSchubkarre").value:"no"); p.chef.haenger=cHaenger.value;
    p.chef.note=(cNote.value||"").trim();
    save(); refreshChefPill();
  }
  [cBagger,cRamme,cHaenger,cNote].forEach(x=>{ x.addEventListener("change", persistChef); x.addEventListener("input", persistChef); });

  function refreshChefPill(){
    const p=currentProject(); if(!p) return;
    const ok = (p.chef.materials||[]).length || (p.chef.note||"").trim() || (p.chef.photos||[]).length;
    el("chefPill").textContent = ok ? "gesetzt" : "leer";
    el("chefPill").className = "pill " + (ok ? "good" : "");
  }

  function refreshChefUI(){
    const p=currentProject();
    el("chefTitle").textContent = p ? `🛠️ Chef/Team: ${p.title}` : "🛠️ Chef / Team";
    if(!p) return;
    cBagger.value=p.chef.bagger||"no";
    cRamme.value=p.chef.ramme||"no";
    if(el("cHandbohr")) el("cHandbohr").value=p.chef.handbohr||"no";
    if(el("cSchubkarre")) el("cSchubkarre").value=p.chef.schubkarre||"no";
    cHaenger.value=p.chef.haenger||"no";
    if(el("cCustomerNote")) el("cCustomerNote").value = (p.customer && p.customer.note) ? p.customer.note : "";
    cNote.value=p.chef.note||"";
    ensureChefAutoMaterials(p);
    renderMaterials(); renderPhotos(); refreshChefPill();
  }

  el("btnAddMat").addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return;
    const sel=el("mName");
    const custom=el("mNameCustom");
    let name = (sel && sel.value) ? String(sel.value).trim() : "";
    if(name==="__custom__"){
      name = custom ? String(custom.value||"").trim() : "";
    }
    const qty = toNum(mQty.value,0);
    const unit = mUnit.value || "Stk";
    if(!name){ toast("Fehlt", "Material auswählen/eingeben"); return; }
    const item={ id: uid(), name, qty, unit, note:"", override:true };
    if(!p.chef) p.chef = { bagger:"no", ramme:"no", handbohr:"no", schubkarre:"no", haenger:"no", note:"", materials:[], photos:[] };
    if(!Array.isArray(p.chef.materials)) p.chef.materials=[];
    p.chef.materials.push(item);
    // reset
    if(sel) sel.value="Doppelstabmatte";
    if(custom){ custom.value=""; custom.style.display="none"; }
    mQty.value="";
    save(); renderMaterials(); refreshChefPill(); toast("Hinzugefügt", name);
  });

  // Toggle Freitext-Eingabe bei Materialauswahl
  if(el("mName") && el("mNameCustom")){
    el("mName").addEventListener("change", ()=>{
      const v=el("mName").value;
      el("mNameCustom").style.display = (v==="__custom__") ? "block" : "none";
    });
  }

  el("btnClearMat").addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return;
    if(!confirm("Interne Materialliste wirklich leeren?")) return;
    p.chef.materials=[]; save(); renderMaterials(); refreshChefPill();
  });

  function renderMaterials(){
    const p=currentProject(); if(!p) return;
    const list=p.chef.materials||[];
    const view = sortMaterials(list);
    matPill.textContent=String(list.length);
    if(!view.length){
      matList.innerHTML='<div class="hint">(noch leer)</div>';
      return;
    }

    matList.innerHTML = `
      <details open>
        <summary>
          <span>Materialliste</span>
          <span class="pill">${view.length}</span>
        </summary>
        <div class="matRows"></div>
      </details>
    `;
    const rows = matList.querySelector(".matRows");
    view.forEach(it=>{
      const row=document.createElement("div");
      row.className="matRow";
      row.innerHTML = `
        <div class="matName">${escapeHtml(it.name)}</div>
        <input type="text" inputmode="decimal" value="${escapeHtml(String(it.qty??""))}" />
        <select>
          <option${it.unit==="Stk"?" selected":""}>Stk</option>
          <option${it.unit==="m"?" selected":""}>m</option>
          <option${it.unit==="m²"?" selected":""}>m²</option>
          <option${it.unit==="Sack"?" selected":""}>Sack</option>
          <option${it.unit==="m³"?" selected":""}>m³</option>
          <option${it.unit==="Paket"?" selected":""}>Paket</option>
        </select>
        <button class="btn small bad" type="button" title="löschen">✕</button>
      `;
      const inpQty=row.querySelector("input");
      const selUnit=row.querySelector("select");
      const btnDel=row.querySelector("button");

      // iOS/PWA Safety: falls DOM anders gerendert wurde, nicht crashen
      if(!inpQty || !selUnit || !btnDel){
        rows.appendChild(row);
        return;
      }

      const commit=()=>{
        const p2=currentProject(); if(!p2) return;
        const tgt=(p2.chef.materials||[]).find(x=>x.id===it.id); if(!tgt) return;
        tgt.qty = toNum(inpQty.value,0);
        tgt.unit = selUnit.value;
        tgt.override = true;
        save(); refreshChefPill();
      };
      inpQty.addEventListener("change", commit);
      selUnit.addEventListener("change", commit);
      btnDel.addEventListener("click", ()=>{
        const p2=currentProject(); if(!p2) return;
        p2.chef.materials=(p2.chef.materials||[]).filter(x=>x.id!==it.id);
        save(); renderMaterials(); refreshChefPill();
      });
      rows.appendChild(row);
    });
  }

  function compressImageToDataUrl(file, maxSide=1280, quality=0.72){
    return new Promise((resolve,reject)=>{
      const fr=new FileReader();
      fr.onload=()=>{
        const img=new Image();
        img.onload=()=>{
          const w=img.width, h=img.height;
          const scale=Math.min(1, maxSide/Math.max(w,h));
          const nw=Math.round(w*scale), nh=Math.round(h*scale);
          const cv=document.createElement("canvas");
          cv.width=nw; cv.height=nh;
          const ctx=cv.getContext("2d");
          ctx.drawImage(img,0,0,nw,nh);
          resolve(cv.toDataURL("image/jpeg", quality));
        };
        img.onerror=reject;
        img.src=fr.result;
      };
      fr.onerror=reject;
      fr.readAsDataURL(file);
    });
  }

  function renderPhotos(){
    const p=currentProject(); if(!p) return;
    const ph=p.chef.photos||[];
    photoPill.textContent=String(ph.length);
    photoGrid.innerHTML="";
    const max=6;
    for(let i=0;i<max;i++){
      const slot=ph[i];
      const div=document.createElement("div");
      div.className="ph";
      if(slot){
        div.innerHTML = `
          <div class="cardTitle"><b>Foto ${i+1}</b><button class="btn small bad" type="button">✕</button></div>
          <div class="meta">${escapeHtml(slot.name||"")}</div>
          <div style="margin-top:8px;"><img src="${slot.dataUrlSmall}" alt="Foto"/></div>
        `;
        div.querySelector("button").addEventListener("click", ()=>{
          const p2=currentProject(); if(!p2) return;
          p2.chef.photos.splice(i,1);
          save(); renderPhotos(); refreshChefPill();
        });
      } else {
        div.innerHTML = `
          <b>+ Foto hinzufügen</b>
          <div class="meta">Tippen → Kamera / Mediathek</div>
          <div style="margin-top:8px;"><input type="file" accept="image/*" capture="environment"/></div>
        `;
        const input=div.querySelector("input");
        input.addEventListener("change", async ()=>{
          const file=input.files && input.files[0];
          if(!file) return;
          const dataUrlSmall = await compressImageToDataUrl(file, 1280, 0.72);
          const p2=currentProject(); if(!p2) return;
          p2.chef.photos=p2.chef.photos||[];
          p2.chef.photos.push({id:uid(), name:file.name||"foto.jpg", type:file.type||"image/jpeg", dataUrlSmall});
          save(); renderPhotos(); refreshChefPill(); toast("Foto gespeichert");
        });
      }
      photoGrid.appendChild(div);
    }
  }

  function chefWhatsText(p){
    const lines=[];
    lines.push(`INTERN – ${p.title}`);
    if(p.plannedDate) lines.push(`Ausführung: ${p.plannedDate}`);
    if(p.phone) lines.push(`Tel: ${p.phone}`);
    if(p.addr) lines.push(`Kunde: ${p.addr}`);
    if(p.objAddr) lines.push(`Objekt: ${p.objAddr}`);
    lines.push("");
    const custNote = (p.customer && (p.customer.note||"").trim()) ? p.customer.note.trim() : "";
    if(custNote){
      lines.push("Kunden‑Notiz:");
      lines.push(custNote);
      lines.push("");
    }
    const eq=[];
    if(p.chef.bagger==="yes") eq.push("Bagger");
    if(p.chef.ramme==="yes") eq.push("Ramme");
    if(p.chef.haenger==="yes") eq.push("Hänger");
    if(eq.length){
      lines.push("Geräte:");
      eq.forEach(x=>lines.push(`- ${x}`));
      lines.push("");
    }
    const mats=sortMaterials(p.chef.materials||[]);
    lines.push("Material (intern):");
    if(!mats.length) lines.push("(leer)");
    else mats.forEach(it=>{
      const q=fmt(toNum(it.qty,0));
      const u=it.unit||"Stk";
      const note=(it.note||"").trim();
      lines.push(`- ${it.name}: ${q} ${u}${note?(" ("+note+")"):""}`);
    });
    const ph=p.chef.photos||[];
    if(ph.length){ lines.push(""); lines.push(`Fotos: ${ph.length} (im Backup.json)`); }
    if((p.chef.note||"").trim()){
      lines.push("");
      lines.push("Hinweise:");
      lines.push(p.chef.note.trim());
    }
    return lines.join("\n");
}

  el("btnCWhats").addEventListener("click", async ()=>{ const p=currentProject(); if(!p) return; await shareInternWithPhotos(p); });
  el("btnCDown").addEventListener("click", ()=>{ const p=currentProject(); if(!p) return; downloadText(chefWhatsText(p), fileSafe(`${p.title}_Intern.txt`)); });

  // Intern: Fotos.zip (Desktop-Fallback) + E-Mail
  if(el("btnCZip")){
    el("btnCZip").addEventListener("click", async ()=>{
      const p=currentProject(); if(!p) return;
      await downloadInternPhotosZip(p);
    });
  }
  if(el("btnCMail")){
    el("btnCMail").addEventListener("click", async ()=>{
      const p=currentProject(); if(!p) return;
      const text = chefWhatsText(p);
      try{ await navigator.clipboard.writeText(text); }catch(_){}
      // Hinweis: Mail-Clients erlauben Anhänge nicht per Script -> Nutzer hängt Fotos.zip manuell an
      sendMailAny(`Intern – ${p.title}`, text + "\n\n(Hinweis: Text wurde in die Zwischenablage kopiert. Bitte Fotos.zip manuell anhängen.)");
    });
  }

  // Backup
  el("btnBackup").addEventListener("click", ()=>{
    const data={ exportedAt: nowISO(), tool:"Zaunteam Zaunplaner", version:APP_VERSION, state };
    downloadText(JSON.stringify(data,null,2), "Zaunplaner_Backup.json", "application/json");
  });
  el("btnCSV").addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return toast("Kein Kunde");
    const rows=[["Kundenname","Datum","Material","Menge","Einheit","Notiz"]].concat((p.chef.materials||[]).map(it=>[p.title,p.plannedDate||"",it.name||"",String((it.qty!=null)?it.qty:""),it.unit||"",it.note||""]));
    const csv=rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(";")).join("\n");
    downloadText(csv, fileSafe(`${p.title}_Material.csv`), "text/csv");
  });
  el("btnReset").addEventListener("click", ()=>{
    if(!confirm("Wirklich ALLE lokalen Daten löschen?")) return;
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));
    location.reload();
  });

  function refreshCustomerUI(){
    const p=currentProject(); if(!p) return;
    const c=p.customer;
    el("kundeTitle").textContent = `👤 Kunde: ${p.title}`;
    if(kCreated) kCreated.value = dateFromIso(p.createdAt||"");
    if(kPlanned) kPlanned.value = p.plannedDate || "";
    if(kPhone) kPhone.value = p.phone || "";
    if(kEmail) kEmail.value = p.email || "";
    kLen.value=c.length||"";
    kHeight.value=String(c.height||160);
    kSystem.value=c.system||"Doppelstab";
    kColor.value=c.color||"Anthrazit (RAL 7016)";
    if(kPrivacy) kPrivacy.value = c.privacy || "no";
    if(kPrivacyLen) kPrivacyLen.value = c.privacyLen || "";
    kWood.value=(c.system==="Holz") ? (c.woodType||"—") : "—";
    kWpc.value=(c.system==="WPC") ? (c.wpcType||"—") : "—";
    kSlopeType.value=c.slopeType||"flat";
    kSlopePct.value=c.slopePct||"";
    setCorners(c.corners||0);
    kConcreteMode.value=c.concreteMode||"sacks";
    updateConcretePlaceholder();
    renderConcreteAutoUI(c);
    kNote.value=c.note||"";
    ensureGateDefaults(c);
    renderGateUI();
    toggleMaterialDependent();
    togglePrivacyDependent();
    refreshKpi();
  }

    function refreshChefUI(){
    const p=currentProject();
    el("chefTitle").textContent = p ? `🛠️ Chef/Team: ${p.title}` : "🛠️ Chef / Team";
    if(!p) return;
    cBagger.value=p.chef.bagger||"no";
    cRamme.value=p.chef.ramme||"no";
    if(el("cHandbohr")) el("cHandbohr").value=p.chef.handbohr||"no";
    if(el("cSchubkarre")) el("cSchubkarre").value=p.chef.schubkarre||"no";
    cHaenger.value=p.chef.haenger||"no";
    if(el("cCustomerNote")) el("cCustomerNote").value = (p.customer && p.customer.note) ? p.customer.note : "";
    cNote.value=p.chef.note||"";
    ensureChefAutoMaterials(p);
    renderMaterials(); renderPhotos(); refreshChefPill();
  }


  function refreshAll(){
    refreshProjectSelectors();
    refreshCustomerUI();
    refreshChefUI();
    updateStatusPill();
    // View mode
    if(state.selectedProjectId) showCustomerEdit(); else showCustomerList();
  }

  // init
  fillHeights();
  fillSelect(kColor, ZAUNTEAM_FARBEN, "Anthrazit (RAL 7016)");
  fillSelect(kWood, HOLZARTEN, "—");
  fillSelect(kWpc, WPC_VARIANTEN, "—");
  updateConcretePlaceholder();
  if(pCreated && !pCreated.value) pCreated.value = new Date().toISOString().slice(0,10);
  migrateLegacy();
  // Always keep version current
  state.version = APP_VERSION;
  refreshAll();
})();
