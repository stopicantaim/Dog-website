/* ═══════════════════════════════════════════════════════════════
   3D services showroom
   The services stand on a slowly turning ring, like cars on a
   showroom turntable. Drag or swipe to spin it, tap the card in
   front and the camera flies into it, then the service page opens.

   Needs js/three.min.js loaded first. index.html only loads these
   files when the visitor gets near the services section, and only
   on devices that can do WebGL and haven't asked for reduced motion.
   Nothing in here needs editing: it reads the services from SITE.
   ═══════════════════════════════════════════════════════════════ */
(function(){
"use strict";

const T = window.THREE;
const GOLD = 0xf0c14b, BG = 0x0a0c0b;
const CARD_W = 3, CARD_H = 3*1080/768;     // same shape as the card artwork
const TEX_W = 768, TEX_H = 1080;

const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;    // ease in-out cubic
const lerp = (a,b,t) => a+(b-a)*t;
const wrapIdx = (i,n) => ((i%n)+n)%n;

function loadImage(src){
  return new Promise(res=>{
    if(!src) return res(null);
    const im = new Image();
    im.onload = ()=>res(im);
    im.onerror = ()=>res(null);
    im.src = src;
  });
}

function roundRectPath(g,x,y,w,h,r){
  g.beginPath();
  g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  g.lineTo(x+r,y+h); g.quadraticCurveTo(x,y+h,x,y+h-r);
  g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y);
  g.closePath();
}

function wrapLines(g,text,maxW){
  const words = text.split(/\s+/), lines=[];
  let cur="";
  words.forEach(w=>{
    const t = cur ? cur+" "+w : w;
    if(g.measureText(t).width>maxW && cur){ lines.push(cur); cur=w; } else cur=t;
  });
  if(cur) lines.push(cur);
  return lines;
}

// The card artwork is drawn onto a canvas, so the text is real text and
// stays sharp, and it matches the rest of the site's type.
function drawCard(img, s, i){
  const c = document.createElement("canvas");
  c.width = TEX_W; c.height = TEX_H;
  const g = c.getContext("2d");
  const disp = "Archivo, 'Arial Narrow', Arial, sans-serif";
  const body = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

  roundRectPath(g,0,0,TEX_W,TEX_H,26); g.save(); g.clip();
  g.fillStyle = "#151917"; g.fillRect(0,0,TEX_W,TEX_H);
  if(img){
    const r = Math.max(TEX_W/img.width, TEX_H/img.height);
    const w = img.width*r, h = img.height*r;
    g.drawImage(img,(TEX_W-w)/2,(TEX_H-h)/2,w,h);
  }
  const sh = g.createLinearGradient(0,0,0,TEX_H);
  sh.addColorStop(0,"rgba(6,8,7,.45)"); sh.addColorStop(.28,"rgba(6,8,7,0)");
  sh.addColorStop(.5,"rgba(6,8,7,.2)"); sh.addColorStop(1,"rgba(6,8,7,.96)");
  g.fillStyle = sh; g.fillRect(0,0,TEX_W,TEX_H);

  // big outlined number, top left
  g.font = "800 132px "+disp;
  g.lineWidth = 2.5; g.strokeStyle = "rgba(255,255,255,.78)";
  g.strokeText(String(i+1).padStart(2,"0"), 46, 160);

  // name, wrapped, from the bottom up
  g.font = "800 76px "+disp;
  const lines = wrapLines(g,(s.name||"").toUpperCase(),TEX_W-96);
  let y = TEX_H-150-(lines.length-1)*74;
  if(s.tag){
    g.font = "700 25px "+body;
    if("letterSpacing" in g) g.letterSpacing = "5px";
    g.fillStyle = "#f0c14b";
    g.fillText(s.tag.toUpperCase(), 48, y-86);
    if("letterSpacing" in g) g.letterSpacing = "0px";
  }
  g.font = "800 76px "+disp; g.fillStyle = "#fff";
  lines.forEach((l,k)=>g.fillText(l,46,y+k*74));

  // hairline and the call to action
  g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(48,TEX_H-108,TEX_W-96,2);
  g.font = "800 24px "+body;
  if("letterSpacing" in g) g.letterSpacing = "4px";
  g.fillStyle = "#fff"; g.fillText("TAP TO STEP INSIDE  →", 48, TEX_H-56);
  g.restore();

  // thin frame
  roundRectPath(g,1.5,1.5,TEX_W-3,TEX_H-3,25);
  g.lineWidth = 3; g.strokeStyle = "rgba(255,255,255,.16)"; g.stroke();
  return c;
}

// fades the floor reflection out as it gets further from the card
function reflectionAlpha(){
  const c = document.createElement("canvas"); c.width = 4; c.height = 256;
  const g = c.getContext("2d");
  const gr = g.createLinearGradient(0,0,0,256);
  gr.addColorStop(0,"#000"); gr.addColorStop(.55,"#000"); gr.addColorStop(1,"#5a5a5a");
  g.fillStyle = gr; g.fillRect(0,0,4,256);
  return new T.CanvasTexture(c);
}

function dotTexture(){
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(32,32,0,32,32,32);
  gr.addColorStop(0,"rgba(255,255,255,1)"); gr.addColorStop(.35,"rgba(255,255,255,.6)");
  gr.addColorStop(1,"rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0,0,64,64);
  return new T.CanvasTexture(c);
}

function create(host, services, opts){
  opts = opts || {};
  const n = services.length;
  if(!T || !n) return null;

  const renderer = new T.WebGLRenderer({antialias:true, alpha:false, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  renderer.setClearColor(BG,1);
  if("outputEncoding" in renderer) renderer.outputEncoding = T.sRGBEncoding;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "pan-y";   // vertical swipes still scroll the page

  const scene = new T.Scene();
  scene.fog = new T.Fog(BG, 12, 26);
  const camera = new T.PerspectiveCamera(36, 1, .1, 100);

  // ring layout: wide enough that neighbours never touch, tight enough
  // that they peek in from the sides
  const R = Math.max(4.6, (CARD_W*1.18)/(2*Math.sin(Math.PI/n)));
  const STEP = 2*Math.PI/n;
  const FLOOR = -CARD_H/2;

  const ring = new T.Group(); scene.add(ring);
  const refl = reflectionAlpha();
  const cards = services.map((s,i)=>{
    const pivot = new T.Group();
    const a = i*STEP;
    pivot.position.set(Math.sin(a)*R, 0, Math.cos(a)*R);
    pivot.rotation.y = a;
    const geo = new T.PlaneGeometry(CARD_W, CARD_H);
    const mat = new T.MeshBasicMaterial({color:0x222222, transparent:true});
    const mesh = new T.Mesh(geo, mat);
    mesh.userData.i = i;
    const rmat = new T.MeshBasicMaterial({color:0x222222, transparent:true, alphaMap:refl,
      side:T.DoubleSide, depthWrite:false, opacity:.55});
    const rmesh = new T.Mesh(geo, rmat);
    rmesh.scale.y = -1;
    rmesh.position.y = -CARD_H - .02;
    pivot.add(mesh); pivot.add(rmesh);
    ring.add(pivot);
    return {pivot, mesh, mat, rmat, lift:0, tx:0, ty:0};
  });

  // the artwork arrives once the photo and the display font are ready
  const fontReady = (document.fonts && document.fonts.load)
    ? Promise.race([document.fonts.load("800 76px Archivo"), new Promise(r=>setTimeout(r,1500))]).catch(()=>{})
    : Promise.resolve();
  fontReady.then(()=>{
    services.forEach((s,i)=>{
      loadImage(s.img).then(img=>{
        const tex = new T.CanvasTexture(drawCard(img,s,i));
        if("encoding" in tex) tex.encoding = T.sRGBEncoding;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        cards[i].mat.map = tex; cards[i].mat.needsUpdate = true;
        cards[i].rmat.map = tex; cards[i].rmat.needsUpdate = true;
        dirty = true;
      });
    });
  });

  // turntable: two gold hairline rings on the floor
  const ringMat = new T.MeshBasicMaterial({color:GOLD, transparent:true, opacity:.42, side:T.DoubleSide});
  [[R+CARD_W*.62, .025],[R-CARD_W*.62, .018],[R+CARD_W*.62+.35, .01]].forEach(([r,w])=>{
    const m = new T.Mesh(new T.RingGeometry(r, r+w, 160), ringMat);
    m.rotation.x = -Math.PI/2; m.position.y = FLOOR - .01;
    scene.add(m);
  });
  // soft glow pooled under the front card
  const glowC = document.createElement("canvas"); glowC.width = glowC.height = 128;
  const gg = glowC.getContext("2d");
  const ggr = gg.createRadialGradient(64,64,0,64,64,64);
  ggr.addColorStop(0,"rgba(240,193,75,.55)"); ggr.addColorStop(1,"rgba(240,193,75,0)");
  gg.fillStyle = ggr; gg.fillRect(0,0,128,128);
  const glow = new T.Mesh(new T.PlaneGeometry(CARD_W*2.6, CARD_W*1.3),
    new T.MeshBasicMaterial({map:new T.CanvasTexture(glowC), transparent:true, depthWrite:false, blending:T.AdditiveBlending}));
  glow.rotation.x = -Math.PI/2; glow.position.set(0, FLOOR, R+.2);
  scene.add(glow);

  // gold dust drifting up through the scene
  const DUST = 320;
  const dpos = new Float32Array(DUST*3), dspd = new Float32Array(DUST);
  for(let k=0;k<DUST;k++){
    dpos[k*3]   = (Math.random()-.5)*26;
    dpos[k*3+1] = FLOOR + Math.random()*10;
    dpos[k*3+2] = (Math.random()-.5)*20;
    dspd[k] = .12 + Math.random()*.35;
  }
  const dgeo = new T.BufferGeometry();
  dgeo.setAttribute("position", new T.BufferAttribute(dpos,3));
  const dust = new T.Points(dgeo, new T.PointsMaterial({color:GOLD, size:.07, map:dotTexture(),
    transparent:true, opacity:.75, depthWrite:false, blending:T.AdditiveBlending, sizeAttenuation:true}));
  scene.add(dust);

  // ── camera framing ───────────────────────────────────────────────
  let W=1, H=1, camDist=12, camY=.35, active=0, rot=0, rotTarget=0;
  function frame(){
    W = host.clientWidth || 1; H = host.clientHeight || 1;
    renderer.setSize(W,H,false);
    camera.aspect = W/H; camera.updateProjectionMatrix();
    const t = Math.tan(T.MathUtils.degToRad(camera.fov/2));
    // the front card fills about two thirds of the height, and never
    // more than 80% of the width on a narrow phone
    const dH = CARD_H/(.66*2*t), dW = CARD_W/(.8*2*t*camera.aspect);
    camDist = Math.max(dH,dW);
    dirty = true;
  }
  const restPos = new T.Vector3(), restLook = new T.Vector3(0,-.1,R);
  function rest(){ restPos.set(0,camY,R+camDist); }

  // ── interaction ─────────────────────────────────────────────────
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  let px=0, py=0, hover=-1, dragging=false, downX=0, downY=0, lastX=0, lastT=0, vel=0, moved=false;
  let state = "idle";                 // idle | flying-in | inside | flying-out
  let dirty = true, visible = true, raf = 0, last = performance.now();
  let fly = {t:0, dur:900, from:new T.Vector3(), to:new T.Vector3(), lookFrom:new T.Vector3(), lookTo:new T.Vector3(), done:null};

  function setActive(i, instant){
    const target = Math.round(rotTarget/STEP);
    // pick the closest full turn so it never spins the long way round
    const cur = wrapIdx(target,n);
    let d = wrapIdx(i,n) - cur;
    if(d > n/2) d -= n; if(d < -n/2) d += n;
    rotTarget = (target+d)*STEP;
    if(instant) rot = rotTarget;
    dirty = true;
  }
  function frontIndex(){ return wrapIdx(Math.round(rotTarget/STEP), n); }

  function pick(e){
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(cards.map(c=>c.mesh), false)[0];
    return hit ? hit.object.userData.i : -1;
  }

  const el = renderer.domElement;
  el.addEventListener("pointerdown", e=>{
    if(state!=="idle") return;
    dragging = true; moved = false;
    downX = lastX = e.clientX; downY = e.clientY; lastT = performance.now(); vel = 0;
    try{ el.setPointerCapture(e.pointerId); }catch(_){}
  });
  el.addEventListener("pointermove", e=>{
    const r = el.getBoundingClientRect();
    px = ((e.clientX-r.left)/r.width)*2-1;
    py = ((e.clientY-r.top)/r.height)*2-1;
    if(dragging){
      const dx = e.clientX-lastX, now = performance.now();
      if(Math.abs(e.clientX-downX)>6) moved = true;
      // a full card width of drag turns the ring by one card
      const k = STEP/Math.max(160, W*.45);
      rotTarget -= dx*k; rot -= dx*k;
      vel = (-dx*k)/Math.max(1,now-lastT)*16;
      lastX = e.clientX; lastT = now;
    } else if(state==="idle" && e.pointerType==="mouse"){
      const h = pick(e);
      if(h!==hover){ hover = h; el.style.cursor = h>=0 ? "pointer" : "grab"; }
    }
    dirty = true;
  });
  function endDrag(e, cancelled){
    if(!dragging) return;
    dragging = false;
    if(!moved && !cancelled && Math.abs(e.clientY-downY)<8){
      const h = pick(e);
      if(h>=0){
        if(h===frontIndex()) openActive();
        else setActive(h);
      }
      return;
    }
    // let it coast a little, then settle on the nearest card
    rotTarget = Math.round((rotTarget + vel*6)/STEP)*STEP;
    dirty = true;
  }
  el.addEventListener("pointerup", e=>endDrag(e,false));
  el.addEventListener("pointercancel", e=>endDrag(e,true));
  el.addEventListener("pointerleave", ()=>{ px=0; py=0; hover=-1; dirty=true; });

  host.addEventListener("keydown", e=>{
    if(state!=="idle") return;
    if(e.key==="ArrowRight"){ e.preventDefault(); api.next(); }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); api.prev(); }
    else if(e.key==="Enter"||e.key===" "){ e.preventDefault(); openActive(); }
  });

  function startFly(toInside, done){
    fly.t = 0; fly.done = done;
    fly.dur = toInside ? 950 : 850;
    const t = Math.tan(T.MathUtils.degToRad(camera.fov/2));
    // close enough that the card covers the whole canvas
    const cover = Math.min(CARD_H/(2*t), CARD_W/(2*t*camera.aspect))*.9;
    const inPos = new T.Vector3(0,0,R+cover), inLook = new T.Vector3(0,0,R);
    rest();
    if(toInside){ fly.from.copy(camera.position); fly.to.copy(inPos); fly.lookFrom.copy(restLook); fly.lookTo.copy(inLook); }
    else { fly.from.copy(inPos); fly.to.copy(restPos); fly.lookFrom.copy(inLook); fly.lookTo.copy(restLook); }
    state = toInside ? "flying-in" : "flying-out";
    start();
  }

  function openActive(){
    if(state!=="idle") return;
    rot = rotTarget = Math.round(rotTarget/STEP)*STEP;
    const i = frontIndex();
    if(opts.onStart) opts.onStart(i);
    startFly(true, ()=>{ state="inside"; if(opts.onOpen) opts.onOpen(i); });
  }

  // ── render loop ─────────────────────────────────────────────────
  const look = new T.Vector3();
  function tick(now){
    raf = 0;
    const dt = Math.min(50, now-last); last = now;
    const time = now/1000;

    if(!dragging) rot += (rotTarget-rot)*Math.min(1, dt*.009);
    ring.rotation.y = -rot;
    const idx = frontIndex();
    if(idx!==active){ active = idx; if(opts.onChange) opts.onChange(idx); }

    cards.forEach((c,i)=>{
      // how squarely this card faces the camera: 1 in front, -1 behind
      const face = Math.cos(i*STEP - rot);
      const b = .22 + .78*Math.pow(Math.max(0,face),2.2);
      c.mat.color.setScalar(b); c.rmat.color.setScalar(b);
      const isFront = i===idx && state==="idle";
      const lift = (isFront ? .18 : 0) + (i===hover ? .12 : 0);
      c.lift += (lift-c.lift)*Math.min(1,dt*.01);
      // the front card leans gently toward the pointer
      const tx = isFront ? -py*.12 : 0, ty = isFront ? px*.18 : 0;
      c.tx += (tx-c.tx)*Math.min(1,dt*.008); c.ty += (ty-c.ty)*Math.min(1,dt*.008);
      c.mesh.position.z = c.lift; c.mesh.rotation.x = c.tx; c.mesh.rotation.y = c.ty;
      // a slow idle bob so the scene never looks frozen
      c.mesh.position.y = Math.sin(time*.9 + i*1.3)*.05;
    });

    // dust drifts up and wraps round
    const p = dgeo.attributes.position.array;
    for(let k=0;k<DUST;k++){
      p[k*3+1] += dspd[k]*dt*.0006;
      p[k*3]   += Math.sin(time*.3+k)*dt*.00008;
      if(p[k*3+1] > FLOOR+10) p[k*3+1] = FLOOR;
    }
    dgeo.attributes.position.needsUpdate = true;
    glow.material.opacity = .75 + Math.sin(time*1.6)*.15;

    rest();
    if(state==="flying-in" || state==="flying-out"){
      fly.t += dt;
      const k = ease(Math.min(1, fly.t/fly.dur));
      camera.position.lerpVectors(fly.from, fly.to, k);
      look.lerpVectors(fly.lookFrom, fly.lookTo, k);
      camera.lookAt(look);
      // the dust rushes past as the camera dives in
      dust.material.size = .07 + (state==="flying-in" ? k : 1-k)*.08;
      if(fly.t>=fly.dur){
        const d = fly.done; fly.done = null;
        if(state==="flying-out") state = "idle";
        if(d) d();
      }
    } else if(state==="idle"){
      // a touch of parallax with the pointer
      const tgt = new T.Vector3(restPos.x + px*.45, restPos.y - py*.25, restPos.z);
      camera.position.lerp(tgt, Math.min(1, dt*.004));
      camera.lookAt(restLook);
    }

    renderer.render(scene, camera);
    // keep going while on screen, and always finish a spin or a flight
    const moving = Math.abs(rotTarget-rot)>.0005 || state==="flying-in" || state==="flying-out";
    if((visible && state!=="inside") || moving) raf = requestAnimationFrame(tick);
  }
  function start(){ if(!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } }

  // only draw while the section is on screen
  if("IntersectionObserver" in window){
    new IntersectionObserver(es=>{
      // entries arrive oldest first, so the last one is the current state
      visible = es[es.length-1].isIntersecting;
      if(visible) start();
    },{rootMargin:"120px 0px"}).observe(host);
  }
  document.addEventListener("visibilitychange",()=>{
    visible = !document.hidden;
    if(visible) start();
  });
  let rt=0;
  addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(()=>{ frame(); start(); },120); });

  frame(); rest();
  camera.position.copy(restPos); camera.lookAt(restLook);
  start();

  const api = {
    next(){ setActive(frontIndex()+1); start(); },
    prev(){ setActive(frontIndex()-1); start(); },
    goTo(i, instant){ setActive(i, instant); start(); },
    open: openActive,
    get index(){ return frontIndex(); },
    // called when the service page closes: fly back out to the turntable
    flyBack(i){
      if(typeof i==="number") setActive(i, true);
      frame();
      startFly(false, null);
    },
  };
  return api;
}

window.Services3D = {create};
})();
