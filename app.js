let gateUiIdx=0; let gateCollapsed=false;
(() => {
  "use strict";

  // --- Airbag: zeigt JS-Fehler sofort im Toast (damit Tabs/Dropdowns nicht "still" sterben)
  window.addEventListener("error", (e)=>{
    try{
      console.error("[Zaunplaner JS-Error]", e.error || e.message || e);
      try{
        const arr = (window.__ZP_EARLY_ERRORS = window.__ZP_EARLY_ERRORS || []);
        arr.push({at:new Date().toISOString(), type:"error", msg:String(e.message||e.error||e), stack:String((e.error && e.error.stack)||"")});
      }catch(_){ }
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
      try{
        const arr = (window.__ZP_EARLY_ERRORS = window.__ZP_EARLY_ERRORS || []);
        arr.push({at:new Date().toISOString(), type:"promise", msg:String(e.reason||e), stack:String((e.reason && e.reason.stack)||"")});
      }catch(_){ }
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

  // Farben (realistische Standardfarben – erweitert)
  // Hinweis: Segment-Editor nutzt zusätzlich systemabhängige Vorschläge (siehe COLOR_BY_SYSTEM).
  const ZAUNTEAM_FARBEN = [
    // Metall / Standard
    "Anthrazit (RAL 7016)",
    "Moosgrün (RAL 6005)",
    "Schwarz (RAL 9005)",
    "Weiß (RAL 9016)",
    "Steingrau (RAL 7030)",
    "Basaltgrau (RAL 7012)",
    "Silbergrau (RAL 7001)",
    "Aluminiumgrau (RAL 9006)",
    "Feuerverzinkt / Natur",
    // Holz / WPC (gängige Dekore)
    "Holz Natur (Lärche)",
    "Holz Teak",
    "Holz Nussbaum",
    "Holz Grau",
    "WPC Anthrazit",
    "WPC Steingrau",
    "WPC Sand",
    "WPC Teak",
    "WPC Braun"
  ];

  // Systemabhängige Farb-Vorschläge (damit "realistische" Farben pro Material gewählt werden)
  const COLOR_BY_SYSTEM = {
    "Doppelstab": [
      "Anthrazit (RAL 7016)",
      "Moosgrün (RAL 6005)",
      "Schwarz (RAL 9005)",
      "Weiß (RAL 9016)",
      "Steingrau (RAL 7030)",
      "Basaltgrau (RAL 7012)",
      "Feuerverzinkt / Natur"
    ],
    "Diagonalgeflecht": [
      "Anthrazit (RAL 7016)",
      "Moosgrün (RAL 6005)",
      "Feuerverzinkt / Natur"
    ],
    "Tornado": [
      "Anthrazit (RAL 7016)",
      "Moosgrün (RAL 6005)",
      "Feuerverzinkt / Natur"
    ],
    "Elektrozaun": [
      "Natur / Verzinkt",
      "Schwarz (RAL 9005)"
    ],
    "Aluminium": [
      "Anthrazit (RAL 7016)",
      "DB 703 (Eisenglimmer)",
      "Schwarz (RAL 9005)",
      "Weiß (RAL 9016)",
      "Aluminiumgrau (RAL 9006)",
      "Silbergrau (RAL 7001)"
    ],
    "Holz": [
      "Holz Natur (Kiefer/Fichte, kdi)",
      "Holz Natur (Douglasie)",
      "Holz Natur (Lärche)",
      "Holz Natur (Robinie)",
      "Holz Natur (Kastanie)",
      "Holz Thermoholz (Esche)",
      "Holz Thermoholz (Kiefer)",
      "Holz Bangkirai",
      "Holz Teak",
      "Holz Nussbaum",
      "Holz Eiche hell",
      "Holz Grau (geölt)",
      "Holz Schwarz (Lasur)"
    ],
    "WPC": [
      "WPC Anthrazit",
      "WPC Steingrau",
      "WPC Sand",
      "WPC Teak",
      "WPC Braun"
    ]
  };
  const HOLZARTEN = ["—","Lärche","Douglasie","Kiefer","Fichte","Eiche"];
  const WPC_VARIANTEN = ["—","glatt","geriffelt","co-extrudiert"];
  const ELECTRO_WOOD_SUGGESTIONS = ["Robinie","Kastanie","Lärche","Douglasie","Kiefer (kdi)","Fichte (kdi)","Thermoholz","Bambus"];

  const el = (id) => document.getElementById(id);
  const toastEl = el("toast");
  
  async function checkForUpdates(){
    try{
      toast("🔎 Prüfe Update…");
      const url = "app.js?v=" + Date.now();
      const txt = await (await fetch(url, {cache:"no-store"})).text();
      const m = txt.match(/const APP_VERSION = "([^"]+)"/);
      const remote = m ? m[1] : null;
      if(!remote){
        toast("Update-Check: keine Versionsinfo gefunden.");
        return;
      }
      if(remote === APP_VERSION){
        toast("✅ Du bist aktuell ("+APP_VERSION+").");
        return;
      }
      const ok = confirm("Neue Version gefunden: "+remote+" (du hast "+APP_VERSION+"). Jetzt aktualisieren?\n\nHinweis: Deine Kunden bleiben erhalten.");
      if(!ok) return;

      // Safety save (LocalStorage bleibt)
      try{ save(); }catch(_){}
      // Force SW cache refresh if available
      try{
        if(navigator.serviceWorker && navigator.serviceWorker.controller){
          navigator.serviceWorker.controller.postMessage({type:"FORCE_UPDATE"});
        }
      }catch(_){}
      // Hard reload with cache-bust
      const base = location.href.split("?")[0].split("#")[0];
      location.href = base + "?v=" + Date.now();
    }catch(e){
      toast("Update-Check fehlgeschlagen.");
    }
  }

  const btnUpdate = el("btnUpdate");
  if(btnUpdate) btnUpdate.addEventListener("click", checkForUpdates);


  function toast(a,b="") {
    toastEl.style.display="block";
    toastEl.textContent = b ? (a + " — " + b) : a;
    setTimeout(()=> toastEl.style.display="none", 2200);
  }

  // Simple Modal (für Import-Report / Fehler)
  function showModal(title, bodyHtml, buttons=[]){
    try{
      const host = document.getElementById("modalHost");
      const card = document.getElementById("modalCard");
      if(!host || !card) return;
      const btnHtml = (buttons||[]).map((b,i)=>{
        const cls = b.cls || "btn";
        return `<button data-mi="${i}" class="${cls}" type="button">${escapeHtml(b.label||"OK")}</button>`;
      }).join("");
      card.innerHTML = `
        <div class="modalTitle">${escapeHtml(title||"")}</div>
        <div class="modalBody">${bodyHtml||""}</div>
        <div class="modalBtns">${btnHtml || '<button data-mi="0" class="btn" type="button">OK</button>'}</div>
      `;
      host.style.display = "flex";
      card.querySelectorAll("button[data-mi]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
          const idx = Number(btn.getAttribute("data-mi"));
          try{ (buttons[idx] && buttons[idx].onClick) && buttons[idx].onClick(); }catch(_){ }
          hideModal();
        });
      });
      host.addEventListener("click", (e)=>{ if(e && e.target===host) hideModal(); }, {once:true});
    }catch(_){ }
  }
  function hideModal(){
    try{
      const host = document.getElementById("modalHost");
      if(host) host.style.display = "none";
    }catch(_){ }
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

  // Normalisiert System-Bezeichnungen (damit alte Daten/Abkürzungen weiter funktionieren)
  const normSystem = (s) => {
    const x = String(s||"").trim();
    if(!x) return "Doppelstab";
    const low = x.toLowerCase();
    if(low === "alu" || low.startsWith("alu ") || low.startsWith("aluminium")) return "Aluminium";
    if(low === "einfachstab") return "Doppelstab"; // ersetzt (wird nicht mehr angeboten)
    if(low === "diagonal geflecht") return "Diagonalgeflecht";
    return x;
  };
  const colorsForSystem = (sys) => {
    const k = normSystem(sys);
    return COLOR_BY_SYSTEM[k] || ZAUNTEAM_FARBEN;
  };

  const electroWoodDatalistHTML = () => {
    try{
      return `<datalist id="jsWoodSpeciesDL">${(ELECTRO_WOOD_SUGGESTIONS||[]).map(v=>`<option value="${String(v).replace(/"/g,"&quot;")}"></option>`).join("")}</datalist>`;
    }catch(e){ return `<datalist id="jsWoodSpeciesDL"></datalist>`; }
  };

  
  // Alias: Wood species datalist (used for Weidezaun/Holz)
  const woodSpeciesDatalistHTML = electroWoodDatalistHTML;
function setElectroExtrasVisible(det, sys, height){
    if(!det) return;
    const show = (normSystem(sys)==="Elektrozaun");
    det.querySelectorAll(".jsElectroOnly").forEach(el=>{
      el.style.display = show ? "" : "none";
    });
    if(show){
      const wood = det.querySelector('input[data-k="electroWood"]');
      if(wood && !String(wood.value||"").trim()) wood.value = "Robinie";
      const pl = det.querySelector('input[data-k="electroPostLen"]');
      if(pl && !String(pl.value||"").trim()){
        const h = clampInt(Number(height||160), 60, 300);
        const d = clampInt(h + 60, 120, 400);
        pl.value = String(d);
      }
      const sp = det.querySelector('input[data-k="electroSpacing"]');
      if(sp && !String(sp.value||"").trim()) sp.value = "3,0";
      const ex = det.querySelector('input[data-k="electroExtraPct"]');
      if(ex && !String(ex.value||"").trim()) ex.value = "10";
      const li = det.querySelector('input[data-k="electroLitze"]');
      if(li && !String(li.value||"").trim()) li.value = "3";
      const dr = det.querySelector('input[data-k="electroDraht"]');
      if(dr && !String(dr.value||"").trim()) dr.value = "0";
      const ba = det.querySelector('input[data-k="electroBand"]');
      if(ba && !String(ba.value||"").trim()) ba.value = "0";

      // Nur 1 Leiter-Art anzeigen (Litze/Draht/Band)
      const typeSel = det.querySelector('select[data-k="electroType"]');
      const liNow = clampInt(det.querySelector('input[data-k="electroLitze"]')?.value || 0, 0, 50);
      const drNow = clampInt(det.querySelector('input[data-k="electroDraht"]')?.value || 0, 0, 50);
      const baNow = clampInt(det.querySelector('input[data-k="electroBand"]')?.value || 0, 0, 50);

      const pick = ()=>{
        if(baNow>0) return "band";
        if(drNow>0) return "draht";
        return "litze";
      };

      const type = typeSel ? String(typeSel.value||"") : "";
      const want = (type==="litze"||type==="draht"||type==="band") ? type : pick();
      if(typeSel) typeSel.value = want;

      // show/hide groups
      det.querySelectorAll(".jsEType").forEach(el=>{ el.style.display = "none"; });
      det.querySelectorAll(".jsEType_"+want).forEach(el=>{ el.style.display = ""; });

      // Zero-out other conductor counts so only 1 is calculated
      const setNum = (k, v)=>{
        const el = det.querySelector(`input[data-k="${k}"]`);
        if(el) el.value = String(v);
      };
      if(want==="litze"){ setNum("electroDraht",0); setNum("electroBand",0); }
      if(want==="draht"){ setNum("electroLitze",0); setNum("electroBand",0); }
      if(want==="band"){  setNum("electroLitze",0); setNum("electroDraht",0); }

      const lr = det.querySelector('select[data-k="electroLitzeRoll"]');
      if(lr && !String(lr.value||"").trim()) lr.value = "400";
      const rr = det.querySelector('select[data-k="electroDrahtRoll"]');
      if(rr && !String(rr.value||"").trim()) rr.value = "625";
      const br = det.querySelector('select[data-k="electroBandRoll"]');
      if(br && !String(br.value||"").trim()) br.value = "200";

      try{ updateElectroCalc(det); }catch(_){ }
    }
  }

  function applyWeidePreset(det, key){
    try{
      if(!det || !key) return;
      // NOTE: ELECTRO_PRESETS wird weiter unten definiert.
      // Wichtig: NICHT als const WEIDE_PRESETS = ELECTRO_PRESETS aliasen,
      // sonst gibt es in Safari/iOS eine TDZ-ReferenceError beim Initialisieren.
      const p = ELECTRO_PRESETS[key];
      if(!p) return;

      const setVal = (sel, v) => { if(sel){ sel.value = String(v); } };

      const inLit = det.querySelector('input[data-k="weideLitze"]');
      const inDra = det.querySelector('input[data-k="weideDraht"]');
      const inBan = det.querySelector('input[data-k="weideBand"]');
      const inSp  = det.querySelector('input[data-k="weideSpacing"]');
      const inEx  = det.querySelector('input[data-k="weideExtraPct"]');

      // Defaults aus Preset
      if(inBan) inBan.value = String(p.band||0);
      if(inLit) inLit.value = String(p.litze||0);
      if(inDra) inDra.value = String(p.draht||0);
      if(inSp)  inSp.value  = String(p.spacing||3);
      if(inEx)  inEx.value  = String(p.extraPct||10);

      // sinnvolle Rollendefaults
      const lr = det.querySelector('select[data-k="weideLitzeRoll"]');
      if(lr && !String(lr.value||"").trim()) lr.value = "400";
      const rr = det.querySelector('select[data-k="weideDrahtRoll"]');
      if(rr && !String(rr.value||"").trim()) rr.value = "625";
      const br = det.querySelector('select[data-k="weideBandRoll"]');
      if(br && !String(br.value||"").trim()) br.value = "200";

      try{ updateWeideCalc(det); }catch(_){ }
    }catch(_){ }
  }

  function setWeideExtrasVisible(det, sys){
    if(!det) return;
    const isWood = (normSystem(sys)==="Holz");

    // Holz-Block nur bei Holz
    det.querySelectorAll(".jsWoodOnly").forEach(n=>{
      n.style.display = isWood ? "" : "none";
    });
    if(!isWood) return;

    // Neue Holz/Weide-Auswahl (fallback: alte Checkbox)
    const selClass = det.querySelector('select[data-k="woodClass"]');
    const selBuild = det.querySelector('select[data-k="woodBuild"]');
    const legacyCb = det.querySelector('input[data-k="woodIsWeide"]');

    const woodClass = selClass ? String(selClass.value||"holz")
      : ((legacyCb && legacyCb.checked) ? "weide" : "holz");
    const woodBuild = selBuild ? String(selBuild.value||"fields")
      : (woodClass==="weide" ? "boards" : "fields");

    const boardsOn = (woodClass==="weide" || woodBuild==="boards");

    // Bretter/Riegel UI
    det.querySelectorAll(".jsWoodBoardsOnly").forEach(n=>{
      n.style.display = boardsOn ? "" : "none";
    });

    // Sichtschutz bei Weide ausblenden/abschalten (kein Sichtschutz/Beton hier)
    const priv = det.querySelector('select[data-k="privacy"]');
    if(priv){
      if(woodClass==="weide"){
        priv.value = "no";
        priv.disabled = true;
      }else{
        priv.disabled = false;
      }
    }

    // Legacy: Leiter/Litze/Draht/Band bei Bretter-Modus immer auf 0
    if(boardsOn){
      const z = (k)=>{
        const el = det.querySelector(`input[data-k="${k}"]`);
        if(el) el.value = "0";
      };
      ["weideLitze","weideDraht","weideBand"].forEach(z);
    }

    try{ updateWeideCalc(det); }catch(_){ }
  }

  function updateWeideCalc(det){
    try{
      if(!det) return;
      const sys = det.querySelector('select[data-k="system"]') ? String(det.querySelector('select[data-k="system"]').value||"") : "";
      if(normSystem(sys)!=="Holz") return;

      const out = det.querySelector('.jsWeideCalc');
      if(!out) return;

      const selClass = det.querySelector('select[data-k="woodClass"]');
      const selBuild = det.querySelector('select[data-k="woodBuild"]');
      const legacyCb = det.querySelector('input[data-k="woodIsWeide"]');

      const woodClass = selClass ? String(selClass.value||"holz")
        : ((legacyCb && legacyCb.checked) ? "weide" : "holz");
      const woodBuild = selBuild ? String(selBuild.value||"fields")
        : (woodClass==="weide" ? "boards" : "fields");

      const boardsOn = (woodClass==="weide" || woodBuild==="boards");
      if(!boardsOn){
        out.textContent = "";
        return;
      }

      const len = Math.max(0, toNum(det.querySelector('input[data-k="len"]')?.value || "", 0));
      const spacing = Math.max(1, toNum(det.querySelector('input[data-k="weideSpacing"]')?.value || "", 3));
      const extraPct = toNum(det.querySelector('input[data-k="weideExtraPct"]')?.value || "", 10);
      const factor = 1 + (extraPct/100);

      const intervals = len ? Math.ceil(len / spacing) : 0;
      const posts = intervals ? (intervals + 1) : 0;
      const corners = clampInt(det.querySelector('input[data-k="corners"]')?.value || 0, 0, posts);

      const rows = clampInt(det.querySelector('input[data-k="weideBoards"]')?.value || 0, 0, 50);
      const boardsPiecesBase = intervals * rows;
      const boardsPieces = boardsPiecesBase ? Math.ceil(boardsPiecesBase * factor) : 0;

      const parts = [];
      parts.push(`Pfosten: ${posts} (Ecken ${corners})`);
      if(rows){
        parts.push(`Bretter/Riegel: ${rows} Reihen → ${boardsPieces} Stk à ${fmt(spacing)} m`);
      }else{
        parts.push(`Bretter/Riegel: (Reihen fehlt)`);
      }
      out.textContent = parts.join(" • ");
    }catch(_){ }
  }


  function updateElectroCalc(det){
    try{
      if(!det) return;
      const sys = det.querySelector('select[data-k="system"]') ? String(det.querySelector('select[data-k="system"]').value||"") : "";
      if(normSystem(sys)!=="Elektrozaun") return;

      const len = Math.max(0, toNum(det.querySelector('input[data-k="len"]')?.value || "", 0));
      const extraPct = toNum(det.querySelector('input[data-k="electroExtraPct"]')?.value || "", 10);
      const factor = 1 + (extraPct/100);
      const base = len * factor;

      const litzeN = clampInt(det.querySelector('input[data-k="electroLitze"]')?.value || 0, 0, 50);
      const drahtN = clampInt(det.querySelector('input[data-k="electroDraht"]')?.value || 0, 0, 50);
      const bandN  = clampInt(det.querySelector('input[data-k="electroBand"]')?.value || 0, 0, 50);

      const litzeM = base * litzeN;
      const drahtM = base * drahtN;
      const bandM  = base * bandN;

      const lr = clampInt(det.querySelector('select[data-k="electroLitzeRoll"]')?.value || 400, 50, 5000);
      const dr = clampInt(det.querySelector('select[data-k="electroDrahtRoll"]')?.value || 625, 50, 5000);
      const br = clampInt(det.querySelector('select[data-k="electroBandRoll"]')?.value || 200, 50, 5000);

      const rolls = (m, r)=> (m>0 ? Math.ceil(m / r) : 0);

      const out = det.querySelector('.jsElectroCalc');
      if(out){
        const baseTxt = `Basis: ${fmt(len)} m + ${fmt(extraPct)}% = ${fmt(base)} m`;
        const parts = [];
        if(litzeN>0) parts.push(`Litze: ${litzeN}× = ${fmt(litzeM)} m (≈ ${rolls(litzeM, lr)} Rolle(n) à ${lr} m)`);
        if(drahtN>0) parts.push(`Draht: ${drahtN}× = ${fmt(drahtM)} m (≈ ${rolls(drahtM, dr)} Rolle(n) à ${dr} m)`);
        if(bandN>0)  parts.push(`Band: ${bandN}× = ${fmt(bandM)} m (≈ ${rolls(bandM, br)} Rolle(n) à ${br} m)`);
        out.textContent = parts.length ? (`${baseTxt} — ` + parts.join(' • ')) : (`${baseTxt} — (noch keine Litzen/Drähte/Bänder eingetragen)`);
      }
    }catch(e){/*silent*/}
  }

  const ELECTRO_PRESETS = {
    pferd:     { band: 3, litze: 0, draht: 0, spacing: 4,   extraPct: 10 },
    rind:      { band: 0, litze: 2, draht: 0, spacing: 4,   extraPct: 10 },
    schaf:     { band: 0, litze: 4, draht: 0, spacing: 3.5, extraPct: 10 },
    ziege:     { band: 0, litze: 5, draht: 0, spacing: 3.5, extraPct: 10 },
    wolf:      { band: 0, litze: 0, draht: 5, spacing: 3,   extraPct: 10 },
    gefluegel: { band: 0, litze: 6, draht: 0, spacing: 2.5, extraPct: 10 }
  };

  function applyElectroPreset(det, key){
    try{
      if(!det || !key) return;
      const p = ELECTRO_PRESETS[String(key||"")];
      if(!p) return;

      // Auswahl: nur 1 Leiter-Art (Litze/Draht/Band)
      const typeSel = det.querySelector('select[data-k="electroType"]');
      let type = "litze";
      if((p.band||0) > 0) type = "band";
      else if((p.draht||0) > 0) type = "draht";
      else type = "litze";
      if(typeSel) typeSel.value = type;

      const setNum = (k, val)=>{
        const el = det.querySelector(`input[data-k="${k}"]`);
        if(el) el.value = String(val);
      };

      setNum("electroSpacing", p.spacing||3);
      setNum("electroExtraPct", p.extra||10);

      setNum("electroLitze", (type==="litze") ? (p.litze||0) : 0);
      setNum("electroDraht", (type==="draht") ? (p.draht||0) : 0);
      setNum("electroBand",  (type==="band")  ? (p.band||0)  : 0);

      setNum("electroLitzeRoll", p.litzeRoll||200);
      setNum("electroDrahtRoll", p.drahtRoll||625);
      setNum("electroBandRoll",  p.bandRoll||200);

      try{ setElectroExtrasVisible(det, "Elektrozaun", 160); }catch(_){}
      try{ updateElectroCalc(det); }catch(_){}
    }catch(e){
      console.warn("applyElectroPreset failed", e);
    }
  };

      

