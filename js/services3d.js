/* ═══════════════════════════════════════════════════════════════
   3D dog house: one section per service
   A wide dog house split into sections, each with its own peaked
   roof, arched door and a hanging sign. Hover or tap a section and
   its door swings open. Tap again, or press the
   button under it, and the camera walks in through that door and
   the service page opens.

   On a phone the camera shows one section at a time; swipe or use
   the arrows to walk along the house.

   Needs js/three.min.js loaded first. index.html only loads these
   files near the services section, on devices that can do WebGL and
   haven't asked for reduced motion. Nothing here needs editing: it
   reads the services (and their icons) from the page.
   ═══════════════════════════════════════════════════════════════ */
(function(){
"use strict";

const T = window.THREE;
const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
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
function wrapLines(g,text,maxW){
  const words = text.split(/\s+/), lines=[]; let cur="";
  words.forEach(w=>{ const t = cur ? cur+" "+w : w;
    if(g.measureText(t).width>maxW && cur){ lines.push(cur); cur=w; } else cur=t; });
  if(cur) lines.push(cur);
  return lines;
}
function roundRect(g,x,y,w,h,r){
  g.beginPath(); g.moveTo(x+r,y); g.lineTo(x+w-r,y); g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h-r); g.quadraticCurveTo(x+w,y+h,x+w-r,y+h); g.lineTo(x+r,y+h);
  g.quadraticCurveTo(x,y+h,x,y+h-r); g.lineTo(x,y+r); g.quadraticCurveTo(x,y,x+r,y); g.closePath();
}

// the hanging sign over each door: icon + service name
function drawSign(name, icon, ink){
  const W=640, H=220, c=document.createElement("canvas"); c.width=W; c.height=H;
  const g=c.getContext("2d");
  roundRect(g,6,6,W-12,H-12,34); g.fillStyle="#fffdf7"; g.fill();
  g.lineWidth=10; g.strokeStyle=ink; g.stroke();
  if(icon) g.drawImage(icon, 34, (H-120)/2, 120, 120);
  g.fillStyle=ink;
  // shrink the lettering until every line fits (long words like
  // "transportation" can't wrap) and it's no more than two lines
  const maxW = W-(icon?210:80);
  let fs=62, lines=[];
  for(; fs>=30; fs-=2){
    g.font="800 "+fs+"px Archivo, 'Arial Narrow', Arial, sans-serif";
    lines=wrapLines(g,(name||"").toUpperCase(), maxW);
    if(lines.length<=2 && lines.every(l=>g.measureText(l).width<=maxW)) break;
  }
  const lh=fs, top=(H-lines.length*lh)/2+lh*.8;
  lines.forEach((l,k)=>g.fillText(l, icon?176:40, top+k*lh));
  return c;
}

// an arch: straight sides, round top. Used for doors and doorways.
function archShape(w,h){
  const s=new T.Shape(), r=w/2;
  s.moveTo(-r,0); s.lineTo(r,0); s.lineTo(r,h-r);
  s.absarc(0,h-r,r,0,Math.PI,false);
  s.lineTo(-r,0);
  return s;
}

function create(host, services, opts){
  opts = opts || {};
  const n = services.length;
  if(!T || !n) return null;
  const th = Object.assign({bg:"#fffdf7", line:"#2f5d3a", dust:"#c99a1f", light:true}, opts.theme||{});
  const col = hex => new T.Color(hex).convertSRGBToLinear();
  const INK = th.line;

  const renderer = new T.WebGLRenderer({antialias:true, alpha:false, powerPreference:"high-performance"});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  renderer.setClearColor(new T.Color(th.bg), 1);
  if("outputEncoding" in renderer) renderer.outputEncoding = T.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = "pan-y";

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(34, 1, .1, 100);

  // ── light: soft daylight from the front left ──────────────────────
  scene.add(new T.HemisphereLight(0xffffff, 0xcfc3a6, .72));
  const sun = new T.DirectionalLight(0xfff1d6, .78);
  sun.position.set(-5, 9, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024,1024);
  sun.shadow.camera.left=-9; sun.shadow.camera.right=9; sun.shadow.camera.top=7; sun.shadow.camera.bottom=-5;
  sun.shadow.radius = 4; sun.shadow.bias = -.0008;
  scene.add(sun);

  // ── materials ─────────────────────────────────────────────────────
  const M = {
    wall:  new T.MeshStandardMaterial({color:col("#efe1c2"), roughness:.9}),
    plank: new T.MeshStandardMaterial({color:col("#dccaa3"), roughness:.95}),
    trim:  new T.MeshStandardMaterial({color:col("#fffdf7"), roughness:.8}),
    roof:  new T.MeshStandardMaterial({color:col(INK), roughness:.75}),
    door:  new T.MeshStandardMaterial({color:col("#f0c14b"), roughness:.7}),
    knob:  new T.MeshStandardMaterial({color:col(INK), roughness:.4, metalness:.2}),
    dark:  new T.MeshBasicMaterial({color:col("#24301f")}),
    eye:   new T.MeshBasicMaterial({color:0xffffff}),
    pupil: new T.MeshBasicMaterial({color:0x111111}),
    ground:new T.MeshStandardMaterial({color:col("#c9dfbf"), roughness:1}),
    rope:  new T.MeshStandardMaterial({color:col("#8a6a3b"), roughness:1}),
    bowl:  new T.MeshStandardMaterial({color:col(INK), roughness:.5}),
    ball:  new T.MeshStandardMaterial({color:col("#c8e04a"), roughness:.8}),
  };

  // ── the house ─────────────────────────────────────────────────────
  const W = 2.3, D = 2.1, BASE_H = 1.55, PEAK = .95;
  const DOOR_W = .92, DOOR_H = 1.18;
  const house = new T.Group(); scene.add(house);
  const totalW = n*W;
  const xOf = i => (i-(n-1)/2)*W;

  const sections = services.map((s,i)=>{
    // the middle section stands a little taller, for a nicer roofline
    const tall = (n%2===1 && i===(n-1)/2) ? 1.14 : 1;
    const h = BASE_H*tall, pk = PEAK*tall;
    const g = new T.Group(); g.position.x = xOf(i); house.add(g);

    // walls: a house-shaped outline pushed back into a solid
    const shp = new T.Shape();
    shp.moveTo(-W/2,0); shp.lineTo(W/2,0); shp.lineTo(W/2,h); shp.lineTo(0,h+pk); shp.lineTo(-W/2,h); shp.lineTo(-W/2,0);
    const walls = new T.Mesh(new T.ExtrudeGeometry(shp,{depth:D, bevelEnabled:false}), M.wall);
    walls.position.z = -D/2; walls.castShadow = walls.receiveShadow = true; g.add(walls);

    // roof: two slabs meeting at the ridge, with an overhang
    const slopeLen = Math.hypot(W/2, pk) + .32, ang = Math.atan2(pk, W/2);
    [-1,1].forEach(side=>{
      const slab = new T.Mesh(new T.BoxGeometry(slopeLen, .14, D+.45), M.roof);
      slab.position.set(side*(W/4 + .02), h + pk/2 + .06, 0);
      slab.rotation.z = -side*ang;
      slab.castShadow = true; g.add(slab);
    });
    const ridge = new T.Mesh(new T.CylinderGeometry(.09,.09,D+.5,14), M.roof);
    ridge.rotation.x = Math.PI/2; ridge.position.set(0, h+pk+.12, 0); g.add(ridge);

    // plank lines across the front, like a real wooden dog house
    for(let y=.36; y<h-.05; y+=.3){
      const pl = new T.Mesh(new T.BoxGeometry(W-.04, .022, .012), M.plank);
      pl.position.set(0, y, D/2+.006); g.add(pl);
    }
    // green corner posts mark where one section ends and the next begins
    [-1,1].forEach(side=>{
      const post = new T.Mesh(new T.BoxGeometry(.12, h, .12), M.roof);
      post.position.set(side*(W/2-.04), h/2, D/2-.02); post.castShadow = true; g.add(post);
    });
    // a trim board along the bottom of the front
    const sill = new T.Mesh(new T.BoxGeometry(W+.02, .12, .06), M.trim);
    sill.position.set(0, .06, D/2+.03); g.add(sill);

    // doorway: a dark arch, someone inside, and the door on its hinge
    const front = D/2;
    const frame = new T.Mesh(new T.ShapeGeometry(archShape(DOOR_W+.16, DOOR_H+.08), 24), M.trim);
    frame.position.set(0, .1, front+.002); g.add(frame);
    const hole = new T.Mesh(new T.ShapeGeometry(archShape(DOOR_W, DOOR_H), 24), M.dark);
    hole.position.set(0, .12, front+.004); g.add(hole);


    const hinge = new T.Group(); hinge.position.set(-DOOR_W/2, .12, front+.03); g.add(hinge);
    const doorGeo = new T.ExtrudeGeometry(archShape(DOOR_W, DOOR_H), {depth:.05, bevelEnabled:false, curveSegments:24});
    doorGeo.translate(DOOR_W/2, 0, -.025);
    const door = new T.Mesh(doorGeo, M.door); door.castShadow = true; hinge.add(door);
    // planks and a knob on the door
    [-.22,0,.22].forEach(px=>{
      const plank = new T.Mesh(new T.BoxGeometry(.014, DOOR_H*.72, .01), M.trim);
      plank.position.set(DOOR_W/2+px, DOOR_H*.4, .03); hinge.add(plank);
    });
    const knob = new T.Mesh(new T.SphereGeometry(.045,12,10), M.knob); knob.position.set(DOOR_W-.13, DOOR_H*.45, .06); hinge.add(knob);

    // hanging sign above the door
    const signGroup = new T.Group(); signGroup.position.set(0, .12+DOOR_H+.66+(tall>1?.16:0), front+.1); g.add(signGroup);
    const signW = 1.32, signH = signW*220/640;
    const signMat = new T.MeshBasicMaterial({color:0xffffff, transparent:true});
    const sign = new T.Mesh(new T.PlaneGeometry(signW, signH), signMat);
    sign.position.y = -signH/2 - .08; signGroup.add(sign);
    [-.5,.5].forEach(rx=>{
      const rope = new T.Mesh(new T.CylinderGeometry(.012,.012,.16,6), M.rope);
      rope.position.set(rx*signW*.8, -.04, 0); signGroup.add(rope);
      const nail = new T.Mesh(new T.SphereGeometry(.03,8,6), M.knob); nail.position.set(rx*signW*.8, .04, 0); signGroup.add(nail);
    });

    // every part of the section answers to a tap
    g.traverse(o=>{ if(o.isMesh) o.userData.i = i; });
    return {g, hinge, door, signGroup, signMat, open:0, lift:0};
  });

  // signs get their artwork once the icons and the display font are ready
  const fontReady = (document.fonts && document.fonts.load)
    ? Promise.race([document.fonts.load("800 62px Archivo"), new Promise(r=>setTimeout(r,1500))]).catch(()=>{})
    : Promise.resolve();
  fontReady.then(()=>{
    services.forEach((s,i)=>{
      loadImage(s.iconURL).then(icon=>{
        const tex = new T.CanvasTexture(drawSign(s.name, icon, INK));
        if("encoding" in tex) tex.encoding = T.sRGBEncoding;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        sections[i].signMat.map = tex; sections[i].signMat.needsUpdate = true;
        start();
      });
    });
  });

  // ── the yard: a round lawn, a water bowl and a ball ──────────────
  const lawnR = totalW*.62+1.2;
  const lawn = new T.Mesh(new T.CylinderGeometry(lawnR, lawnR+.1, .12, 64), M.ground);
  lawn.position.y = -.06; lawn.receiveShadow = true; scene.add(lawn);
  const ringMat = new T.MeshBasicMaterial({color:col(INK), transparent:true, opacity:.35, side:T.DoubleSide});
  const ring = new T.Mesh(new T.RingGeometry(lawnR-.2, lawnR-.17, 128), ringMat);
  ring.rotation.x = -Math.PI/2; ring.position.y = .002; scene.add(ring);

  const bowl = new T.Group();
  const bOuter = new T.Mesh(new T.CylinderGeometry(.32,.24,.16,28), M.bowl); bOuter.position.y=.08; bOuter.castShadow=true; bowl.add(bOuter);
  const water = new T.Mesh(new T.CircleGeometry(.27,28), new T.MeshStandardMaterial({color:col("#8fd3f4"), roughness:.2}));
  water.rotation.x=-Math.PI/2; water.position.y=.15; bowl.add(water);
  bowl.position.set(xOf(n-1)+W*.55, 0, D/2+.85); scene.add(bowl);
  const ball = new T.Mesh(new T.SphereGeometry(.17,20,16), M.ball);
  ball.position.set(xOf(0)-W*.35, .17, D/2+1.0); ball.castShadow = true; scene.add(ball);

  // ── the dog ───────────────────────────────────────────────────────
  // A cartoon wiener dog (dachshund) built from rounded shapes. It trots
  // to whichever door is chosen and waits beside it, wags, follows the
  // pointer with its head, hops when tapped, and runs in through the door
  // ahead of you. opts.dogStyle picks the look:
  //   "blacktan" (used on the site) · "red" · "longhair" · "chunky"
  const STYLES = {
    red:      {fur:"#b4622b", ear:"#7a3a14"},
    blacktan: {fur:"#2b211c", ear:"#1d1612", tan:"#c4843f"},
    longhair: {fur:"#a85424", ear:"#7d3610", fluff:true},
    chunky:   {fur:"#c9773a", ear:"#8f4518", chunky:true},
  };
  const ST = STYLES[opts.dogStyle] || STYLES.blacktan;
  const DM = {
    fur:   new T.MeshStandardMaterial({color:col(ST.fur), roughness:.8}),
    dark:  new T.MeshStandardMaterial({color:col(ST.ear), roughness:.85}),
    tan:   new T.MeshStandardMaterial({color:col(ST.tan || ST.fur), roughness:.8}),
    nose:  new T.MeshStandardMaterial({color:col("#1b1b1b"), roughness:.35}),
    eye:   new T.MeshStandardMaterial({color:col("#1b1b1b"), roughness:.2}),
    shine: new T.MeshBasicMaterial({color:0xffffff}),
    cheek: new T.MeshStandardMaterial({color:col("#f2a0a0"), roughness:.9, transparent:true, opacity:.75}),
    tongue:new T.MeshStandardMaterial({color:col("#f07c8a"), roughness:.6}),
    collar:new T.MeshStandardMaterial({color:col(INK), roughness:.6}),
    tag:   new T.MeshStandardMaterial({color:col("#f0c14b"), roughness:.3, metalness:.4}),
  };
  const ball3 = (r, mat, x,y,z, sx=1,sy=1,sz=1) => {
    const m = new T.Mesh(new T.SphereGeometry(r, 24, 18), mat);
    m.position.set(x,y,z); m.scale.set(sx,sy,sz); m.castShadow = true; return m;
  };
  const C = !!ST.chunky;                          // the chunky cartoon is shorter, rounder, bigger-headed
  const len = C ? .78 : 1;                         // body length
  const dog = new T.Group(); scene.add(dog);       // where it stands and which way it faces
  const pup = new T.Group(); dog.add(pup);         // bobs, hops
  // the long sausage body, with a slightly rounder chest up front
  pup.add(ball3(C?.23:.2, DM.fur, 0,.33,-.02, 1,.92,2.75*len));
  pup.add(ball3(C?.22:.19, DM.fur, 0,.33,.3*len, 1.02,1,1.05));
  pup.add(ball3(C?.2:.17, DM.fur, 0,.34,-.36*len, .98,.95,1));
  if(ST.tan) pup.add(ball3(.13, DM.tan, 0,.3,.43*len, 1,1,.5));                 // tan chest
  if(ST.fluff){                                                                  // soft fringe under the belly
    for(let z=-.34; z<=.34; z+=.11) pup.add(ball3(.075, DM.dark, 0,.19,z, 1.9,.7,1));
    pup.add(ball3(.12, DM.dark, 0,.28,.46, 1.1,1.1,.7));                        // chest tuft
  }
  // short little legs swing from the hip; front legs, then back legs
  const legs = [[-.1,.36*len],[.1,.36*len],[-.1,-.4*len],[.1,-.4*len]].map(([lx,lz])=>{
    const hip = new T.Group(); hip.position.set(lx,.24,lz); pup.add(hip);
    const leg = new T.Mesh(new T.CylinderGeometry(C?.058:.05,.048,.17,12), DM.fur); leg.position.y = -.085; leg.castShadow = true; hip.add(leg);
    hip.add(ball3(.058, ST.tan ? DM.tan : DM.fur, 0,-.18,.025, 1,.7,1.35));     // paw
    return hip;
  });
  // tail: thin and pointed, or a feathered plume on the long-haired one
  const tail = new T.Group(); tail.position.set(0,.4,-.54*len); pup.add(tail);
  const tailBone = new T.Mesh(new T.ConeGeometry(.04,.36,12), DM.fur);
  tailBone.position.set(0,.14,-.1); tailBone.rotation.x = -.75; tailBone.castShadow = true; tail.add(tailBone);
  if(ST.fluff){ [.06,.14,.22].forEach((t,k)=>tail.add(ball3(.07-k*.012, DM.dark, 0,.05+t*.7,-.05-t*.75, 1,.8,1.2))); }
  // head with the long snout (turns to follow the pointer)
  const hs = C ? 1.32 : 1;                         // head size
  const head = new T.Group(); head.position.set(0,.5+(C?.04:0),.5*len+(C?.02:0)); head.scale.setScalar(hs); pup.add(head);
  head.add(ball3(.17, DM.fur, 0,.06,0, 1,.95,1.05));
  head.add(ball3(.1, ST.tan ? DM.tan : DM.fur, 0,-.01,.2, .85,.78, C?1.35:1.75));   // snout
  head.add(ball3(.045, DM.nose, 0,.015, C?.33:.37, 1.2,.9,.9));                     // nose
  const tongue = ball3(.04, DM.tongue, 0,-.08,.27, .9,.45,1.2); head.add(tongue);
  const eyeR = C ? .045 : .032;
  [-.075,.075].forEach(ex=>{
    head.add(ball3(eyeR, DM.eye, ex,.11,.13));
    const glint = new T.Mesh(new T.SphereGeometry(eyeR*.33,8,6), DM.shine);
    glint.position.set(ex+eyeR*.3,.11+eyeR*.38,.13+eyeR*.85); head.add(glint);
    if(C){ const g2 = new T.Mesh(new T.SphereGeometry(eyeR*.16,8,6), DM.shine); g2.position.set(ex-eyeR*.25,.11-eyeR*.3,.13+eyeR*.9); head.add(g2); }
    if(ST.tan) head.add(ball3(.024, DM.tan, ex,.17,.11, 1.3,.7,.7));               // tan eyebrow dots
    if(C) head.add(ball3(.035, DM.cheek, ex*1.45,.03,.12, 1,.7,.5));               // rosy cheeks
  });
  // long floppy ears; feathered on the long-haired one
  const ears = [-1,1].map(side=>{
    const ear = new T.Group(); ear.position.set(side*.15,.13,-.02); head.add(ear);
    const flap = ball3(.1, DM.dark, side*.03,-.13,0, .45,1.8,.75); flap.rotation.z = side*.18; ear.add(flap);
    if(ST.fluff){ [-.05,-.14,-.23].forEach((y,k)=>ear.add(ball3(.055, DM.dark, side*(.05+k*.012),y-.05,(k%2?.03:-.03), 1,1,1))); }
    return ear;
  });
  // collar and tag
  const collar = new T.Mesh(new T.TorusGeometry(C?.17:.15,.026,10,28), DM.collar);
  collar.position.set(0,.43,.42*len+(C?.04:0)); collar.rotation.x = Math.PI/2 - .7; pup.add(collar);
  const tag = new T.Mesh(new T.CylinderGeometry(.038,.038,.014,16), DM.tag);
  tag.position.set(0,.3,.52*len+(C?.06:0)); tag.rotation.x = Math.PI/2 - .3; pup.add(tag);
  pup.scale.setScalar(C ? 1.2 : 1.12);
  const dogMeshes = []; dog.traverse(o=>{ if(o.isMesh) dogMeshes.push(o); });

  const spot = i => ({x: xOf(i) + .95, z: D/2 + .8});       // where it waits, beside the door
  const dogState = {x: spot(0).x, z: spot(0).z, face: -1.0, hopT: -1, walking: 0};
  dog.position.set(dogState.x, 0, dogState.z);

  // ── camera framing ────────────────────────────────────────────────
  let narrow=false, camDist=12;
  const tanH = () => Math.tan(T.MathUtils.degToRad(camera.fov/2));
  function frame(){
    const Wpx = host.clientWidth||1, Hpx = host.clientHeight||1;
    renderer.setSize(Wpx,Hpx,false);
    camera.aspect = Wpx/Hpx; camera.updateProjectionMatrix();
    narrow = camera.aspect < 1.05;
    const t = tanH();
    const showW = narrow ? W*1.5 : totalW+2.6;
    camDist = Math.max(showW/(2*t*camera.aspect), 4.4/(2*t));
  }

  // ── state ─────────────────────────────────────────────────────────
  let active = 0, hover = -1, state = "idle";       // idle | flying-in | inside | flying-out
  let px=0, py=0, visible=true, raf=0, last=performance.now();
  let autoOn = !!opts.autoplay, autoT = 0;
  const camX = {cur:0, tgt:0};
  const fly = {t:0, dur:900, from:new T.Vector3(), to:new T.Vector3(), lf:new T.Vector3(), lt:new T.Vector3(), done:null};
  const restPos = new T.Vector3(), restLook = new T.Vector3();

  function stopAuto(){ if(autoOn){ autoOn=false; if(opts.onInteract) opts.onInteract(); } }
  function setActive(i){
    active = wrapIdx(i,n);
    if(opts.onChange) opts.onChange(active);
    start();
  }
  function rest(){
    const x = narrow ? camX.cur : 0;
    restPos.set(x + px*.35, 2.1 - py*.25, D/2 + camDist);
    restLook.set(x, 1.25, 0);
  }
  function doorSpot(i){
    return { pos: new T.Vector3(xOf(i), .12+DOOR_H*.5, D/2+.55),
             look: new T.Vector3(xOf(i), .12+DOOR_H*.5, -1) };
  }

  // ── input ─────────────────────────────────────────────────────────
  const el = renderer.domElement;
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  const meshes = []; sections.forEach(s=>s.g.traverse(o=>{ if(o.isMesh) meshes.push(o); }));
  function aim(e){
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc, camera);
  }
  function pick(e){
    aim(e);
    const hit = ray.intersectObjects(meshes,false)[0];
    return hit ? hit.object.userData.i : -1;
  }
  function pickDog(e){ aim(e); return ray.intersectObjects(dogMeshes,false).length>0; }
  function hop(){ if(dogState.hopT<0) dogState.hopT = 0; start(); }
  let downX=0, downY=0, downT=0, down=false;
  el.addEventListener("pointerdown", e=>{ if(state!=="idle") return; down=true; downX=e.clientX; downY=e.clientY; downT=performance.now(); });
  el.addEventListener("pointermove", e=>{
    const r = el.getBoundingClientRect();
    px = ((e.clientX-r.left)/r.width)*2-1; py = ((e.clientY-r.top)/r.height)*2-1;
    autoT = 0;
    if(e.pointerType==="mouse" && state==="idle"){
      if(pickDog(e)){ el.style.cursor = "pointer"; start(); return; }
      const h = pick(e);
      if(h!==hover){ hover=h; el.style.cursor = h>=0 ? "pointer" : "default"; if(h>=0){ stopAuto(); setActive(h); } }
    }
    start();
  });
  el.addEventListener("pointerup", e=>{
    if(!down) return; down=false;
    const dx = e.clientX-downX, dy = e.clientY-downY;
    stopAuto();
    // a sideways swipe walks along the house
    if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.3 && performance.now()-downT<900){
      setActive(active + (dx<0?1:-1)); return;
    }
    if(Math.abs(dx)<8 && Math.abs(dy)<8){
      if(pickDog(e)){ hop(); return; }               // a tap on the pup makes it hop
      const h = pick(e);
      if(h<0) return;
      if(h===active) openActive(); else setActive(h);
    }
  });
  el.addEventListener("pointercancel", ()=>{ down=false; });
  el.addEventListener("pointerleave", ()=>{ px=0; py=0; hover=-1; start(); });
  host.addEventListener("keydown", e=>{
    if(state!=="idle") return;
    if(e.key==="ArrowRight"){ e.preventDefault(); stopAuto(); setActive(active+1); }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); stopAuto(); setActive(active-1); }
    else if(e.key==="Enter"||e.key===" "){ e.preventDefault(); stopAuto(); openActive(); }
  });

  function startFly(inward, i, done){
    rest();
    const d = doorSpot(i);
    fly.t = 0; fly.dur = inward ? 1000 : 850; fly.done = done;
    if(inward){ fly.from.copy(camera.position); fly.to.copy(d.pos); fly.lf.copy(restLook); fly.lt.copy(d.look); }
    else { fly.from.copy(d.pos); fly.to.copy(restPos); fly.lf.copy(d.look); fly.lt.copy(restLook); }
    state = inward ? "flying-in" : "flying-out";
    start();
  }
  function openActive(){
    if(state!=="idle") return;
    if(opts.onStart) opts.onStart(active);
    camX.cur = camX.tgt = xOf(active);
    const i = active;
    startFly(true, i, ()=>{ state="inside"; if(opts.onOpen) opts.onOpen(i); });
  }

  // ── render loop ───────────────────────────────────────────────────
  const look = new T.Vector3();
  function tick(now){
    raf = 0;
    const dt = Math.min(50, now-last); last = now;
    const time = now/1000;

    if(autoOn && state==="idle" && visible){
      autoT += dt;
      if(autoT > opts.autoplay){ autoT = 0; setActive(active+1); }
    }
    camX.tgt = xOf(active);
    camX.cur += (camX.tgt-camX.cur)*Math.min(1, dt*.006);

    sections.forEach((s,i)=>{
      const flying = (state==="flying-in" || state==="inside") && i===active;
      const want = flying ? 1.45 : (i===active || i===hover) ? 1.05 : 0;   // how far the door swings
      s.open += (want - s.open)*Math.min(1, dt*.008);
      s.hinge.rotation.y = -s.open;
      // the chosen section's sign swings a little and stands out
      const lift = i===active ? 1 : 0;
      s.lift += (lift - s.lift)*Math.min(1, dt*.008);
      s.signGroup.rotation.z = Math.sin(time*1.6 + i)*(.015 + s.lift*.045);
      s.signGroup.scale.setScalar(1 + s.lift*.1);
    });
    ball.rotation.z = Math.sin(time*.8)*.3;

    // where the pup is headed: beside the chosen door, or in through it
    const going = state==="flying-in" || state==="inside";
    const tgt = going ? {x: xOf(active), z: D/2 - .8} : spot(active);
    const vx = tgt.x - dogState.x, vz = tgt.z - dogState.z, dist = Math.hypot(vx, vz);
    const speed = (going ? 4.2 : 2.6) * dt/1000;
    if(dist > .01){
      const stepLen = Math.min(dist, speed);
      dogState.x += vx/dist*stepLen; dogState.z += vz/dist*stepLen;
      dogState.walking = Math.min(1, dogState.walking + dt*.006);
      // face the way it's going
      const want = Math.atan2(vx, vz);
      let dA = want - dogState.face; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      dogState.face += dA*Math.min(1, dt*.012);
    } else {
      dogState.walking = Math.max(0, dogState.walking - dt*.005);
      // settled: mostly side-on (so you see that long body), facing its door
      let dA = -1.0 - dogState.face; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
      dogState.face += dA*Math.min(1, dt*.006);
    }
    dog.position.set(dogState.x, 0, dogState.z);
    dog.rotation.y = dogState.face;
    const w = dogState.walking, stride = Math.sin(time*15);
    legs.forEach((hip,k)=>{ hip.rotation.x = w*(k===0||k===3 ? stride : -stride)*.55; });
    // a hop when tapped
    let hopY = 0;
    if(dogState.hopT >= 0){
      dogState.hopT += dt/520;
      hopY = Math.sin(Math.min(1,dogState.hopT)*Math.PI)*.38;
      if(dogState.hopT >= 1) dogState.hopT = -1;
    }
    pup.position.y = hopY + w*Math.abs(Math.sin(time*15))*.04;
    // happy tail, faster when you're pointing at its door or it's hopping
    const excited = (hover===active || dogState.hopT>=0) ? 1 : 0;
    tail.rotation.z = Math.sin(time*(11 + excited*9))*(.45 + excited*.25);
    tail.rotation.x = -.15;
    // head follows the pointer when it's sitting still
    const still = 1 - w;
    head.rotation.y += ((px*.6 + .55)*still - head.rotation.y)*Math.min(1, dt*.008);
    head.rotation.x += ((py*.25)*still - head.rotation.x)*Math.min(1, dt*.008);
    head.rotation.z = Math.sin(time*.9)*.06*still + (hopY>0 ? .12 : 0);
    ears.forEach((ear,k)=>{ ear.rotation.x = -hopY*1.6 + w*Math.sin(time*15+k)*.15; });
    tongue.visible = w > .3 || excited;

    rest();
    if(state==="flying-in" || state==="flying-out"){
      fly.t += dt;
      const k = ease(Math.min(1, fly.t/fly.dur));
      camera.position.lerpVectors(fly.from, fly.to, k);
      look.lerpVectors(fly.lf, fly.lt, k);
      camera.lookAt(look);
      if(fly.t >= fly.dur){
        const d = fly.done; fly.done = null;
        if(state==="flying-out") state = "idle";
        if(d) d();
      }
    } else if(state==="idle"){
      camera.position.lerp(restPos, Math.min(1, dt*.005));
      camera.lookAt(restLook);
    }

    renderer.render(scene, camera);
    const moving = Math.abs(camX.tgt-camX.cur)>.002 || state==="flying-in" || state==="flying-out";
    if((visible && state!=="inside") || moving) raf = requestAnimationFrame(tick);
  }
  function start(){ if(!raf){ last = performance.now(); raf = requestAnimationFrame(tick); } }

  if("IntersectionObserver" in window){
    new IntersectionObserver(es=>{
      visible = es[es.length-1].isIntersecting;
      if(visible) start();
    },{rootMargin:"120px 0px"}).observe(host);
  }
  document.addEventListener("visibilitychange",()=>{ visible = !document.hidden; if(visible) start(); });
  let rt=0;
  addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(()=>{ frame(); start(); },120); });

  frame(); camX.cur = camX.tgt = xOf(0); rest();
  camera.position.copy(restPos); camera.lookAt(restLook);
  start();

  return {
    next(){ stopAuto(); setActive(active+1); },
    prev(){ stopAuto(); setActive(active-1); },
    goTo(i){ stopAuto(); setActive(i); camX.cur = camX.tgt = xOf(active); },
    open(){ stopAuto(); openActive(); },
    get index(){ return active; },
    // called when the service page closes: walk back out of that door
    flyBack(i){
      if(typeof i==="number"){ active = wrapIdx(i,n); camX.cur = camX.tgt = xOf(active); if(opts.onChange) opts.onChange(active); }
      dogState.x = xOf(active); dogState.z = D/2 - .6;     // it comes trotting back out of the door
      frame();
      startFly(false, active, null);
    },
  };
}

window.Services3D = {create};
})();
