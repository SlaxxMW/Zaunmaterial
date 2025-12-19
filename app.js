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

    const APP_VERSION = "1.4.33";
  const APP_BUILD = "2025-12-19";
let state = { version:"1.4.33", selectedProjectId:null, projects:[], meta:{ lastSavedAt:"", lastBackupAt:"" } };

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
      chef: { bagger:"no", ramme:"no", handbohr:"no", schubkarre:"no", haenger:"no", hoursPlanned:"", status:"draft", note:"", materials:[], photos:[] },
      status:"Entwurf",
      plannedHours:""
    };
  }

  function save()
 {
    try{
      if(!state.meta) state.meta = {};
      state.meta.lastSavedAt = nowISO();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      // safety: keep last known good state to recover from JS bugs/crashes
      if(state && Array.isArray(state.projects) && state.projects.length){
        localStorage.setItem(STORAGE_KEY+"_lastgood", JSON.stringify(state));
      }
    }catch(e){}
    updateStatusPill();
    try{ renderProjectOverview(); }catch(e){}
  }

  function migrateLegacy() {
    const stable = localStorage.getItem(STORAGE_KEY);
    if(stable) {
      try {
        const s = JSON.parse(stable);
        if(s && Array.isArray(s.projects)) { state = {...state, ...s, version:APP_VERSION}; if(!state.meta) state.meta={ lastSavedAt:"", lastBackupAt:"" }; return; }
      } catch(e){}
    }
    
    // Recovery: wenn durch Bug/Crash leer gespeichert wurde, versuche "lastgood" wiederherzustellen
    try{
      const lg = localStorage.getItem(STORAGE_KEY+"_lastgood");
      if(lg){
        const s2 = JSON.parse(lg);
        if(s2 && Array.isArray(s2.projects) && s2.projects.length && (!state.projects || !state.projects.length)){
          state = {...state, ...s2, version:APP_VERSION};
          // nicht sofort überschreiben – nur anzeigen
          setTimeout(()=>{ try{ toast("✅ Kunden wiederhergestellt (Backup)"); }catch(e){} }, 50);
          return;
        }
      }
    }catch(e){}
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
    // Save/Backup status
    const sp = el("savePill");
    const bp = el("backupPill");
    const ls = (state && state.meta && state.meta.lastSavedAt) ? state.meta.lastSavedAt : "";
    const lb = (state && state.meta && state.meta.lastBackupAt) ? state.meta.lastBackupAt : "";
    const fmt = (iso)=>{
      try{
        if(!iso) return "—";
        const d = new Date(iso);
        const hh = String(d.getHours()).padStart(2,"0");
        const mm = String(d.getMinutes()).padStart(2,"0");
        const dd = String(d.getDate()).padStart(2,"0");
        const mo = String(d.getMonth()+1).padStart(2,"0");
        return `${dd}.${mo}. ${hh}:${mm}`;
      }catch(e){ return "—"; }
    };
    if(sp){ sp.textContent = "gespeichert: " + fmt(ls); sp.title = ls || ""; }
    if(bp){ bp.textContent = "Backup: " + fmt(lb); bp.title = lb || ""; }

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

  
  // Projektübersicht + Suche (Kunde/Projekt)
  const projSearch = el("projSearch");
  const projOverview = el("projOverview");

  function renderProjectOverview(){
    if(!projOverview) return;
    const q = (projSearch && projSearch.value) ? projSearch.value.trim().toLowerCase() : "";
    const list = (state.projects||[]).filter(p=>{
      if(!q) return true;
      const hay = `${p.title||""} ${p.addr||""} ${p.objAddr||""} ${p.phone||""}`.toLowerCase();
      return hay.includes(q);
    });

    // render table
    let html = `<div style="overflow:auto; max-height:260px; border-radius:14px; border:1px solid rgba(255,255,255,.08);">`;
    html += `<table style="width:100%; border-collapse:collapse; font-size:13px;">`;
    html += `<thead><tr style="text-align:left; opacity:.9;">
      <th style="padding:10px;">Kunde</th>
      <th style="padding:10px;">Status</th>
      <th style="padding:10px; white-space:nowrap;">Std.</th>
    </tr></thead><tbody>`;
    if(!list.length){
      html += `<tr><td colspan="3" style="padding:12px; opacity:.8;">Keine Treffer</td></tr>`;
    } else {
      for(const p of list){
        const isActive = (p.id === state.selectedProjectId);
        html += `<tr data-pid="${p.id}" style="cursor:pointer; ${isActive?'background:rgba(34,197,94,.12);':''}">
          <td style="padding:10px; border-top:1px solid rgba(255,255,255,.06);">${escapeHtml(p.title||"")}</td>
          <td style="padding:10px; border-top:1px solid rgba(255,255,255,.06);">${escapeHtml(p.status||"")}</td>
          <td style="padding:10px; border-top:1px solid rgba(255,255,255,.06); text-align:right;">${escapeHtml(p.plannedHours||"")}</td>
        </tr>`;
      }
    }
    html += `</tbody></table></div>`;
    projOverview.innerHTML = html;

    // row click
    projOverview.querySelectorAll("tr[data-pid]").forEach(tr=>{
      tr.addEventListener("click", ()=>{
        const pid = tr.getAttribute("data-pid");
        state.selectedProjectId = pid;
        save();
        refreshAll();
        showCustomerEdit();
      });
    });

    // also filter dropdown options
    const ps = el("projSel");
    if(ps){
      const keep = new Set(list.map(p=>p.id));
      Array.from(ps.options).forEach(o=>{
        if(!o.value) return;
        o.hidden = q ? !keep.has(o.value) : false;
      });
    }
  }

  if(projSearch){
    projSearch.addEventListener("input", ()=>{
      renderProjectOverview();
    });
  }
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
  
    try{ renderProjectOverview(); }catch(e){}
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
    const issues=validateProject(p); if(!showIssues(issues)) return;
    callPhone(p.phone || pPhone.value || "");
    });
  }

  if(el("btnMail")){
    el("btnMail").addEventListener("click", ()=>{
      const p=currentProject(); if(!p) return;
      sendEmail(p.email || (pEmail ? pEmail.value : "") || "", `Zaunprojekt: ${p.title}`, customerWhatsText(p));
    });
  }


  const btnDelMain = el("btnDel");
  if(btnDelMain) btnDelMain.addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return;
    if(!confirm(`Kunde wirklich löschen?

${p.title}`)) return;
    state.projects = state.projects.filter(x=>x.id!==p.id);
    state.selectedProjectId = (state.projects[0] && state.projects[0].id) ? state.projects[0].id : null;
    save(); refreshAll();
    toast("Gelöscht");
  });
  if(sortSel) sortSel.addEventListener("change", refreshProjectSelectors);
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
  const kLen=el("kLen"), kHeight=el("kHeight"), kSystem=el("kSystem"), kColor=el("kColor"), kPrivacy=el("kPrivacy"), kPrivacyLen=el("kPrivacyLen"), kPrivacyRoll=el("kPrivacyRoll"), kPrivacyRollsAuto=el("kPrivacyRollsAuto"), kWood=el("kWood"), kWpc=el("kWpc");
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
    if(!kPrivacy) return;
    const on = (kPrivacy.value === "yes");
    if(kPrivacyLen){
      kPrivacyLen.disabled = !on;
      if(!on) kPrivacyLen.value = "";
    }
    if(typeof kPrivacyRoll!=="undefined" && kPrivacyRoll){
      kPrivacyRoll.disabled = !on;
      if(!on) kPrivacyRoll.value = "35";
    }
    if(typeof kPrivacyRollsAuto!=="undefined" && kPrivacyRollsAuto){
      kPrivacyRollsAuto.disabled = true;
      if(!on) kPrivacyRollsAuto.value = "";
    }
  }
  if(kPrivacy){ kPrivacy.addEventListener("change", ()=>{ togglePrivacyDependent(); persistCustomer(); }); }
  if(kPrivacyLen){ kPrivacyLen.addEventListener("input", ()=>{ try{ const p=currentProject(); if(!p) return; const pr=computePrivacyRolls(p.customer, computeTotals(p.customer)); if(kPrivacyRollsAuto) kPrivacyRollsAuto.value = pr.rolls ? `${pr.rolls} Rollen (à ${pr.rollLen}m)` : ""; }catch(_){ } persistCustomer(); }); }
  if(typeof kPrivacyRoll!=="undefined" && kPrivacyRoll){ kPrivacyRoll.addEventListener("change", ()=>{ try{ const p=currentProject(); if(!p) return; const pr=computePrivacyRolls(p.customer, computeTotals(p.customer)); if(kPrivacyRollsAuto) kPrivacyRollsAuto.value = pr.rolls ? `${pr.rolls} Rollen (à ${pr.rollLen}m)` : ""; }catch(_){ } persistCustomer(); }); }


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
    const woodOn = (sys=="Holz");
    const wpcOn = (sys==="WPC");
    kWood.disabled = !woodOn;
    kWpc.disabled = !wpcOn;
    if(!woodOn) kWood.value="—";
    if(!wpcOn) kWpc.value="—";
  }
  kSystem.addEventListener("change", ()=>{ toggleMaterialDependent(); persistCustomer(); });

  function togglePrivacyDependent(){
    if(!kPrivacy || !kPrivacyLen) return;
    const on = (kPrivacy.value==="yes");
    const p=currentProject();
    const hasSegments = p && p.customer && Array.isArray(p.customer.segments) && p.customer.segments.length>0;
    const on = !hasSegments && (kPrivacy.value==="yes");
    kPrivacy.disabled = hasSegments;
    kPrivacyLen.disabled = !on;
    if(!on) kPrivacyLen.value="";
  }
  if(kPrivacy){
    kPrivacy.addEventListener("change", ()=>{ togglePrivacyDependent(); persistCustomer(); });
  }


  function persistCustomer() {
    const p = currentProject(); if (!p) return;
    const c=p.customer;
    c.length=(kLen.value||"").trim();
    const segs = segmentList(c);
    if(segs.length){
      c.length = String(segs.reduce((a,s)=>a+Math.max(0,toNum(s.length,0)),0) || "");
    } anders {
      c.length=(kLen.value||"").trim();
    }
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
    if(segs.length){
      c.privacy = c.segments.some(x=>(x.privacy||"no")==="yes") ? "yes" : "no";
      c.privacyLen = "";
    } anders {
      c.privacy = (kPrivacy ? (kPrivacy.value||"no") : (c.privacy||"no"));
      c.privacyLen = (c.privacy==="yes") ? ((kPrivacyLen ? (kPrivacyLen.value||"") : "").trim()) : "";
    }
    c.privacyRollLen = (c.privacy==="yes") ? (toNum((kPrivacyRoll ? kPrivacyRoll.value : (c.privacyRollLen||35)),35) || 35) : 35;
    c.note=(kNote.value||"").trim();
    ensureGateDefaults(c);
    if(kGateType) c.gateType = kGateType.value || c.gateType || "none";
    if(c.gateType==="none") c.gates = [];
    c.concreteValue="";
    versuchen{
      const cc = computeConcrete(c);
      c.concreteValue = concreteDisplayValue(c, cc);
      c.concreteAuto = cc;
    }catch(_){ c.concreteAuto = null; }
    renderConcreteAutoUI(c);
    ensureChefAutoMaterials(p);
    speichern();
    refreshKpi();
    refreshChefPill();
  }

  [kLen,kHeight,kSystem,kColor,kPrivacy,kPrivacyLen,kWood,kWpc,kSlopeType,kSlopePct,kConcreteVal,kNote].forEach(x=>{
    x.addEventListener("input", persistCustomer);
    x.addEventListener("change", persistCustomer);
  });

  
  // Plausibilitätschecks (damit Demo beim Chef sauber wirkt)
