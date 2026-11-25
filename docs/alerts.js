/* v3.12 Alerts - shared by the Android background check (alerts.html, every 15 min) and the open app / web page.
   Checks: propagation (10 m, 6 m / 4 m / 2 m Sporadic E, aurora) from hamqsl.com, app users near you on APRS (aprs.fi),
   and people showing on air (Firebase). Each user picks what they want in the Alerts tab. Only CHANGES are notified:
   a band opening, someone newly near you (once every 6 h each), someone newly on air. The first run just remembers. */
var ALR = {
 FS: "https://firestore.googleapis.com/v1/projects/radio-chat-unlimited-m0xoo/databases/(default)/documents/",
 KEY: "AIzaSyA6ClIo52wbC2afxEAJRerCdZLaHhOXdoc",
 APRS_KEY: "209605.7aHWBxNlpG57c1",
 DEF: {p10: true, p6: true, p4: false, p2: false, aur: true, kp: 5, aprs: true, aprsMi: 10, air: true, airMi: 0},
 get: function (url, cb) {
  var x = new XMLHttpRequest(); try { x.open("GET", url); } catch (e) { return cb(null); } x.timeout = 20000;
  x.onload = function () { cb(x.status >= 200 && x.status < 300 ? x.responseText : null); };
  x.onerror = x.ontimeout = function () { cb(null); }; x.send();
 },
 dec: function (v) {
  if (!v) return ""; if ("stringValue" in v) return v.stringValue; if ("timestampValue" in v) return v.timestampValue;
  if ("integerValue" in v) return +v.integerValue; if ("booleanValue" in v) return v.booleanValue; return "";
 },
 docs: function (coll, cb) {
  ALR.get(ALR.FS + coll + "?pageSize=300&key=" + ALR.KEY, function (t) {
   var L = []; try { (JSON.parse(t).documents || []).forEach(function (d) { var o = {id: d.name.split("/").pop()}; for (var k in d.fields || {}) o[k] = ALR.dec(d.fields[k]); L.push(o); }); } catch (e) { return cb(null); }
   cb(L);
  });
 },
 base: function (c) { return String(c || "").toUpperCase().replace(/\/.*$/, "").replace(/-\d+$/, ""); },
 isCall: function (c) { return /^([A-Z]{1,2}|\d[A-Z])\d{1,2}[A-Z]{1,4}$/.test(c); },
 miles: function (a, b, c, d) { var R = 3958.8, r = Math.PI / 180, x = Math.sin((c - a) * r / 2), y = Math.sin((d - b) * r / 2);
  return 2 * R * Math.asin(Math.sqrt(x * x + Math.cos(a * r) * Math.cos(c * r) * y * y)); },
 dir: function (a, b, c, d) { var r = Math.PI / 180, y = Math.sin((d - b) * r) * Math.cos(c * r), x = Math.cos(a * r) * Math.sin(c * r) - Math.sin(a * r) * Math.cos(c * r) * Math.cos((d - b) * r);
  var g = (Math.atan2(y, x) / r + 360) % 360; return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(g / 45) % 8]; },
 /* hamqsl solar XML -> {b10, b6, b4, b2, aur, kp, txt} */
 prop: function (xml) {
  var x; try { x = new DOMParser().parseFromString(xml, "text/xml"); if (!x.getElementsByTagName("solardata").length) return null; } catch (e) { return null; }
  var h = new Date().getHours(), tm = h >= 7 && h < 19 ? "day" : "night", b10 = "", ph = {}, i, b = x.getElementsByTagName("band"), p = x.getElementsByTagName("phenomenon");
  for (i = 0; i < b.length; i++) if (b[i].getAttribute("name") == "12m-10m" && b[i].getAttribute("time") == tm) b10 = b[i].textContent.trim();
  for (i = 0; i < p.length; i++) ph[p[i].getAttribute("name") + "|" + p[i].getAttribute("location")] = p[i].textContent.trim();
  var open = function (k) { return !!ph[k] && !/closed/i.test(ph[k]); }, kpEl = x.getElementsByTagName("kindex")[0], kp = kpEl ? parseFloat(kpEl.textContent) : NaN;
  return {b10: /good|fair/i.test(b10), b10t: b10 || "?", b6: open("E-Skip|europe_6m"), b4: open("E-Skip|europe_4m"), b2: open("E-Skip|europe"),
   aurv: open("vhf-aurora|northern_hemi"), kp: kp, b6t: ph["E-Skip|europe_6m"] || "?"};
 },
 /* run all enabled checks. env: {prefs, state, post(title, text), save(state), done()} */
 run: function (env) {
  var P = {}, k; for (k in ALR.DEF) P[k] = ALR.DEF[k]; for (k in env.prefs || {}) P[k] = env.prefs[k];
  var S = env.state || {}, first = !S.init, out = [], left = 3, now = Date.now();
  S.prop = S.prop || {}; S.aprs = S.aprs || {}; S.air = S.air || {};
  function note(t, x) { if (!first) out.push([t, x]); }
  function fin() {
   if (--left > 0) return;
   S.init = 1; S.last = now;
   if (out.length > 4) { var more = out.slice(3); out = out.slice(0, 3); out.push(["More alerts", more.map(function (o) { return o[1]; }).join(" · ").slice(0, 300)]); }
   out.forEach(function (o) { env.post(o[0], o[1]); }); env.save(S); env.done && env.done(out);
  }
  /* 1. propagation */
  if (P.p10 || P.p6 || P.p4 || P.p2 || P.aur) ALR.get("https://www.hamqsl.com/solarxml.php?t=" + now, function (t) {
   var c = t && ALR.prop(t);
   if (c) {
    var aur = c.aurv || (P.kp > 0 && c.kp >= P.kp);
    [["p10", c.b10, "📡 10 m is open", "HF conditions for 12 m–10 m are " + c.b10t + " – worth a call on 28 MHz."],
     ["p6", c.b6, "📡 6 m is open (Sporadic E)", "hamqsl.com reports 6 m Es in Europe (" + c.b6t + ")."],
     ["p4", c.b4, "📡 4 m is open (Sporadic E)", "hamqsl.com reports 4 m Es in Europe."],
     ["p2", c.b2, "📡 2 m is open (Sporadic E)", "hamqsl.com reports 2 m Es in Europe – rare, go and listen!"],
     ["aur", aur, "🌌 Aurora possible", "K index " + (isNaN(c.kp) ? "?" : c.kp) + (c.aurv ? " and hamqsl.com reports VHF aurora" : "") + " – try 6 m / 2 m pointing north."]
    ].forEach(function (r) { if (P[r[0]] && r[1] && !S.prop[r[0]]) note(r[2], r[3]); S.prop[r[0]] = !!r[1]; });
    S.cond = {b10: c.b10t, b6: c.b6t, kp: c.kp, at: now};
   }
   fin();
  }); else fin();
  /* 2 + 3. APRS near you and people on air */
  var me = (P.lat != null && P.lon != null) ? {lat: +P.lat, lon: +P.lon} : null, myB = ALR.base(P.call);
  ALR.docs("activity", function (act) {
   act = (act || []).filter(function (d) { return d.call && d.freq && now - new Date(d.at) < 6 * 3600e3 && !(P.uid && d.id.indexOf(P.uid) == 0) && ALR.base(d.call) != myB; });
   var needAprs = P.aprs || (P.air && P.airMi > 0);
   if (!needAprs) return onPos({});
   /* everyone the app knows: users + admins + people on air */
   ALR.docs("users", function (us) {
    ALR.get(ALR.FS + "settings/admins?key=" + ALR.KEY, function (t) {
     var calls = {}; (us || []).forEach(function (u) { calls[ALR.base(u.call || u.id)] = 1; });
     try { String(ALR.dec(JSON.parse(t).fields.calls)).split(",").forEach(function (c) { calls[ALR.base(c.trim())] = 1; }); } catch (e) {}
     act.forEach(function (d) { calls[ALR.base(d.call)] = 1; }); if (myB) calls[myB] = 1;
     var L = Object.keys(calls).filter(ALR.isCall), pos = {}, bi = 0, B = [];
     for (var i = 0; i < L.length; i += 2) B.push(L.slice(i, i + 2));
     (function next() {
      if (bi >= B.length) return onPos(pos);
      var g = B[bi++], names = []; g.forEach(function (c) { ["", "-1", "-2", "-3", "-4", "-5", "-6", "-7", "-8", "-9"].forEach(function (s) { names.push(c + s); }); });
      ALR.get("https://api.aprs.fi/api/get?name=" + encodeURIComponent(names.join(",")) + "&what=loc&apikey=" + encodeURIComponent(P.key || ALR.APRS_KEY) + "&format=json", function (t) {
       try { (JSON.parse(t).entries || []).forEach(function (e) { var b = ALR.base(e.name), tt = +(e.lasttime || e.time) || 0; if (e.lat != null && (!pos[b] || tt > pos[b].t)) pos[b] = {n: e.name, lat: +e.lat, lon: +e.lng, t: tt}; }); } catch (e) {}
       setTimeout(next, 1000);
      });
     })();
    });
   });
   function onPos(pos) {
    if (!me && pos[myB]) me = {lat: pos[myB].lat, lon: pos[myB].lon};
    /* APRS: app users within aprsMi, heard in the last hour, at most once every 6 hours each */
    if (P.aprs && me) Object.keys(pos).forEach(function (c) {
     var p = pos[c]; if (c == myB || now / 1000 - p.t > 3600) return; var mi = ALR.miles(me.lat, me.lon, p.lat, p.lon);
     if (mi > P.aprsMi) return; if (S.aprs[c] && now - S.aprs[c] < 6 * 3600e3) return; S.aprs[c] = now;
     note("📍 " + c + " is nearby", p.n + " is " + (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + " miles " + ALR.dir(me.lat, me.lon, p.lat, p.lon) + " of you on APRS (" + Math.round((now / 1000 - p.t) / 60) + " min ago).");
    });
    for (var c in S.aprs) if (now - S.aprs[c] > 24 * 3600e3) delete S.aprs[c];
    /* on air: anyone newly showing a frequency (optionally only within airMi of you) */
    var cur = {};
    if (P.air) act.forEach(function (d) {
     var key = d.id + "|" + d.freq + "|" + d.mode; cur[key] = 1; if (S.air[key]) return;
     var p = pos[ALR.base(d.call)], dist = "";
     if (P.airMi > 0) { if (!me || !p) return; var mi = ALR.miles(me.lat, me.lon, p.lat, p.lon); if (mi > P.airMi) return; dist = " · " + (mi < 10 ? mi.toFixed(1) : Math.round(mi)) + " mi " + ALR.dir(me.lat, me.lon, p.lat, p.lon); }
     else if (me && p && now / 1000 - p.t < 3 * 3600) { var m2 = ALR.miles(me.lat, me.lon, p.lat, p.lon); dist = " · " + (m2 < 10 ? m2.toFixed(1) : Math.round(m2)) + " mi " + ALR.dir(me.lat, me.lon, p.lat, p.lon); }
     note("📻 " + d.call + " is on air", d.freq + " MHz " + (d.mode || "") + (d.label ? " · " + d.label : "") + (d.note ? " · " + d.note : "") + dist);
    });
    S.air = cur;
    fin(); fin();
   }
  });
 }
};