function escapeHtml(s) {
    return String(s||"").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
  }

  const APP_VERSION = "1.4.46";
  const APP_BUILD = "2025-12-22";
  const APP_NAME = "Zaunteam Zaunplaner";

  // iOS / PWA Erkennung (für robuste Hinweise – iOS kann Storage in Safari-Tabs aggressiv räumen)
  const IS_IOS = (()=>{
    try{
      const ua = navigator.userAgent || "";
      const iOS = /iPad|iPhone|iPod/i.test(ua);
      const iPadOS = (navigator.platform === "MacIntel" && (navigator.maxTouchPoints||0) > 1);
      return iOS || iPadOS;
    }catch(_){ return false; }
  })();
  function isStandalone(){
    try{
      return (!!(window.navigator && window.navigator.standalone)) ||
        (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);
    }catch(_){ return false; }
  }
  async function requestPersistentStorage(){
    try{
      if(!navigator.storage || !navigator.storage.persist) return {supported:false, persisted:null, granted:null};
      const persisted = await navigator.storage.persisted();
      if(persisted) return {supported:true, persisted:true, granted:true};
      const granted = await navigator.storage.persist();
      return {supported:true, persisted:!!granted, granted:!!granted};
    }catch(_){ return {supported:false, persisted:null, granted:null}; }
  }

  let PERSIST_INFO = {supported:false, persisted:null, granted:null};
  let STORAGE_EST = null;

  // Default-Settings (offline-first, kein Tracking)
  const DEFAULT_SETTINGS = {
    shareOnExport: true,
    supportEmail: "",
    // vorbereitet (ohne Zwang)
    reminderPrep: false
  };

  // Globaler State
  let state = {
    version: APP_VERSION,
    selectedProjectId: null,
    projects: [],
    settings: {...DEFAULT_SETTINGS},
    meta: { lastSavedAt:"", lastBackupAt:"", logs:[] }
  };

  let BOOT_DONE = false;

  /******************************************************************
   * Lokales Logging (nur lokal, keine Analytics)
   ******************************************************************/
  const EARLY_LOGS = [];
  function logEvent(type, msg, data){
    try{
      const entry = {
        at: nowISO(),
        type: String(type||"info"),
        msg: String(msg||""),
        data: (data===undefined) ? "" : (()=>{ try{ return JSON.stringify(data).slice(0,1200); }catch(_){ return String(data).slice(0,1200); } })()
      };
      if(state && state.meta){
        if(!Array.isArray(state.meta.logs)) state.meta.logs = [];
        state.meta.logs.push(entry);
        if(state.meta.logs.length>250) state.meta.logs = state.meta.logs.slice(-200);
      }else{
        EARLY_LOGS.push(entry);
        if(EARLY_LOGS.length>80) EARLY_LOGS.splice(0, EARLY_LOGS.length-60);
      }
    }catch(_){ }
  }
  function flushEarlyLogs(){
    try{
      try{
        const ee = window.__ZP_EARLY_ERRORS;
        if(Array.isArray(ee) && ee.length){
          for(const it of ee) EARLY_LOGS.push(it);
          ee.length = 0;
        }
      }catch(_){ }
      if(!EARLY_LOGS.length) return;
      if(!state.meta) state.meta = {lastSavedAt:"", lastBackupAt:"", logs:[]};
      if(!Array.isArray(state.meta.logs)) state.meta.logs = [];
      state.meta.logs = state.meta.logs.concat(EARLY_LOGS).slice(-200);
      EARLY_LOGS.length = 0;
    }catch(_){ }
  }

  /******************************************************************
   * PERSISTENZ-GUARD
   *
   * Manche Browser/Setups (z.B. iOS Safari "Privat" oder lokale file://-Öffnung)
   * verlieren localStorage oder blockieren ihn teilweise. Dann wirkt es so,
   * als würden "Kunden nicht gespeichert".
   *
   * Lösung:
   * 1) localStorage-Schreibtest + sichtbarer Hinweis (Speicher AUS)
   * 2) zusätzlich IndexedDB als Fallback-Backup (wenn verfügbar)
   ******************************************************************/

  function storageTest(){
    try{
      const k="__zp_test__";
      localStorage.setItem(k,"1");
      const ok = (localStorage.getItem(k)==="1");
      localStorage.removeItem(k);
      return ok;
    }catch(e){
      return false;
    }
  }

  let STORAGE_OK = storageTest();
  let STORAGE_WARNED = false;

  // IndexedDB Mini-KV
  const IDB_NAME = "zaunteam_zaunplaner_db";
  const IDB_STORE = "kv";

  function idbOpen(){
    return new Promise((resolve,reject)=>{
      try{
        if(!window.indexedDB) return resolve(null);
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = ()=>{
          try{
            const db = req.result;
            if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
          }catch(e){}
        };
        req.onsuccess = ()=> resolve(req.result);
        req.onerror = ()=> resolve(null);
      }catch(e){
        resolve(null);
      }
    });
  }

  async function idbSet(key, value){
    try{
      const db = await idbOpen();
      if(!db) return false;
      return await new Promise((resolve)=>{
        const tx = db.transaction(IDB_STORE, "readwrite");
        const st = tx.objectStore(IDB_STORE);
        const r = st.put(value, key);
        r.onsuccess = ()=> resolve(true);
        r.onerror = ()=> resolve(false);
      });
    }catch(e){
      return false;
    }
  }

  async function idbGet(key){
    try{
      const db = await idbOpen();
      if(!db) return null;
      return await new Promise((resolve)=>{
        const tx = db.transaction(IDB_STORE, "readonly");
        const st = tx.objectStore(IDB_STORE);
        const r = st.get(key);
        r.onsuccess = ()=> resolve(r.result ?? null);
        r.onerror = ()=> resolve(null);
      });
    }catch(e){
      return null;
    }
  }

  
// CacheStorage Mirror (3. Backup-Schicht)
// Hinweis: iOS kann einzelne Storage-Arten löschen; wir spiegeln daher zusätzlich in Cache Storage.
// Achtung: Der Service Worker räumt Caches mit Prefix "zaunplaner-" auf.
// Deshalb darf dieser Cache NICHT so heißen, sonst wird der State beim Update gelöscht.
const STATE_CACHE_NAME = "zp-state-cache-v2";
const STATE_CACHE_KEY = "/__zp_state__.json";

async function cacheSet(value){
  try{
    if(!("caches" in window)) return false;
    const c = await caches.open(STATE_CACHE_NAME);
    const res = new Response(value, {headers: {"Content-Type":"application/json; charset=utf-8"}});
    await c.put(STATE_CACHE_KEY, res);
    return true;
  }catch(e){
    return false;
  }
}

async function cacheGet(){
  try{
    if(!("caches" in window)) return null;
    const c = await caches.open(STATE_CACHE_NAME);
    const res = await c.match(STATE_CACHE_KEY);
    if(!res) return null;
    return await res.text();
  }catch(e){
    return null;
  }
}

  function warnStorageOnce(){
    if(STORAGE_WARNED) return;
    STORAGE_WARNED = true;
    try{
      toast("⚠️ Speichern ist gerade nicht dauerhaft möglich", "Bitte als Web-App öffnen (https) oder Backup nutzen");
    }catch(e){}
  }

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

  function isValidState(s){
    try{
      if(!s || typeof s !== "object") return false;
      if(!Array.isArray(s.projects)) return false;
      // mind. Struktur prüfen (keine harten Regeln, damit alte Backups noch gehen)
      return true;
    }catch(_){ return false; }
  }

  function save(){
    try{ flushEarlyLogs(); }catch(_){ }


    if(!BOOT_DONE){
      // Wichtig: niemals vor dem initialen Storage-Load schreiben (sonst werden Daten überschrieben).
      return;
    }
    // Defaults sicherstellen
    if(!state.settings) state.settings = {...DEFAULT_SETTINGS};
    else state.settings = {...DEFAULT_SETTINGS, ...(state.settings||{})};
    if(!state.meta) state.meta = {lastSavedAt:"", lastBackupAt:"", logs:[]};
    if(!Array.isArray(state.meta.logs)) state.meta.logs = [];

    // Timestamp wird mitgespeichert
    state.meta.lastSavedAt = nowISO();

    if(!isValidState(state)){
      STORAGE_OK = false;
      warnStorageOnce();
      logEvent("error", "Save blocked: invalid state", {hasProjects:Array.isArray(state && state.projects), version:state && state.version});
      return;
    }

    const payload = (()=>{ try{ return JSON.stringify(state); }catch(e){ return null; }})();
    if(!payload){
      STORAGE_OK = false;
      warnStorageOnce();
      logEvent("error", "Save blocked: JSON stringify failed");
      return;
    }

    // localStorage write-through + verify
    try{
      localStorage.setItem(STORAGE_KEY, payload);
      const back = localStorage.getItem(STORAGE_KEY);
      if(back !== payload){
        STORAGE_OK = false;
        warnStorageOnce();
        logEvent("warn", "localStorage verify mismatch");
      }
      // Safety: last known good
      if(state.projects && state.projects.length){
        try{ localStorage.setItem(STORAGE_KEY+"_lastgood", payload); }catch(_){ }
      }
    }catch(e){
      STORAGE_OK = false;
      warnStorageOnce();
      logEvent("warn", "localStorage write failed", {err:String(e && e.message || e)});
    }

    // IndexedDB mirror (robust gegen iOS localStorage-Glitches)
    try{ idbSet("state", payload); }catch(_){ }
    try{ cacheSet(payload); }catch(_){ }

    updateStatusPill();
    try{ renderProjectOverview(); }catch(_){ }
  }

  