@@ -634,109 +647,169 @@ ${p.title}`)) return;
  function mapsLink(p){
    const q = ((p.objAddr||"").trim() || fullCustomerAddress(p) || (p.addr||"").trim());
    if(!q) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }
function validateProject(p){
    const issues = [];
    if(!p) { issues.push("Kein Kunde ausgewählt."); return issues; }
    const c = p.customer || {};
    const len ​​= Array.isArray(c.segments)&&c.segments.length ? c.segments.reduce((a,s)=>a+Math.max(0,toNum(s.length,0)),0) : toNum(c.length, 0);
    if(!len || len<=0) issues.push("Zaunlänge fehlt (m).");
    if(!c.height) issues.push("Höhe fehlt.");
    if(!c.system) issues.push("System fehlt.");
    // Sichtschutz nur wenn Länge vorhanden
    if(c.privacy==="yes" && (!len || len<=0)) issues.push("Sichtschutz gewählt, aber Zaunlänge fehlt.");
    // Tore: wenn gateType != none aber keine Varianten
    if(c.gateType && c.gateType!=="none" && (!Array.isArray(c.gates) || !c.gates.length)) issues.push("Tor-Typ gewählt, aber keine Tor-Varianten hinterlegt.");
    Rückgabeprobleme;
  }

  function showIssues(issues){
    if(!issues || !issues.length) return true;
    toast("⚠️ Bitte prüfen: " + issues[0]);
    return false;
  }
function computeTotals(c){
    const segs = c && Array.isArray(c.segments) ? c.segments : null;
    const lengthM = Math.max(0, segs ? segs.reduce((a,s)=>a+Math.max(0,toNum(s.length,0)),0) : toNum(c.length,0));
  function segmentList(c){
    return (c && Array.isArray(c.segments)) ? c.segments.filter(s=>s && toNum(s.length,0)>0) : [];
  }
  Funktion computeSegmentTotals(seg){
    const lengthM = Math.max(0, toNum(seg && seg.length, 0));
    const panels = lengthM ? Math.ceil(lengthM/PANEL_W) : 0;
    const posts = panels ? (panels+1) : 0;
    const postStrips = posts;
    zurückkehren {
      LängeM,
      Paneele,
      Beiträge
      CornerPosts:0,
      postStrips,
      Höhe: Number(seg && seg.height) || 160,
      System: (seg && seg.system) || „Doppelter Stab“,
      Farbe: (seg && seg.color) || "Anthrazit (RAL 7016)",
      label: seg && seg.label
    };
  }
  function computeTotals(c){
    const segs = segmentList(c);
    if(segs.length){
      let lengthM=0, panels=0, posts=0, postStrips=0;
      for(const s of segs){
        const st = computeSegmentTotals(s);
        lengthM += st.lengthM;
        panels += st.panels;
        posts += st.posts;
        postStrips += st.postStrips;
      }
      const corners=clampInt(c.corners||0);
      const cornerPosts=corners;
      postStrips += cornerPosts;
      return {lengthM, panels, posts, cornerPosts, postStrips};
    }
    const lengthM = Math.max(0, toNum(c.length,0));
    const panels=lengthM ? Math.ceil(lengthM/PANEL_W) : 0;
    const posts=panels ? (panels+1) : 0;
    const corners=clampInt(c.corners||0);
    const cornerPosts=corners;
    const postStrips=posts ? (posts+corners) : 0;
    return {lengthM, panels, posts, cornerPosts, postStrips};
  }
  function computePrivacyRolls(c, totals){
    versuchen{
      if(!c) return {rolls:0, rollLen:35, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0};
      if(!c) return {rolls:0, rollLen:35, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0 , segments:[] };

      const rollLen = clampInt(c.privacyRollLen || 35, 20, 100);

      // Wenn Segmente vorhanden: summiere Sichtschutz je Segment (Höhen können variieren)
      if(Array.isArray(c.segments) && c.segments.length){
      const segs = segmentList(c);
      if(segs.length){
        setze totalStripM = 0;
        let lengthM = 0;
        let panelsAll = 0;
        const details = [];

        for(const s of c.segment s){
        for(const s of seg s){
          const segLen = Math.max(0, toNum(s.length,0));
          const segPriv = (s.privacy||c.privacy||"no")==="yes";
          if(!segLen){ continue; }
          lengthM += segLen;
          if(!segLen || !segPriv){ continue; }
          constpanels = segLen ? Math.ceil(segLen / PANEL_W) : 0;
          panelAll += panels;
          if(!segPriv) continue;
          const h = Number(s.height||c.height)||160;
          const stripsPerPanel = Math.max(0, Math.round(h/20)); // 100→5,120→6...
          totalStripM += panels * stripsPerPanel * PANEL_W;
          const segStripM = panels * stripsPerPanel * PANEL_W;
          const segRolls = segStripM ? Math.ceil(segStripM / rollLen) : 0;
          totalStripM += segStripM;
          lengthM += segLen;
          details.push({
            label: s.label || "",
            LängeM: SegelLen,
            Paneele,
            Streifen pro Panel,
            totalStripM: segStripM,
            rolls: segRolls,
            rollLen,
            Höhe: h
          });
        }
        const rolls = totalStripM ? Math.ceil(totalStripM / rollLen) : 0;
        return {rolls, rollLen, stripsPerPanel:0, panels:panelsAll, totalStripM, lengthM};
        return {rolls, rollLen, stripsPerPanel:0, panels:panelsAll, totalStripM, lengthM , segments:details };
      }

      // Legacy (ein Abschnitt)
      if((c.privacy||"no")!=="yes") return {rolls:0, rollLen, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0};
      if((c.privacy||"no")!=="yes") return {rolls:0, rollLen, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0 , segments:[] };
      const h = Number(c.height)||160;
      const stripsPerPanel = Math.max(0, Math.round(h/20));
      const baseLen = toNum(c.privacyLen, 0) || (Summen && GesamtlängeM) || toNum(c.length, 0) || 0;
      const lengthM = Math.max(0, baseLen);
      const panels = lengthM ? Math.ceil(lengthM / PANEL_W) : 0;
      const totalStripM = panels * stripsPerPanel * PANEL_W;
      const rolls = totalStripM ? Math.ceil(totalStripM / rollLen) : 0;
      return {rolls, rollLen, stripsPerPanel, panels, totalStripM, lengthM};
      return {rolls, rollLen, stripsPerPanel, panels, totalStripM, lengthM , segments:[] };
    }catch(e){
      return {rolls:0, rollLen:35, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0};
      return {rolls:0, rollLen:35, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0 , segments:[] };
    }
  }


  function sysLabel(c){
    const h=Number(c.height)||160;
    const base = (c.system==="Doppelstab")?"Doppelstab‑Matten":(c.system==="Aluminium")?"Alu‑Elemente":(c.system==="Holz")?"Holz‑Elemente":(c.system==="WPC")?"WPC‑Elemente":(c.system==="Diagonal Geflecht")?"Diagonal‑Geflecht":(c.system==="Tornado")?"Tornado‑Zaun":(c.system==="Elektrozaun")?"Elektrozaun":"Zaun‑Elemente";
    const sys = String((c&&c.system)||"").toLowerCase();
    const base = (sys.indexOf("doppelstab")!==-1) ? "Doppelstab‑Matten"
      : (sys.indexOf("einfachstab")!==-1) ? "Einfachstab‑Matten"
      : (sys.indexOf("aluminum")===0 || sys.indexOf("aluminum")!==-1) ? “Alu‑Element”
      : (sys.indexOf("holz")!==-1) ? "Holz‑Elemente"
      : (sys.indexOf("wpc")!==-1) ? "WPC‑Elemente"
      : (sys.indexOf("diagonal")!==-1) ? "Diagonal‑Geflecht"
      : (sys.indexOf("tornado")!==-1) ? "Tornado‑Zaun"
      : (sys.indexOf("electro")!==-1) ? “Elektrosion”
      : "Zaun‑Elemente";
    return `${base} 2,50m • ${h} cm`;
  }
  Funktion sysLabelForSegment(seg){
    if(!seg) return sysLabel({});
    return sysLabel({ height: seg.height, system: seg.system });
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
      Höhe:Number(g.height)||160,
      widthCm: clampInt((g.widthCm!=null ? g.widthCm : (g.width!=null ? g.width : 125)), 50, 400),
      qty: clampInt((g.qty!=null ? g.qty : (g.count!=null ? g.count : 1)), 0, 20),
    })).filter(g=>g.qty>0);
    const total=rows.reduce((s,g)=>s+g.qty,0);
    const text=rows.map(g=>`H${g.height} / B${g.widthCm}cm × ${g.qty}`).join(" | ");
    return {total, rows, text};
  }


  Funktion computeConcrete(c){
@@ -792,74 +865,96 @@ Funktion computeTotals(c){
    if(kEmail) kEmail.value = p.email || "";
    customerKpi.innerHTML="";
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
    const p = currentProject(); if (!p) return;
    const c=p.customer;
    const t=computeTotals(c);
    if(!t.lengthM) return toast("Länge fehlt","Bitte Zaunlänge eingeben");
    const mats=p.chef.materials;
    upsertMat(mats, "Zaun‑Übersicht", 1, "Stk", `${fmt(t.lengthM)} m • ${c.height} cm • ${c.system} • ${c.color}${(c.system==="Holz"&&c.woodType)?(" • "+c.woodType):""}${(c.system==="WPC"&&c.wpcType)?(" • "+c.wpcType):""}`);
    upsertMat(mats, sysLabel(c), t.panels, "Stk", "gesamt");
    upsertMat(mats, "Pfosten", t.posts, "Stk", "gesamt");
    if(t.cornerPosts) upsertMat(mats, "corner posts", t.cornerPosts, "pcs", "total");
    const segs = segmentList(c);
    if(segs.length){
      const segNote = segs.map(s=>`${s.label||""}:${fmt(toNum(s.length,0))}m`).join(" • ");
      upsertMat(mats, "Zaun‑Übersicht (Abschnitte)", 1, "Stk", segNote || `${fmt(t.lengthM)} m`);
      for(const seg of segs){
        const st = computeSegmentTotals(seg);
        const prefix = seg.label ? `Abschnitt ${seg.label} – ` : "";
        upsertMat(mats, `${prefix}${sysLabelForSegment(seg)}`, st.panels, "Stk", `${fmt(st.lengthM)} m`);
        upsertMat(mats, `${prefix}Pfosten`, st.posts, "Stk", `${fmt(st.lengthM)} m`);
        upsertMat(mats, `${prefix}Pfostenleisten`, st.postStrips, "Stk", `${fmt(st.lengthM)} m`);
      }
      if(t.cornerPosts) upsertMat(mats, "corner posts", t.cornerPosts, "pcs", "total");
      if(t.cornerPosts) upsertMat(mats, "Pfostenleisten (Ecken)", t.cornerPosts, "Stk", "Eckpfosten");
    } anders {
      upsertMat(mats, "Zaun‑Übersicht", 1, "Stk", `${fmt(t.lengthM)} m • ${c.height} cm • ${c.system} • ${c.color}${(c.system==="Holz"&&c.woodType)?(" • "+c.woodType):""}${(c.system==="WPC"&&c.wpcType)?(" • "+c.wpcType):""}`);
      upsertMat(mats, sysLabel(c), t.panels, "Stk", "gesamt");
      upsertMat(mats, "Pfosten", t.posts, "Stk", "gesamt");
      if(t.cornerPosts) upsertMat(mats, "corner posts", t.cornerPosts, "pcs", "total");
    }
    {
      const g=gateSummary(c);
      if(g.total) upsertMat(mats, `Tor (${gateTypeLabel(c.gateType)})`, g.total, "Stk", g.text||"");
    }
    upsertMat(mats, "Pfostenleisten", t.postStrips, "Stk", "gesamt");
    if((c.privacy||"no")==="yes"){
      const pr = computePrivacyRolls(c, t);
    if(!segs.length){
      upsertMat(mats, "Pfostenleisten", t.postStrips, "Stk", "gesamt");
    }
    const pr = computePrivacyRolls(c, t);
    if(segs.length && pr && Array.isArray(pr.segments)){
      for(const det of pr.segments){
        const prefix = det.label ? `Abschnitt ${det.label} – ` : "";
        if(det.lengthM>0) upsertMat(mats, `${prefix}Datenschutz (Länge)`, det.lengthM, "m", `${det.height||""} cm`);
        if(det.rolls>0) upsertMat(mats, `${prefix}Sichtschutz‑Rollen`, det.rolls, "Rolle", `${det.rollLen||35}m • ${det.stripsPerPanel||0}×2,5m je Feld • gesamt ${fmt(det.totalStripM||0)}m`);
      }
    } else if((c.privacy||"no")==="yes"){
      if(pr.lengthM>0){
        upsertMat(mats, "Sichtschutz (Länge)", pr.lengthM, "m", "Kunde");
        if(pr.rolls>0){
          upsertMat(mats, "Sichtschutz‑Rollen", pr.rolls, "Rolle", `${pr.rollLen}m • ${pr.stripsPerPanel}×2,5m je Feld • gesamt ${fmt(pr.totalStripM)}m`);
        }
      }
      // UI-Hint im Kunden-Tab (Auto-Feld)
      versuchen{
        if(typeof kPrivacyRollsAuto!=="undefined" && kPrivacyRollsAuto){
          kPrivacyRollsAuto.value = pr.rolls ? `${pr.rolls} rolls (at ${pr.rollLen}m)` : "";
        }
      }fangen(_){}
    }
    versuchen{
      if(typeof kPrivacyRollsAuto!=="undefined" && kPrivacyRollsAuto){
        kPrivacyRollsAuto.value = pr && pr.rolls ? `${pr.rolls} rolls (at ${pr.rollLen}m)` : "";
      }
    }fangen(_){}
    {
      const cc = computeConcrete(c);
      const unit=(c.concreteMode==="m3")?"m³":"Sack";
      const qty=(c.concreteMode==="m3")?cc.m3:cc.sacks;
      upsertMat(mats, "Beton", qty, unit, `Auto: ${cc.totalHoles} Löcher` + (cc.gateHoles?` (normal ${cc.normalHoles}, Torpfosten ${cc.gateHoles})`:` (normal ${cc.normalHoles})`));
    }
    speichern();
    refreshChefUI();
    toast("Übernommen","→ Chef‑Materialliste");
    setTab("boss");
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
@@ -1338,116 +1433,139 @@ Funktion computeTotals(c){
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
    const segs = segmentList(c);
    let cc = null;
    try { cc = computeConcrete(c); } catch (_) {}
    const concreteQty = (c.concreteMode==="m3") ? (cc ? cc.m3 : 0) : (cc ? cc.sacks : 0);
    const ConcreteUnit = (c.concreteMode==="m3") ? „m³“ : „Sack“;
    const auto = [
      // Matten/Elemente: Name soll wie im Chef‑Tab sein (z.B. "Alu‑Elemente 2,50m • 100 cm")
      { k:"auto_matten", label: sysLabel(c), qty:t.panels||0, unit:"Stk" },
      { k:"auto_pfosten", label:"Pfosten", qty:t.posts||0, unit:"Stk" },
      { k:"auto_eckpfosten", label:"Eckpfosten", qty:t.cornerPosts||0, unit:"Stk" },
      { k:"auto_leisten", label:"Pfostenleisten", qty:t.postStrips||0, unit:"Stk" },
      { k:"auto_beton", label:"Beton", qty:concreteQty||0, unit:concreteUnit }
    ];
    const auto = [];
    if(segs.length){
      for(const seg of segs){
        const st = computeSegmentTotals(seg);
        const prefix = seg.label ? `Abschnitt ${seg.label} – ` : "";
        auto.push({ k:`auto_seg_${seg.label}_matten`, label: `${prefix}${sysLabelForSegment(seg)}`, qty:st.panels||0, unit:"Stk" });
        auto.push({ k:`auto_seg_${seg.label}_pfosten`, label:`${prefix}Pfosten`, qty:st.posts||0, unit:"Stk" });
        auto.push({ k:`auto_seg_${seg.label}_leisten`, label:`${prefix}Pfostenleisten`, qty:st.postStrips||0, unit:"Stk" });
      }
      if(t.cornerPosts) auto.push({ k:"auto_eckpfosten", label:"Eckpfosten", qty:t.cornerPosts||0, unit:"Stk" });
      if(t.cornerPosts) auto.push({ k:"auto_leisten_ecke", label:"Pfostenleisten (Ecken)", qty:t.cornerPosts||0, unit:"Stk" });
    } anders {
      auto.push({ k:"auto_matten", label: sysLabel(c), qty:t.panels||0, unit:"Stk" });
      auto.push({ k:"auto_pfosten", label:"Pfosten", qty:t.posts||0, unit:"Stk" });
      auto.push({ k:"auto_eckpfosten", label:"Eckpfosten", qty:t.cornerPosts||0, unit:"Stk" });
      auto.push({ k:"auto_leisten", label:"Pfostenleisten", qty:t.postStrips||0, unit:"Stk" });
    }
    const pr = computePrivacyRolls(c, t);
    if(segs.length && pr && Array.isArray(pr.segments)){
      for(const det of pr.segments){
        auto.push({ k:`auto_privlen_${det.label||"_"}`, label:`Sichtschutz Abschnitt ${det.label||""}`, qty:det.lengthM||0, unit:"m", note: det.panels ? `${det.panels} Felder • ${det.height||""} cm` : "" });
        if(det.rolls) auto.push({ k:`auto_privrolls_${det.label||"_"}`, label:`Sichtschutz‑Rollen Abschnitt ${det.label||""}`, qty:det.rolls||0, unit:"Rolle", note:`à ${det.rollLen||35}m • ${det.stripsPerPanel||0}×2,5m je Feld • gesamt ${fmt(det.totalStripM||0)}m` });
      }
    } else if((c.privacy||"no")==="yes"){
      if(pr.lengthM>0) auto.push({ k:"auto_privlen", label:"Sichtschutz (Länge)", qty:pr.lengthM||0, unit:"m" });
      if(pr.rolls>0) auto.push({ k:"auto_privrolls", label:"Sichtschutz‑Rollen", qty:pr.rolls||0, unit:"Rolle", note:`à ${pr.rollLen||35}m • ${pr.stripsPerPanel||0}×2,5m je Feld • gesamt ${fmt(pr.totalStripM||0)}m` });
    }
    auto.push({ k:"auto_beton", label:"Beton", qty:concreteQty||0, unit:concreteUnit });
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
      let it = byKey[ak];

      if(!it){
        // Spezial: Matten/Elemente möglichst mit bestehender Zeile zusammenführen
        if(ak==="auto_matten"){
          for(let j=0;j<mats.length;j++){
            const x=mats[j];
            if(!x || x.autoKey) continue;
            if(matCategory(x.name)==="matten"){ it=x; break; }
          }
        }
      }

      if(!it){
        const wantNames = [a.label];
        if(ak==="auto_matten"){ wantNames.push("Matten","Matten/Elemente","Elemente"); }
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

      const note = a.note || "";
      if(!it){
        Falls nicht gewünscht, fortfahren;
        mats.push({ id: uid(), name: a.label, qty: want, unit: a.unit, note :"" , autoKey:ak, override:false });
        mats.push({ id: uid(), name: a.label, qty: want, unit: a.unit, note, autoKey:if, override:false });
      } anders {
        it.autoKey = ak;
        if(typeof it.override !== "boolean") it.override = ((it.qty!=="" && it.qty!==null && it.qty!==undefined) && (Number(it.qty||0)!==0) && (Number(it.qty)!==want));
        it.autoQty = want;
        it.autoUnit = a.unit;
        if(!it.override){
          // Auto darf Name/Qty/Unit aktualisieren (z.B. Systemwechsel → anderer Matten‑Name)
          it.name = a.label;
          it.qty = want;
          it.unit = a.unit;
          if(note) it.note = note;
        }
      }
    }

    // Auto-Zeilen entfernen, wenn sie 0 sind und nicht überschrieben wurden
    p.chef.materials = mats.filter(it=>{
      if(it && it.autoKey && !it.override && (Number(it.qty)||0)===0) return false;
      gib true zurück;
    });

    // AutoKey de-dupe
    const seen = {};
    p.chef.materials = p.chef.materials.filter(it=>{
      if(!it || !it.autoKey) return true;
      if(seen[it.autoKey]) return false;
      seen[it.autoKey]=true;
      gib true zurück;
    });

    // Extra: doppelte Matten/Elemente‑Zeilen entfernen (Alt + Auto), wenn sie offensichtlich identisch sind
    const mAuto = p.chef.materials.find(x=>x && x.autoKey==="auto_matten");
    if(mAuto){
      const autoQtyNum = Number(mAuto.qty)||0;
      const autoName = norm(mAuto.name);
      const dupNames = { "mats":1, "mat elements":1, "mat elements total":1, "elements":1 };
@@ -2137,50 +2255,64 @@ function refreshCustomerUI(){
      }
      const base = p.customer.segments[0] || {};
      p.customer.segments.push({
        id: uid(),
        Etikett,
        Länge:"",
        Höhe: Basis.Höhe || 160,
        system: base.system || "Doppelstab",
        Farbe: Basisfarbe || "Anthrazit (RAL 7016)",
        Datenschutz: base.privacy || "Nein"
      });
      speichern();
      renderSegments();
      toast("Abschnitt hinzugefügt", label);
    }); }

    // Anfangswerte für Adresseneingänge
    if(kStreet) kStreet.value = p.addrStreet || "";
    if(kZip) kZip.value = p.addrZip || "";
    if(kCity) kCity.value = p.addrCity || "";
    if(kCountry) kCountry.value = p.addrCountry || "DE";
    if(kObjAddr) kObjAddr.value = p.objAddr || "";
    updateAddrBar();
    renderSegments();

    const hasSegments = Array.isArray(p.customer.segments) && p.customer.segments.length>0;
    const segLenTotal = hasSegments ? totalLengthFromSegments() : 0;
    if(kLen){
      kLen.readOnly = hasSegments;
      kLen.value = hasSegments ? (segLenTotal ? fmt(segLenTotal) : "") : (c.length||"");
    }
    if(kPrivacy){
      kPrivacy.disabled = hasSegments;
    }
    if(kPrivacyLen){
      kPrivacyLen.disabled = hasSegments || (kPrivacy && kPrivacy.value!=="yes");
      if(hasSegments) kPrivacyLen.value = "";
    }

    if(kStreet && !kStreet.dataset.bound){ kStreet.dataset.bound="1"; kStreet.addEventListener("input", ()=>{ updateAddrBar(); save(); }); }
    if(kCity && !kCity.dataset.bound){ kCity.dataset.bound="1"; kCity.addEventListener("input", ()=>{ updateAddrBar(); save(); }); }
    if(kCountry && !kCountry.dataset.bound){ kCountry.dataset.bound="1"; kCountry.addEventListener("input", ()=>{ updateAddrBar(); save(); }); }
    if(kObjAddr && !kObjAddr.dataset.bound){ kObjAddr.dataset.bound="1"; kObjAddr.addEventListener("input", ()=>{ updateAddrBar(); save(); }); }
    if(kZip && !kZip.dataset.bound){
      kZip.dataset.bound="1";
      kZip.addEventListener("input", ()=>{ updateAddrBar(); save(); });
      kZip.addEventListener("change", ()=>{ updateAddrBar(); save(); tryZipAutofill(); });
      kZip.addEventListener("blur", ()=>{ tryZipAutofill(); });
    }

  }

    function refreshChefUI(){
    const p=currentProject();
    el("chefTitle").textContent = p ? `🛠️ Chef/Team: ${p.title}` : "🛠️ Chef / Team";
    if(!p) return;
    cBagger.value=p.chef.bagger||"no";
    cFrame.value=p.chef.frame||"no";
    if(el("cHandbohr")) el("cHandbohr").value=p.chef.handbohr||"no";
    if(el("cSchubkarre")) el("cSchubkarre").value=p.chef.schubkarre||"no";
    cHaenger.value=p.chef.haenger||"no";
    if(el("cCustomerNote")) el("cCustomerNote").value = (p.customer && p.customer.note) ? p.customer.note : "";
    cNote.value=p.chef.note||"";
    ensureChefAutoMaterials(p);
@@ -2241,27 +2373,25 @@ function refreshCustomerUI(){
    p.customer.height = 160;
    p.customer.system = "Doppelstab";
    p.customer.color = "Anthrazit (RAL 7016)";
    p.customer.privacy = "yes";
    p.customer.privacyRollLen = 35;
    p.customer.gateType = "none";
    p.customer.note = "Demo-Daten – bitte später löschen.";
    p.chef.note = "Team: 2 Mann / 1 Tag (Demo)";
    // zwei Demo-Bilder als Platzhalter
    p.chef.photos = [
      { id: uid(), name:"Demo_Foto_1.svg", dataUrl: makeDemoPhoto("Foto 1"), addedAt: nowISO() },
      { id: uid(), name:"Demo_Foto_2.svg", dataUrl: makeDemoPhoto("Foto 2"), addedAt: nowISO() },
    ];
    state.projects = [p];
    state.selectedProjectId = p.id;
    if(!state.meta) state.meta = {};
    speichern();
    refreshAll();
    toast("✅ Demo geladen", p.title);
  }
  if(btnDemo) btnDemo.addEventListener("click", ()=>{
    if(confirm("Demo-Daten laden? (Ersetzt NICHT deine echten Kunden – aber wird als neuer Kunde angelegt)")){
      loadDemo();
    }
  });


