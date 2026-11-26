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

// Builds the wiener dog on its own, so the same dog can be used in the
// dog house scene and rendered for the logo.
function buildDog(opts){
  opts = opts || {};
  const col = hex => new T.Color(hex).convertSRGBToLinear();
  const INK = opts.ink || "#2f5d3a";
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
  const dog = new T.Group();                       // where it stands and which way it faces
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
  return {dog, pup, legs, tail, head, tongue, ears, dogMeshes};
}

function svcSlugOf(s,i){
  return s.slug || String(s.name||("service-"+(i+1))).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
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
    return {g, hinge, door, hole, signGroup, signMat, open:0, lift:0};
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

  // ── the dog (built by buildDog below) ────────────────────────────
  const {dog, pup, legs, tail, head, tongue, ears, dogMeshes} = buildDog({dogStyle: opts.dogStyle, ink: INK});
  scene.add(dog);

  const spot = i => ({x: xOf(i) + .95, z: D/2 + .8});       // where it waits, beside the door
  const dogState = {x: spot(0).x, z: spot(0).z, face: -1.0, hopT: -1, walking: 0};
  dog.position.set(dogState.x, 0, dogState.z);


  // ── inside the dog house ──────────────────────────────────────────
  // When you step through a door you land in a cozy little room that
  // matches that service. The pup trots in after you and settles down,
  // then the service page opens. Tapping skips straight to the page.
  const iscene = new T.Scene();
  iscene.background = col("#efe1c2");
  iscene.add(new T.HemisphereLight(0xfff4e0, 0x8a6a4a, .62));
  const iSun = new T.DirectionalLight(0xfff1d6, .55);
  iSun.position.set(-3, 5, 3); iSun.castShadow = true; iSun.shadow.mapSize.set(1024,1024);
  iSun.shadow.camera.left=-4; iSun.shadow.camera.right=4; iSun.shadow.camera.top=4; iSun.shadow.camera.bottom=-4;
  iSun.shadow.radius = 4; iSun.shadow.bias = -.0008;
  iscene.add(iSun);
  const lampLight = new T.PointLight(0xffd29a, .85, 7, 2); lampLight.position.set(1.3, 1.9, 0); iscene.add(lampLight);

  const IM = {
    floor: new T.MeshStandardMaterial({color:col("#c48a52"), roughness:.85}),
    plank: new T.MeshStandardMaterial({color:col("#a8703f"), roughness:.9}),
    wall:  new T.MeshStandardMaterial({color:col("#f6ead0"), roughness:.95}),
    low:   new T.MeshStandardMaterial({color:col(INK), roughness:.8}),
    trim:  new T.MeshStandardMaterial({color:col("#fffdf7"), roughness:.8}),
    gold:  new T.MeshStandardMaterial({color:col("#f0c14b"), roughness:.7}),
    cream: new T.MeshStandardMaterial({color:col("#fffaf0"), roughness:.85}),
    wood:  new T.MeshStandardMaterial({color:col("#9a6534"), roughness:.8}),
    dark:  new T.MeshStandardMaterial({color:col("#33302c"), roughness:.6}),
    red:   new T.MeshStandardMaterial({color:col("#d9534f"), roughness:.7}),
    blue:  new T.MeshStandardMaterial({color:col("#8fd3f4"), roughness:.3}),
    leaf:  new T.MeshStandardMaterial({color:col("#5e9b5a"), roughness:.9}),
    glass: new T.MeshStandardMaterial({color:col("#dff2fb"), roughness:.1, transparent:true, opacity:.45}),
  };
  const box = (w,h,d,mat,x,y,z,parent) => { const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; (parent||iscene).add(m); return m; };
  const cyl = (rt,rb,h,mat,x,y,z,parent,seg) => { const m=new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg||24),mat); m.position.set(x,y,z); m.castShadow=m.receiveShadow=true; (parent||iscene).add(m); return m; };
  const sph = (r,mat,x,y,z,parent) => { const m=new T.Mesh(new T.SphereGeometry(r,18,14),mat); m.position.set(x,y,z); m.castShadow=true; (parent||iscene).add(m); return m; };

  // the room: plank floor, cream walls with green panelling, a window
  const RW = 4.4, RB = -1.9, RH = 2.6;
  box(RW+.2, .1, 6, IM.floor, 0, -.05, 1.1);
  for(let z=RB+.3; z<4; z+=.34) box(RW, .004, .02, IM.plank, 0, .002, z);
  [[0,RB,RW,0],[-RW/2,1.1,6,Math.PI/2],[RW/2,1.1,6,-Math.PI/2]].forEach(([x,z,w,ry])=>{
    const wall = new T.Mesh(new T.PlaneGeometry(w, RH), IM.wall); wall.position.set(x, RH/2, z); wall.rotation.y = ry; wall.receiveShadow = true; iscene.add(wall);
    const low = new T.Mesh(new T.PlaneGeometry(w, .85), IM.low); low.position.set(x*.999, .425, z+(ry===0?.004:0)); low.rotation.y = ry; iscene.add(low);
    if(ry!==0) low.position.x = x + (x<0?.004:-.004);
    const rail = new T.Mesh(new T.BoxGeometry(ry===0?w:.05, .06, ry===0?.05:w), IM.trim); rail.position.set(x+(ry===0?0:(x<0?.02:-.02)), .86, z+(ry===0?.02:0)); iscene.add(rail);
  });
  // a window in the right-hand wall near the front, with a bit of sky
  const win = new T.Group(); win.position.set(RW/2-.01, 1.6, 1.35); win.rotation.y = -Math.PI/2; iscene.add(win);
  box(1.0, .8, .05, IM.trim, 0,0,0, win);
  const sky = new T.Mesh(new T.PlaneGeometry(.86,.66), new T.MeshBasicMaterial({color:col("#bfe6f7")})); sky.position.z = .03; win.add(sky);
  box(.04,.66,.02, IM.trim, 0,0,.04, win); box(.86,.04,.02, IM.trim, 0,0,.04, win);
  box(1.12,.06,.14, IM.trim, 0,-.43,.06, win);

  // props for each kind of room
  function roomFor(slug){
    const g = new T.Group(); g.visible = false; iscene.add(g);
    if(/house/.test(slug)){                       // living room
      const rug = cyl(1.15,1.15,.02, IM.gold, 0,.011,-.35, g, 40); rug.scale.z = .62;
      box(1.9,.42,.72, IM.low, -.15,.26,-1.45, g); box(1.9,.62,.2, IM.low, -.15,.62,-1.78, g);
      box(.2,.55,.75, IM.low, -1.2,.4,-1.45, g); box(.2,.55,.75, IM.low, .9,.4,-1.45, g);
      box(.8,.12,.6, IM.cream, -.6,.53,-1.4, g); box(.8,.12,.6, IM.cream, .3,.53,-1.4, g);
      box(.36,.3,.1, IM.gold, -.55,.75,-1.6, g).rotation.z = .15;
      cyl(.03,.03,1.5, IM.dark, 1.55,.75,-1.35, g); cyl(.06,.22,.04, IM.dark, 1.55,.02,-1.35, g);
      cyl(.16,.28,.3, IM.gold, 1.55,1.55,-1.35, g);
      cyl(.17,.13,.32, IM.wood, -1.85,.16,-1.4, g); sph(.28, IM.leaf, -1.85,.5,-1.4, g); sph(.2, IM.leaf, -1.75,.72,-1.35, g);
      const bed = new T.Mesh(new T.TorusGeometry(.36,.12,14,30), IM.low); bed.rotation.x = -Math.PI/2; bed.position.set(-1.3,.12,-.2); bed.castShadow=true; g.add(bed);
      cyl(.34,.34,.08, IM.cream, -1.3,.06,-.2, g);
      g.userData.spot = {x:.15, z:-.55};
    } else if(/drop/.test(slug)){                // kitchen nook
      box(2.6,.9,.62, IM.cream, -.55,.45,-1.55, g); box(2.7,.06,.7, IM.wood, -.55,.93,-1.52, g);
      [-1.4,-.75,-.1,.55].forEach(x=>{ box(.56,.62,.02, IM.low, x,.45,-1.23, g); sph(.025, IM.gold, x+.2,.6,-1.21, g); });
      const jar = cyl(.13,.13,.3, IM.glass, -.2,1.11,-1.55, g); jar.castShadow = false;
      [[-.24,1.02],[-.16,1.04],[-.2,1.1],[-.15,.99]].forEach(([x,y])=>box(.07,.04,.04, IM.wood, x,y,-1.55, g));
      cyl(.11,.11,.05, IM.red, -.2,1.29,-1.55, g);
      const clock = cyl(.28,.28,.05, IM.cream, 1.55,1.55,RB+.04, g); clock.rotation.x = Math.PI/2;
      const rim = new T.Mesh(new T.TorusGeometry(.28,.03,10,32), IM.low); rim.position.set(1.55,1.55,RB+.06); g.add(rim);
      box(.025,.18,.02, IM.dark, 1.55,1.62,RB+.08, g); const mh = box(.025,.14,.02, IM.dark, 1.6,1.53,RB+.08, g); mh.rotation.z = -1.2;
      box(1.0,.012,.55, IM.red, .9,.007,-.75, g);
      [[.65,IM.low],[1.15,IM.dark]].forEach(([x,m],k)=>{ cyl(.2,.15,.1, m, x,.06,-.75, g); const fill = cyl(.17,.17,.02, k?IM.blue:IM.wood, x,.11,-.75, g); fill.castShadow=false; });
      g.userData.spot = {x:.25, z:-.6};
    } else if(/walk/.test(slug)){                // mudroom
      box(1.6,.08,.5, IM.wood, -.9,.45,-1.55, g); [-1.6,-.2].forEach(x=>box(.08,.45,.45, IM.wood, x,.22,-1.55, g));
      box(1.05,.08,.08, IM.wood, 1.55,1.6,RB+.05, g);
      [[1.2,IM.low],[1.55,IM.red],[1.9,IM.gold]].forEach(([x,m])=>{
        cyl(.02,.02,.7, m, x,1.22,RB+.12, g, 8);
        const loop = new T.Mesh(new T.TorusGeometry(.1,.025,8,20), m); loop.position.set(x,1.62,RB+.12); g.add(loop);
        box(.06,.08,.06, IM.gold, x,.86,RB+.12, g);
      });
      cyl(.32,.26,.38, IM.wood, 1.45,.19,-1.1, g);
      [[1.35,.45,-1.05],[1.55,.47,-1.15],[1.45,.5,-.98]].forEach(([x,y,z])=>sph(.11, IM.leaf, x,y,z, g).material = new T.MeshStandardMaterial({color:col("#c8e04a"), roughness:.8}));
      box(.26,.22,.42, IM.red, -1.25,.11,-1.0, g); box(.26,.22,.42, IM.red, -.95,.11,-1.0, g);
      box(1.1,.012,.7, IM.low, .1,.007,-.3, g);
      g.userData.spot = {x:.15, z:-.55};
    } else {                                     // garage corner for rides
      const crate = new T.Group(); crate.position.set(-1.1,0,-1.25); g.add(crate);
      box(1.1,.06,.72, IM.dark, 0,.03,0, crate); box(1.1,.06,.72, IM.dark, 0,.78,0, crate);
      box(.06,.8,.72, IM.dark, -.52,.4,0, crate); box(1.1,.8,.05, IM.dark, 0,.4,-.34, crate);
      for(let x=-.4; x<=.5; x+=.12) cyl(.012,.012,.74, IM.dark, x,.41,.34, crate, 6);
      for(let z=-.3; z<=.3; z+=.12) cyl(.012,.012,.74, IM.dark, .52,.41,z, crate, 6);
      cyl(.25,.25,.06, IM.cream, -.1,.09,0, crate);
      const car = new T.Group(); car.position.set(1.05,0,-1.0); car.rotation.y = -.5; g.add(car);
      box(1.2,.32,.6, IM.gold, 0,.3,0, car); box(.66,.28,.54, IM.cream, -.08,.6,0, car);
      box(.6,.2,.56, IM.glass, -.08,.6,0, car);
      [[-.38,.3],[.38,.3],[-.38,-.3],[.38,-.3]].forEach(([x,z])=>{ const wh=cyl(.14,.14,.1, IM.dark, x,.14,z, car); wh.rotation.x = Math.PI/2; });
      sph(.05, IM.cream, .6,.32,.2, car); sph(.05, IM.cream, .6,.32,-.2, car);
      const mapC = document.createElement("canvas"); mapC.width = 320; mapC.height = 220; const mg = mapC.getContext("2d");
      mg.fillStyle="#e4f1d6"; mg.fillRect(0,0,320,220); mg.strokeStyle="#f0c14b"; mg.lineWidth=14; mg.lineCap="round";
      mg.beginPath(); mg.moveTo(20,180); mg.bezierCurveTo(120,170,90,60,200,70); mg.lineTo(300,40); mg.stroke();
      mg.strokeStyle="#ffffff"; mg.lineWidth=8; mg.beginPath(); mg.moveTo(60,20); mg.lineTo(150,200); mg.stroke();
      mg.fillStyle="#d9534f"; mg.beginPath(); mg.arc(200,70,16,0,Math.PI*2); mg.fill();
      mg.strokeStyle="#2f5d3a"; mg.lineWidth=10; mg.strokeRect(5,5,310,210);
      const mapTex = new T.CanvasTexture(mapC); if("encoding" in mapTex) mapTex.encoding = T.sRGBEncoding;
      const map = new T.Mesh(new T.PlaneGeometry(.8,.55), new T.MeshBasicMaterial({map:mapTex})); map.position.set(1.55,1.45,RB+.02); g.add(map);
      box(1.2,.012,.8, IM.low, .1,.007,-.25, g);
      g.userData.spot = {x:.2, z:-.45};
    }
    return g;
  }
  const rooms = services.map((s,i)=>roomFor(svcSlugOf(s,i)));
  // ── the doorway is a window into the room ────────────────────────
  // Each room sits "behind" its door: the open doorway shows that room,
  // drawn from exactly where you're standing, so the camera can glide
  // straight through the door into it with no fade and no cut.
  const ZF = 2.1;                                          // where the room's doorway is (in front of every viewing spot)
  const offsetFor = i => new T.Vector3(-xOf(i), -.12, ZF - (D/2 + .004));
  const icam = new T.PerspectiveCamera(camera.fov, 1, .05, 100);
  const portalRT = new T.WebGLRenderTarget(2, 2, {minFilter:T.LinearFilter, magFilter:T.LinearFilter});
  if("encoding" in portalRT.texture) portalRT.texture.encoding = T.sRGBEncoding;
  const portalMat = new T.ShaderMaterial({
    uniforms: {tex:{value:portalRT.texture}, res:{value:new T.Vector2(1,1)}},
    vertexShader: "void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: "uniform sampler2D tex; uniform vec2 res; void main(){ gl_FragColor = texture2D(tex, gl_FragCoord.xy/res); }",
  });
  let shownRoom = -1;
  function showRoom(i){
    if(shownRoom!==i){ rooms.forEach((r,k)=>{ r.visible = k===i; }); shownRoom = i; }
    fillWalls(i);
    sections.forEach((s,k)=>{ const want = k===i ? portalMat : M.dark; if(s.hole.material!==want) s.hole.material = want; });
  }

  // ── the service's information, on the walls of its room ───────────
  // Back wall: a noticeboard with the details and what's included.
  // Left wall: framed photos, and review notes pinned to a corkboard.
  // Right wall: a screen playing the service's clip.
  const BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";
  const DISP = "Archivo, 'Arial Narrow', Arial, sans-serif";
  const texOf = c => { const t = new T.CanvasTexture(c); if("encoding" in t) t.encoding = T.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
  const plain = (map) => new T.MeshBasicMaterial({color:0xffffff, map:map||null});

  // noticeboard
  const boardG = new T.Group(); boardG.position.set(-.2, 1.87, RB+.04); iscene.add(boardG);
  const boardFrame = new T.Mesh(new T.BoxGeometry(1,1,.06), IM.wood); boardFrame.castShadow = true; boardG.add(boardFrame);
  const boardMat = plain(); const board = new T.Mesh(new T.PlaneGeometry(1,1), boardMat); board.position.z = .035; boardG.add(board);
  board.userData.station = "details"; boardFrame.userData.station = "details";
  let boardPortrait = null;
  function boardSize(portrait){ return portrait ? {w:1.05, h:1.5, y:1.78} : {w:2.1, h:1.05, y:1.87}; }
  function drawBoard(s, portrait){
    const W = portrait ? 840 : 1680, H = portrait ? 1200 : 840, P = portrait ? 56 : 70;
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    g.fillStyle = "#fffdf7"; g.fillRect(0,0,W,H);
    g.strokeStyle = INK; g.lineWidth = 6; g.strokeRect(18,18,W-36,H-36);
    const ls = px => { if("letterSpacing" in g) g.letterSpacing = px; };
    const wrapDraw = (text, x, y, maxW, lh, font, color, maxLines) => {
      g.font = font; g.fillStyle = color;
      let lines = wrapLines(g, text, maxW);
      if(maxLines && lines.length > maxLines){ lines = lines.slice(0,maxLines); lines[maxLines-1] += "…"; }
      lines.forEach((l,k)=>g.fillText(l, x, y + k*lh)); return y + lines.length*lh;
    };
    const colW = portrait ? W-2*P : W*.5 - P*1.2;
    let y = P + 40;
    // tag
    g.font = "700 26px "+BODY; ls("6px"); g.fillStyle = "#8a6a1f";
    g.fillText((s.tag||"").toUpperCase(), P, y); ls("0px");
    g.fillStyle = "#f0c14b"; g.fillRect(P, y+14, 60, 5);
    y += 76;
    // name
    y = wrapDraw((s.name||"").toUpperCase(), P, y+ (portrait?10:20), colW, portrait?78:92, "800 "+(portrait?74:88)+"px "+DISP, INK, 2) + 6;
    // price line
    y = wrapDraw(s.priceLine||"", P, y, colW, 40, "600 30px "+BODY, "#5f6b60", 2) + 22;
    // description
    y = wrapDraw(s.desc||"", P, y, colW, portrait?44:46, "400 "+(portrait?32:34)+"px "+BODY, "#1d2a20", portrait?6:7) + 30;
    // what's included: beside it on the wide board, below it on the tall one
    let x2 = P, y2 = y;
    if(!portrait){ x2 = W*.5 + P*.4; y2 = P + 40; g.fillStyle = "#e8e0cc"; g.fillRect(W*.5 - 4, P, 3, H - 2*P); }
    g.font = "700 26px "+BODY; ls("6px"); g.fillStyle = "#8a6a1f"; g.fillText("WHAT'S INCLUDED", x2, y2); ls("0px");
    y2 += 30;
    const inc = (s.included||[]).slice(0,5), rowH = portrait ? 74 : 96, iw = portrait ? W-2*P-60 : W*.5 - P*1.6 - 60;
    inc.forEach((t,k)=>{
      const ry = y2 + 24 + k*rowH;
      g.fillStyle = INK; g.beginPath(); g.arc(x2+20, ry+10, 20, 0, Math.PI*2); g.fill();
      g.strokeStyle = "#fff"; g.lineWidth = 5; g.lineCap = "round"; g.lineJoin = "round";
      g.beginPath(); g.moveTo(x2+11, ry+11); g.lineTo(x2+18, ry+18); g.lineTo(x2+30, ry+3); g.stroke();
      wrapDraw(t, x2+58, ry+20, iw, 38, "500 "+(portrait?28:32)+"px "+BODY, "#1d2a20", 2);
    });
    return c;
  }

  // photo wall: four frames
  const photoG = new T.Group(); photoG.position.set(-RW/2+.04, 1.6, -.75); photoG.rotation.y = Math.PI/2; iscene.add(photoG);
  const photoMats = [];
  [[-.36,.3],[.36,.3],[-.36,-.3],[.36,-.3]].forEach(([x,y],k)=>{
    const fr = box(.64,.52,.05, k%2 ? IM.low : IM.wood, x,y,0, photoG); fr.userData.station = "photos";
    const m = plain(); photoMats.push(m);
    const pic = new T.Mesh(new T.PlaneGeometry(.56,.44), m); pic.position.set(x,y,.03); pic.userData.station = "photos"; photoG.add(pic);
  });
  // review corkboard near the front of the left wall
  const notesG = new T.Group(); notesG.position.set(-RW/2+.04, 1.5, 1.05); notesG.rotation.y = Math.PI/2; iscene.add(notesG);
  const cork = box(1.45,1.1,.05, new T.MeshStandardMaterial({color:col("#c9a26b"), roughness:1}), 0,0,0, notesG); cork.userData.station = "reviews";
  const noteMats = [plain(), plain()], notes = noteMats.map((m,k)=>{
    const n = new T.Mesh(new T.PlaneGeometry(.62,.86), m); n.position.set(k ? .33 : -.33, 0, .035); n.rotation.z = k ? -.04 : .035;
    n.userData.station = "reviews"; notesG.add(n);
    sph(.03, IM.red, n.position.x, .4, .05, notesG); return n;
  });
  function drawNote(r, tint){
    const W = 620, H = 860, c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    g.fillStyle = tint; g.fillRect(0,0,W,H);
    g.fillStyle = "#c99a1f"; g.font = "40px "+BODY; g.fillText("★★★★★", 48, 100);
    g.font = "italic 400 33px "+BODY; g.fillStyle = "#1d2a20";
    let lines = wrapLines(g, "“"+(r.text||"")+"”", W-96); if(lines.length>15){ lines = lines.slice(0,15); lines[14] += "…"; }
    lines.forEach((l,k)=>g.fillText(l, 48, 170 + k*42));
    g.font = "700 30px "+BODY; g.fillStyle = INK; g.fillText("— "+(r.who||""), 48, H-56);
    return c;
  }
  // a screen on the right wall
  const screenG = new T.Group(); screenG.position.set(RW/2-.04, 1.5, -.55); screenG.rotation.y = -Math.PI/2; iscene.add(screenG);
  const bezel = box(.76,1.28,.06, IM.dark, 0,0,0, screenG); bezel.userData.station = "video";
  const screenMat = plain(); const screen = new T.Mesh(new T.PlaneGeometry(.68,1.2), screenMat); screen.position.z = .035; screen.userData.station = "video"; screenG.add(screen);

  // fill the walls for room i (made once per room, then reused)
  const wallCache = {};
  let roomVideo = null;
  function coverCanvas(img, w, h){
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    g.fillStyle = "#e8e0cc"; g.fillRect(0,0,w,h);
    if(img){ const k = Math.max(w/img.width, h/img.height); g.drawImage(img, (w-img.width*k)/2, (h-img.height*k)/2, img.width*k, img.height*k); }
    return c;
  }
  function fillWalls(i){
    const s = services[i];
    const portrait = !!narrow;
    let C = wallCache[i];
    if(!C){
      C = wallCache[i] = {photos:[null,null,null,null], notes:[]};
      (s.photos||[]).slice(0,4).forEach((src,k)=>loadImage(src).then(img=>{
        C.photos[k] = texOf(coverCanvas(img, 560, 440)); if(shownRoom===i){ photoMats[k].map = C.photos[k]; photoMats[k].needsUpdate = true; start(); }
      }));
      const revs = (s.reviews||[]).slice(0,2);
      C.notes = revs.map((r,k)=>texOf(drawNote(r, k ? "#fff3c4" : "#fdfbf3")));
      if(s.clip){
        const v = document.createElement("video");
        v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline",""); v.preload = "none"; v.src = s.clip;
        C.video = v; C.screen = new T.VideoTexture(v); if("encoding" in C.screen) C.screen.encoding = T.sRGBEncoding;
      } else {
        loadImage(s.img).then(img=>{ C.screen = texOf(coverCanvas(img, 680, 1200)); if(shownRoom===i){ screenMat.map = C.screen; screenMat.needsUpdate = true; start(); } });
      }
    }
    if(C.boardPortrait!==portrait || !C.board){ C.board = texOf(drawBoard(s, portrait)); C.boardPortrait = portrait; }
    const bs = boardSize(portrait);
    boardFrame.scale.set(bs.w+.12, bs.h+.12, 1); board.scale.set(bs.w, bs.h, 1); boardG.position.y = bs.y;
    boardMat.map = C.board; boardMat.needsUpdate = true;
    photoMats.forEach((m,k)=>{ m.map = C.photos[k] || null; m.needsUpdate = true; });
    notes.forEach((n,k)=>{ n.visible = !!C.notes[k]; if(C.notes[k]){ noteMats[k].map = C.notes[k]; noteMats[k].needsUpdate = true; } });
    if(C.notes.length===1){ notes[0].position.x = 0; } else { notes[0].position.x = -.33; }
    screenMat.map = C.screen || null; screenMat.needsUpdate = true;
    if(roomVideo && roomVideo!==C.video) roomVideo.pause();
    roomVideo = C.video || null;
  }
  // the stops the camera makes inside a room
  function stationsFor(i){
    const s = services[i], st = ["details", "photos"];
    if(s.clip) st.push("video");
    if((s.reviews||[]).length) st.push("reviews");
    return st;
  }
  const STATION_LABEL = {details:"Details", photos:"Photos", video:"Video", reviews:"Reviews"};
  function stationPose(name){
    const bs = boardSize(!!narrow);
    const S = {
      details: {c:new T.Vector3(-.2, bs.y, RB+.07), n:new T.Vector3(0,0,1), w:bs.w+.2, h:bs.h+.2},
      photos:  {c:new T.Vector3(-RW/2+.05, 1.6, -.75), n:new T.Vector3(1,0,0), w:1.5, h:1.25},
      video:   {c:new T.Vector3(RW/2-.05, 1.5, -.55), n:new T.Vector3(-1,0,0), w:.95, h:1.4},
      reviews: {c:new T.Vector3(-RW/2+.05, 1.5, 1.05), n:new T.Vector3(1,0,0), w:1.55, h:1.2},
    }[name] || null;
    const t = Math.tan(T.MathUtils.degToRad(camera.fov/2));
    const d = Math.max(S.w/(.86*2*t*camera.aspect), S.h/(.86*2*t), .9);
    return {pos: S.c.clone().addScaledVector(S.n, d), look: S.c.clone()};
  }
  // a twin of the pup lives in the room and copies every move, so the dog
  // you see walking through the doorway is seamless on both sides
  const twin = buildDog({dogStyle: opts.dogStyle, ink: INK}); iscene.add(twin.dog);
  const box3 = host.closest ? host.closest(".svc3d") : null;     // to hide the arrows while inside
  const path = {curve:null, t0:0, dur:2700, dir:1, u:0, uD:.85, lookA:new T.Vector3(), lookDoor:new T.Vector3(), lookEnd:new T.Vector3(), startZ:0, endZ:0, done:null};
  function leaveInterior(){
    if(box3) box3.classList.remove("is-inside");
  }

  // ── being in a room: gliding between its walls ────────────────────
  const room = {stations:[], k:0, from:new T.Vector3(), to:new T.Vector3(), lf:new T.Vector3(), lt:new T.Vector3(),
                t0:0, dur:950, look:new T.Vector3()};
  // the small controls over the room: back outside, the stops, and Book this
  const ui = document.createElement("div");
  ui.className = "room-ui"; ui.hidden = true;
  ui.innerHTML =
    '<button type="button" class="room-out"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Outside</button>'+
    '<div class="room-nav">'+
      '<button type="button" class="room-step" data-step="-1" aria-label="Previous"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>'+
      '<div class="room-tabs" role="tablist" aria-label="Look around the room"></div>'+
      '<button type="button" class="room-step" data-step="1" aria-label="Next"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>'+
    '</div>'+
    '<button type="button" class="room-book">Book this</button>';
  host.appendChild(ui);
  const tabsEl = ui.querySelector(".room-tabs");
  ui.querySelector(".room-out").addEventListener("click", ()=>leaveRoom());
  ui.querySelectorAll(".room-step").forEach(b=>b.addEventListener("click", ()=>goStation(room.k + (+b.dataset.step))));
  ui.querySelector(".room-book").addEventListener("click", ()=>{ const i = active; leaveRoom(); if(opts.onBook) opts.onBook(i); });
  tabsEl.addEventListener("click", e=>{ const t = e.target.closest("[data-k]"); if(t) goStation(+t.dataset.k); });

  function enterRoom(){
    state = "room";
    room.stations = stationsFor(active); room.k = 0;
    tabsEl.innerHTML = room.stations.map((st,k)=>
      '<button type="button" role="tab" data-k="'+k+'" aria-selected="'+(k===0)+'">'+STATION_LABEL[st]+'</button>').join("");
    ui.hidden = false;
    syncVideo();
    if(opts.onRoom) opts.onRoom(active);
    start();
  }
  function goStation(k){
    if(state!=="room" || !room.stations.length) return;
    room.k = wrapIdx(k, room.stations.length);
    const o = offsetFor(active), p = stationPose(room.stations[room.k]);
    room.from.copy(camera.position); room.to.copy(p.pos).sub(o);
    room.lf.copy(room.look); room.lt.copy(p.look).sub(o);
    room.t0 = performance.now();
    tabsEl.querySelectorAll("[data-k]").forEach(b=>b.setAttribute("aria-selected", String(+b.dataset.k===room.k)));
    syncVideo();
    start();
  }
  function syncVideo(){
    if(!roomVideo) return;
    if(state==="room" && room.stations[room.k]==="video"){ const pr = roomVideo.play(); if(pr && pr.catch) pr.catch(()=>{}); }
    else roomVideo.pause();
  }
  function leaveRoom(){
    if(state!=="room") return;
    ui.hidden = true;
    state = "leaving"; syncVideo();
    startFly(false, active, null, camera.position.clone(), room.look.clone());
  }
  // which wall did you tap?
  const stationMeshes = []; [boardG, photoG, notesG, screenG].forEach(g=>g.traverse(o=>{ if(o.isMesh && o.userData.station) stationMeshes.push(o); }));
  const twinMeshes = []; twin.dog.traverse(o=>{ if(o.isMesh) twinMeshes.push(o); });
  // ── camera framing ────────────────────────────────────────────────
  let narrow=false, camDist=12;
  const tanH = () => Math.tan(T.MathUtils.degToRad(camera.fov/2));
  function frame(){
    const Wpx = host.clientWidth||1, Hpx = host.clientHeight||1;
    renderer.setSize(Wpx,Hpx,false);
    camera.aspect = Wpx/Hpx; camera.updateProjectionMatrix();
    icam.aspect = camera.aspect; icam.fov = camera.fov; icam.updateProjectionMatrix();
    const buf = renderer.getDrawingBufferSize(new T.Vector2());
    portalRT.setSize(buf.x, buf.y); portalMat.uniforms.res.value.copy(buf);
    narrow = camera.aspect < 1.05;
    const t = tanH();
    const showW = narrow ? W*1.5 : totalW+2.6;
    camDist = Math.max(showW/(2*t*camera.aspect), 4.4/(2*t));
  }

  // ── state ─────────────────────────────────────────────────────────
  let active = 0, hover = -1, state = "idle";       // idle | flying-in | entering | inside | flying-out
  let px=0, py=0, visible=true, raf=0, last=performance.now();
  let autoOn = !!opts.autoplay, autoT = 0;
  const camX = {cur:0, tgt:0};
  const fly = {t:0, dur:900, from:new T.Vector3(), to:new T.Vector3(), lf:new T.Vector3(), lt:new T.Vector3(), done:null};
  const restPos = new T.Vector3(), restLook = new T.Vector3();

  function stopAuto(){ if(autoOn){ autoOn=false; if(opts.onInteract) opts.onInteract(); } }
  function setActive(i){
    active = wrapIdx(i,n);
    showRoom(active);
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
  el.addEventListener("pointerdown", e=>{
    if(state==="flying-in"){ path.t0 = performance.now() - path.dur; return; }     // a tap skips to the room
    if(state!=="idle" && state!=="room") return;
    down=true; downX=e.clientX; downY=e.clientY; downT=performance.now();
  });
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
    if(state==="room"){
      // swipe to the next wall, tap a wall to look at it, tap the pup to make it hop
      if(Math.abs(dx)>40 && Math.abs(dx)>Math.abs(dy)*1.3 && performance.now()-downT<900){ goStation(room.k + (dx<0?1:-1)); return; }
      if(Math.abs(dx)<8 && Math.abs(dy)<8){
        const r = el.getBoundingClientRect();
        ndc.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
        ray.setFromCamera(ndc, icam);
        if(ray.intersectObjects(twinMeshes,false).length){ hop(); return; }
        const hit = ray.intersectObjects(stationMeshes,false)[0];
        if(hit){ const k = room.stations.indexOf(hit.object.userData.station); if(k>=0) goStation(k); }
      }
      return;
    }
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
    if(state==="room"){
      if(e.key==="ArrowRight"){ e.preventDefault(); goStation(room.k+1); }
      else if(e.key==="ArrowLeft"){ e.preventDefault(); goStation(room.k-1); }
      else if(e.key==="Escape"){ e.preventDefault(); leaveRoom(); }
      return;
    }
    if(state!=="idle") return;
    if(e.key==="ArrowRight"){ e.preventDefault(); stopAuto(); setActive(active+1); }
    else if(e.key==="ArrowLeft"){ e.preventDefault(); stopAuto(); setActive(active-1); }
    else if(e.key==="Enter"||e.key===" "){ e.preventDefault(); stopAuto(); openActive(); }
  });

  function startFly(inward, i, done, fromInside, lookInside){
    rest();
    const o = offsetFor(i), dx = xOf(i), dy = .12 + DOOR_H*.5;
    // the room end of the trip, in outside terms: the noticeboard on the way
    // in, or wherever you're standing on the way out
    const first = stationPose("details");
    const endExt = fromInside ? fromInside.clone() : first.pos.clone().sub(o);
    const outer = inward ? camera.position.clone() : restPos.clone();
    path.curve = new T.CatmullRomCurve3([
      outer,
      new T.Vector3(dx, dy + .3, D/2 + 1.7),
      new T.Vector3(dx, dy, D/2 + .35),
      new T.Vector3(dx, dy + .05, D/2 - .35),
      endExt,
    ], false, "centripetal");
    path.lookA.copy(restLook); path.lookDoor.set(dx, dy, -1);
    if(lookInside) path.lookEnd.copy(lookInside); else path.lookEnd.copy(first.look).sub(o);
    path.startZ = outer.z; path.endZ = endExt.z;
    // how far along the path the camera passes through the doorway
    path.uD = .85;
    for(let k=0; k<=200; k++){ if(path.curve.getPointAt(k/200).z < D/2){ path.uD = k/200; break; } }
    path.dir = inward ? 1 : -1; path.dur = inward ? 2700 : 2100;
    path.t0 = performance.now(); path.done = done;
    state = inward ? "flying-in" : "flying-out";
    if(inward && box3) box3.classList.add("is-inside");
    start();
  }
  function openActive(){
    if(state!=="idle") return;
    if(opts.onStart) opts.onStart(active);
    camX.cur = camX.tgt = xOf(active);
    showRoom(active);
    startFly(true, active, ()=>enterRoom());
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
      const flying = (state==="flying-in" || state==="room" || state==="leaving" || state==="inside" || state==="flying-out") && i===active;
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

    // where the pup is headed, all in outside terms: in through the door to
    // its spot in the room, or back out to its spot beside the door
    const o = offsetFor(active), doorX = xOf(active), doorZ = D/2;
    const inward = state==="flying-in" || state==="room" || state==="inside";
    const inRoom = dogState.z < doorZ - .05;
    const rs = rooms[active].userData.spot;
    let tgt;
    if(inward) tgt = (!inRoom && dogState.z > doorZ + .1 && Math.abs(dogState.x - doorX) > .06)
                     ? {x: doorX, z: doorZ + .3} : {x: rs.x - o.x, z: rs.z - o.z};
    else tgt = (dogState.z < doorZ + .25) ? {x: doorX, z: doorZ + .45} : spot(active);
    const indoors = inRoom;
    const vx = tgt.x - dogState.x, vz = tgt.z - dogState.z, dist = Math.hypot(vx, vz);
    const speed = (inward ? 3.6 : inRoom ? 2.5 : 2.6) * dt/1000;     // hurries in ahead of you
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
      // settled: mostly side-on (so you see that long body), facing its door,
      // or turned toward you once it's inside
      let dA = (indoors ? .55 : -1.0) - dogState.face; dA = Math.atan2(Math.sin(dA), Math.cos(dA));
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
    twin.dog.position.set(dog.position.x + o.x, 0, dog.position.z + o.z);
    twin.dog.rotation.y = dog.rotation.y;
    twin.pup.position.y = pup.position.y;
    twin.legs.forEach((h,k)=>{ h.rotation.x = legs[k].rotation.x; });
    twin.tail.rotation.copy(tail.rotation); twin.head.rotation.copy(head.rotation);
    twin.ears.forEach((e,k)=>{ e.rotation.x = ears[k].rotation.x; });
    twin.tongue.visible = tongue.visible;

    rest();
    if(state==="flying-in" || state==="flying-out"){
      const raw = Math.min(1, Math.max(0, (now - path.t0)/path.dur));   // the first frame can land a hair early
      const u = path.dir>0 ? ease(raw) : 1 - ease(raw);
      camera.position.copy(path.curve.getPointAt(u));
      // look at the door on the way in, then ease round to take in the room
      if(u < path.uD) look.lerpVectors(path.lookA, path.lookDoor, ease(u/path.uD));
      else look.lerpVectors(path.lookDoor, path.lookEnd, ease((u - path.uD)/Math.max(.01, 1 - path.uD)));
      path.u = u;
      camera.lookAt(look);
      room.look.copy(look);
      if(raw >= 1){
        const d = path.done; path.done = null;
        if(state==="flying-out"){ state = "idle"; leaveInterior(); }
        if(d) d();
      }
    } else if(state==="room"){
      const k = ease(Math.min(1, Math.max(0, (now - room.t0)/room.dur)));
      if(room.t0){ camera.position.lerpVectors(room.from, room.to, k); look.lerpVectors(room.lf, room.lt, k); camera.lookAt(look); room.look.copy(look); }
    } else if(state==="idle"){
      camera.position.lerp(restPos, Math.min(1, dt*.005));
      camera.lookAt(restLook);
    }

    icam.position.copy(camera.position).add(o);
    icam.quaternion.copy(camera.quaternion);
    // inside once the camera is through the doorway (a hair early, so the wall never clips the view)
    const camInside = state==="room" || ((state==="flying-in" || state==="flying-out" || state==="leaving") && path.u > path.uD - .015);
    if(camInside){
      renderer.render(iscene, icam);
    } else {
      if(sections[active].open > .12){
        renderer.setRenderTarget(portalRT); renderer.render(iscene, icam); renderer.setRenderTarget(null);
      }
      renderer.render(scene, camera);
    }
    const moving = Math.abs(camX.tgt-camX.cur)>.002 || state==="flying-in" || state==="flying-out" || state==="room";
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
  addEventListener("resize",()=>{ clearTimeout(rt); rt=setTimeout(()=>{ frame();
    if(state==="room"){ fillWalls(active); goStation(room.k); }           // the noticeboard reshapes for the screen
    start(); },120); });

  frame(); camX.cur = camX.tgt = xOf(0); rest(); showRoom(0);
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
      showRoom(active);
      frame(); rest();
      // start where we left off: in the room, with the pup in its spot
      const o = offsetFor(active), rs = rooms[active].userData.spot;
      dogState.x = rs.x - o.x; dogState.z = rs.z - o.z;
      if(box3) box3.classList.add("is-inside");
      startFly(false, active, null);
    },
  };
}

window.Services3D = {create, buildDog};
})();
