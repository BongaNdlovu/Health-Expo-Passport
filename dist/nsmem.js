/* NSMem v43: central cache + timer/listener registry + low-memory handling + demo-only diagnostics.
   No network, no storage of visitor data. NS_DEV_BUILD is a BUILD FLAG: true only in TEST builds;
   a release build must set it to false (window.__NEWSTART.__internals then exposes only a narrow non-PII tour API). */
(function(){
  "use strict";
  var NS_DEV_BUILD = false; // BUILD FLAG: false in source. tools/build.js sets it true only when run with NS_DEV_BUILD=1 (test builds)
  var now = function(){ return Date.now(); };
  var dm = (navigator.deviceMemory || 4), low = dm <= 2;
  var caches = {}, ver = 1;
  function Cache(name, o){
    o = o || {}; this.name = name; this.max = Math.max(4, Math.round((o.max || 50) * (low ? 0.5 : 1)));
    this.ttl = o.ttl || 60000; this.m = new Map(); this.hits = 0; this.miss = 0; caches[name] = this;
  }
  Cache.prototype.get = function(k){
    var e = this.m.get(k);
    if (!e || e.v !== ver || now() - e.t > this.ttl){ if (e) this.m.delete(k); this.miss++; return undefined; }
    this.m.delete(k); this.m.set(k, e); this.hits++; return e.d;
  };
  Cache.prototype.set = function(k, d){
    this.m.delete(k); this.m.set(k, {d: d, t: now(), v: ver});
    while (this.m.size > this.max) this.m.delete(this.m.keys().next().value);
    return d;
  };
  Cache.prototype.memo = function(k, fn){ var d = this.get(k); return d !== undefined ? d : this.set(k, fn()); };
  Cache.prototype.clear = function(){ this.m.clear(); };
  function clearAll(){ for (var n in caches) caches[n].clear(); }
  function bump(why){ ver++; if (why === "reset" || why === "switch" || why === "signout" || why === "trim") clearAll(); }

  /* scoped registry: scope "tab" (released on tab switch), "overlay" (on overlay close), "page" (pagehide) */
  var reg = {};
  function S(scope){ return reg[scope] || (reg[scope] = []); }
  function every(scope, fn, ms){ var id = setInterval(fn, ms); S(scope).push({k:"i", id:id}); return id; }
  function after(scope, fn, ms){ var rec = {k:"t"}; rec.id = setTimeout(function(){ rec.done = 1; fn(); }, ms); S(scope).push(rec); return rec.id; }
  function raf(scope, fn){ var rec = {k:"r"}; rec.id = requestAnimationFrame(function(t){ rec.done = 1; fn(t); }); S(scope).push(rec); return rec.id; }
  function on(scope, target, type, fn, opt){ target.addEventListener(type, fn, opt); S(scope).push({k:"l", t:target, y:type, f:fn, o:opt}); }
  function release(scope){
    var a = reg[scope]; if (!a) return 0; var n = a.length;
    a.forEach(function(r){
      if (r.k === "i") clearInterval(r.id); else if (r.k === "t") clearTimeout(r.id);
      else if (r.k === "r") cancelAnimationFrame(r.id); else if (r.k === "l") r.t.removeEventListener(r.y, r.f, r.o);
    });
    delete reg[scope]; return n;
  }
  function counts(){
    var c = {intervals:0, timeouts:0, rafs:0, listeners:0};
    for (var s in reg) reg[s].forEach(function(r){
      if (r.done) return; if (r.k === "i") c.intervals++; else if (r.k === "t") c.timeouts++; else if (r.k === "r") c.rafs++; else c.listeners++;
    });
    return c;
  }
  function trim(){ bump("trim"); release("tab"); release("overlay"); return true; }
  addEventListener("pagehide", function(e){ if(e&&e.persisted)/* kept: a bfcache restore resumes these (U6) */; else { for (var s in reg) release(s); clearAll(); } });
  document.addEventListener("visibilitychange", function(){ if (document.hidden && low) trim(); });

  function stats(){
    var c = counts(), cs = {}, total = 0;
    for (var n in caches){ cs[n] = caches[n].m.size; total += caches[n].m.size; }
    var pm = performance && performance.memory;
    return { heapMB: pm ? +(pm.usedJSHeapSize/1048576).toFixed(1) : null, domNodes: document.getElementsByTagName("*").length,
      registry: c, cacheEntries: total, caches: cs, deviceMemoryGB: dm, lowMemoryMode: low, dataVersion: ver };
  }
  function openDiag(isDemo){
    if (!isDemo) return false;
    var old = document.getElementById("nsDiag"); if (old) old.remove();
    var d = document.createElement("div"); d.id = "nsDiag"; d.setAttribute("role","dialog"); d.setAttribute("aria-modal","true");
    d.setAttribute("aria-labelledby","nsDiagT"); d.className = "ns-diag";
    function body(){ var s = stats();
      return '<h3 id="nsDiagT">Memory diagnostics (demo only)</h3><dl>' +
        '<dt>JS heap</dt><dd>' + (s.heapMB == null ? "not reported by this browser" : s.heapMB + " MB") + '</dd>' +
        '<dt>Page elements</dt><dd>' + s.domNodes + '</dd><dt>Tracked listeners</dt><dd>' + s.registry.listeners + '</dd>' +
        '<dt>Tracked timers</dt><dd>' + (s.registry.intervals + s.registry.timeouts + s.registry.rafs) + '</dd>' +
        '<dt>Cache entries</dt><dd>' + s.cacheEntries + '</dd><dt>Device memory</dt><dd>' + s.deviceMemoryGB + ' GB' + (s.lowMemoryMode ? " (low-memory mode)" : "") + '</dd></dl>' +
        '<div class="ns-diag-b"><button type="button" id="nsDiagFree">Free memory</button><button type="button" id="nsDiagClose">Close</button></div>'; }
    d.innerHTML = body(); document.body.appendChild(d);
    var back = document.activeElement;
    function close(){ document.removeEventListener("keydown", key); d.remove(); try { back && back.focus(); } catch(e){} }
    function key(e){ if (e.key === "Escape") close(); }
    document.addEventListener("keydown", key);
    d.addEventListener("click", function(e){
      if (e.target.id === "nsDiagClose") close();
      else if (e.target.id === "nsDiagFree"){ trim(); d.innerHTML = body(); var f = document.getElementById("nsDiagFree"); f && f.focus(); }
    });
    var f = document.getElementById("nsDiagClose"); f && f.focus();
    return true;
  }
  window.NSMem = { devBuild: NS_DEV_BUILD, Cache: Cache, bump: bump, clearAll: clearAll, every: every, after: after, raf: raf, on: on,
    release: release, counts: counts, trim: trim, stats: stats, openDiag: openDiag, get ver(){ return ver; }, lowMemory: low };
})();
