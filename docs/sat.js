/* Radio Chat Unlimited M0XOO - sat.js (v3.26): satellite orbits, passes and Doppler, all worked out on the phone.
   SGP4 (near-Earth, WGS-72) following Vallado et al. "Revisiting Spacetrack Report #3" (2006) - no external library.
   Orbit data (TLEs) come from CelesTrak; nothing here touches the app's database. */
var SAT = (function () {
  var PI = Math.PI, TWOPI = 2 * PI, DEG = PI / 180, X2O3 = 2 / 3;
  var MU = 398600.8, RE = 6378.135, XKE = 60 / Math.sqrt(RE * RE * RE / MU), J2 = 0.001082616, J3 = -0.00000253881,
    J4 = -0.00000165597, J3OJ2 = J3 / J2, VKMPS = RE * XKE / 60, C = 299792.458;

  function num(s) { return parseFloat(String(s).trim()) }
  function expo(s) { /* " 11956-3" -> 0.11956e-3 */
    s = String(s).trim(); if (!s) return 0; var m = /^([+-]?)(\d+)([+-]\d)$/.exec(s);
    if (!m) return parseFloat(s) || 0; return parseFloat(m[1] + "0." + m[2]) * Math.pow(10, +m[3]) }
  function jday(y, mo, d, h, mi, s) {
    return 367 * y - Math.floor(7 * (y + Math.floor((mo + 9) / 12)) * 0.25) + Math.floor(275 * mo / 9) + d + 1721013.5 + ((s / 60 + mi) / 60 + h) / 24 }
  function jdOf(ms) { return ms / 864e5 + 2440587.5 }
  function gmst(jdut1) { /* Vallado gstime, radians */
    var t = (jdut1 - 2451545.0) / 36525, g = -6.2e-6 * t * t * t + 0.093104 * t * t + (876600 * 3600 + 8640184.812866) * t + 67310.54841;
    g = (g * DEG / 240) % TWOPI; return g < 0 ? g + TWOPI : g }

  function parse(name, l1, l2) {
    var s = { name: String(name || "").trim(), norad: +l1.slice(2, 7) };
    var yy = +l1.slice(18, 20), day = num(l1.slice(20, 32)), yr = yy < 57 ? 2000 + yy : 1900 + yy;
    s.epochJd = jday(yr, 1, 0, 0, 0, 0) + day; s.epochMs = (s.epochJd - 2440587.5) * 864e5;
    s.bstar = expo(l1.slice(53, 61));
    s.inclo = num(l2.slice(8, 16)) * DEG; s.nodeo = num(l2.slice(17, 25)) * DEG; s.ecco = num("0." + l2.slice(26, 33).trim());
    s.argpo = num(l2.slice(34, 42)) * DEG; s.mo = num(l2.slice(43, 51)) * DEG; s.noKozai = num(l2.slice(52, 63)) * TWOPI / 1440;
    init(s); return s }

  function init(s) {
    var ss = 78 / RE + 1, qzms2t = Math.pow((120 - 78) / RE, 4);
    var cosio = Math.cos(s.inclo), cosio2 = cosio * cosio, eccsq = s.ecco * s.ecco, omeosq = 1 - eccsq, rteosq = Math.sqrt(omeosq);
    var ak = Math.pow(XKE / s.noKozai, X2O3), d1 = 0.75 * J2 * (3 * cosio2 - 1) / (rteosq * omeosq), del = d1 / (ak * ak);
    var adel = ak * (1 - del * del - del * (1 / 3 + 134 * del * del / 81)); del = d1 / (adel * adel);
    var no = s.noKozai / (1 + del), ao = Math.pow(XKE / no, X2O3), sinio = Math.sin(s.inclo), po = ao * omeosq;
    var con42 = 1 - 5 * cosio2, con41 = -con42 - cosio2 - cosio2, posq = po * po, rp = ao * (1 - s.ecco);
    s.no = no; s.ao = ao; s.con41 = con41; s.isimp = rp < (220 / RE + 1); s.deep = TWOPI / no >= 225;
    var sfour = ss, qzms24 = qzms2t, perige = (rp - 1) * RE;
    if (perige < 156) { sfour = perige - 78; if (perige < 98) sfour = 20; qzms24 = Math.pow((120 - sfour) / RE, 4); sfour = sfour / RE + 1 }
    var pinvsq = 1 / posq, tsi = 1 / (ao - sfour), eta = ao * s.ecco * tsi, etasq = eta * eta, eeta = s.ecco * eta, psisq = Math.abs(1 - etasq);
    var coef = qzms24 * Math.pow(tsi, 4), coef1 = coef / Math.pow(psisq, 3.5);
    var cc2 = coef1 * no * (ao * (1 + 1.5 * etasq + eeta * (4 + etasq)) + 0.375 * J2 * tsi / psisq * con41 * (8 + 3 * etasq * (8 + etasq)));
    s.cc1 = s.bstar * cc2; var cc3 = 0; if (s.ecco > 1e-4) cc3 = -2 * coef * tsi * J3OJ2 * no * sinio / s.ecco;
    s.x1mth2 = 1 - cosio2;
    s.cc4 = 2 * no * coef1 * ao * omeosq * (eta * (2 + 0.5 * etasq) + s.ecco * (0.5 + 2 * etasq) - J2 * tsi / (ao * psisq) *
      (-3 * con41 * (1 - 2 * eeta + etasq * (1.5 - 0.5 * eeta)) + 0.75 * s.x1mth2 * (2 * etasq - eeta * (1 + etasq)) * Math.cos(2 * s.argpo)));
    s.cc5 = 2 * coef1 * ao * omeosq * (1 + 2.75 * (etasq + eeta) + eeta * etasq);
    var cosio4 = cosio2 * cosio2, temp1 = 1.5 * J2 * pinvsq * no, temp2 = 0.5 * temp1 * J2 * pinvsq, temp3 = -0.46875 * J4 * pinvsq * pinvsq * no;
    s.mdot = no + 0.5 * temp1 * rteosq * con41 + 0.0625 * temp2 * rteosq * (13 - 78 * cosio2 + 137 * cosio4);
    s.argpdot = -0.5 * temp1 * con42 + 0.0625 * temp2 * (7 - 114 * cosio2 + 395 * cosio4) + temp3 * (3 - 36 * cosio2 + 49 * cosio4);
    var xhdot1 = -temp1 * cosio;
    s.nodedot = xhdot1 + (0.5 * temp2 * (4 - 19 * cosio2) + 2 * temp3 * (3 - 7 * cosio2)) * cosio;
    s.omgcof = s.bstar * cc3 * Math.cos(s.argpo); s.xmcof = s.ecco > 1e-4 ? -X2O3 * coef * s.bstar / eeta : 0;
    s.nodecf = 3.5 * omeosq * xhdot1 * s.cc1; s.t2cof = 1.5 * s.cc1;
    s.xlcof = Math.abs(cosio + 1) > 1.5e-12 ? -0.25 * J3OJ2 * sinio * (3 + 5 * cosio) / (1 + cosio) : -0.25 * J3OJ2 * sinio * (3 + 5 * cosio) / 1.5e-12;
    s.aycof = -0.5 * J3OJ2 * sinio; s.delmo = Math.pow(1 + eta * Math.cos(s.mo), 3); s.sinmao = Math.sin(s.mo);
    s.x7thm1 = 7 * cosio2 - 1; s.eta = eta;
    if (!s.isimp) {
      var cc1sq = s.cc1 * s.cc1; s.d2 = 4 * ao * tsi * cc1sq; var temp = s.d2 * tsi * s.cc1 / 3;
      s.d3 = (17 * ao + sfour) * temp; s.d4 = 0.5 * temp * ao * tsi * (221 * ao + 31 * sfour) * s.cc1;
      s.t3cof = s.d2 + 2 * cc1sq; s.t4cof = 0.25 * (3 * s.d3 + s.cc1 * (12 * s.d2 + 10 * cc1sq));
      s.t5cof = 0.2 * (3 * s.d4 + 12 * s.cc1 * s.d3 + 6 * s.d2 * s.d2 + 15 * cc1sq * (2 * s.d2 + cc1sq)) }
  }

  /* position / velocity (km, km/s, TEME frame) t minutes after the TLE epoch */
  function sgp4(s, t) {
    var xmdf = s.mo + s.mdot * t, argpdf = s.argpo + s.argpdot * t, nodedf = s.nodeo + s.nodedot * t;
    var argpm = argpdf, mm = xmdf, t2 = t * t, nodem = nodedf + s.nodecf * t2, tempa = 1 - s.cc1 * t, tempe = s.bstar * s.cc4 * t, templ = s.t2cof * t2;
    if (!s.isimp) {
      var delomg = s.omgcof * t, delm = s.xmcof * (Math.pow(1 + s.eta * Math.cos(xmdf), 3) - s.delmo), temp = delomg + delm;
      mm = xmdf + temp; argpm = argpdf - temp; var t3 = t2 * t, t4 = t3 * t;
      tempa = tempa - s.d2 * t2 - s.d3 * t3 - s.d4 * t4; tempe = tempe + s.bstar * s.cc5 * (Math.sin(mm) - s.sinmao);
      templ = templ + s.t3cof * t3 + t4 * (s.t4cof + t * s.t5cof) }
    var nm = s.no, em = s.ecco, inclm = s.inclo;
    var am = Math.pow(XKE / nm, X2O3) * tempa * tempa; nm = XKE / Math.pow(am, 1.5); em = em - tempe;
    if (em < 1e-6) em = 1e-6; if (em >= 1) return null;
    mm = mm + s.no * templ; var xlm = mm + argpm + nodem;
    nodem = nodem % TWOPI; argpm = argpm % TWOPI; xlm = xlm % TWOPI; mm = (xlm - argpm - nodem) % TWOPI;
    var sinim = Math.sin(inclm), cosim = Math.cos(inclm);
    var axnl = em * Math.cos(argpm), temp0 = 1 / (am * (1 - em * em)), aynl = em * Math.sin(argpm) + temp0 * s.aycof;
    var xl = mm + argpm + nodem + temp0 * s.xlcof * axnl, u = (xl - nodem) % TWOPI, eo1 = u, tem5 = 9999, ktr = 1, sineo1 = 0, coseo1 = 0;
    while (Math.abs(tem5) >= 1e-12 && ktr <= 10) {
      sineo1 = Math.sin(eo1); coseo1 = Math.cos(eo1); tem5 = 1 - coseo1 * axnl - sineo1 * aynl;
      tem5 = (u - aynl * coseo1 + axnl * sineo1 - eo1) / tem5; if (Math.abs(tem5) >= 0.95) tem5 = tem5 > 0 ? 0.95 : -0.95; eo1 += tem5; ktr++ }
    var ecose = axnl * coseo1 + aynl * sineo1, esine = axnl * sineo1 - aynl * coseo1, el2 = axnl * axnl + aynl * aynl, pl = am * (1 - el2);
    if (pl < 0) return null;
    var rl = am * (1 - ecose), rdotl = Math.sqrt(am) * esine / rl, rvdotl = Math.sqrt(pl) / rl, betal = Math.sqrt(1 - el2), temp = esine / (1 + betal);
    var sinu = am / rl * (sineo1 - aynl - axnl * temp), cosu = am / rl * (coseo1 - axnl + aynl * temp), su = Math.atan2(sinu, cosu);
    var sin2u = (cosu + cosu) * sinu, cos2u = 1 - 2 * sinu * sinu; temp = 1 / pl; var temp1 = 0.5 * J2 * temp, temp2 = temp1 * temp;
    var mrt = rl * (1 - 1.5 * temp2 * betal * s.con41) + 0.5 * temp1 * s.x1mth2 * cos2u;
    su = su - 0.25 * temp2 * s.x7thm1 * sin2u; var xnode = nodem + 1.5 * temp2 * cosim * sin2u, xinc = inclm + 1.5 * temp2 * cosim * sinim * cos2u;
    var mvt = rdotl - nm * temp1 * s.x1mth2 * sin2u / XKE, rvdot = rvdotl + nm * temp1 * (s.x1mth2 * cos2u + 1.5 * s.con41) / XKE;
    var sinsu = Math.sin(su), cossu = Math.cos(su), snod = Math.sin(xnode), cnod = Math.cos(xnode), sini = Math.sin(xinc), cosi = Math.cos(xinc);
    var xmx = -snod * cosi, xmy = cnod * cosi, ux = xmx * sinsu + cnod * cossu, uy = xmy * sinsu + snod * cossu, uz = sini * sinsu,
      vx = xmx * cossu - cnod * sinsu, vy = xmy * cossu - snod * sinsu, vz = sini * cossu;
    if (mrt < 1) return null; /* decayed */
    return { r: [mrt * ux * RE, mrt * uy * RE, mrt * uz * RE], v: [(mvt * ux + rvdot * vx) * VKMPS, (mvt * uy + rvdot * vy) * VKMPS, (mvt * uz + rvdot * vz) * VKMPS] } }

  /* observer: lat/lon degrees, height km (WGS-84) -> ECEF km */
  function obsEcef(lat, lon, h) {
    var a = 6378.137, f = 1 / 298.257223563, e2 = f * (2 - f), la = lat * DEG, lo = lon * DEG, n = a / Math.sqrt(1 - e2 * Math.sin(la) * Math.sin(la));
    return [(n + h) * Math.cos(la) * Math.cos(lo), (n + h) * Math.cos(la) * Math.sin(lo), (n * (1 - e2) + h) * Math.sin(la)] }
  /* look angles from observer to satellite at time ms */
  function look(s, obs, ms) {
    var t = (jdOf(ms) - s.epochJd) * 1440, p = sgp4(s, t); if (!p) return null;
    var g = gmst(jdOf(ms)), cg = Math.cos(g), sg = Math.sin(g);
    var x = cg * p.r[0] + sg * p.r[1], y = -sg * p.r[0] + cg * p.r[1], z = p.r[2]; /* TEME -> ECEF (polar motion ignored) */
    var o = obs.ecef, dx = x - o[0], dy = y - o[1], dz = z - o[2], la = obs.lat * DEG, lo = obs.lon * DEG;
    var sl = Math.sin(la), cl = Math.cos(la), so = Math.sin(lo), co = Math.cos(lo);
    var south = sl * co * dx + sl * so * dy - cl * dz, east = -so * dx + co * dy, up = cl * co * dx + cl * so * dy + sl * dz;
    var range = Math.sqrt(dx * dx + dy * dy + dz * dz), el = Math.asin(up / range) / DEG, az = Math.atan2(east, -south) / DEG;
    if (az < 0) az += 360;
    var rr = Math.sqrt(x * x + y * y + z * z), sublat = Math.asin(z / rr) / DEG, sublon = Math.atan2(y, x) / DEG;
    return { az: az, el: el, range: range, lat: sublat, lon: sublon, alt: rr - RE } }
  function observer(lat, lon, hKm) { return { lat: lat, lon: lon, ecef: obsEcef(lat, lon, hKm || 0.1) } }
  /* range rate km/s (positive = moving away) */
  function rangeRate(s, obs, ms) { var a = look(s, obs, ms - 500), b = look(s, obs, ms + 500); return a && b ? (b.range - a.range) : 0 }
  /* Doppler: what to listen on / transmit on so the satellite hears its own uplink frequency */
  function doppler(fMHz, rr, up) { return up ? fMHz * (1 + rr / C) : fMHz * (1 - rr / C) }

  /* passes over the next `hours` with the satellite above minEl degrees at its highest */
  function passes(s, obs, fromMs, hours, minEl) {
    if (s.deep) return [];
    var out = [], step = 60e3, end = fromMs + hours * 3600e3, prev = look(s, obs, fromMs), tPrev = fromMs, inPass = prev && prev.el > 0, aos = inPass ? fromMs : 0;
    function edge(a, b) { for (var i = 0; i < 20; i++) { var m = (a + b) / 2, l = look(s, obs, m); if (l && l.el > 0) b = m; else a = m } return b }
    function edgeDown(a, b) { for (var i = 0; i < 20; i++) { var m = (a + b) / 2, l = look(s, obs, m); if (l && l.el > 0) a = m; else b = m } return a }
    for (var t = fromMs + step; t <= end + step * 30; t += step) {
      var l = look(s, obs, t); if (!l) break;
      if (!inPass && l.el > 0 && prev && prev.el <= 0) { if (t > end) break; aos = edge(tPrev, t); inPass = true }
      else if (inPass && l.el <= 0) {
        var los = edgeDown(tPrev, t), best = { el: -90 }, tca = aos;
        for (var u = aos; u <= los; u += 10e3) { var q = look(s, obs, u); if (q && q.el > best.el) { best = q; tca = u } }
        if (best.el >= (minEl || 0)) out.push({ sat: s, aos: aos, los: los, tca: tca, maxEl: best.el, aosAz: look(s, obs, aos).az, losAz: look(s, obs, los).az, tcaAz: best.az, now: aos <= fromMs });
        inPass = false }
      prev = l; tPrev = t }
    return out }

  function parseTle(text) {
    var L = String(text).split(/\r?\n/).map(function (x) { return x.replace(/\s+$/, "") }).filter(Boolean), out = [];
    for (var i = 0; i + 2 < L.length + 1; i++) {
      if (/^1 /.test(L[i + 1] || "") && /^2 /.test(L[i + 2] || "")) { try { out.push(parse(L[i], L[i + 1], L[i + 2])) } catch (e) { } i += 2 } }
    return out }

  return { parse: parse, parseTle: parseTle, sgp4: sgp4, look: look, observer: observer, rangeRate: rangeRate, doppler: doppler, passes: passes, gmst: gmst, jdOf: jdOf };
})();
if (typeof module !== "undefined") module.exports = SAT;
