/* ═══════════════════════════════════════════════════════════════
   Google Ads tracking for Dillon's Pet Care
   Fill in GOOGLE_ADS below from your Google Ads account and every page
   starts reporting conversions. Until then nothing is loaded.

   Where to find the values (Google Ads → Goals → Conversions → Summary):
   - id:          your conversion ID, looks like "AW-123456789"
   - leadLabel:   the label of a "Submit lead form" conversion action
   - callLabel:   the label of a "Phone call clicks" (or "Contact")
                  conversion action. Text and email taps use it too.
   A label looks like "AbC-D_efG-h12_34-567" (the part after the "/").
   ═══════════════════════════════════════════════════════════════ */
var GOOGLE_ADS = {
  id:        "",      // e.g. "AW-123456789"
  leadLabel: "",      // booking request sent
  callLabel: "",      // tapped Call, Text or Email
};
/* ═════════════ nothing below here needs editing ═════════════ */
(function(){
  "use strict";
  var AD = GOOGLE_ADS || {};
  var ON = /^AW-\d+$/.test(String(AD.id||"").trim());

  // 1. remember which ad a visitor came from (gclid, utm_*), for 90 days,
  //    so a booking request can say "came from Google Ads: house sitting"
  var KEY = "dpc_ad_source", src = null;
  function read(){ try{ return JSON.parse(localStorage.getItem(KEY)||"null"); }catch(_){ return null; } }
  try{
    var q = new URLSearchParams(location.search), got = {};
    ["gclid","gbraid","wbraid","utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){
      var v = q.get(k); if(v) got[k] = v.slice(0,200);
    });
    if(Object.keys(got).length){
      got.landing = location.pathname; got.at = new Date().toISOString().slice(0,10);
      src = got; try{ localStorage.setItem(KEY, JSON.stringify(got)); }catch(_){}
    } else {
      src = read();
      if(src && src.at && (Date.now() - Date.parse(src.at)) > 90*864e5){ src = null; try{ localStorage.removeItem(KEY); }catch(_){} }
    }
  }catch(_){}

  // 2. Google's tag, only once an Ads ID is set
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  if(ON){
    window.gtag = window.gtag || gtag;
    var s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id="+encodeURIComponent(AD.id);
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("config", AD.id);
  }
  function conv(label, extra){
    if(!ON || !label) return;
    var o = {send_to: AD.id+"/"+label};
    if(extra) for(var k in extra) o[k] = extra[k];
    try{ gtag("event","conversion",o); }catch(_){}
  }

  // 3. calls, texts and emails count as contacts, on every page
  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest('a[href^="tel:"],a[href^="sms:"],a[href^="mailto:"]') : null;
    if(!a) return;
    conv(AD.callLabel);
    try{ if(typeof fbq==="function") fbq("track","Contact"); }catch(_){}
  }, true);

  window.AdTrack = {
    // call when a booking request has been sent
    lead: function(service){ conv(AD.leadLabel, {value:1.0, currency:"USD"}); },
    // fields to add to a booking request so it shows where the visitor came from
    source: function(){
      if(!src) return {};
      var out = {}, label = [];
      if(src.gclid || src.gbraid || src.wbraid) label.push("Google Ads");
      else if(src.utm_source) label.push(src.utm_source + (src.utm_medium ? " / "+src.utm_medium : ""));
      if(src.utm_campaign) label.push(src.utm_campaign);
      if(src.utm_term) label.push("“"+src.utm_term+"”");
      out.came_from = label.join(" · ") || "ad";
      if(src.landing) out.landing_page = src.landing;
      if(src.gclid) out.gclid = src.gclid;
      return out;
    },
    enabled: ON,
  };
})();