async function migrateLegacy() {
  // 1) Primär: localStorage
  let stable = null;
  try{ stable = localStorage.getItem(STORAGE_KEY); }catch(e){ STORAGE_OK = false; warnStorageOnce(); stable = null; }
  if(stable) {
    try {
      const s = JSON.parse(stable);
      if(s && Array.isArray(s.projects)) {
        state = {...state, ...s, version:APP_VERSION};
        state.settings = {...DEFAULT_SETTINGS, ...(s.settings||{})};
        if(!state.meta) state.meta={ lastSavedAt:"", lastBackupAt:"", logs:[] };
        if(!Array.isArray(state.meta.logs)) state.meta.logs=[];
        return;
      }
    } catch(e){}
  }

  // 2) Fallback: IndexedDB Spiegel
  try{
    const txt = await idbGet("state");
    if(txt){
      let s=null;
      try{ s = JSON.parse(txt); }catch(_){ s=null; }
      if(s && Array.isArray(s.projects) && s.projects.length){
        state = {...state, ...s, version:APP_VERSION};
        state.settings = {...DEFAULT_SETTINGS, ...(s.settings||state.settings||{})};
        if(!state.meta) state.meta={ lastSavedAt:"", lastBackupAt:"", logs:[] };
        if(!Array.isArray(state.meta.logs)) state.meta.logs=[];
        // zurück nach localStorage spiegeln (wenn möglich)
        try{
          localStorage.setItem(STORAGE_KEY, txt);
          localStorage.setItem(STORAGE_KEY+"_lastgood", txt);
        }catch(e){
          STORAGE_OK = false;
        }
        try{ cacheSet(txt); }catch(_){}
        try{ toast("✅ Kunden geladen", "IndexedDB"); }catch(_){}
        return;
      }
    }
  }catch(e){}

  // 3) Fallback: CacheStorage Spiegel
  try{
    const cTxt = await cacheGet();
    if(cTxt){
      let s=null;
      try{ s = JSON.parse(cTxt); }catch(_){ s=null; }
      if(s && Array.isArray(s.projects) && s.projects.length){
        state = {...state, ...s, version:APP_VERSION};
        state.settings = {...DEFAULT_SETTINGS, ...(s.settings||state.settings||{})};
        if(!state.meta) state.meta={ lastSavedAt:"", lastBackupAt:"", logs:[] };
        if(!Array.isArray(state.meta.logs)) state.meta.logs=[];
        try{
          localStorage.setItem(STORAGE_KEY, cTxt);
          localStorage.setItem(STORAGE_KEY+"_lastgood", cTxt);
        }catch(e){
          STORAGE_OK = false;
        }
        try{ idbSet("state", cTxt); }catch(_){}
        try{ toast("✅ Kunden geladen", "Cache"); }catch(_){}
        return;
      }
    }
  }catch(e){}

  // 4) Recovery: lastgood (nur wenn localStorage noch erreichbar ist)
  try{
    const lg = (()=>{ try{ return localStorage.getItem(STORAGE_KEY+"_lastgood"); }catch(e){ return null; }})();
    if(lg){
      const s2 = JSON.parse(lg);
      if(s2 && Array.isArray(s2.projects) && s2.projects.length && (!state.projects || !state.projects.length)){
        state = {...state, ...s2, version:APP_VERSION};
        state.settings = {...DEFAULT_SETTINGS, ...(s2.settings||state.settings||{})};
        if(!state.meta) state.meta={ lastSavedAt:"", lastBackupAt:"", logs:[] };
        if(!Array.isArray(state.meta.logs)) state.meta.logs=[];
        // nicht sofort überschreiben – nur anzeigen
        setTimeout(()=>{ try{ toast("✅ Kunden wiederhergestellt (Backup)"); }catch(e){} }, 50);
        return;
      }
    }
  }catch(e){}

  // 5) Legacy Keys
  for(const k of LEGACY_KEYS) {
    const raw = (()=>{ try{ return localStorage.getItem(k); }catch(e){ return null; }})();
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

  // 6) Demo als Fallback
  const demo = blankProject("Demo – Kunde Beispiel");
  demo.plannedDate = "2025-12-16";
  state.projects = [demo];
  state.selectedProjectId = demo.id;

  // Wenn Storage blockiert ist, nicht aggressiv überschreiben.
  // (Bei iOS kann localStorage beim Schließen verschwinden – daher trotzdem nach IDB/Cache spiegeln.)
  try{
    const payload = JSON.stringify(state);
    if(STORAGE_OK){
      try{ localStorage.setItem(STORAGE_KEY, payload); }catch(e){ STORAGE_OK=false; }
    }
    try{ idbSet("state", payload); }catch(_){}
    try{ cacheSet(payload); }catch(_){}
  }catch(_){}
  if(STORAGE_OK) save();
}

function currentProject() {
    return state.projects.find(p=>p.id===state.selectedProjectId) || null;
  }

  function updateStatusPill() {
    const p = currentProject();
    const base = p ? (`aktiv: ${p.title} • ${p.status}`) : "kein Kunde";
    el("statusPill").textContent = STORAGE_OK ? base : (base + " • ⚠️ Speicher AUS");
    const vp = el("verPill");
    if(vp){
      const v = (state && state.version) ? state.version : APP_VERSION;
      vp.textContent = "v" + v;
      vp.title = "Zaunplaner v" + v + " • Build " + APP_BUILD + (STORAGE_OK ? "" : " • Speicher AUS (Backup nutzen)");
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

  function refreshSettingsUI(){
    try{
      if(!state.settings) state.settings = {...DEFAULT_SETTINGS};
      const box = el("storageStatusBox");
      const pill = el("storagePill");
      const isHttps = (location.protocol === "https:");
      const isFile = (location.protocol === "file:");
      const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || !!(window.navigator && window.navigator.standalone);
      const projCount = Array.isArray(state.projects) ? state.projects.length : 0;
      const lastS = (state.meta && state.meta.lastSavedAt) ? state.meta.lastSavedAt : "";
      const lastB = (state.meta && state.meta.lastBackupAt) ? state.meta.lastBackupAt : "";
      const env = `${isHttps?"https":""}${isFile?"file":""}${(!isHttps && !isFile)?location.protocol.replace(':',''):""}`;
      const storageLine = STORAGE_OK ? "✅ Speicher OK" : "⚠️ Speicher unsicher (Backup nutzen)";
      if(pill) pill.textContent = storageLine;
      if(box){
        box.innerHTML = `
          <div><b>${storageLine}</b></div>
          <div class="hint" style="margin-top:6px;">
            Modus: <b>${standalone?"Installiert (PWA)":"Browser"}</b> • Protokoll: <b>${escapeHtml(env)}</b><br>
            Projekte: <b>${projCount}</b><br>
            Letztes Speichern: <b>${escapeHtml(lastS||"—")}</b><br>
            Letztes Backup: <b>${escapeHtml(lastB||"—")}</b>
          </div>
        `;
      }

      const sh = el("setShareOnExport");
      if(sh) sh.checked = !(state.settings && state.settings.shareOnExport===false);

      const se = el("setSupportEmail");
      if(se && document.activeElement!==se) se.value = String(state.settings.supportEmail||"");

      const info = el("supportInfo");
      if(info){
        const standalone2 = isStandalone();
        const env2 = `${location.protocol}//${location.host}${location.pathname}`;
        const persistLine = (PERSIST_INFO && PERSIST_INFO.supported) ? (PERSIST_INFO.persisted ? "persist: ✅" : "persist: ⚠️") : "persist: —";
        const estLine = (STORAGE_EST && (STORAGE_EST.quota||STORAGE_EST.usage)) ? ` • Storage: ${Math.round((STORAGE_EST.usage||0)/1024/1024)}MB / ${Math.round((STORAGE_EST.quota||0)/1024/1024)}MB` : "";
        info.innerHTML = `Version: <b>${escapeHtml(APP_VERSION)}</b> • Build: <b>${escapeHtml(APP_BUILD)}</b><br>`+
          `Modus: <b>${standalone2?"Installiert (PWA)":"Browser"}</b> • ${persistLine}${estLine}<br>`+
          `iOS: <b>${IS_IOS?"ja":"nein"}</b><br>`+
          `<span class="hint">${escapeHtml(env2)}</span>`;
      }
      const btnMail = el("btnSupportMail");
      if(btnMail){
        const m = String(state.settings.supportEmail||"").trim();
        btnMail.disabled = !m;
      }

      const logBox = el("logBox");
      if(logBox){
        const logs = (state.meta && Array.isArray(state.meta.logs)) ? state.meta.logs.slice(-20).reverse() : [];
        logBox.innerHTML = logs.length ? logs.map(l=>`<div class="hint">${escapeHtml(l.at||"")} — <b>${escapeHtml(l.type||"")}</b>: ${escapeHtml(l.msg||"")}</div>`).join("") : `<div class="hint">(keine Logs)</div>`;
      }
    }catch(_){ }
  }

  async function runStorageSelfTest(){
    const lines=[];
    try{
      const k = "__zp_test__"+Math.random().toString(36).slice(2);
      localStorage.setItem(k, "1");
      const ok = localStorage.getItem(k)==="1";
      localStorage.removeItem(k);
      lines.push(`localStorage: ${ok?"OK":"FAIL"}`);
    }catch(e){ lines.push(`localStorage: FAIL (${String(e && e.message || e)})`); }
    try{
      const t = `test_${Date.now()}`;
      const w = await idbSet(t, "ok");
      const r = await idbGet(t);
      lines.push(`IndexedDB: ${(w && r==="ok")?"OK":"FAIL"}`);
    }catch(e){ lines.push(`IndexedDB: FAIL (${String(e && e.message || e)})`); }
    showModal("Speicher-Selbsttest", `<div class="hint">${escapeHtml(lines.join("\n")).replace(/\n/g,"<br>")}</div>`, [{label:"OK", cls:"btn green"}]);
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
    refreshHeader();
  }
  function showCustomerEdit(){
    const lv=el("kundenListView"), ev=el("kundenEditView");
    if(lv) lv.style.display="none";
    if(ev) ev.style.display="block";
    refreshHeader();
  }


  document.querySelectorAll(".tabBtn").forEach(b=>b.addEventListener("click", ()=> setTab(b.dataset.tab)));
  // Initiale Ansicht wird nach Storage-Load in init() gesetzt (verhindert frühe Nebenwirkungen)

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

  // Behalte benutzerdefinierte Werte in Selects (falls nicht in den Optionen enthalten)
  function ensureOption(sel, value, labelSuffix=""){
    const v = String(value||"").trim();
    if(!v) return;
    const exists = Array.from(sel.options).some(o => o.value === v);
    if(exists) return;
    const o = document.createElement("option");
    o.value = v;
    o.textContent = labelSuffix ? `${v} ${labelSuffix}` : v;
    sel.insertBefore(o, sel.firstChild);
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
      <th style="padding:10px; width:1%; white-space:nowrap;"></th>
    </tr></thead><tbody>`;
    if(!list.length){
      html += `<tr><td colspan="4" style="padding:12px; opacity:.8;">Keine Treffer</td></tr>`;
    } else {
      for(const p of list){
        const isActive = (p.id === state.selectedProjectId);
        html += `<tr data-pid="${p.id}" style="cursor:pointer; ${isActive?'background:rgba(34,197,94,.12);':''}">
          <td style="padding:10px; border-top:1px solid rgba(255,255,255,.06);">${escapeHtml(p.title||"")}</td>
          <td style="padding:10px; border-top:1px solid rgba(255,255,255,.06);">${escapeHtml(p.status||"")}</td>
          <td style="padding:10px; border-top:1px solid rgba(255,255,255,.06); text-align:right;">${escapeHtml(p.plannedHours||"")}</td>
          <td style="padding:10px; border-top:1px solid rgba(255,255,255,.06); text-align:right;">
            <button class="btn small bad" type="button" data-del="${p.id}" title="Kunde löschen">🗑</button>
          </td>
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

    // delete button in list
    projOverview.querySelectorAll("button[data-del]").forEach(btn=>{
      btn.addEventListener("click", (ev)=>{
        try{ ev.stopPropagation(); }catch(_){}
        const pid = btn.getAttribute("data-del");
        const p = (state.projects||[]).find(x=>x.id===pid);
        if(!p) return;
        if(!confirm(`Kunde wirklich löschen?\n\n${p.title}`)) return;
        state.projects = (state.projects||[]).filter(x=>x.id!==pid);
        if(state.selectedProjectId===pid){
          state.selectedProjectId = (state.projects[0] && state.projects[0].id) ? state.projects[0].id : null;
        }
        save(); refreshAll();
        if(!state.selectedProjectId) showCustomerList();
        toast("Gelöscht");
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


  function clampInt(v, lo=0, hi=9999) {
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
    c.privacyRollLen = (c.privacy==="yes") ? (toNum((kPrivacyRoll ? kPrivacyRoll.value : (c.privacyRollLen||35)),35) || 35) : 35;
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

  
  // Plausibilitätschecks (damit Demo beim Chef sauber wirkt)
  
  // Adresse / PLZ→Ort Lookup (DE)
  const ZIP_CITY_CACHE_KEY = "jsZipCityCache_v1";
  function getZipCityCache(){
    try{ return JSON.parse(localStorage.getItem(ZIP_CITY_CACHE_KEY)||"{}")||{}; }catch(e){ return {}; }
  }
  function setZipCityCache(cache){
    try{ localStorage.setItem(ZIP_CITY_CACHE_KEY, JSON.stringify(cache||{})); }catch(e){}
  }
  async function lookupCityByZip(zip){
    zip = String(zip||"").trim();
    if(!/^[0-9]{5}$/.test(zip)) return "";
    const cache = getZipCityCache();
    if(cache[zip]) return cache[zip];

    // 1) zippopotam.us (free)
    try{
      const r = await fetch(`https://api.zippopotam.us/DE/${zip}`, { cache:"no-store" });
      if(r.ok){
        const j = await r.json();
        const place = j && j.places && j.places[0];
        const city = place ? (place["place name"] || "") : "";
        if(city){
          cache[zip]=city; setZipCityCache(cache);
          return city;
        }
      }
    }catch(e){}

    // 2) openplzapi (fallback)
    try{
      const r = await fetch(`https://openplzapi.org/de/Localities?postalCode=${zip}`, { cache:"no-store" });
      if(r.ok){
        const j = await r.json();
        const city = (Array.isArray(j) && j[0] && (j[0].name || j[0].localityName)) ? (j[0].name || j[0].localityName) : "";
        if(city){
          cache[zip]=city; setZipCityCache(cache);
          return city;
        }
      }
    }catch(e){}
    return "";
  }

  function fullCustomerAddress(p){
    const street = (p.addrStreet||"").trim();
    const zip = (p.addrZip||"").trim();
    const city = (p.addrCity||"").trim();
    const country = (p.addrCountry||"DE").trim();
    const parts = [];
    if(street) parts.push(street);
    const zc = [zip, city].filter(Boolean).join(" ");
    if(zc) parts.push(zc);
    if(country && country.toUpperCase()!=="DE") parts.push(country);
    return parts.join(", ");
  }

  function mapsLink(p){
    const q = ((p.objAddr||"").trim() || fullCustomerAddress(p) || (p.addr||"").trim());
    if(!q) return "";
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }
function validateProject(p){
    const issues = [];
    if(!p) { issues.push("Kein Kunde ausgewählt."); return issues; }
    const c = p.customer || {};
    const segs = Array.isArray(c.segments) ? c.segments : [];
    const len = segs.length ? segs.reduce((a,s)=>a+Math.max(0,toNum(s.length ?? s.lengthM,0)),0) : toNum(c.length, 0);
    const firstSeg = segs.find(s=>toNum(s.length ?? s.lengthM,0)>0) || segs[0] || null;
    if(!len || len<=0) issues.push("Zaunlänge fehlt (m).");
    if(!c.height && !firstSeg) issues.push("Höhe fehlt.");
    if(!c.system && !firstSeg) issues.push("System fehlt.");
    // Sichtschutz nur wenn Länge vorhanden
    if(c.privacy==="yes" && (!len || len<=0)) issues.push("Sichtschutz gewählt, aber Zaunlänge fehlt.");
    // Tore: wenn gateType != none aber keine Varianten
    if(c.gateType && c.gateType!=="none" && (!Array.isArray(c.gates) || !c.gates.length)) issues.push("Tor-Typ gewählt, aber keine Tor-Varianten hinterlegt.");
    return issues;
  }

  function showIssues(issues){
    if(!issues || !issues.length) return true;
    toast("⚠️ Bitte prüfen: " + issues[0]);
    return false;
  }
function computeTotals(c){
    // Robust: Segment-Mode automatisch aktiv, sobald Segmente mit Länge vorhanden sind.
    const segsAll = Array.isArray(c && c.segments) ? c.segments : [];
    const segs = segsAll.filter(s=>Math.max(0,toNum(s.length ?? s.lengthM,0))>0);

    const segmentsActive = (segs.length>0);

    const totalLen = segmentsActive
      ? segs.reduce((a,s)=>a + toNum(s.length ?? s.lengthM,0), 0)
      : toNum(c && c.length,0);

    const panels = totalLen>0 ? Math.ceil(totalLen / PANEL_W) : 0;

    // Posts: contiguous fence => panels + 1 (wenn es überhaupt Panels gibt)
    const posts = panels>0 ? (panels + 1) : 0;

    let cornerPosts = 0;
    if(segmentsActive){
      cornerPosts = segs.reduce((a,s)=>a + clampInt(s.corners||0,0,999), 0);
    } else {
      cornerPosts = clampInt((c && c.corners)||0,0,999);
    }
    cornerPosts = clampInt(cornerPosts,0,posts);

    const postStrips = posts; // 1 Leiste pro Pfosten (inkl. Ecken)

    // Backward compatible keys
    return {
      totalLen,
      lengthM: totalLen,
      panels,
      posts,
      cornerPosts,
      corners: cornerPosts,
      postStrips
    };
  }
  function computePrivacyRolls(c, totals){
    try{
      if(!c) return {rolls:0, rollLen:35, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0};

      const rollLen = clampInt(c.privacyRollLen || 35, 20, 100);

      // Wenn Segmente vorhanden: summiere Sichtschutz je Segment (Höhen können variieren)
      if(Array.isArray(c.segments) && c.segments.length){
        let totalStripM = 0;
        let lengthM = 0;
        let panelsAll = 0;

        for(const s of c.segments){
          const segLen = Math.max(0, toNum(s.length ?? s.lengthM,0));
          const segPriv = (s.privacy||c.privacy||"no")==="yes";
          if(!segLen){ continue; }
          lengthM += segLen;
          const panels = segLen ? Math.ceil(segLen / PANEL_W) : 0;
          panelsAll += panels;
          if(!segPriv) continue;
          const h = Number(s.height||c.height)||160;
          const stripsPerPanel = Math.max(0, Math.round(h/20)); // 100→5,120→6...
          totalStripM += panels * stripsPerPanel * PANEL_W;
        }
        const rolls = totalStripM ? Math.ceil(totalStripM / rollLen) : 0;
        return {rolls, rollLen, stripsPerPanel:0, panels:panelsAll, totalStripM, lengthM};
      }

      // Legacy (ein Abschnitt)
      if((c.privacy||"no")!=="yes") return {rolls:0, rollLen, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0};
      const h = Number(c.height)||160;
      const stripsPerPanel = Math.max(0, Math.round(h/20));
      const baseLen = toNum(c.privacyLen, 0) || (totals && totals.lengthM) || toNum(c.length, 0) || 0;
      const lengthM = Math.max(0, baseLen);
      const panels = lengthM ? Math.ceil(lengthM / PANEL_W) : 0;
      const totalStripM = panels * stripsPerPanel * PANEL_W;
      const rolls = totalStripM ? Math.ceil(totalStripM / rollLen) : 0;
      return {rolls, rollLen, stripsPerPanel, panels, totalStripM, lengthM};
    }catch(e){
      return {rolls:0, rollLen:35, stripsPerPanel:0, panels:0, totalStripM:0, lengthM:0};
    }
  }

  function computePrivacyForSegment(segLen, height, c){
    const rollLen = (c.privacyRollLen && Number(c.privacyRollLen)===50) ? 50 : 35;
    const panels = segLen ? Math.ceil(segLen / PANEL_W) : 0;
    const h = Number(height)||160;
    const stripsPerPanel = Math.max(0, Math.round(h/20)); // 100→5,120→6...
    const strips = panels * stripsPerPanel;
    const totalStripM = strips * PANEL_W;
    const rolls = totalStripM ? Math.ceil(totalStripM / rollLen) : 0;
    return {rolls, rollLen, stripsPerPanel, strips, stripH: stripsPerPanel, stripW: 250, totalStripM};
  }



  function sysLabel(c){
    const h=Number(c.height)||160;
    const base = (c.system==="Doppelstab")?"Doppelstab‑Matten":(c.system==="Aluminium")?"Alu‑Elemente":(c.system==="Holz")?"Holz‑Elemente":(c.system==="WPC")?"WPC‑Elemente":(c.system==="Diagonal Geflecht")?"Diagonal‑Geflecht":(c.system==="Tornado")?"Tornado‑Zaun":(c.system==="Elektrozaun")?"Elektrozaun":"Zaun‑Elemente";
    // Elektrozaun hat keine 2,50m-Elemente wie Matten – nur Stromleiter.
    if(c.system==="Elektrozaun") return `${base} • ${h} cm`;
    return `${base} 2,50m • ${h} cm`;
  }

  function sysLabelWithColor(c){
    try{
      const col = (c && c.color) ? String(c.color).trim() : "";
      const base = sysLabel(c);
      return col ? `${base} • ${col}` : base;
    }catch(_){
      return sysLabel(c);
    }
  }

  function shortSys(sys){
    const s = String(sys||"").trim();
    if(!s) return "Zaun";
    if(s==="Diagonal Geflecht") return "Diagonal";
    return s;
  }

  function labelWithSysColor(prefix, sys, color){
    const s = shortSys(sys);
    const col = String(color||"").trim();
    return col ? `${prefix} — ${s} • ${col}` : `${prefix} — ${s}`;
  }

  // Tore (Varianten)
  function ensureGateDefaults(c){
    if(!c) return;
    if(!c.gateType) c.gateType="none";
    if(!Array.isArray(c.gates)) c.gates=[];
  }
  function gateTypeLabel(t){
    return ({gate1:"1‑flügelig", gate2:"2‑flügelig", gate3:"3‑flügelig", none:"kein Tor"})[t] || (t||"Tor");
  }
  function gateSummary(c){
    ensureGateDefaults(c);
    if(!c || c.gateType==="none") return {total:0, rows:[], text:""};
    const n = (c.gateType==="gate2") ? 2 : (c.gateType==="gate3") ? 3 : 1;

    const rows=(c.gates||[]).map(g=>{
      const gg = normalizeGateRow(c, g);
      const opening = clampInt(gg.openingCm, 50, 600);
      const leaves = Array.isArray(gg.leaves) ? gg.leaves.slice(0,n) : [opening];
      const split = gg.split || (n>1?"equal":"single");
      const leafTxt = (n===1) ? `${opening}cm` : (split==="equal" ? `${n}×${Math.round(opening/n)}cm` : leaves.join("+")+"cm");
      return {
        height:Number(gg.height)||160,
        openingCm: opening,
        leaves,
        split,
        qty: clampInt(gg.qty, 0, 20),
        text: `${gateTypeLabel(c.gateType)} — ${opening}cm LW (${leafTxt}) • H ${Number(gg.height)||160}cm`
      };
    }).filter(g=>g.qty>0);

    const total = rows.reduce((a,g)=>a+(Number(g.qty)||0),0);
    const text = rows.map(r=>`${r.qty}× ${r.text}`).join("\n");
    return {total, rows, text};
  }


  function computeConcrete(c){
    // Beton nur für Zaunarten mit Fundament (keine Elektrozaun- oder Weidezaun-Pfosten)
    const g = gateSummary(c);
    const gateCount = Number(g.total||0);
    const gateHoles = gateCount*2; // Torpfosten (2 pro Tor)

    let normalHoles = 0;

    // Segmentmodus: pro Segment zählen (Elektro/Weide zählen NICHT)
    const segs = (c && Array.isArray(c.segments)) ? c.segments : [];
    const segmentsActive = !!(c && c.useSegments && segs.length);

    if(segmentsActive){
      let started = false;
      for(const s of segs){
        const len = Math.max(0, toNum(s.length ?? s.lengthM, 0));
        const sys = normSystem((s.system||c.system||"Doppelstab"));
        const isWeide = (sys==="Holz" && (String(s.woodClass||"")==="weide" || !!s.woodIsWeide));
        if(sys==="Elektrozaun" || isWeide) { started = true; continue; }

        // Holzzaun Bretter/Riegel: Pfosten nach Abstand (aber Beton wird berechnet)
        const woodBuild = String(s.woodBuild||"");
        if(sys==="Holz" && woodBuild==="boards"){
          const spacing = Math.max(1, toNum(s.weideSpacing, 3));
          const intervals = len ? Math.ceil(len / spacing) : 0;
          if(!intervals) { started = true; continue; }
          const posts = intervals + (!started ? 1 : 0);
          normalHoles += posts;
          started = true;
          continue;
        }

        const panels = len ? Math.ceil(len / PANEL_W) : 0;
        if(!panels) { started = true; continue; }
        const posts = panels + (!started ? 1 : 0);
        normalHoles += posts;
        started = true;
      }
    } else {
      // Legacy: ohne Segmente – Beton nach Gesamtlänge
      const t = computeTotals(c);
      normalHoles = Number(t.posts||0);
    }

    const sacks = (normalHoles*1.5) + (gateHoles*3);
    const m3 = (normalHoles*0.025) + (gateHoles*0.05);
    return {normalHoles, gateHoles, totalHoles: normalHoles+gateHoles, gateCount, sacks, m3};
  }
  function concreteDisplayValue(c, cc){
    const lengthM = (computeTotals(c).lengthM||0);
    if(!lengthM) return "";
    if((c.concreteMode||"sacks")==="m3") return fmtN(cc.m3, 3);
    return fmtN(cc.sacks, 1);
  }
  function concreteHintText(c, cc){
    const lengthM = (computeTotals(c).lengthM||0);
    if(!lengthM) return "Beton wird automatisch berechnet, sobald eine Zaunlänge (Abschnitt) gesetzt ist.";
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

  const _btnKCalc = el("btnKCalc");
  if(_btnKCalc) _btnKCalc.addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return;
    const c=p.customer;
    const t=computeTotals(c);
    if(!t.lengthM) return toast("Länge fehlt","Bitte Länge in einem Abschnitt eingeben");
    p.chef.materials = (p.chef.materials||[]).filter(x=>x && x.name!=="Sichtschutz (Länge)");
    const mats=p.chef.materials;

    // Segment-Info (für Notizen/Übersicht)
    const segs = (c && Array.isArray(c.segments)) ? c.segments.filter(s=>Math.max(0,toNum(s.length ?? s.lengthM,0))>0) : [];
    const segNote = segs.length
      ? ("Abschnitte: " + segs.map(s=>`${(s.label||"")||"?"} ${fmt(toNum(s.length ?? s.lengthM,0))}m/${(s.height||c.height||"")}`).join(" • "))
      : "";

    upsertMat(mats, "Zaun‑Übersicht", 1, "Stk",
      `${fmt(t.lengthM)}m gesamt${segNote?(" • "+segNote):""}${c.color?(" • "+c.color):""}${(c.system==="WPC"&&c.wpcType)?(" • "+c.wpcType):""}`);

    // Systeme/Matten nach Abschnitten (falls mehrere Systeme)
    const sysMap = new Map();
    if(segs.length){
      for(const s of segs){
        const len = Math.max(0,toNum(s.length ?? s.lengthM,0));
        if(!len) continue;
        const panels = Math.ceil(len / PANEL_W);
        const tmp = Object.assign({}, c, {system: (s.system||c.system), height:(s.height||c.height)});
        const lab = sysLabel(tmp);
        sysMap.set(lab, (sysMap.get(lab)||0) + panels);
      }
      for(const [lab,qty] of sysMap.entries()){
        upsertMat(mats, lab, qty, "Stk", "Abschnitte");
      }
    }else{
      upsertMat(mats, sysLabel(c), t.panels, "Stk", "gesamt");
    }

    // Pfosten/Leisten (korrekt bei Abschnitten: Pfosten = Felder + 1)
    upsertMat(mats, "Pfosten", t.posts, "Stk", segs.length?"aus Abschnitten":"gesamt");
    if(t.cornerPosts) upsertMat(mats, "Eckpfosten", t.cornerPosts, "Stk", "gesamt");

    {
      const g=gateSummary(c);
      if(g.total) upsertMat(mats, `Tor (${gateTypeLabel(c.gateType)})`, g.total, "Stk", g.text||"");
    }

    upsertMat(mats, "Pfostenleisten", t.postStrips, "Stk", segs.length?"aus Abschnitten":"gesamt");

    // Sichtschutz: nur Rollen (keine doppelte Länge)
    if((c.privacy||"no")==="yes"){
      const pr = computePrivacyRolls(c, t);
      if(pr.rolls>0){
        upsertMat(mats, "Sichtschutz‑Rollen", pr.rolls, "Rollen",
          `${fmt(pr.lengthM)}m Sichtschutz • à ${pr.rollLen}m • Streifen: ${pr.stripsPerPanel}×2,5m je Feld • gesamt ${fmt(pr.totalStripM)}m`);
      }else{
        // falls nur Länge/Segmente da, aber keine Rollen errechnet
        if(pr.lengthM>0){
          upsertMat(mats, "Sichtschutz‑Rollen", 0, "Rollen", `${fmt(pr.lengthM)}m Sichtschutz (bitte prüfen)`);
        }
      }
      // UI-Hint im Kunden-Tab (Auto-Feld)
      try{
        if(typeof kPrivacyRollsAuto!=="undefined" && kPrivacyRollsAuto){
          kPrivacyRollsAuto.value = pr.rolls ? `${pr.rolls} Rollen (à ${pr.rollLen}m)` : "";
        }
      }catch(_){}
    }

    {
      const cc = computeConcrete(c);
      const unit=(c.concreteMode==="m3")?"m³":"Sack";
      const qty=(c.concreteMode==="m3")?cc.m3:cc.sacks;
      upsertMat(mats, "Beton", qty, unit, `Auto: ${cc.totalHoles} Löcher${cc.gateHoles?` (normal ${cc.normalHoles}, Torpfosten ${cc.gateHoles})`:` (normal ${cc.normalHoles})`}`);
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
      const pr = computePrivacyRolls(c, t);
      if(pr.lengthM>0){
        const rl = pr.rollLen || 35;
        const rollsTxt = pr.rolls ? `, ca. ${pr.rolls} Rollen à ${rl}m` : "";
        lines.push(`• Sichtschutz: ja (${fmt(pr.lengthM)} m${rollsTxt})`);
      }
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
    const doAnchor = ()=>{
      try{
        const a=document.createElement("a");
        a.href=url; a.download=filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 1200);
      }catch(e){
        try{ window.open(url, "_blank"); }catch(_){}
        setTimeout(()=>URL.revokeObjectURL(url), 4000);
      }
    };

    // iOS/Safari kann das Download-Attribut blocken → Datei teilen als Fallback
    const shareWanted = (()=>{ try{ return !(state && state.settings && state.settings.shareOnExport===false); }catch(_){ return true; } })();
    try{
      if(shareWanted && navigator && navigator.share && navigator.canShare){
        const file = new File([blob], filename, {type:mime});
        if(navigator.canShare({files:[file]})){
          navigator.share({files:[file], title: filename}).catch(()=>{ doAnchor(); });
          return;
        }
      }
    }catch(_){}

    doAnchor();
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
  
  function gateLeafCount(t){
    if(t==="gate2") return 2;
    if(t==="gate3") return 3;
    return 1;
  }
  function normalizeGateRow(c, g){
    if(!c) return g;
    const t = c.gateType || "gate1";
    const n = gateLeafCount(t);
    if(!g) g = {};
    // Höhe (60-200 in 20er Schritten)
    let h = Number(g.height)||Number(c.height)||160;
    h = Math.round(h/20)*20;
    h = Math.max(60, Math.min(200, h));
    g.height = h;

    // Menge
    g.qty = clampInt((g.qty!=null ? g.qty : (g.count!=null ? g.count : 1)), 0, 20);

    // Öffnung (Lichte Weite) in cm
    let opening = clampInt((g.openingCm!=null ? g.openingCm : (g.widthCm!=null ? g.widthCm : (g.width!=null ? g.width : 125))), 50, 600);

    // Split / Flügel
    let split = (g.split==="asym" || g.split==="equal") ? g.split : (n>1 ? "equal" : "single");

    // Leaves
    let leaves = Array.isArray(g.leaves) ? g.leaves.map(x=>clampInt(x, 30, 600)) : [];

    if(n===1){
      split = "single";
      opening = clampInt(opening, 50, 600);
      leaves = [opening];
    }else{
      if(split==="equal"){
        const base = Math.max(1, Math.floor(opening / n));
        leaves = Array(n).fill(base);
        let rem = opening - base*n;
        let i=0;
        while(rem>0){ leaves[i%n] += 1; i++; rem--; }
      }else{
        if(leaves.length!==n) leaves = Array(n).fill(0);
        const sum = leaves.reduce((a,b)=>a+(Number(b)||0),0);
        if(sum>0) opening = clampInt(sum, 50, 600);
        else{
          // fallback equal
          const base = Math.max(1, Math.floor(opening / n));
          leaves = Array(n).fill(base);
          let rem = opening - base*n;
          let i=0;
          while(rem>0){ leaves[i%n] += 1; i++; rem--; }
          split="equal";
        }
      }
    }

    g.openingCm = opening;
    g.leaves = leaves;
    g.split = split;
    return g;
  }

  function gateDefaultRow(c){
    const t = (c && c.gateType) ? c.gateType : "gate1";
    const n = gateLeafCount(t);
    let h = (c && c.height) ? Number(c.height) : 160;
    h = Math.round(h/20)*20;
    h = Math.max(60, Math.min(200, h));

    let opening = 125;
    let leaves = [125];
    let split = "single";

    if(n===2){
      opening = 250;
      leaves = [125,125];
      split = "equal";
    }else if(n===3){
      opening = 300;
      leaves = [100,100,100];
      split = "equal";
    }

    return normalizeGateRow({gateType:t, height:h}, {height:h, openingCm: opening, leaves, split, qty:1});
  }

  function renderGateUI(){
    const p=currentProject(); if(!p) return;
    const c=p.customer; ensureGateDefaults(c);
    if(!kGateType || !gateVariants || !gateRows) return;

    // Sicherstellen: gültige Werte
    if(!["none","gate1","gate2","gate3"].includes(c.gateType)) c.gateType="none";
    kGateType.value = c.gateType || "none";

    const active = (kGateType.value !== "none");
    gateVariants.style.display = active ? "" : "none";
    if(!active){ gateRows.innerHTML=""; return; }

    const n = gateLeafCount(c.gateType);

    // Normalize bestehende Zeilen
    if(!Array.isArray(c.gates)) c.gates=[];
    c.gates = c.gates.map(g=>normalizeGateRow(c,g));
    if(c.gates.length===0) c.gates=[gateDefaultRow(c)];

    const count = c.gates.length||0;

    gateVariants.innerHTML = `
      <div class="pill">Maße immer als <b>Lichte Weite</b> (cm)</div>
      <div class="pill">${gateTypeLabel(c.gateType)}: ${n} Flügel</div>
      <div class="pill">Varianten: <b>${count}</b></div>
      <div class="row" style="margin-top:10px; justify-content:flex-end; gap:8px;">
        <button class="btn" type="button" id="btnGateAllOpen">Alle öffnen</button>
        <button class="btn" type="button" id="btnGateAllClose">Alle schließen</button>
      </div>
    `;

    gateRows.innerHTML="";

    const makeSummary = (g, idx)=>{
      const qty = clampInt(g.qty||0,0,999);
      const h = clampInt(g.height||0,0,999);
      const lw = clampInt(g.openingCm||0,0,9999);
      return `Tor ${idx+1} • ${qty}× • Höhe ${h} cm • LW ${lw} cm`;
    };

    c.gates.forEach((g, idx)=>{
      const det=document.createElement("details");
      det.className="gateDet";
      det.open = (idx===0); // erstes offen, Rest zu (übersichtlich)
      const sum=document.createElement("summary");
      sum.textContent = makeSummary(g, idx);
      sum.style.cursor="pointer";
      sum.style.userSelect="none";
      det.appendChild(sum);

      const wrap=document.createElement("div");
      wrap.style.marginTop="10px";
      wrap.appendChild(buildGateRow(g, idx));
      det.appendChild(wrap);
      gateRows.appendChild(det);
    });

    const btnOpen = gateVariants.querySelector("#btnGateAllOpen");
    const btnClose = gateVariants.querySelector("#btnGateAllClose");
    if(btnOpen) btnOpen.addEventListener("click", ()=>{
      gateRows.querySelectorAll("details").forEach(d=>d.open=true);
    });
    if(btnClose) btnClose.addEventListener("click", ()=>{
      gateRows.querySelectorAll("details").forEach(d=>d.open=false);
    });
  }

  function buildGateRow(g, idx){
    const p=currentProject(); if(!p) return document.createElement("div");
    const c=p.customer; ensureGateDefaults(c);

    g = normalizeGateRow(c, g);

    const n = gateLeafCount(c.gateType);

    const row=document.createElement("div");
    row.className="gateRow";
    row.dataset.idx=String(idx);

    // Leaf inputs HTML
    let leafHtml = "";
    if(n===1){
      leafHtml = `
        <div>
          <label>Lichte Weite (cm)</label>
          <input class="gateOpen" list="gateWidthList" inputmode="numeric" placeholder="z.B. 100 / 125 / 150 / 200" />
        </div>
      `;
    }else{
      const leafInputs = Array.from({length:n}).map((_,i)=>`
        <div>
          <label>Flügel ${i+1} (cm)</label>
          <input class="gateLeaf" data-i="${i}" list="gateWidthList" inputmode="numeric" placeholder="cm" />
        </div>
      `).join("");

      leafHtml = `
        <div>
          <label>Lichte Weite gesamt (cm)</label>
          <input class="gateOpen" list="gateWidthList" inputmode="numeric" placeholder="z.B. 250 / 300 / 350" />
        </div>
        <div>
          <label>Aufteilung</label>
          <select class="gateSplit">
            <option value="equal">gleichschenkelig</option>
            <option value="asym">asymmetrisch</option>
          </select>
        </div>
        ${leafInputs}
      `;
    }

    row.innerHTML = `
      <div>
        <label>Tor‑Höhe</label>
        <select class="gateH"></select>
      </div>
      ${leafHtml}
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
    selH.value=String(g.height);

    const selQ=row.querySelector(".gateQ");
    selQ.innerHTML="";
    for(let i=0;i<=10;i++){
      const o=document.createElement("option");
      o.value=String(i); o.textContent=String(i);
      selQ.appendChild(o);
    }
    selQ.value=String(g.qty);

    const inpOpen=row.querySelector(".gateOpen");
    if(inpOpen) inpOpen.value = String(g.openingCm||"");

    const selSplit=row.querySelector(".gateSplit");
    if(selSplit) selSplit.value = (g.split==="asym" ? "asym" : "equal");

    // Set leaf values
    const leafEls = row.querySelectorAll(".gateLeaf");
    if(leafEls && leafEls.length){
      leafEls.forEach(elm=>{
        const i = clampInt(elm.getAttribute("data-i"),0,99);
        elm.value = String((g.leaves && g.leaves[i]!=null) ? g.leaves[i] : "");
      });
    }

    function syncFromUI(src){
      const p=currentProject(); if(!p) return;
      const c=p.customer; ensureGateDefaults(c);
      const i=Number(row.dataset.idx)||0;
      const cur = normalizeGateRow(c, c.gates[i] || g);

      // Höhe
      cur.height = clampInt(selH.value, 60, 200);

      // Menge
      cur.qty = clampInt(selQ.value, 0, 20);

      // Öffnung
      const openVal = clampInt(inpOpen ? inpOpen.value : cur.openingCm, 50, 600);

      if(gateLeafCount(c.gateType)===1){
        cur.openingCm = openVal;
        cur.leaves = [openVal];
        cur.split = "single";
      }else{
        let split = selSplit ? selSplit.value : cur.split;
        if(split!=="asym") split="equal";
        cur.split = split;

        if(src && src.classList && src.classList.contains("gateLeaf")){
          // Leaf geändert => asym
          cur.split = "asym";
          if(selSplit) selSplit.value = "asym";
        }

        // Leaves aus UI
        let leaves = [];
        const leafEls = row.querySelectorAll(".gateLeaf");
        leafEls.forEach(elm=>{
          leaves.push(clampInt(elm.value, 0, 600));
        });

        cur.openingCm = openVal;

        if(cur.split==="equal"){
          // Opening treibt Leaves
          const n = gateLeafCount(c.gateType);
          const base = Math.max(1, Math.floor(cur.openingCm / n));
          leaves = Array(n).fill(base);
          let rem = cur.openingCm - base*n;
          let k=0; while(rem>0){ leaves[k%n]+=1; k++; rem--; }
          // UI updaten
          leafEls.forEach((elm,idx)=>{ elm.value = String(leaves[idx]||""); });
        }else{
          // Asym: leaves treiben opening
          const sum = leaves.reduce((a,b)=>a+(Number(b)||0),0);
          if(sum>0){
            cur.openingCm = clampInt(sum, 50, 600);
            if(inpOpen) inpOpen.value = String(cur.openingCm);
          }
        }

        cur.leaves = leaves.map(x=>clampInt(x, 30, 600));
      }

      c.gates[i] = normalizeGateRow(c, cur);
      save(); refreshKpi(); renderConcreteAutoUI(c); ensureChefAutoMaterials(p); refreshChefPill();
    }

    // Listeners
    [selH, selQ].forEach(elm=>{
      if(!elm) return;
      elm.addEventListener("change", ()=>syncFromUI(elm));
    });
    if(inpOpen){
      inpOpen.addEventListener("input", ()=>syncFromUI(inpOpen));
      inpOpen.addEventListener("change", ()=>syncFromUI(inpOpen));
    }
    if(selSplit){
      selSplit.addEventListener("change", ()=>{
        // Beim Wechsel auf equal: Leaves automatisch setzen
        syncFromUI(selSplit);
      });
    }
    const leafEls2=row.querySelectorAll(".gateLeaf");
    leafEls2.forEach(elm=>{
      elm.addEventListener("input", ()=>syncFromUI(elm));
      elm.addEventListener("change", ()=>syncFromUI(elm));
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
      const prev = c.gateType || "none";
      c.gateType = kGateType.value || "none";
      if(c.gateType==="none"){
        c.gates=[];
      }else{
        // wenn Flügel-Anzahl wechselt, sichere Default-Variante setzen (sonst bleiben alte Felder)
        const prevN = (prev==="gate2")?2:(prev==="gate3")?3:(prev==="gate1")?1:0;
        const newN  = (c.gateType==="gate2")?2:(c.gateType==="gate3")?3:1;
        if(!Array.isArray(c.gates) || c.gates.length===0 || prevN!==newN){
          c.gates=[gateDefaultRow(c)];
        }else{
          c.gates = c.gates.map(g=>normalizeGateRow(c,g));
        }
      }
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
    if(n.includes("beton")) return "beton";

    // NOTE: Elektrozaun hat KEINE Matten/Elemente. Stromleiter (Litze/Draht/Band) kommt in "other".
    if(n.includes("litze") || n.includes("draht") || n.includes("band") || n.includes("breitband") || n.includes("stromleiter")) return "other";

    // Matten/Elemente: Doppelstab, Alu, Holz, WPC, Tornado, Diagonal
    if(
      n.includes("matte") ||
      n.includes("element") ||
      n.includes("doppelstab") ||
      (n.includes(" alu") || n.startsWith("alu")) ||
      (n.includes(" wpc") || n.startsWith("wpc")) ||
      (n.includes(" holz") || n.startsWith("holz")) ||
      n.includes("tornado") ||
      n.includes("diagonal")
    ) return "matten";

    if(n.includes("eckpf") || n.includes("eck pf") || n.includes("eck-pf")) return "eckpfosten";

    // Leisten vor Pfosten (damit "Pfostenleisten" korrekt einsortiert wird)
    if(n.includes("leiste") || n.includes("u-leist") || n.includes("u leist") || n.includes("torleiste")) return "leisten";

    if(n.includes("pfosten") && !n.includes("eck")) return "pfosten";
    return "other";
  }
  function sortMaterials(list){
    const arr = Array.isArray(list) ? list.slice() : [];

    const catIndex = (name)=>{
      const idx = MAT_ORDER.indexOf(matCategory(name));
      return (idx>=0) ? idx : MAT_ORDER.length;
    };

    const hNum = (nm)=>{
      const s = String(nm||"").replace(/,/g,'.');
      let m = s.match(/(\d{2,3})\s*cm\b/i);
      if(m){ const v=parseInt(m[1],10); return Number.isFinite(v)?v:9999; }
      m = s.match(/(\d{3,4})\s*mm\b/i);
      if(m){ const v=parseInt(m[1],10); const cm = Math.round(v/10); return Number.isFinite(cm)?cm:9999; }
      m = s.match(/\b(\d(?:\.\d{1,2})?)\s*m\b/i);
      if(m){ const v=parseFloat(m[1]); if(Number.isFinite(v) && v>0 && v<10) return Math.round(v*100); }
      m = s.match(/\bH(?:öhe)?\s*[: ]\s*(\d{2,3})\b/i);
      if(m){ const v=parseInt(m[1],10); return Number.isFinite(v)?v:9999; }
      m = s.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})\b/);
      if(m){ const a=parseInt(m[1],10), b=parseInt(m[2],10); const hi=Math.max(a,b); if(Number.isFinite(hi) && hi<=300) return hi; }
      return 9999;
    };

    arr.sort((a,b)=>{
      const ca = catIndex(a && a.name);
      const cb = catIndex(b && b.name);
      if(ca!==cb) return ca-cb;

      const ha = hNum(a && a.name);
      const hb = hNum(b && b.name);
      if(ha!==hb) return ha-hb;

      return String((a&&a.name)||"").localeCompare(String((b&&b.name)||""),"de",{sensitivity:"base",numeric:true});
    });
    return arr;
  }

  function ensureChefAutoMaterials(p){
    if(!p || !p.customer) return;
    if(!p.chef) p.chef = { bagger:"no", ramme:"no", handbohr:"no", schubkarre:"no", haenger:"no", note:"", materials:[], photos:[], hoursPlanned:"", status:"draft" };
    if(!Array.isArray(p.chef.materials)) p.chef.materials = [];
    const c = p.customer;

    // Pfostenlänge (robust): Zaunhöhe + 60 cm. Bei Doppelstab reicht die Zaunhöhe als Angabe (Label).
    function postLenCm(h){ h = clampInt(h||160, 60, 300); return clampInt(h + 60, 120, 400); }

    // Segmente aktiv?
    const segsAll = Array.isArray(c.segments) ? c.segments : [];
    const segs = segsAll.filter(s=>Math.max(0,toNum(s.length ?? s.lengthM,0))>0);

    // Wenn Segmente aktiv sind: alte manuelle Gesamt-Zeilen (Matten/Pfosten/Leisten ohne "Abschnitt") entfernen,
    // damit nichts doppelt erscheint. (Segmente sind dann die Quelle der Wahrheit.)
    const segmentsActive = (segs.length>0);
    if(segmentsActive){
      p.chef.materials = (p.chef.materials||[]).filter(it=>{
        if(!it || it.autoKey) return true;
        const cat = matCategory(it.name||"");
        if(cat==="matten" || cat==="pfosten" || cat==="eckpfosten" || cat==="leisten"){
          const n = String(it.name||"");
          if(!/^Abschnitt\s/i.test(n)) return false;
        }
        return true;
      });
    }

    // Beton (gesamt)
    let cc = null;
    try{ cc = computeConcrete(c); }catch(_){ }
    const concreteQty = (c.concreteMode==="m3") ? (cc ? cc.m3 : 0) : (cc ? cc.sacks : 0);
    const concreteUnit = (c.concreteMode==="m3") ? "m³" : "Sack";
    const concreteLabel = (c.concreteMode==="m3") ? "Fertigbeton (m³)" : "Beton (Sack)";

    // Ecken (gesamt) — nach max. Zaunhöhe
    const corners = segs.length ? segs.reduce((a,s)=>a+clampInt(s.corners||0,0,999),0) : clampInt(c.corners||0, 0, 99);
    const maxH = segs.length ? Math.max(...segs.map(s=>clampInt(s.height||c.height||160))) : clampInt(c.height||160);
    const cornerPostLen = postLenCm(maxH);
    const baseSystem = (c.system||"Doppelstab");

    const auto = [];

    if(segs.length){
      
      
      // Segment-Mode: Matten pro Abschnitt (wenn Systeme/Höhen abweichen), Pfosten/Leisten je Höhe gesamt,
      // Sichtschutz nur als Gesamt-Rollen (keine Streifen-Liste).
      let started=false;

      // Standard-Zaun: je System + Farbe + (Pfosten-/Zaunhöhe) gruppieren, damit es im Chef-Tab auch
      // bei gemischten Segmenten übersichtlich bleibt.
      const normalByH = new Map();   // key -> qty
      const cornersByH = new Map();  // key -> qty
      const stripsByH  = new Map();  // key -> qty
      
      const electroNormal = new Map(); // key -> qty
      const electroCorners = new Map(); // key -> qty

      const weideNormal = new Map(); // key -> qty
      const weideCorners = new Map(); // key -> qty
      const weideLitzeByRoll = new Map();
      const weideDrahtByRoll = new Map();
      const weideBandByRoll = new Map();
      let weideLitzeM_total = 0;
      let weideDrahtM_total = 0;
      let weideBandM_total = 0;
      const weideBoardsBySpacing = new Map();

      const holzBoardsNormal = new Map();
      const holzBoardsCorners = new Map();
      const holzBoardsBySpacing = new Map();

let privacyStripM_total = 0;
      const electroLitzeByRoll = new Map();
      const electroDrahtByRoll = new Map();
      const electroBandByRoll = new Map();
      let electroLitzeM_total = 0;
      let electroDrahtM_total = 0;
      let electroBandM_total = 0;
      let eIsoLD_normal = 0, eIsoLD_corner = 0, eIsoBand_normal = 0, eIsoBand_corner = 0;

      for(const s of segs){
        const label = (s.label||"?").toString();
        const len = Math.max(0,toNum(s.length ?? s.lengthM,0));
        const h = clampInt(s.height||c.height||160);
        const sys = (s.system||c.system||"Doppelstab");
        const col = String(s.color || c.color || "").trim();

        let panels = 0; // nur für Matten/Elemente relevant
        let posts = 0;

        if(normSystem(sys)==="Elektrozaun"){
          const spacing = Math.max(1, toNum(s.electroSpacing, 3));
          const intervals = len ? Math.ceil(len / spacing) : 0;
          if(!intervals) continue;
          posts = intervals + (!started ? 1 : 0);
        } else if(normSystem(sys)==="Holz" && (String(s.woodClass||"")==="weide" || !!s.woodIsWeide || String(s.woodBuild||"")==="boards")){
          const spacing = Math.max(1, toNum(s.weideSpacing, 3));
          const intervals = len ? Math.ceil(len / spacing) : 0;
          if(!intervals) continue;
          posts = intervals + (!started ? 1 : 0);
        } else {
          panels = len ? Math.ceil(len / PANEL_W) : 0;
          if(!panels) continue;
          posts = panels + (!started ? 1 : 0);
        }
        started = true;

        const cornersSeg = clampInt(s.corners||0,0,posts);
        const normalPosts = Math.max(0, posts - cornersSeg);
        // Matten/Elemente nur bei NICHT-Elektrozaun (Elektrozaun hat Stromleiter statt Matten)
        const sysObj = { system: sys, height: h, color: col };
        if(normSystem(sys)!=="Elektrozaun" && !(normSystem(sys)==="Holz" && (String(s.woodClass||"")==="weide" || !!s.woodIsWeide || String(s.woodBuild||"")==="boards"))){
          const matLbl = `Abschnitt ${label} — ${sysLabel(sysObj)}${col?" • "+col:""}`;
          auto.push({ k:`auto_matten_${label}`, label: matLbl, qty: panels, unit:"Stk" });
        }

        // Summen: je Höhe (Standard), Elektrozaun (ohne Holzarten) oder Weidezaun (Holzpfosten)
        if(normSystem(sys)==="Elektrozaun"){
          const pLen = clampInt((h+60), 120, 400);
          const key = `${pLen} cm`;
          electroNormal.set(key, (electroNormal.get(key)||0) + normalPosts);
          electroCorners.set(key, (electroCorners.get(key)||0) + cornersSeg);

          // Stromleiter (Litze/Draht/Band): Meter = Länge × Anzahl Stränge (+ Reserve%)
          const extraPct = toNum(s.electroExtraPct, 10);
          const baseM = len * (1 + (extraPct/100));
          const litzeN = clampInt(toNum(s.electroLitze,0), 0, 50);
          const drahtN = clampInt(toNum(s.electroDraht,0), 0, 50);
          const bandN  = clampInt(toNum(s.electroBand,0),  0, 50);

          const litzeM = baseM * litzeN;
          const drahtM = baseM * drahtN;
          const bandM  = baseM * bandN;
          electroLitzeM_total += litzeM;
          electroDrahtM_total += drahtM;
          electroBandM_total  += bandM;

          const litzeRoll = clampInt(toNum(s.electroLitzeRoll,400), 50, 5000);
          const drahtRoll = clampInt(toNum(s.electroDrahtRoll,625), 50, 5000);
          const bandRoll  = clampInt(toNum(s.electroBandRoll,200),  50, 5000);

          if(litzeM>0) electroLitzeByRoll.set(litzeRoll, (electroLitzeByRoll.get(litzeRoll)||0) + litzeM);
          if(drahtM>0) electroDrahtByRoll.set(drahtRoll, (electroDrahtByRoll.get(drahtRoll)||0) + drahtM);
          if(bandM>0)  electroBandByRoll.set(bandRoll,  (electroBandByRoll.get(bandRoll)||0)  + bandM);

          // Isolatoren: abhängig von Leiter-Art + Anzahl Pfosten/Ecken
          eIsoLD_normal += (litzeN + drahtN) * normalPosts;
          eIsoLD_corner += (litzeN + drahtN) * cornersSeg;
          eIsoBand_normal += bandN * normalPosts;
          eIsoBand_corner += bandN * cornersSeg;

        } else if(normSystem(sys)==="Holz" && (String(s.woodClass||"")==="weide" || !!s.woodIsWeide || String(s.woodBuild||"")==="boards")){
          const woodClass = (String(s.woodClass||"") || ((!!s.woodIsWeide) ? "weide" : "holz"));

          const isWeide = (woodClass==="weide");

          const wood = String(s.weideWood||"Robinie").trim() || "Robinie";
          const pLen = clampInt(toNum(s.weidePostLen,0) || (h+60), 120, 400);
          const key = `${pLen} cm • ${wood}`;

          const mapNormal = isWeide ? weideNormal : holzBoardsNormal;

          const mapCorner = isWeide ? weideCorners : holzBoardsCorners;

          const boardsMap = isWeide ? weideBoardsBySpacing : holzBoardsBySpacing;
          mapNormal.set(key, (weideNormal.get(key)||0) + normalPosts);
          mapCorner.set(key, (weideCorners.get(key)||0) + cornersSeg);

          const extraPct = toNum(s.weideExtraPct, 10);
          const baseM = len * (1 + (extraPct/100));
          const litzeN = clampInt(toNum(s.weideLitze,0), 0, 50);
          const drahtN = clampInt(toNum(s.weideDraht,0), 0, 50);
          const bandN  = clampInt(toNum(s.weideBand,0),  0, 50);
          const boardsRows = clampInt(toNum(s.weideBoards,0), 0, 50);

          const litzeM = baseM * litzeN;
          const drahtM = baseM * drahtN;
          const bandM  = baseM * bandN;

          // Bretter: pro Intervall ein Brett je Reihe; Reserve% addiert Stück (nicht Pfosten)
          const spacing = Math.max(1, toNum(s.weideSpacing, 3));
          const intervals = len ? Math.ceil(len / spacing) : 0;
          const boardsPiecesBase = intervals * boardsRows;
          const boardsPieces = boardsPiecesBase ? Math.ceil(boardsPiecesBase * (1 + (extraPct/100))) : 0;
          if(boardsPieces>0) boardsMap.set(spacing, (weideBoardsBySpacing.get(spacing)||0) + boardsPieces);

          weideLitzeM_total += litzeM;
          weideDrahtM_total += drahtM;
          weideBandM_total  += bandM;

          const litzeRoll = clampInt(toNum(s.weideLitzeRoll,400), 50, 5000);
          const drahtRoll = clampInt(toNum(s.weideDrahtRoll,625), 50, 5000);
          const bandRoll  = clampInt(toNum(s.weideBandRoll,200),  50, 5000);

          if(litzeM>0) weideLitzeByRoll.set(litzeRoll, (weideLitzeByRoll.get(litzeRoll)||0) + litzeM);
          if(drahtM>0) weideDrahtByRoll.set(drahtRoll, (weideDrahtByRoll.get(drahtRoll)||0) + drahtM);
          if(bandM>0)  weideBandByRoll.set(bandRoll,  (weideBandByRoll.get(bandRoll)||0)  + bandM);

          // Isolatoren: abhängig von Leiter-Art + Anzahl Pfosten/Ecken
        } else {
          const ds = (sys==="Doppelstab");
          const pLen = ds ? h : postLenCm(h);
          const key = `${sys}||${pLen}||${col}`;
          normalByH.set(key, (normalByH.get(key)||0) + normalPosts);
          cornersByH.set(key, (cornersByH.get(key)||0) + cornersSeg);
          stripsByH.set(key, (stripsByH.get(key)||0) + posts);
        }
// Sichtschutz: nur Gesamt-Rollen zählen (aus Streifen-Metern)
        if(String(s.privacy||"no")==="yes"){
          const ss = computePrivacyForSegment(len, h, c);
          privacyStripM_total += (ss.totalStripM || 0);
        }
      }

      // Pfosten/Eckpfosten/Leisten als Gesamtsumme je Höhe
      const keys = Array.from(new Set([ ...normalByH.keys(), ...cornersByH.keys(), ...stripsByH.keys() ]));
      keys.sort((a,b)=>{
        const pa = toNum(String(a).split("||")[1]||"", 9999);
        const pb = toNum(String(b).split("||")[1]||"", 9999);
        if(pa!==pb) return pa-pb;
        return String(a).localeCompare(String(b),"de",{sensitivity:"base",numeric:true});
      });
      for(const key of keys){
        const parts = String(key).split("||");
        const sys = parts[0]||"Zaun";
        const pLen = parts[1]||"";
        const col = parts.slice(2).join("||");
        const n = normalByH.get(key)||0;
        const e = cornersByH.get(key)||0;
        const l = stripsByH.get(key)||0;
        if(n>0) auto.push({ k:`auto_pfosten_${sys}_${pLen}_${String(col).replace(/\W+/g,"_")}`.slice(0,80), label: labelWithSysColor(`Pfosten ${pLen} cm`, sys, col), qty:n, unit:"Stk" });
        if(e>0) auto.push({ k:`auto_eckpfosten_${sys}_${pLen}_${String(col).replace(/\W+/g,"_")}`.slice(0,80), label: labelWithSysColor(`Eckpfosten ${pLen} cm`, sys, col), qty:e, unit:"Stk" });
        if(l>0) auto.push({ k:`auto_leisten_${sys}_${pLen}_${String(col).replace(/\W+/g,"_")}`.slice(0,80), label: labelWithSysColor(`Pfostenleisten ${pLen} cm`, sys, col), qty:l, unit:"Stk" });
      }
      // Elektrozaun-Pfosten nach Holzart/Länge
      if((electroNormal && electroNormal.size) || (electroCorners && electroCorners.size)){
        const allKeys = Array.from(new Set([ ...(electroNormal?electroNormal.keys():[]), ...(electroCorners?electroCorners.keys():[]) ]));
        allKeys.sort((a,b)=>{
          const ha = toNum(String(a).match(/(\d{2,3})\s*cm/i)?.[1] || "", 9999);
          const hb = toNum(String(b).match(/(\d{2,3})\s*cm/i)?.[1] || "", 9999);
          if(ha!==hb) return ha-hb;
          return String(a).localeCompare(String(b),"de",{sensitivity:"base",numeric:true});
        });
        for(const key of allKeys){
          const n = electroNormal.get(key)||0;
          const e = electroCorners.get(key)||0;
          const slug = String(key).toLowerCase().replace(/[^a-z0-9]+/g,"_").slice(0,40);
          if(n>0) auto.push({ k:`auto_elektr_pfosten_${slug}`, label:`Elektrozaun Pfosten ${key}`, qty:n, unit:"Stk" });
          if(e>0) auto.push({ k:`auto_elektr_eckpfosten_${slug}`, label:`Elektrozaun Eckpfosten (verstärkt) ${key}`, qty:e, unit:"Stk" });
        }
      }



      // Weidezaun (Holz): Pfosten/Eckpfosten (dicker Stamm)
      if(weideNormal.size || weideCorners.size){
        const allKeys = Array.from(new Set([...weideNormal.keys(), ...weideCorners.keys()])).sort((a,b)=> String(a).localeCompare(String(b), "de"));
        for(const key of allKeys){
          const n = weideNormal.get(key)||0;
          const e = weideCorners.get(key)||0;
          const slug = String(key).toLowerCase().replace(/[^a-z0-9]+/g,"_").slice(0,40);
          if(n>0) auto.push({ k:`auto_weide_pfosten_${slug}`, label:`Weidezaun Pfosten ${key}`, qty:n, unit:"Stk" });
          if(e>0) auto.push({ k:`auto_weide_eckpfosten_${slug}`, label:`Weidezaun Eckpfosten (dicker Stamm) ${key}`, qty:e, unit:"Stk" });
        }
      }


      // Holzzaun (Bretter/Riegel): Pfosten/Eckpfosten
      if(holzBoardsNormal.size || holzBoardsCorners.size){
        const allKeys = Array.from(new Set([...(holzBoardsNormal?holzBoardsNormal.keys():[]), ...(holzBoardsCorners?holzBoardsCorners.keys():[])])).sort((a,b)=> String(a).localeCompare(String(b), "de"));
        for(const key of allKeys){
          const n = holzBoardsNormal.get(key)||0;
          const e = holzBoardsCorners.get(key)||0;
          const slug = String(key).toLowerCase().replace(/[^a-z0-9]+/g,"_").slice(0,40);
          if(n>0) auto.push({ k:`auto_holz_boards_pfosten_${slug}`, label:`Holzzaun Pfosten ${key}`, qty:n, unit:"Stk" });
          if(e>0) auto.push({ k:`auto_holz_boards_eckpfosten_${slug}`, label:`Holzzaun Eckpfosten (verstärkt) ${key}`, qty:e, unit:"Stk" });
        }
      }


      // Elektrozaun: Isolatoren (abhängig von Leiter-Art)
      if(eIsoLD_normal>0) auto.push({ k:`auto_elektr_iso_ld`, label:`Elektrozaun Isolator (Litze/Draht)`, qty:eIsoLD_normal, unit:"Stk" });
      if(eIsoLD_corner>0) auto.push({ k:`auto_elektr_iso_ld_ecke`, label:`Elektrozaun Eckisolator (Litze/Draht)`, qty:eIsoLD_corner, unit:"Stk" });
      if(eIsoBand_normal>0) auto.push({ k:`auto_elektr_iso_band`, label:`Elektrozaun Breitband-Isolator bis 40 mm`, qty:eIsoBand_normal, unit:"Stk" });
      if(eIsoBand_corner>0) auto.push({ k:`auto_elektr_iso_band_ecke`, label:`Elektrozaun Breitband-Eckisolator bis 40 mm`, qty:eIsoBand_corner, unit:"Stk" });

      // Elektrozaun: Stromleiter (gesamt)
      const pushElectroCon = (baseKey, labelBase, totalM, byRoll)=>{
        if(!totalM || totalM<=0) return;
        auto.push({ k: baseKey + '_m', label: `${labelBase} (m)`, qty: Math.round(totalM*10)/10, unit: 'm' });
        const keys = Array.from((byRoll||new Map()).keys()).sort((a,b)=>a-b);
        for(const r of keys){
          const m = byRoll.get(r)||0;
          const rolls = (m>0) ? Math.ceil(m / r) : 0;
          if(rolls>0) auto.push({ k: `${baseKey}_roll_${r}`, label: `${labelBase} Rollen (${r} m)`, qty: rolls, unit: 'Stk' });
        }
      };
      pushElectroCon('auto_elektro_litze', 'Elektrozaun Litze', electroLitzeM_total, electroLitzeByRoll);
      pushElectroCon('auto_elektro_draht', 'Elektrozaun Draht', electroDrahtM_total, electroDrahtByRoll);
      pushElectroCon('auto_elektro_band',  'Elektrozaun Band',  electroBandM_total,  electroBandByRoll);

      // Weidezaun Leiter (wie Elektrozaun) + Bretter
      pushElectroCon('auto_weide_litze', 'Weidezaun Litze', weideLitzeM_total, weideLitzeByRoll);
      pushElectroCon('auto_weide_draht', 'Weidezaun Draht', weideDrahtM_total, weideDrahtByRoll);
      pushElectroCon('auto_weide_band',  'Weidezaun Band',  weideBandM_total,  weideBandByRoll);

      // Bretter/Riegel (Weidezaun): Stück nach Pfostenabstand (+ Reserve%)
      const bKeys = Array.from(weideBoardsBySpacing.keys()).sort((a,b)=>a-b);
      for(const sp of bKeys){
        const qty = weideBoardsBySpacing.get(sp)||0;
        if(qty>0) auto.push({ k:`auto_weide_bretter_${String(sp).replace(".","_")}`, label:`Weidezaun Bretter/Riegel (Stk à ${fmt(sp)} m)`, qty, unit:"Stk" });
      }

      // Bretter/Riegel (Holzzaun): Stück nach Pfostenabstand (+ Reserve%)
      const hbKeys = Array.from(holzBoardsBySpacing.keys()).sort((a,b)=>a-b);
      for(const sp of hbKeys){
        const qty = holzBoardsBySpacing.get(sp)||0;
        if(qty>0) auto.push({ k:`auto_holz_bretter_${String(sp).replace(".","_")}`, label:`Holzzaun Bretter/Riegel (Stk à ${fmt(sp)} m)`, qty, unit:"Stk" });
      }


      // Sichtschutz Rollen gesamt
      if(privacyStripM_total>0){
        const rollLen = (c.privacyRollLen && Number(c.privacyRollLen)===50) ? 50 : 35;
        const rolls = Math.ceil(privacyStripM_total / rollLen);
        if(rolls>0) auto.push({ k:`auto_sichtschutz_rolls`, label:`Sichtschutz Rollen (${rollLen} m)`, qty: rolls, unit:"Stk" });
      }


      if(false && corners>0){
        if(baseSystem==="Doppelstab"){
          auto.push({ k:`auto_eckpfosten_${maxH}`, label:`Eckpfosten ${maxH} cm`, qty: corners, unit:"Stk" });
          auto.push({ k:`auto_leisten_ecken_${maxH}`, label:`Pfostenleisten (Ecken) ${maxH} cm`, qty: corners, unit:"Stk" });
        }else{
          auto.push({ k:`auto_eckpfosten_${cornerPostLen}`, label:`Eckpfosten ${cornerPostLen} cm`, qty: corners, unit:"Stk" });
          auto.push({ k:`auto_leisten_ecken`, label:`Pfostenleisten (Ecken)`, qty: corners, unit:"Stk" });
        }
      }
    }else{
      const t = computeTotals(c);
      const h = clampInt(c.height||160);
      const sys = (c.system||"Doppelstab");
      const pLen = postLenCm(h);

      auto.push({ k:"auto_matten", label: sysLabelWithColor(c), qty:t.panels||0, unit:"Stk" });

      if(sys==="Doppelstab"){
        auto.push({ k:`auto_pfosten_${h}`, label: labelWithSysColor(`Pfosten ${h} cm`, sys, c.color), qty:t.posts||0, unit:"Stk" });
        auto.push({ k:`auto_eckpfosten_${h}`, label: labelWithSysColor(`Eckpfosten ${h} cm`, sys, c.color), qty:t.cornerPosts||0, unit:"Stk" });
        auto.push({ k:`auto_leisten_${h}`, label: labelWithSysColor(`Pfostenleisten ${h} cm`, sys, c.color), qty:t.postStrips||0, unit:"Stk" });
      }else{
        auto.push({ k:`auto_pfosten_${pLen}`, label: labelWithSysColor(`Pfosten ${pLen} cm`, sys, c.color), qty:t.posts||0, unit:"Stk" });
        auto.push({ k:`auto_eckpfosten_${pLen}`, label: labelWithSysColor(`Eckpfosten ${pLen} cm`, sys, c.color), qty:t.cornerPosts||0, unit:"Stk" });
        auto.push({ k:"auto_leisten", label: labelWithSysColor("Pfostenleisten", sys, c.color), qty:t.postStrips||0, unit:"Stk" });
      }
    }

    // Beton ist immer gesamt
    auto.push({ k:"auto_beton", label:concreteLabel, qty:concreteQty||0, unit:concreteUnit });

    const mats = p.chef.materials;

    const byKey = {};
    for(let i=0;i<mats.length;i++){ const it=mats[i]; if(it && it.autoKey && !byKey[it.autoKey]) byKey[it.autoKey]=it; }

    const autoKeys = {};
    for(const a of auto) autoKeys[a.k]=true;

    for(const a of auto){
      const want = Number(a.qty)||0;
      let it = byKey[a.k];

      if(!it){
        // Matten: bestehende Zeile wiederverwenden wenn möglich (nur im NON-Segment Modus)
        if(a.k==="auto_matten"){
          for(let j=0;j<mats.length;j++){ const x=mats[j]; if(!x || x.autoKey) continue;
            if(matCategory(x.name)==="matten"){ it=x; break; }
          }
        }
      }

      if(!it){
        if(!want) continue;
        mats.push({ id: uid(), name: a.label, qty: want, unit: a.unit, note:"", autoKey:a.k, override:false });
      }else{
        if(!it.override){
          it.name = a.label;
          it.qty = want;
          it.unit = a.unit;
        }
      }
    }

    // Cleanup: alte Auto-Zeilen entfernen, die nicht mehr zu den aktuellen Auto-Keys passen
    p.chef.materials = (p.chef.materials||[]).filter(x=>!x || !x.autoKey || autoKeys[x.autoKey]);
    // dauerhaft sortiert speichern (Chef-Tab bleibt immer in der gleichen Reihenfolge)
    p.chef.materials = sortMaterials(p.chef.materials||[]);
  }

// Chef
  const cBagger=el("cBagger"), cRamme=el("cRamme"), cHaenger=el("cHaenger"), cHoursPlanned=el("cHoursPlanned"), cStatus=el("cStatus"), cNote=el("cNote");
  const matPill=el("matPill"), matList=el("matList"), mName=el("mName"), mQty=el("mQty"), mUnit=el("mUnit"), mNote=el("mNote");
  const photoGrid=el("photoGrid"), photoPill=el("photoPill");

  function persistChef(){
    const p=currentProject(); if(!p) return;
    p.chef.bagger=cBagger.value; p.chef.ramme=cRamme.value; p.chef.handbohr=(el("cHandbohr")?el("cHandbohr").value:"no"); p.chef.schubkarre=(el("cSchubkarre")?el("cSchubkarre").value:"no"); p.chef.haenger=cHaenger.value;
    if(cHoursPlanned) p.chef.hoursPlanned=(cHoursPlanned.value||"").trim();
    p.plannedHours = (p.chef.hoursPlanned||"").trim();
    if(cStatus) p.chef.status=(cStatus.value||"draft");
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
    if(cHoursPlanned) cHoursPlanned.value = (p.chef.hoursPlanned||p.plannedHours||"");
    if(cStatus) cStatus.value = (p.chef.status||"draft");
    if(el("cCustomerNote")) el("cCustomerNote").value = (p.customer && p.customer.note) ? p.customer.note : "";
    cNote.value=p.chef.note||"";
    ensureChefAutoMaterials(p);
    renderChefSegments(p);
    renderMaterials(); renderPhotos(); refreshChefPill();
  }

  function renderChefSegments(p){
    const box = el("chefSegmentsBox");
    const list = el("chefSegmentsList");
    const pill = el("chefSegmentsPill");
    if(!box || !list) return;

    function postLenCm(h){ h=clampInt(h||160,60,300); return clampInt(h+60,120,400); }

    const segs = (p && p.customer && Array.isArray(p.customer.segments)) ? p.customer.segments.filter(s=>Math.max(0,toNum(s.length ?? s.lengthM,0))>0) : [];
    if(!segs.length){
      box.style.display = "none";
      if(pill) pill.textContent = "—";
      return;
    }
    box.style.display = "block";
    if(pill) pill.textContent = `${segs.length} Abschnitt${segs.length===1?"":"e"}`;

    const rows = segs.map(s=>{
      const len = Math.max(0,toNum(s.length ?? s.lengthM,0));
      const panels = len ? Math.ceil(len / PANEL_W) : 0;
      const posts = panels ? (panels + 1) : 0;
      const ht = s.height || (p.customer.height||160);
      const sys = s.system || (p.customer.system||"Doppelstab");
      const ds = (sys==="Doppelstab");
      const pLen = postLenCm(ht);
      const pLabel = ds ? `${ht} cm` : `${pLen} cm`;
      const col = s.color || (p.customer.color||"");
      const priv = (s.privacy||"no")==="yes";
      return `
        <div class="row" style="justify-content:space-between; gap:10px; padding:8px 10px; border-radius:12px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); margin-bottom:6px;">
          <div style="min-width:0;">
            <div style="font-weight:800;">Abschnitt ${escapeHtml(s.label||"?")}</div>
            <div class="small" style="opacity:0.9;">${fmt(len)}m • ${escapeHtml(String(ht))}cm • ${escapeHtml(sys)}${col?(" • "+escapeHtml(col)):""}${priv?" • Sichtschutz":""}</div>
          </div>
          <div class="pill" style="white-space:nowrap;">${panels} Felder</div>
        </div>
      `;
    }).join("");
    list.innerHTML = rows;
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

  // Gruppiert nach Zaun-Variante (System + Höhe + Farbe) als Dropdowns
  function parseVariant(name){
    const s = String(name||"");
    const sys =
      (/Doppelstab/i.test(s) ? "Doppelstab" :
      (/\bWPC\b/i.test(s) ? "WPC" :
      (/\bHolz\b/i.test(s) ? "Holz" :
      (/Alu|Aluminium/i.test(s) ? "Aluminium" :
      (/Tornado/i.test(s) ? "Tornado" :
      (/Diagonal/i.test(s) ? "Diagonal" :
      (/Elektro/i.test(s) ? "Elektrozaun" : "")))))));

    const hm = s.match(/(\d{2,3})\s*cm\b/i);
    const height = hm ? Number(hm[1]) : null;

    let color = "";
    try{
      const parts = s.split("•").map(x=>x.trim()).filter(Boolean);
      // entferne Höhen/Element-Länge
      const keep = parts.filter(x=>!/(\d{2,3})\s*cm\b/i.test(x) && !/2[,\.]?50m/i.test(x));
      if(keep.length){
        const cand = keep[keep.length-1];
        if(/RAL|Anthrazit|Moosgrün|Schwarz|Weiß|Grau|verzinkt|Natur|Holz|WPC|DB\s*703/i.test(cand)){
          color = cand;
        }
      }
    }catch(_){ }

    if(!sys || !height){
      return { key:"Sonstiges", label:"Sonstiges" };
    }
    const label = `${sys} • ${height} cm${color?(" • "+color):""}`;
    const key = `${sys}__${height}__${color||""}`;
    return { key, label, sys, height, color };
  }

  const groups = new Map();
  for(const it of view){
    const v = parseVariant(it.name);
    if(!groups.has(v.key)) groups.set(v.key, {label:v.label, items:[]});
    groups.get(v.key).items.push(it);
  }

  const entries = Array.from(groups.entries());
  entries.sort((a,b)=>{
    if(a[0]==="Sonstiges") return 1;
    if(b[0]==="Sonstiges") return -1;
    const pa = a[0].split("__");
    const pb = b[0].split("__");
    const sa = pa[0]||"", sb = pb[0]||"";
    if(sa!==sb) return sa.localeCompare(sb,"de",{sensitivity:"base"});
    const ha = Number(pa[1]||0), hb = Number(pb[1]||0);
    if(ha!==hb) return ha-hb;
    const ca = pa.slice(2).join("__"), cb = pb.slice(2).join("__");
    return ca.localeCompare(cb,"de",{sensitivity:"base"});
  });

  matList.innerHTML = entries.map((e,idx)=>{
    const key = e[0];
    const g = e[1];
    const open = (idx===0) ? "open" : "";
    const safeKey = encodeURIComponent(key);
    return `
      <details ${open}>
        <summary>
          <span>${escapeHtml(g.label||"Material")}</span>
          <span class="pill">${g.items.length}</span>
        </summary>
        <div class="matRows" data-g="${safeKey}"></div>
      </details>
    `;
  }).join("");

  function bindRow(rows, it){
    const row=document.createElement("div");
    row.className="matRow";
    row.innerHTML = `
      <div class="matName">${escapeHtml(it.name||"")}</div>
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
  }

  // Fill groups
  for(const [key,g] of entries){
    const rows = matList.querySelector(`.matRows[data-g="${encodeURIComponent(key)}"]`);
    if(!rows) continue;
    g.items.forEach(it=>bindRow(rows,it));
  }
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
    const hp = (p.chef && (p.chef.hoursPlanned||"").trim()) ? (p.chef.hoursPlanned||"").trim() : ((p.plannedHours||"").trim());
    if(hp) lines.push(`Geplante Stunden: ${hp}`);
    if(p.chef && (p.chef.status||"") && p.chef.status!=="draft") lines.push(`Status: ${p.chef.status}`);
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
    if(p.chef.handbohr==="yes") eq.push("Handbohrgerät");
    if(p.chef.schubkarre==="yes") eq.push("Schubkarre");
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

  el("btnCWhats").addEventListener("click", async ()=>{
    const p=currentProject(); if(!p) return;
    const issues=validateProject(p); if(!showIssues(issues)) return;
    await shareInternWithPhotos(p);
  });
  // WhatsApp Intern – 2-Step Buttons (empfohlen)
  const btnCWhatsText = el("btnCWhatsText");
  const btnCWhatsFotos = el("btnCWhatsFotos");

  if(btnCWhatsText) btnCWhatsText.addEventListener("click", async ()=>{
    const p=currentProject(); const issues=validateProject(p); if(!showIssues(issues)) return;
    const text = chefWhatsText(p);
    // bevorzugt WhatsApp-Web/WhatsApp-App Text öffnen, parallel Text kopieren
    try{ await navigator.clipboard.writeText(text); }catch(_){}
    if(openWhatsAppText(text)){
      toast("WhatsApp", "Intern-Text kopiert ✅");
      return;
    }
    await shareText(text, "Intern");
  });

  if(btnCWhatsFotos) btnCWhatsFotos.addEventListener("click", async ()=>{
    const p=currentProject(); const issues=validateProject(p); if(!showIssues(issues)) return;
    const ph = (p && p.chef && Array.isArray(p.chef.photos)) ? p.chef.photos : [];
    if(!ph.length){
      toast("Keine Fotos", "Im Chef/Team Tab erst Fotos hinzufügen");
      return;
    }
    // iOS Share-Sheet: teile nur Fotos (Text ist bereits über "Intern Text" gedacht)
    if(navigator.share){
      try{
        const files=[];
        const max=Math.min(6, ph.length);
        for(let i=0;i<max;i++){
          const x=ph[i];
          if(!x || !x.dataUrlSmall) continue;
          const rawName=x.name||`Foto_${i+1}.jpg`;
          const safeName=String(rawName).replace(/[\/:*?"<>|]+/g,"_");
          files.push(await dataUrlToFile(x.dataUrlSmall, safeName, x.type));
        }
        if(files.length && (!navigator.canShare || navigator.canShare({files}))){
          await navigator.share({ title:"Intern Fotos", files });
          toast("Fotos teilen", "✅");
          return;
        }
      }catch(e){}
    }
    // Fallback: ZIP laden
    try{ await downloadInternPhotosZip(p); }catch(_){}
    toast("Fotos.zip", "geladen – bitte in WhatsApp manuell anhängen");
  });

  // Maps Link senden (Google Maps)
  const btnCMaps = el("btnCMaps");
  if(btnCMaps) btnCMaps.addEventListener("click", async ()=>{
    const p=currentProject(); if(!p) return;
    const link = mapsLink(p);
    if(!link){ toast("Maps", "Keine Adresse/Objektadresse hinterlegt."); return; }
    try{ await navigator.clipboard.writeText(link); }catch(_){}
    if(openWhatsAppText("📍 Standort: "+link)){
      toast("Maps", "Link kopiert ✅");
      return;
    }
    await shareText("📍 Standort: "+link, "Maps");
  });

  // Chef: Maps & WhatsApp Intern (alles)
  const btnChefMaps = el("btnChefMaps");
  if(btnChefMaps) btnChefMaps.addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return;
    const url = mapsLink(p);
    if(!url) return toast("Adresse fehlt","Bitte Straße/PLZ/Ort eintragen.");
    copy(url);
    toast("Maps‑Link kopiert","Jetzt in WhatsApp einfügen.");
    try{ window.open(url, "_blank"); }catch(e){}
  });

  const btnChefWhatsAll = el("btnChefWhatsAll");
  if(btnChefWhatsAll) btnChefWhatsAll.addEventListener("click", async ()=>{
    const p=currentProject(); if(!p) return;
    const text = buildInternText(p, true);
    // 1) Text senden
    openWhatsAppText(text);
    toast("WhatsApp Intern","Text vorbereitet – sende ihn ab.");
    // 2) optional Fotos
    try{
      const files = await getPhotoFiles(p);
      if(files && files.length){
        setTimeout(()=>{
          if(confirm(`Jetzt ${files.length} Foto(s) senden?\n\nHinweis: WhatsApp muss geöffnet sein.`)){
            shareFiles(files);
          }
        }, 600);
      }
    }catch(e){}
  });


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

  // Backup (Datei) – unabhängig vom Browser-Speicher
  const btnBackup = el("btnBackup");
  if(btnBackup) btnBackup.addEventListener("click", ()=>{
    try{
      if(!state.meta) state.meta = {};
      state.meta.lastBackupAt = nowISO();
      // Erst alles sauber in state schreiben
      save();

      const data = {
        exportedAt: nowISO(),
        tool: "Zaunteam Zaunplaner",
        version: APP_VERSION,
        build: APP_BUILD,
        state
      };

      const d = new Date();
      const pad = (n)=>String(n).padStart(2,"0");
      const fn = "Zaunplaner_Backup_" + d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + ".json";

      downloadText(JSON.stringify(data,null,2), fn, "application/json");
      toast("✅ Sicherung erstellt", fn);
    }catch(e){
      console.error(e);
      toast("❌ Sicherung fehlgeschlagen");
    }
  });

  // JSON Import (für Handy ↔ PC Transfer)
  const btnImportJson = el("btnImportJson");
  const fileImportJson = el("fileImportJson");

  function normalizeImportedState(raw){
    // akzeptiert entweder {state:...} oder direkt den state
    const s = (raw && raw.state) ? raw.state : raw;
    if(!s || typeof s!=="object") return null;

    // Minimalstruktur
    const out = {
      version: APP_VERSION,
      projects: Array.isArray(s.projects) ? s.projects : [],
      selectedProjectId: s.selectedProjectId || null,
      ui: (s.ui && typeof s.ui==="object") ? s.ui : {},
    };

    // Bewahre optionale Felder, falls vorhanden
    for(const k of ["notes","settings","meta"]){
      if(s[k]!==undefined) out[k]=s[k];
    }
    return out;
  }

  function doImportJsonText(txt, info={}){
    let parsed=null;
    try{ parsed = JSON.parse(txt); }catch(e){ toast("❌ Import fehlgeschlagen", "Keine gültige JSON"); return; }
    const nextRaw = normalizeImportedState(parsed);
    if(!nextRaw){ toast("❌ Import fehlgeschlagen", "Datenformat unbekannt"); return; }

    const next = {
      version: APP_VERSION,
      projects: Array.isArray(nextRaw.projects) ? nextRaw.projects : [],
      selectedProjectId: nextRaw.selectedProjectId || null,
      settings: {...DEFAULT_SETTINGS, ...(nextRaw.settings||{})},
      meta: (nextRaw.meta && typeof nextRaw.meta==="object") ? nextRaw.meta : {}
    };

    const curCount = Array.isArray(state.projects) ? state.projects.length : 0;
    const incCount = Array.isArray(next.projects) ? next.projects.length : 0;

    const sizeInfo = info && info.size ? ` — ${Math.round(info.size/1024)} KB` : "";
    const fileInfo = info && info.name ? `<div class="hint">Datei: <b>${escapeHtml(info.name)}</b>${escapeHtml(sizeInfo)}</div>` : "";

    const body = `
      ${fileInfo}
      <div style="margin-top:8px;">
        <div><b>Aktuell:</b> ${curCount} Kunden/Projekte</div>
        <div><b>In Datei:</b> ${incCount} Kunden/Projekte</div>
      </div>
      <div class="hint" style="margin-top:10px;">
        <b>Merge</b> = Kunden hinzufügen/aktualisieren (du behältst deine bestehenden).<br>
        <b>Replace</b> = alles durch Datei ersetzen.
      </div>
    `;

    const backupLastGood = ()=>{
      try{ localStorage.setItem(STORAGE_KEY+"_lastgood", JSON.stringify(state)); }catch(_){ }
      try{ idbSet("state_lastgood", JSON.stringify(state)); }catch(_){ }
    };

    const finalize = (msgTitle, msgBody)=>{
      try{ save(); }catch(_){ }
      try{ refreshAll(); }catch(_){ }
      try{ refreshSettingsUI(); }catch(_){ }
      toast(msgTitle, msgBody||"");
    };

    const doReplace = ()=>{
      backupLastGood();
      const oldLogs = (state && state.meta && Array.isArray(state.meta.logs)) ? state.meta.logs.slice(-120) : [];
      state = {
        version: APP_VERSION,
        selectedProjectId: next.selectedProjectId,
        projects: next.projects,
        settings: {...DEFAULT_SETTINGS, ...(next.settings||{})},
        meta: {...(next.meta||{}), logs: Array.isArray((next.meta||{}).logs) ? (next.meta.logs.concat(oldLogs)).slice(-200) : oldLogs }
      };
      if(state.selectedProjectId && !state.projects.find(p=>p.id===state.selectedProjectId)) state.selectedProjectId = state.projects[0]?.id || null;
      logEvent("info", "Import replace", {incCount});
      finalize("✅ Import", "Replace übernommen");
    };

    const doMerge = ()=>{
      backupLastGood();
      const existing = new Map();
      (state.projects||[]).forEach(p=>{ if(p && p.id) existing.set(p.id, p); });
      const byKey = new Map();
      const mkKey = (p)=>{
        const t = String(p && p.title || "").trim().toLowerCase();
        const d = String(p && p.plannedDate || "").trim();
        const ph = String(p && p.phone || "").trim();
        return `${t}__${d}__${ph}`;
      };
      (state.projects||[]).forEach(p=>{ try{ byKey.set(mkKey(p), p); }catch(_){ } });

      let added=0, updated=0, fixedIds=0;
      const merged = (state.projects||[]).slice();

      for(const p0 of (next.projects||[])){
        if(!p0 || typeof p0!=="object") continue;
        const p = JSON.parse(JSON.stringify(p0));
        if(!p.id){ p.id = uid(); fixedIds++; }
        const hitById = existing.get(p.id);
        if(hitById){
          const idx = merged.findIndex(x=>x && x.id===p.id);
          if(idx>=0) merged[idx] = p;
          updated++;
          continue;
        }
        const k = mkKey(p);
        const hitByKey = byKey.get(k);
        if(hitByKey && hitByKey.id){
          const idx = merged.findIndex(x=>x && x.id===hitByKey.id);
          if(idx>=0){
            p.id = hitByKey.id; // keep id stable
            merged[idx] = p;
            updated++;
            continue;
          }
        }
        merged.push(p);
        added++;
      }

      // Settings: lokale behalten, aber Support-Mail aus Backup übernehmen wenn leer
      const mergedSettings = {...DEFAULT_SETTINGS, ...(state.settings||{})};
      if(!String(mergedSettings.supportEmail||"").trim() && next.settings && next.settings.supportEmail){
        mergedSettings.supportEmail = String(next.settings.supportEmail||"").trim();
      }
      state.projects = merged;
      state.settings = mergedSettings;
      state.version = APP_VERSION;
      if(state.selectedProjectId && !state.projects.find(p=>p.id===state.selectedProjectId)) state.selectedProjectId = state.projects[0]?.id || null;
      logEvent("info", "Import merge", {added, updated, fixedIds, incCount, curCount});
      finalize("✅ Import", `Merge: +${added} neu, ${updated} aktualisiert`);

      showModal("Import-Report", `
        <div><b>Merge abgeschlossen</b></div>
        <div style="margin-top:6px;">Neu: <b>${added}</b> — Aktualisiert: <b>${updated}</b>${fixedIds?` — IDs ergänzt: <b>${fixedIds}</b>`:""}</div>
      `, [{label:"OK", cls:"btn green"}]);
    };

    showModal("JSON Import", body, [
      {label:"Merge", cls:"btn green", onClick: doMerge},
      {label:"Replace", cls:"btn bad", onClick: doReplace},
      {label:"Abbrechen", cls:"btn", onClick: ()=>{}},
    ]);
  }

  if(btnImportJson && fileImportJson){
    btnImportJson.addEventListener("click", ()=> fileImportJson.click());
    fileImportJson.addEventListener("change", async (ev)=>{
      const f = ev.target.files && ev.target.files[0];
      if(!f) return;
      try{
        const txt = await f.text();
        doImportJsonText(txt, {name:f.name, size:f.size});
      }catch(e){
        toast("❌ Import fehlgeschlagen");
      } finally {
        try{ ev.target.value=""; }catch(e){}
      }
    });
  }

  el("btnCSV").addEventListener("click", ()=>{
    const p=currentProject(); if(!p) return toast("Kein Kunde");
    const rows=[["Kundenname","Datum","Material","Menge","Einheit","Notiz"]].concat((p.chef.materials||[]).map(it=>[p.title,p.plannedDate||"",it.name||"",String((it.qty!=null)?it.qty:""),it.unit||"",it.note||""]));
    const csv=rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(";")).join("\n");
    downloadText(csv, fileSafe(`${p.title}_Material.csv`), "text/csv");
  });

  function csvLine(arr){
    return arr.map(cell=>`"${String(cell??"").replace(/"/g,'""')}"`).join(";");
  }

  function exportProjectsCSV(){
    const rows=[];
    rows.push(["ID","Kunde/Projekt","Angelegt","Ausführung","Tel","E-Mail","Adresse Kunde","Adresse Objekt","Länge","System","Farbe","Status","Geplante Stunden"]);
    for(const p of (state.projects||[])){
      if(!p) continue;
      const c=p.customer||{};
      const st=(p.chef && p.chef.status) ? p.chef.status : (p.status||"");
      const hp=(p.chef && (p.chef.hoursPlanned||"").trim()) ? (p.chef.hoursPlanned||"").trim() : ((p.plannedHours||"").trim());
      rows.push([
        p.id||"", p.title||"", p.createdAt||"", p.plannedDate||"",
        p.phone||"", p.email||"", p.addr||"", p.objAddr||"",
        c.length||"", normSystem(c.system||""), c.color||"",
        st||"", hp||""
      ]);
    }
    const csv = rows.map(csvLine).join("\n");
    const fn = fileSafe(`Zaunplaner_Kunden_${stampForFile()}.csv`);
    downloadText(csv, fn, "text/csv");
  }

  function exportAllMaterialsCSV(){
    const map = new Map();
    const bump = (name, unit, qty, projectTitle)=>{
      const n=String(name||"").trim();
      if(!n) return;
      const u=String(unit||"Stk").trim()||"Stk";
      const key = `${n}__${u}`;
      const cur = map.get(key) || {name:n, unit:u, qty:0, projects:new Set()};
      cur.qty += toNum(qty,0);
      if(projectTitle) cur.projects.add(String(projectTitle));
      map.set(key, cur);
    };
    for(const p of (state.projects||[])){
      const title = p && p.title ? p.title : "";
      const mats = (p && p.chef && Array.isArray(p.chef.materials)) ? p.chef.materials : [];
      for(const it of mats){ bump(it && it.name, it && it.unit, it && it.qty, title); }
    }
    const rows=[];
    rows.push(["Material","Menge gesamt","Einheit","In Projekten (Anzahl)"]);
    [...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'de')).forEach(it=>{
      rows.push([it.name, fmt(it.qty), it.unit, it.projects.size]);
    });
    const csv = rows.map(csvLine).join("\n");
    const fn = fileSafe(`Zaunplaner_Gesamtmaterial_${stampForFile()}.csv`);
    downloadText(csv, fn, "text/csv");
  }

  function stampForFile(){
    const d=new Date();
    const pad=(n)=>String(n).padStart(2,"0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  }

  function printPdfReport(){
    const p=currentProject();
    if(!p) return toast("Kein Kunde");
    const c=p.customer||{};
    const mats=sortMaterials((p.chef && p.chef.materials)||[]);
    const html = `
      <html><head><meta charset="utf-8" />
      <title>${escapeHtml(p.title||"Report")}</title>
      <style>
        body{font-family:Arial, sans-serif; padding:18px; color:#111;}
        h1{font-size:20px; margin:0 0 8px;}
        .muted{color:#444; font-size:12px;}
        table{width:100%; border-collapse:collapse; margin-top:12px;}
        th,td{border:1px solid #bbb; padding:6px 8px; font-size:12px; text-align:left;}
        th{background:#eee;}
        .grid{display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;}
        .box{border:1px solid #bbb; padding:10px; border-radius:8px;}
      </style>
      </head><body>
        <h1>Zaunplaner – Report</h1>
        <div class="muted">Kunde/Projekt: <b>${escapeHtml(p.title||"")}</b> — Export: ${escapeHtml(new Date().toLocaleString())}</div>
        <div class="grid">
          <div class="box">
            <div><b>Kontaktdaten</b></div>
            <div>Tel: ${escapeHtml(p.phone||"-")}</div>
            <div>E-Mail: ${escapeHtml(p.email||"-")}</div>
            <div>Kunde: ${escapeHtml(p.addr||"-")}</div>
            <div>Objekt: ${escapeHtml(p.objAddr||"-")}</div>
            <div>Ausführung: ${escapeHtml(p.plannedDate||"-")}</div>
          </div>
          <div class="box">
            <div><b>Zaun</b></div>
            <div>Länge: ${escapeHtml(c.length||"-")}</div>
            <div>System: ${escapeHtml(normSystem(c.system||""))}</div>
            <div>Farbe: ${escapeHtml(c.color||"-")}</div>
            <div>Höhe: ${escapeHtml(c.height||"-")} cm</div>
          </div>
        </div>

        <h2 style="font-size:16px; margin:16px 0 6px;">Material</h2>
        <table>
          <thead><tr><th>Material</th><th>Menge</th><th>Einheit</th><th>Notiz</th></tr></thead>
          <tbody>
            ${mats.length ? mats.map(it=>`<tr><td>${escapeHtml(it.name||"")}</td><td>${escapeHtml(fmt(toNum(it.qty,0)))}</td><td>${escapeHtml(it.unit||"Stk")}</td><td>${escapeHtml((it.note||"").trim())}</td></tr>`).join("") : `<tr><td colspan="4">(keine Einträge)</td></tr>`}
          </tbody>
        </table>

        ${(p.customer && (p.customer.note||"").trim()) ? `<h2 style="font-size:16px; margin:16px 0 6px;">Notiz</h2><div>${escapeHtml(p.customer.note||"")}</div>` : ""}
      </body></html>
    `;
    try{
      const w = window.open("", "_blank");
      if(!w){ toast("Popup blockiert", "Bitte Popups erlauben"); return; }
      w.document.open();
      w.document.write(html);
      w.document.close();
      setTimeout(()=>{ try{ w.focus(); w.print(); }catch(_){ } }, 250);
    }catch(e){
      toast("PDF/Print fehlgeschlagen", String(e && e.message || e));
    }
  }
  el("btnReset").addEventListener("click", ()=>{
    if(!confirm("Wirklich ALLE lokalen Daten löschen?")) return;
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_KEYS.forEach(k=>localStorage.removeItem(k));
    location.reload();
  });

  
    const kStreet=el("kStreet"), kZip=el("kZip"), kCity=el("kCity"), kCountry=el("kCountry"), kObjAddr=el("kObjAddr");
    const addrBar=el("addrBar");
    const segList=el("segList"), segAddLabel=el("segAddLabel"), btnSegAdd=el("btnSegAdd"), btnSegCollapseAll=el("btnSegCollapseAll"), btnSegExpandAll=el("btnSegExpandAll");
function refreshCustomerUI(){
    const p=currentProject(); if(!p) return;
    const c=p.customer;

    const segActive = (c && Array.isArray(c.segments)) ? c.segments.some(s=>Math.max(0,toNum(s.length ?? s.lengthM,0))>0) : false;
    const tt = computeTotals(c);

    el("kundeTitle").textContent = `👤 Kunde: ${p.title}`;
    if(kCreated) kCreated.value = dateFromIso(p.createdAt||"");
    if(kPlanned) kPlanned.value = p.plannedDate || "";
    if(kPhone) kPhone.value = p.phone || "";
    if(kEmail) kEmail.value = p.email || "";
    if(kLen) kLen.value=segActive ? (tt.lengthM?String(tt.lengthM):"") : (c.length||"");
    if(kHeight) kHeight.value=String(c.height||160);
    if(kSystem) kSystem.value=c.system||"Doppelstab";
    if(kColor) kColor.value=c.color||"Anthrazit (RAL 7016)";

    // Wenn Abschnitte genutzt werden: Gesamtdaten sind abgeleitet → Feld deaktivieren (keine Doppel-Logik)
    const toggleDerived = (elm, on, title)=>{
      if(!elm) return;
      elm.disabled = !!on;
      if(title) elm.title = on ? title : "";
      if(on) elm.classList.add("isDisabled"); else elm.classList.remove("isDisabled");
    };
    toggleDerived(kLen, segActive, "Gesamtlänge wird aus Zaunabschnitten summiert.");
    toggleDerived(kHeight, segActive, "Höhe bitte je Abschnitt wählen.");
    toggleDerived(kSystem, segActive, "System bitte je Abschnitt wählen.");
    toggleDerived(kColor, segActive, "Farbe bitte je Abschnitt wählen.");
    toggleDerived(kPrivacy, segActive, "Sichtschutz bitte je Abschnitt setzen.");
    toggleDerived(kPrivacyLen, segActive, "Sichtschutz-Länge wird aus Abschnitten abgeleitet.");
    if(kPrivacy) kPrivacy.value = c.privacy || "no";
    if(kPrivacyLen) kPrivacyLen.value = c.privacyLen || "";
    if(typeof kPrivacyRoll!=="undefined" && kPrivacyRoll) kPrivacyRoll.value = String(c.privacyRollLen || 35);
    try{
      if(typeof kPrivacyRollsAuto!=="undefined" && kPrivacyRollsAuto){
        const pr = computePrivacyRolls(c, computeTotals(c));
        kPrivacyRollsAuto.value = pr.rolls ? `${pr.rolls} Rollen (à ${pr.rollLen}m)` : "";
      }
    }catch(_){ }
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
  
    // Adresse anzeigen + speichern
    function updateAddrBar(){
      if(!p) return;
      p.addrStreet = (kStreet ? (kStreet.value||"") : (p.addrStreet||"")).trim();
      p.addrZip = (kZip ? (kZip.value||"") : (p.addrZip||"")).trim();
      p.addrCity = (kCity ? (kCity.value||"") : (p.addrCity||"")).trim();
      p.addrCountry = (kCountry ? (kCountry.value||"DE") : (p.addrCountry||"DE")).trim() || "DE";
      if(kObjAddr) p.objAddr = (kObjAddr.value||"").trim();

      // legacy combined fields
      p.addr = fullCustomerAddress(p);
      if(addrBar) addrBar.textContent = "Adresse: " + (p.addr || "—");
    }

    async function tryZipAutofill(){
      if(!p || !kZip || !kCity) return;
      const zip = String(kZip.value||"").trim();
      if(!/^[0-9]{5}$/.test(zip)) return;
      if(!navigator.onLine) return; // offline -> manuell
      // nur wenn ort leer ist oder sehr kurz
      const cur = String(kCity.value||"").trim();
      if(cur && cur.length>=2) return;
      const city = await lookupCityByZip(zip);
      if(city){
        kCity.value = city;
        updateAddrBar();
        save();
        toast("Ort ergänzt", `${zip} → ${city}`);
      }
    }

    // Segmente (A,B,C…)
    function ensureSegments(){
      p.customer = p.customer || {};
      if(!Array.isArray(p.customer.segments) || !p.customer.segments.length){
        // migrate from legacy
        p.customer.segments = [{
          id: uid(),
          label: "A",
          length: p.customer.length || "",
          height: p.customer.height || 160,
          system: p.customer.system || "Doppelstab",
          color: p.customer.color || "Anthrazit (RAL 7016)",
          privacy: p.customer.privacy || "no",
        corners: 0
      }];
      }
    

  // normalize
  p.customer.segments = (p.customer.segments||[]).map((s,i)=>{
    s = s || {};
    if(!s.id) s.id = uid();
    if(!s.label) s.label = String.fromCharCode(65+i);
    if(s.corners==null || s.corners==="") s.corners = 0;
    s.corners = clampInt(s.corners,0,999);
    s.system = normSystem(s.system || p.customer.system || "Doppelstab");
    if(!s.color) s.color = (colorsForSystem(s.system)[0] || "Anthrazit (RAL 7016)");
    return s;
  });

}

    function totalLengthFromSegments(){
      const segs = (p.customer && Array.isArray(p.customer.segments)) ? p.customer.segments : [];
      let sum = 0;
      for(const s of segs){
        sum += Math.max(0, toNum(s.length, 0));
      }
      return sum;
    }

    function renderSegments(){
      if(!segList) return;
      ensureSegments();
      const segs = p.customer.segments;

      // label options for add
      if(segAddLabel && !segAddLabel.dataset.ready){
        const used = new Set();
        const labels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        segAddLabel.innerHTML = labels.slice(0,10).map(x=>`<option value="${x}">${x}</option>`).join("");
        segAddLabel.dataset.ready="1";
      }

      segList.innerHTML = woodSpeciesDatalistHTML();
      for(const s of segs){
        const sum = `Abschnitt ${escapeHtml(s.label||"")}`;
        const len = toNum(s.length ?? s.lengthM,0);
        const ht = s.height || "";
        const sys = s.system || "";
        const col = s.color || "";
        const isPriv = (s.privacy||"no")==="yes";
        const det = document.createElement("details");
        det.open = true;
        det.className = "card";
        det.style.marginTop="8px";
        det.innerHTML = `
          <summary style="cursor:pointer; user-select:none;">
            <b>${sum}</b> — ${len?len+" m":"—"} • ${ht?ht+" cm":"—"} • ${escapeHtml(sys)} • ${escapeHtml(col)} ${isPriv?"• Sichtschutz":""}
          </summary>

          <div class="grid3" style="margin-top:10px;">
            <div>
              <label>Länge (m)</label>
              <input data-k="len" inputmode="decimal" value="${s.length||""}" placeholder="z.B. 12,5" />
            </div>
            <div>
              <label>Höhe</label>
              <select data-k="height"></select>
            </div>
            <div>
              <label>System</label>
              <select data-k="system">
                <option>Doppelstab</option>
                <option>Aluminium</option>
                <option>Holz</option>
                <option>WPC</option>
                <option>Diagonalgeflecht</option>
                <option>Tornado</option>
                <option>Elektrozaun</option>
              </select>
            </div>
            <div style="grid-column: span 2;">
              <label>Farbe</label>
              <select data-k="color"></select>
            </div>
            <div>
              <label>Eckpfosten</label>
              <input data-k="corners" inputmode="numeric" value="${s.corners||0}" placeholder="0" />
            </div>
<div class="jsElectroOnly" style="display:none;">
              <label>Pfostenabstand (m)</label>
              <input data-k="electroSpacing" inputmode="decimal" value="${s.electroSpacing||""}" placeholder="z.B. 3,0" />
            </div>
            <div class="jsElectroOnly" style="display:none;">
              <label>Reserve % (Zugabe)</label>
              <input data-k="electroExtraPct" inputmode="decimal" value="${s.electroExtraPct||""}" placeholder="z.B. 10" />
            </div>

            <div class="jsElectroOnly" style="grid-column: span 3; display:none;">
              <div class="card" style="padding:10px; background:rgba(255,255,255,0.04);">
                <div class="row" style="justify-content:space-between; align-items:center; gap:10px;">
                  <b>Stromleiter (Elektrozaun)</b>
                  <span class="hint">Meter = Zaunlänge × Anzahl Stränge (+ Reserve)</span>
                </div>
                <div class="grid3" style="margin-top:8px;">
                  <div style="grid-column: span 3;">
                    <label>Preset (Tierart)</label>
                    <select data-k="electroPreset">
                      <option value="">—</option>
                      <option value="pferd">Pferde (2–3 Leiter)</option>
                      <option value="rind">Rinder/Mutterkühe (2–3 Drähte)</option>
                      <option value="schaf">Schafe (3–4 Drähte)</option>
                      <option value="ziege">Ziegen (3–5 Drähte)</option>
                      <option value="wolf">Wolf/Herdenschutz (4–5 Drähte)</option>
                      <option value="gefluegel">Geflügel (5–7 Drähte)</option>
                    </select>
                    <div class="hint">Preset setzt Vorschläge (du kannst danach alles anpassen).</div>
                  </div>
                </div>
                <div class="grid3" style="margin-top:8px;">


                  <div style="grid-column: span 3;">
                    <label>Gewählte Option</label>
                    <select data-k="electroType">
                      <option value="litze">Litze</option>
                      <option value="draht">Draht</option>
                      <option value="band">Band</option>
                    </select>
                    <div class="hint">Es wird nur die gewählte Option berechnet/angezeigt.</div>
                  </div>

                  <div class="jsEType jsEType_litze">
                    <label>Litze: Anzahl Stränge</label>
                    <input data-k="electroLitze" inputmode="numeric" value="${s.electroLitze||""}" placeholder="z.B. 3" />
                  </div>
                  <div class="jsEType jsEType_litze">
                    <label>Litze: Rollenlänge</label>
                    <select data-k="electroLitzeRoll">
                      <option value="200">200 m</option>
                      <option value="400">400 m</option>
                      <option value="1000">1000 m</option>
                    </select>
                  </div>
                  <div class="jsEType jsEType_litze">
                    <label>&nbsp;</label>
                    <div class="hint">z.B. 200/400/1000 m Rollen sind üblich</div>
                  </div>

                  <div class="jsEType jsEType_draht">
                    <label>Draht: Anzahl Drähte</label>
                    <input data-k="electroDraht" inputmode="numeric" value="${s.electroDraht||""}" placeholder="z.B. 2" />
                  </div>
                  <div class="jsEType jsEType_draht">
                    <label>Draht: Rollenlänge</label>
                    <select data-k="electroDrahtRoll">
                      <option value="250">250 m</option>
                      <option value="500">500 m</option>
                      <option value="625">625 m</option>
                      <option value="1000">1000 m</option>
                    </select>
                  </div>
                  <div>
                    <label>&nbsp;</label>
                    <div class="hint">625 m ist typisch bei 25 kg / 2,5 mm</div>
                  </div>

                  <div>
                    <label>Band: Anzahl Bänder</label>
                    <input data-k="electroBand" inputmode="numeric" value="${s.electroBand||""}" placeholder="z.B. 1" />
                  </div>
                  <div class="jsEType jsEType_band">
                    <label>Band: Rollenlänge</label>
                    <select data-k="electroBandRoll">
                      <option value="200">200 m</option>
                    </select>
                  </div>
                  <div class="jsEType jsEType_band">
                    <label>&nbsp;</label>
                    <div class="hint">Breitband ist oft 200 m</div>
                  </div>
                </div>
                <div class="jsElectroCalc hint" style="margin-top:8px;"></div>
              </div>
            </div>

            <div>
              <label>Sichtschutz</label>
              <select data-k="privacy">
                <option value="no">Nein</option>
                <option value="yes">Ja</option>
              </select>
            </div>

            <div class="jsWoodOnly" style="grid-column: span 3;">
              <div class="card" style="padding:10px; background:rgba(255,255,255,0.04);">
                <b>Holzzaun / Weidezaun</b>
                <div class="grid3" style="margin-top:8px;">
                  <div>
                    <label>Variante</label>
                    <select data-k="woodClass">
                      <option value="holz">Holzzaun</option>
                      <option value="weide">Weidezaun</option>
                    </select>
                  </div>
                  <div>
                    <label>Bauart</label>
                    <select data-k="woodBuild">
                      <option value="fields">Holzfelder / Elemente</option>
                      <option value="boards">Bretter / Riegel</option>
                    </select>
                  </div>
                  <div>
                    <label>Stil</label>
                    <select data-k="woodStyle">
                      <option value="">—</option>
                      <option value="Lattenzaun">Lattenzaun (Deko + günstig)</option>
                      <option value="Jägerzaun">Jägerzaun (Deko + günstig)</option>
                      <option value="Staketenzaun">Staketenzaun (Naturnah)</option>
                      <option value="Flechtzaun">Flechtzaun (Naturnah)</option>
                      <option value="Lamellen/Elemente">Lamellen/Elemente (Sichtschutz)</option>
                      <option value="Nut-und-Feder">Nut-und-Feder (Sichtschutz)</option>
                      <option value="Bohlenzaun">Bohlenzaun (Sichtschutz)</option>
                      <option value="Koppel-/Ranchzaun">Koppel-/Ranchzaun (Weide / Tierbereich)</option>
                      <option value="Riegelzaun">Riegelzaun (Weide / Tierbereich)</option>
                      <option value="Palisaden/Robinienpfosten">Palisaden/Robinienpfosten (Weide / Tierbereich)</option>
                    </select>
                  </div>
                </div>

                <div class="jsWoodBoardsOnly" style="margin-top:8px; display:none;">
                  <div class="grid3">
                    <div style="grid-column: span 2;">
                      <label>Holzart (Pfosten)</label>
                      <input data-k="weideWood" list="jsWoodSpeciesDL" value="${escapeHtml(s.weideWood||"")}" placeholder="z.B. Robinie, Kastanie, Douglasie" />
                    </div>
                    <div>
                      <label>Pfostenlänge (cm)</label>
                      <input data-k="weidePostLen" inputmode="numeric" value="${s.weidePostLen||""}" placeholder="z.B. 220" />
                    </div>

                    <div>
                      <label>Pfostenabstand (m)</label>
                      <input data-k="weideSpacing" inputmode="decimal" value="${s.weideSpacing||""}" placeholder="z.B. 3,0" />
                    </div>
                    <div>
                      <label>Reserve % (Zugabe)</label>
                      <input data-k="weideExtraPct" inputmode="decimal" value="${s.weideExtraPct||""}" placeholder="z.B. 10" />
                    </div>
                    <div>
                      <label>Bretter/Riegel: Reihen</label>
                      <input data-k="weideBoards" inputmode="numeric" value="${s.weideBoards||""}" placeholder="z.B. 3" />
                    </div>

                    <div class="hint" style="grid-column: span 3;">
                      Berechnung: Pfosten = Intervalle + 1 • Bretter = Intervalle × Reihen (+ Reserve%).
                    </div>
                  </div>
                  <div class="jsWeideCalc hint" style="margin-top:8px;"></div>
                </div>

                <div class="hint jsWoodFieldsHint" style="margin-top:8px;">
                  Holzfelder/Elemente: Berechnung wie 2,50m‑Elemente (wie Alu/WPC). Bei Brettern/Riegeln werden nur Bretter & Holzpfosten berechnet.
                </div>
              </div>
            </div>

          <div class="row" style="margin-top:10px; gap:8px;">
            <button data-act="del" class="btn red" type="button">Löschen</button>
          </div>
        `;

        // height options
        const selH = det.querySelector('select[data-k="height"]');
        if(selH){
          selH.innerHTML = "";
          for(let h=60; h<=220; h+=20){
            const o=document.createElement("option");
            o.value=String(h); o.textContent=`${h} cm`;
            selH.appendChild(o);
          }
          selH.value=String(s.height||160);
        }
        // system + color selects
        const selS = det.querySelector('select[data-k="system"]');
        if(selS) selS.value = normSystem(s.system||"Doppelstab");

        const selC = det.querySelector('select[data-k="color"]');
        if(selC){
          const sysNow = selS ? String(selS.value||"Doppelstab") : normSystem(s.system||"Doppelstab");
          fillSelect(selC, colorsForSystem(sysNow), null);
          ensureOption(selC, s.color, "(eigene)");
          selC.value = String(s.color||"Anthrazit (RAL 7016)");

          
          setElectroExtrasVisible(det, sysNow, s.height||160);
          setWeideExtrasVisible(det, sysNow);

// Wenn System geändert wird, Farboptionen passend aktualisieren
          if(selS && !selS.dataset.boundColors){
            selS.dataset.boundColors = "1";
            selS.addEventListener("change", ()=>{
              const keep = String(selC.value||"").trim();
              const sys = String(selS.value||"Doppelstab");
              fillSelect(selC, colorsForSystem(sys), null);
              // versuche bisherigen Wert zu behalten
              if(keep && Array.from(selC.options).some(o=>o.value===keep)){
                selC.value = keep;
              } else {
                // fallback
                const d = colorsForSystem(sys)[0] || "Anthrazit (RAL 7016)";
                selC.value = d;
              }
              setElectroExtrasVisible(det, sys, Number(det.querySelector('select[data-k="height"]').value||160));
              setWeideExtrasVisible(det, sys);

            });
          }
        }
        const selP = det.querySelector('select[data-k="privacy"]');
        if(selP) selP.value = String(s.privacy||"no");

        // Elektrozaun Selects initial setzen (sonst bleiben Defaults hängen)
        const elLR = det.querySelector('select[data-k="electroLitzeRoll"]');
        if(elLR) elLR.value = String(s.electroLitzeRoll || "400");
        const elDR = det.querySelector('select[data-k="electroDrahtRoll"]');
        if(elDR) elDR.value = String(s.electroDrahtRoll || "625");
        const elBR = det.querySelector('select[data-k="electroBandRoll"]');
        if(elBR) elBR.value = String(s.electroBandRoll || "200");
        const elPreset = det.querySelector('select[data-k="electroPreset"]');
        if(elPreset) elPreset.value = String(s.electroPreset||"");
        const elType = det.querySelector('select[data-k="electroType"]');
        if(elType) elType.value = String(s.electroType||"");
        try{ setElectroExtrasVisible(det, normSystem(det.querySelector('select[data-k="system"]')?.value || s.system || ""), s.height||160); }catch(_){ }
        try{ updateElectroCalc(det); }catch(_){ }


        // Weidezaun (Holz) Selects initial setzen
        const wCB = det.querySelector('input[data-k="woodIsWeide"]');
        if(wCB) wCB.checked = !!s.woodIsWeide;

        // Neu: Holz/Weide/Bauart/Stil
        const wcEl = det.querySelector('select[data-k="woodClass"]');
        if(wcEl){
          const legacyWeide = !!s.woodIsWeide;
          wcEl.value = String(s.woodClass || (legacyWeide ? "weide" : "holz") || "holz");
        }
        const wbEl = det.querySelector('select[data-k="woodBuild"]');
        if(wbEl){
          const wcNow = wcEl ? String(wcEl.value||"holz") : "holz";
          const def = (wcNow==="weide") ? "boards" : "fields";
          wbEl.value = String(s.woodBuild || def);
        }
        const wsEl = det.querySelector('select[data-k="woodStyle"]');
        if(wsEl) wsEl.value = String(s.woodStyle||"");
        try{ setWeideExtrasVisible(det, normSystem(det.querySelector('select[data-k="system"]')?.value || s.system || "Holz")); }catch(_){ }

        const wLR = det.querySelector('select[data-k="weideLitzeRoll"]');
        if(wLR) wLR.value = String(s.weideLitzeRoll || "400");
        const wDR = det.querySelector('select[data-k="weideDrahtRoll"]');
        if(wDR) wDR.value = String(s.weideDrahtRoll || "625");
        const wBR = det.querySelector('select[data-k="weideBandRoll"]');
        if(wBR) wBR.value = String(s.weideBandRoll || "200");
        const wPreset = det.querySelector('select[data-k="weidePreset"]');
        if(wPreset) wPreset.value = String(s.weidePreset||"");
        try{ updateWeideCalc(det); }catch(_){ }

        const commit = ()=>{
          s.length = (det.querySelector('input[data-k="len"]').value||"").trim();
          s.height = Number(det.querySelector('select[data-k="height"]').value||160);
          s.system = normSystem(det.querySelector('select[data-k="system"]').value||"Doppelstab");
          s.color = String(det.querySelector('select[data-k="color"]').value||"").trim() || "Anthrazit (RAL 7016)";
          s.privacy = String(det.querySelector('select[data-k="privacy"]').value||"no");


          // Holz/Weide Auswahl (nur wenn System=Holz)
          const sysN = normSystem(s.system);
          if(sysN==="Holz"){
            const wcEl = det.querySelector('select[data-k="woodClass"]');
            const wbEl = det.querySelector('select[data-k="woodBuild"]');
            const wsEl = det.querySelector('select[data-k="woodStyle"]');
            const legacyWeide = !!s.woodIsWeide;
            s.woodClass = wcEl ? String(wcEl.value||"holz") : (String(s.woodClass||"") || (legacyWeide ? "weide" : "holz"));
            s.woodBuild = wbEl ? String(wbEl.value||"fields") : (String(s.woodBuild||"") || (s.woodClass==="weide" ? "boards" : "fields"));
            s.woodStyle = wsEl ? String(wsEl.value||"") : (s.woodStyle||"");
            // Legacy-Feld weiterpflegen
            s.woodIsWeide = (s.woodClass==="weide");

            // Weide/Bretter-Modus: Leiter/Litze/Draht/Band niemals verwenden
            if(s.woodClass==="weide" || s.woodBuild==="boards"){
              s.weideLitze = "0";
              s.weideDraht = "0";
              s.weideBand  = "0";
              s.weidePreset = "";
            }
          }
          s.corners = clampInt(det.querySelector('input[data-k="corners"]').value||0,0,999);
          // Elektrozaun Extras (optional)
          s.electroSpacing = (det.querySelector('input[data-k="electroSpacing"]') ? String(det.querySelector('input[data-k="electroSpacing"]').value||"").trim() : (s.electroSpacing||""));
          s.electroExtraPct = (det.querySelector('input[data-k="electroExtraPct"]') ? String(det.querySelector('input[data-k="electroExtraPct"]').value||"").trim() : (s.electroExtraPct||""));
          s.electroLitze = (det.querySelector('input[data-k="electroLitze"]') ? String(det.querySelector('input[data-k="electroLitze"]').value||"").trim() : (s.electroLitze||""));
          s.electroDraht = (det.querySelector('input[data-k="electroDraht"]') ? String(det.querySelector('input[data-k="electroDraht"]').value||"").trim() : (s.electroDraht||""));
          s.electroBand = (det.querySelector('input[data-k="electroBand"]') ? String(det.querySelector('input[data-k="electroBand"]').value||"").trim() : (s.electroBand||""));
          s.electroPreset = (det.querySelector('select[data-k="electroPreset"]') ? String(det.querySelector('select[data-k="electroPreset"]').value||"").trim() : (s.electroPreset||""));
          s.electroType = (det.querySelector('select[data-k="electroType"]') ? String(det.querySelector('select[data-k="electroType"]').value||"") : (s.electroType||""));
          s.electroLitzeRoll = (det.querySelector('select[data-k="electroLitzeRoll"]') ? String(det.querySelector('select[data-k="electroLitzeRoll"]').value||"").trim() : (s.electroLitzeRoll||""));
          s.electroDrahtRoll = (det.querySelector('select[data-k="electroDrahtRoll"]') ? String(det.querySelector('select[data-k="electroDrahtRoll"]').value||"").trim() : (s.electroDrahtRoll||""));
          s.electroBandRoll = (det.querySelector('select[data-k="electroBandRoll"]') ? String(det.querySelector('select[data-k="electroBandRoll"]').value||"").trim() : (s.electroBandRoll||""));

          // Elektro: nur 1 Leiter-Art behalten
          (function(){
            const t = String(s.electroType||"");
            if(t==="litze"){ s.electroDraht="0"; s.electroBand="0"; }
            else if(t==="draht"){ s.electroLitze="0"; s.electroBand="0"; }
            else if(t==="band"){ s.electroLitze="0"; s.electroDraht="0"; }
          })();
          try{ updateElectroCalc(det); }catch(_){ }

          // Weidezaun (Holz) Extras
          s.woodIsWeide = !!(det.querySelector('input[data-k="woodIsWeide"]') && det.querySelector('input[data-k="woodIsWeide"]').checked);
          s.weideWood = (det.querySelector('input[data-k="weideWood"]') ? String(det.querySelector('input[data-k="weideWood"]').value||"").trim() : (s.weideWood||""));
          s.weidePostLen = (det.querySelector('input[data-k="weidePostLen"]') ? String(det.querySelector('input[data-k="weidePostLen"]').value||"").trim() : (s.weidePostLen||""));
          s.weideSpacing = (det.querySelector('input[data-k="weideSpacing"]') ? String(det.querySelector('input[data-k="weideSpacing"]').value||"").trim() : (s.weideSpacing||""));
          s.weideExtraPct = (det.querySelector('input[data-k="weideExtraPct"]') ? String(det.querySelector('input[data-k="weideExtraPct"]').value||"").trim() : (s.weideExtraPct||""));
          s.weideLitze = (det.querySelector('input[data-k="weideLitze"]') ? String(det.querySelector('input[data-k="weideLitze"]').value||"").trim() : (s.weideLitze||""));
          s.weideDraht = (det.querySelector('input[data-k="weideDraht"]') ? String(det.querySelector('input[data-k="weideDraht"]').value||"").trim() : (s.weideDraht||""));
          s.weideBand = (det.querySelector('input[data-k="weideBand"]') ? String(det.querySelector('input[data-k="weideBand"]').value||"").trim() : (s.weideBand||""));
          s.weideBoards = (det.querySelector('input[data-k="weideBoards"]') ? String(det.querySelector('input[data-k="weideBoards"]').value||"").trim() : (s.weideBoards||""));
          s.weidePreset = (det.querySelector('select[data-k="weidePreset"]') ? String(det.querySelector('select[data-k="weidePreset"]').value||"").trim() : (s.weidePreset||""));
          s.weideLitzeRoll = (det.querySelector('select[data-k="weideLitzeRoll"]') ? String(det.querySelector('select[data-k="weideLitzeRoll"]').value||"").trim() : (s.weideLitzeRoll||""));
          s.weideDrahtRoll = (det.querySelector('select[data-k="weideDrahtRoll"]') ? String(det.querySelector('select[data-k="weideDrahtRoll"]').value||"").trim() : (s.weideDrahtRoll||""));
          s.weideBandRoll = (det.querySelector('select[data-k="weideBandRoll"]') ? String(det.querySelector('select[data-k="weideBandRoll"]').value||"").trim() : (s.weideBandRoll||""));
          try{ updateWeideCalc(det); }catch(_){ }
// legacy fallback: total length and default fields from first segment
          p.customer.length = String(totalLengthFromSegments() || "");
          const a = p.customer.segments[0] || s;
          p.customer.height = a.height || p.customer.height;
          p.customer.system = a.system || p.customer.system;
          p.customer.color = a.color || p.customer.color;
          // privacy global yes if any segment yes
          p.customer.privacy = p.customer.segments.some(x=>(x.privacy||"no")==="yes") ? "yes" : "no";

          save();
          try{ refreshAll(); }catch(e){}
        };

                const presetSel = det.querySelector('select[data-k="electroPreset"]');
        if(presetSel){
          presetSel.addEventListener("change", (ev)=>{
            try{ ev.stopImmediatePropagation(); }catch(_){}
            applyElectroPreset(det, String(presetSel.value||""));
            // commit once with new values
            commit();
          });
        }

        const weidePresetSel = det.querySelector('select[data-k="weidePreset"]');
        if(weidePresetSel){
          weidePresetSel.addEventListener("change", (ev)=>{
            try{ ev.stopImmediatePropagation(); }catch(_){}
            applyWeidePreset(det, String(weidePresetSel.value||""));
            commit();
          });
        }
        const electroTypeSel = det.querySelector('select[data-k="electroType"]');
        if(electroTypeSel){
          electroTypeSel.addEventListener("change", (ev)=>{
            try{ ev.stopImmediatePropagation(); }catch(_){}
            setElectroExtrasVisible(det, normSystem(det.querySelector('select[data-k="system"]')?.value || ""), s.height||160);
            try{ updateElectroCalc(det); }catch(_){}
            commit();
          });
        }

        const woodClassSel = det.querySelector('select[data-k="woodClass"]');
        const woodBuildSel = det.querySelector('select[data-k="woodBuild"]');
        const woodStyleSel = det.querySelector('select[data-k="woodStyle"]');
        const woodRefresh = ()=>{
          setWeideExtrasVisible(det, normSystem(det.querySelector('select[data-k="system"]')?.value || ""));
          try{ updateWeideCalc(det); }catch(_){}
          commit();
        };
        if(woodClassSel) woodClassSel.addEventListener("change", woodRefresh);
        if(woodBuildSel) woodBuildSel.addEventListener("change", woodRefresh);
        if(woodStyleSel) woodStyleSel.addEventListener("change", woodRefresh);

        const weideCb = det.querySelector('input[data-k="woodIsWeide"]');
        if(weideCb){
          weideCb.addEventListener("change", ()=>{
            const sysNow = det.querySelector('select[data-k="system"]') ? String(det.querySelector('select[data-k="system"]').value||"") : "";
            setWeideExtrasVisible(det, sysNow);
            commit();
          });
        }

det.querySelectorAll("input,select").forEach(elm=>{
          elm.addEventListener("change", commit);
          elm.addEventListener("input", ()=>{ save(); updateAddrBar(); });
        });

        const btnDel = det.querySelector('button[data-act="del"]');
        if(btnDel){
          btnDel.addEventListener("click", ()=>{
            if(segs.length<=1){
              toast("Nicht möglich", "Mindestens Abschnitt A bleibt.");
              return;
            }
            if(confirm(`Abschnitt ${s.label} löschen?`)){
              p.customer.segments = p.customer.segments.filter(x=>x.id!==s.id);
              // update legacy fields
              p.customer.length = String(totalLengthFromSegments() || "");
              p.customer.privacy = p.customer.segments.some(x=>(x.privacy||"no")==="yes") ? "yes":"no";
              save();
              renderSegments();
              refreshAll();
            }
          });
        }

        segList.appendChild(det);
      }
    }

    function closeAllSegments(open){
      if(!segList) return;
      segList.querySelectorAll("details").forEach(d=>{ d.open = !!open; });
    }

    if(btnSegCollapseAll && !btnSegCollapseAll.dataset.bound){ btnSegCollapseAll.dataset.bound="1"; btnSegCollapseAll.addEventListener("click", ()=>closeAllSegments(false)); }
    if(btnSegExpandAll && !btnSegExpandAll.dataset.bound){ btnSegExpandAll.dataset.bound="1"; btnSegExpandAll.addEventListener("click", ()=>closeAllSegments(true)); }

    if(btnSegAdd && !btnSegAdd.dataset.bound){ btnSegAdd.dataset.bound="1"; btnSegAdd.addEventListener("click", ()=>{
      ensureSegments();
      const used = new Set((p.customer.segments||[]).map(x=>String(x.label||"").toUpperCase()));
      const want = segAddLabel ? String(segAddLabel.value||"").toUpperCase() : "B";
      let label = want;
      if(used.has(label)){
        // pick next free
        const labels="ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
        label = labels.find(x=>!used.has(x)) || ("X"+String(Date.now()).slice(-2));
      }
      const base = p.customer.segments[0] || {};
      p.customer.segments.push({
        id: uid(),
        label,
        length:"",
        height: base.height || 160,
        system: normSystem(base.system || "Doppelstab"),
        color: base.color || (colorsForSystem(base.system || "Doppelstab")[0] || "Anthrazit (RAL 7016)"),
        privacy: base.privacy || "no",
        electroWood: base.electroWood || "",
        electroPostLen: base.electroPostLen || ""
      });
      save();
      renderSegments();
      toast("Abschnitt hinzugefügt", label);
    }); }

    // Initial values for address inputs
    if(kStreet) kStreet.value = p.addrStreet || "";
    if(kZip) kZip.value = p.addrZip || "";
    if(kCity) kCity.value = p.addrCity || "";
    if(kCountry) kCountry.value = p.addrCountry || "DE";
    if(kObjAddr) kObjAddr.value = p.objAddr || "";
    updateAddrBar();
    renderSegments();

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
    cRamme.value=p.chef.ramme||"no";
    if(el("cHandbohr")) el("cHandbohr").value=p.chef.handbohr||"no";
    if(el("cSchubkarre")) el("cSchubkarre").value=p.chef.schubkarre||"no";
    cHaenger.value=p.chef.haenger||"no";
    if(el("cCustomerNote")) el("cCustomerNote").value = (p.customer && p.customer.note) ? p.customer.note : "";
    cNote.value=p.chef.note||"";
    ensureChefAutoMaterials(p);
    renderChefSegments(p);
    renderMaterials(); renderPhotos(); refreshChefPill();
  }


  function refreshAll(){
    refreshProjectSelectors();
    refreshCustomerUI();
    refreshChefUI();
    updateStatusPill();
    try{ refreshSettingsUI(); }catch(_){ }
    // View mode
    if(state.selectedProjectId) showCustomerEdit(); else showCustomerList();
  }

  async function restoreFromIndexedDBIfNeeded(){
    try{
      const txt = await idbGet("state");
      if(!txt) return;
      let s=null;
      try{ s = JSON.parse(txt); }catch(e){ s=null; }
      if(!s || !Array.isArray(s.projects) || !s.projects.length) return;

      const hasLocal = (()=>{ try{ return !!localStorage.getItem(STORAGE_KEY); }catch(e){ return false; }})();
      const isDemoOnly = (state.projects && state.projects.length===1 && /demo/i.test(String(state.projects[0].title||"")));

      // Nur übernehmen, wenn localStorage leer/blockiert ist oder nur Demo aktiv ist
      if(!hasLocal || isDemoOnly){
        state = {...state, ...s, version: APP_VERSION};
        state.settings = {...DEFAULT_SETTINGS, ...(s.settings||state.settings||{})};

// zurück nach localStorage spiegeln, damit nach App-Schließen nichts "weg" ist
try{
  const payload = JSON.stringify(state);
  localStorage.setItem(STORAGE_KEY, payload);
  localStorage.setItem(STORAGE_KEY+"_lastgood", payload);
}catch(e){
  STORAGE_OK = false;
}
try{ cacheSet(JSON.stringify(state)); }catch(_){}

        if(!state.meta) state.meta={ lastSavedAt:"", lastBackupAt:"", logs:[] };
        if(!Array.isArray(state.meta.logs)) state.meta.logs=[];
        if(state.selectedProjectId && !state.projects.find(p=>p.id===state.selectedProjectId)){
          state.selectedProjectId = state.projects[0]?.id || null;
        }
        try{ refreshAll(); }catch(e){}
        try{ toast("✅ Kunden geladen", "Fallback (IndexedDB)"); }catch(e){}
      }
    }catch(e){}
  }

  
// init
(async ()=>{
  try{
    fillHeights();
    fillSelect(kColor, ZAUNTEAM_FARBEN, "Anthrazit (RAL 7016)");
    fillSelect(kWood, HOLZARTEN, "—");
    fillSelect(kWpc, WPC_VARIANTEN, "—");
    updateConcretePlaceholder();
    if(pCreated && !pCreated.value) pCreated.value = new Date().toISOString().slice(0,10);

    await migrateLegacy();

    BOOT_DONE = true;

    // Storage Persist (best-effort) + Storage Estimate
    try{ PERSIST_INFO = await requestPersistentStorage(); }catch(_){ }
    try{ if(navigator.storage && navigator.storage.estimate) STORAGE_EST = await navigator.storage.estimate(); }catch(_){ }

    // Always keep version current
    state.version = APP_VERSION;

    // Final safety: falls localStorage leer ist, aber IDB Daten hat (ohne Überschreiben)
    try{ setTab('kunde'); }catch(_){}
    try{ await restoreFromIndexedDBIfNeeded(); }catch(_){}

    refreshAll();

    // iOS-Hinweis: wenn nicht installiert, kann iOS Storage beim Schließen räumen.
    try{
      if(IS_IOS && !isStandalone() && location.protocol!=="file:"){
        toast("⚠️ iPhone/iPad Hinweis", "Für dauerhaften Speicher: Als Web-App installieren (Teilen → 'Zum Home-Bildschirm')");
      }
      if(location.protocol==="file:"){
        toast("⚠️ Datei-Modus", "Wenn du die HTML aus 'Dateien' öffnest, kann nichts dauerhaft gespeichert werden. Bitte über https öffnen/installieren.");
      }
    }catch(_){ }
    try{ save(); }catch(_){ } // einmal sauber persistieren (write-through)
  }catch(e){
    try{
      console.error("Init failed", e);
      toast("❌ Startfehler", String((e && e.message) || e));
    }catch(_){}
  }
})();

  // Last-chance persist (iOS killt Tabs gerne ohne Vorwarnung)
  try{
    window.addEventListener("pagehide", ()=>{ try{ save(); }catch(_){ } });
    document.addEventListener("visibilitychange", ()=>{
      if(document.visibilityState==="hidden"){
        try{ save(); }catch(_){ }
      }
    });
  }catch(_){ }

/******************************************************************
   * Settings Tab – Buttons / Toggles
   ******************************************************************/
  const btnExportJSON = el("btnExportJSON");
  if(btnExportJSON) btnExportJSON.addEventListener("click", ()=>{ try{ el("btnBackup").click(); }catch(_){ } });
  const btnImportJSON2 = el("btnImportJSON2");
  if(btnImportJSON2) btnImportJSON2.addEventListener("click", ()=>{ try{ el("fileImportJson").click(); }catch(_){ } });
  const btnExportCSVProjects = el("btnExportCSVProjects");
  if(btnExportCSVProjects) btnExportCSVProjects.addEventListener("click", exportProjectsCSV);
  const btnExportCSVAllMaterials = el("btnExportCSVAllMaterials");
  if(btnExportCSVAllMaterials) btnExportCSVAllMaterials.addEventListener("click", exportAllMaterialsCSV);
  const btnExportPDF = el("btnExportPDF");
  if(btnExportPDF) btnExportPDF.addEventListener("click", printPdfReport);

  const btnStorageSelfTest = el("btnStorageSelfTest");
  if(btnStorageSelfTest) btnStorageSelfTest.addEventListener("click", ()=>{ runStorageSelfTest(); });

  const btnExportLog = el("btnExportLog");
  if(btnExportLog) btnExportLog.addEventListener("click", ()=>{
    const logs = (state.meta && Array.isArray(state.meta.logs)) ? state.meta.logs : [];
    const txt = JSON.stringify({app:APP_NAME, version:APP_VERSION, build:APP_BUILD, exportedAt:nowISO(), logs}, null, 2);
    downloadText(txt, fileSafe(`Zaunplaner_Log_${stampForFile()}.json`), "application/json");
  });

  const setShareOnExport = el("setShareOnExport");
  if(setShareOnExport) setShareOnExport.addEventListener("change", ()=>{
    state.settings = {...DEFAULT_SETTINGS, ...(state.settings||{})};
    state.settings.shareOnExport = !!setShareOnExport.checked;
    save();
    refreshSettingsUI();
  });

  const setSupportEmail = el("setSupportEmail");
  let supportEmailTimer=null;
  if(setSupportEmail) setSupportEmail.addEventListener("input", ()=>{
    if(supportEmailTimer) clearTimeout(supportEmailTimer);
    supportEmailTimer = setTimeout(()=>{
      state.settings = {...DEFAULT_SETTINGS, ...(state.settings||{})};
      state.settings.supportEmail = String(setSupportEmail.value||"").trim();
      save();
      refreshSettingsUI();
    }, 250);
  });
  const btnSupportMail = el("btnSupportMail");
  if(btnSupportMail) btnSupportMail.addEventListener("click", ()=>{
    const m = String(state.settings && state.settings.supportEmail || "").trim();
    if(!m) return;
    try{ window.location.href = `mailto:${encodeURIComponent(m)}?subject=${encodeURIComponent(APP_NAME+" Support")}&body=${encodeURIComponent("Version: "+APP_VERSION+" ("+APP_BUILD+")\n\n")}`; }catch(_){ }
  });

  // Fallback-Restore (async)
  setTimeout(()=>{ try{ restoreFromIndexedDBIfNeeded(); }catch(e){} }, 80);

  // Demo-Modus (für Chef-Showcase – lädt Beispielkunde ohne echte Daten)
  const btnDemo = el("btnDemo");
  function makeDemoPhoto(label){
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#16a34a"/>
          <stop offset="1" stop-color="#ef4444"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#g)"/>
      <rect x="70" y="70" width="1060" height="660" rx="40" fill="rgba(0,0,0,0.35)"/>
      <text x="600" y="360" font-size="64" fill="#fff" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto">${APP_NAME}</text>
      <text x="600" y="450" font-size="54" fill="#fff" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto">${label}</text>
      <text x="600" y="520" font-size="28" fill="#fff" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto">Demo-Foto (Platzhalter)</text>
    </svg>`;
    return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
  }
  function loadDemo(){
    const p = blankProject("Demo: Musterkunde");
    p.status = "Entwurf";
    p.plannedHours = "12";
    p.chef.hoursPlanned = "12";
    p.phone = "+49 170 000000";
    p.email = "demo@zaunteam.de";
    p.addr = "Musterstraße 1, 12345 Musterstadt";
    p.objAddr = "Baustelle: Musterweg 9, 12345 Musterstadt";
    p.plannedDate = new Date().toISOString().slice(0,10);
    p.customer.length = "37";
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
    save();
    refreshAll();
    toast("✅ Demo geladen", p.title);
  }
  if(btnDemo) btnDemo.addEventListener("click", ()=>{
    if(confirm("Demo-Daten laden? (Ersetzt NICHT deine echten Kunden – aber wird als neuer Kunde angelegt)")){
      loadDemo();
    }
  });
})();