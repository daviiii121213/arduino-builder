/* ==========================================================================
   05 — Motor 3D (Three.js r128). Unidade da cena: metros. Planta (x,y) -> cena (x,-,z)
   ========================================================================== */
const V3 = AS.v3d = {
  ok: false, renderer: null, scene: null, camera: null, root: null,
  cam: { target: { x: 0, y: 1, z: 0 }, dist: 18, theta: Math.PI * 0.25, phi: Math.PI * 0.32, mode: 'orbit' },
  builtVersion: -1, dirty: true, matCache: {}, texCache: {}, pickables: [], el: null, needsRender: true,
};

V3.init = (el) => {
  V3.el = el;
  if (!window.THREE) { el.innerHTML = '<div class="v3-empty"><b>Visualização 3D indisponível</b><span>A biblioteca Three.js não carregou (sem acesso à CDN). A planta 2D continua funcionando.</span></div>'; return; }
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    el.appendChild(r.domElement); V3.renderer = r;
  } catch (e) {
    el.innerHTML = '<div class="v3-empty"><b>WebGL indisponível neste navegador</b><span>A visualização 3D precisa de WebGL. A planta 2D continua funcionando.</span></div>'; return;
  }
  const scene = V3.scene = new THREE.Scene();
  V3.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
  const hemi = new THREE.HemisphereLight(0xf3f6ff, 0x8a8170, 0.75); scene.add(hemi); V3.hemi = hemi;
  const sun = new THREE.DirectionalLight(0xfff3e0, 1.15); sun.position.set(12, 22, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target); V3.sun = sun;
  const amb = new THREE.AmbientLight(0xffffff, 0.18); scene.add(amb);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x9fae8c, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.02; ground.receiveShadow = true; scene.add(ground); V3.ground = ground;
  V3.root = new THREE.Group(); scene.add(V3.root);
  V3.applyTheme();
  new ResizeObserver(() => V3.resize()).observe(el);
  V3.bindControls(r => r);
  V3.ok = true; V3.resize();
  const loop = () => {
    requestAnimationFrame(loop);
    if (!V3.ok || !V3.visible()) return;
    if (V3.dirty && performance.now() - (V3.lastBuild || 0) > 120) V3.build();
    if (V3.needsRender) { V3.updateCamera(); V3.renderer.render(V3.scene, V3.camera); V3.needsRender = false; }
  };
  requestAnimationFrame(loop);
};
V3.visible = () => V3.el && V3.el.offsetParent !== null && V3.el.clientWidth > 0;
V3.applyTheme = () => {
  if (!V3.scene) return;
  const dark = document.documentElement.dataset.resolvedTheme === 'dark';
  V3.scene.background = new THREE.Color(dark ? 0x1c2026 : 0xdfe6ea);
  V3.scene.fog = new THREE.Fog(dark ? 0x1c2026 : 0xdfe6ea, 60, 180);
  if (V3.ground) V3.ground.material.color = new THREE.Color(dark ? 0x3a4238 : 0xb7c2a6).convertSRGBToLinear();
  V3.needsRender = true;
};
V3.resize = () => {
  if (!V3.renderer) return;
  const w = V3.el.clientWidth, h = V3.el.clientHeight; if (!w || !h) return;
  V3.renderer.setSize(w, h); V3.camera.aspect = w / h; V3.camera.updateProjectionMatrix(); V3.needsRender = true;
};
V3.invalidate = () => { V3.dirty = true; V3.needsRender = true; };

/* ---------- câmera orbital própria (sem dependências extras) ---------- */
V3.updateCamera = () => {
  const c = V3.cam, t = c.target;
  if (c.mode === 'top') { V3.camera.position.set(t.x, t.y + c.dist * 1.4, t.z + 0.001); V3.camera.lookAt(t.x, t.y, t.z); return; }
  const x = t.x + c.dist * Math.sin(c.phi) * Math.sin(c.theta), y = t.y + c.dist * Math.cos(c.phi), z = t.z + c.dist * Math.sin(c.phi) * Math.cos(c.theta);
  V3.camera.position.set(x, y, z); V3.camera.lookAt(t.x, t.y, t.z);
};
V3.bindControls = () => {
  const el = V3.renderer.domElement; el.tabIndex = 0;
  let drag = null; const pts = new Map();
  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    drag = { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey, moved: 0, theta: V3.cam.theta, phi: V3.cam.phi, t: { ...V3.cam.target }, d0: pts.size === 2 ? V3.pinchDist(pts) : 0, dist: V3.cam.dist };
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return; if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.moved += Math.abs(dx) + Math.abs(dy);
    if (pts.size === 2 && drag.d0) { V3.cam.dist = AS.clamp(drag.dist * drag.d0 / V3.pinchDist(pts), 1, 150); V3.needsRender = true; return; }
    if (drag.btn === 2 || drag.btn === 1 || drag.shift) { // pan
      const s = V3.cam.dist * 0.0018, th = V3.cam.theta;
      V3.cam.target.x = drag.t.x - (dx * Math.cos(th) + dy * Math.sin(th) * (V3.cam.mode === 'top' ? 1 : 1)) * s;
      V3.cam.target.z = drag.t.z - (-dx * Math.sin(th) + dy * Math.cos(th)) * s;
      if (V3.cam.mode === 'top') { V3.cam.target.x = drag.t.x - dx * s; V3.cam.target.z = drag.t.z - dy * s; }
    } else if (V3.cam.mode !== 'top') { V3.cam.theta = drag.theta - dx * 0.006; V3.cam.phi = AS.clamp(drag.phi - dy * 0.005, 0.08, Math.PI / 2 - 0.02); }
    V3.needsRender = true;
  });
  const up = (e) => { pts.delete(e.pointerId); if (drag && drag.moved < 5 && drag.btn === 0) V3.pick(e); drag = pts.size ? drag : null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', (e) => { e.preventDefault(); V3.cam.dist = AS.clamp(V3.cam.dist * Math.exp(e.deltaY * 0.0012), 1, 150); V3.needsRender = true; }, { passive: false });
  el.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase(), s = V3.cam.dist * 0.04, th = V3.cam.theta;
    const mv = { w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] }[k]; if (!mv) return;
    V3.cam.target.x += (mv[0] * Math.cos(th) + mv[1] * Math.sin(th)) * s; V3.cam.target.z += (-mv[0] * Math.sin(th) + mv[1] * Math.cos(th)) * s; V3.needsRender = true; e.stopPropagation();
  });
};
V3.pinchDist = (pts) => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; };
V3.setView = (mode) => {
  V3.cam.mode = mode === 'top' ? 'top' : 'orbit';
  if (mode === 'persp') { V3.cam.phi = Math.PI * 0.32; }
  if (mode === 'eye') { V3.cam.mode = 'orbit'; V3.cam.phi = Math.PI / 2 - 0.08; V3.cam.dist = Math.max(4, V3.cam.dist * 0.5); V3.cam.target.y = 1.6; }
  else V3.cam.target.y = 1;
  V3.needsRender = true;
};
V3.frame = () => {
  const pts = S.project.floors.flatMap(f => f.walls.flatMap(w => [w.a, w.b]));
  if (!pts.length) { V3.cam.target = { x: 0, y: 1, z: 0 }; V3.cam.dist = 15; V3.needsRender = true; return; }
  const b = AS.geo.bbox(pts);
  V3.cam.target = { x: (b.x0 + b.w / 2) / 100, y: 1, z: (b.y0 + b.h / 2) / 100 };
  V3.cam.dist = Math.max(8, Math.max(b.w, b.h) / 100 * 1.5); V3.needsRender = true;
};

/* ---------- materiais com texturas procedurais ---------- */
V3.texture = (m) => {
  const key = m.pattern + m.color + (m.tile || '');
  if (V3.texCache[key]) return V3.texCache[key];
  if (['none', 'glass', 'metal'].includes(m.pattern)) return null;
  const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  const base = new THREE.Color(m.color);
  const shade = (k) => { const c = base.clone(); c.offsetHSL(0, 0, k); return '#' + c.getHexString(); };
  g.fillStyle = m.color; g.fillRect(0, 0, N, N);
  const rnd = AS.rng(key.length * 977);
  if (m.pattern === 'wood') {
    for (let i = 0; i < 8; i++) { g.fillStyle = shade((rnd() - 0.5) * 0.06); g.fillRect(0, i * 32, N, 32); g.fillStyle = shade(-0.08); g.fillRect(0, i * 32, N, 1); }
    g.globalAlpha = 0.25; for (let i = 0; i < 90; i++) { g.strokeStyle = shade((rnd() - 0.5) * 0.15); g.beginPath(); const y = rnd() * N; g.moveTo(0, y); g.bezierCurveTo(N * 0.3, y + rnd() * 6 - 3, N * 0.6, y + rnd() * 6 - 3, N, y); g.stroke(); } g.globalAlpha = 1;
  } else if (m.pattern === 'tile' || m.pattern === 'brick') {
    const rows = m.pattern === 'brick' ? 8 : 4, cols = m.pattern === 'brick' ? 4 : 4;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { g.fillStyle = shade((rnd() - 0.5) * 0.04); const off = m.pattern === 'brick' && r % 2 ? N / cols / 2 : 0; g.fillRect(c * N / cols + off, r * N / rows, N / cols - 2, N / rows - 2); if (off) g.fillRect(-N / cols / 2, r * N / rows, N / cols - 2, N / rows - 2); }
    g.fillStyle = shade(-0.15); g.globalAlpha = 0.6;
    for (let r = 0; r <= rows; r++) g.fillRect(0, r * N / rows - 1, N, 2);
    if (m.pattern === 'tile') for (let c = 0; c <= cols; c++) g.fillRect(c * N / cols - 1, 0, 2, N);
    g.globalAlpha = 1;
  } else if (m.pattern === 'concrete' || m.pattern === 'stone') {
    const img = g.getImageData(0, 0, N, N);
    for (let i = 0; i < img.data.length; i += 4) { const n = (rnd() - 0.5) * (m.pattern === 'stone' ? 36 : 22); img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    if (m.pattern === 'stone') { g.strokeStyle = shade(-0.12); g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(rnd() * N, 0); g.lineTo(rnd() * N, N); g.stroke(); } }
  } else if (m.pattern === 'marble') {
    g.globalAlpha = 0.35; for (let i = 0; i < 14; i++) { g.strokeStyle = shade(-0.18 - rnd() * 0.1); g.lineWidth = rnd() * 2 + 0.5; g.beginPath(); let x = rnd() * N, y = 0; g.moveTo(x, y); while (y < N) { x += (rnd() - 0.5) * 30; y += 12; g.lineTo(x, y); } g.stroke(); } g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.encoding = THREE.sRGBEncoding;
  tex.anisotropy = 4;
  const sizeM = m.pattern === 'tile' ? (m.tile || 60) * 4 / 100 : m.pattern === 'brick' ? (m.tile || 20) * 4 / 100 : m.pattern === 'wood' ? 1.6 : 2;
  tex.userData = { sizeM };
  V3.texCache[key] = tex; return tex;
};
V3.material = (id, opts = {}) => {
  const m = AS.mat(id); const key = id + JSON.stringify(m) + (opts.side || '') + (opts.noTex ? 'n' : '');
  if (V3.matCache[key]) return V3.matCache[key];
  const tex = opts.noTex ? null : V3.texture(m);
  const mat = new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : new THREE.Color(m.color).convertSRGBToLinear(), roughness: m.rough ?? 0.8, metalness: m.metal ?? 0, map: tex || null, side: opts.side || THREE.FrontSide });
  if (m.pattern === 'glass') { mat.transparent = true; mat.opacity = m.opacity ?? 0.35; mat.depthWrite = false; mat.roughness = 0.05; mat.metalness = 0.1; }
  V3.matCache[key] = mat; return mat;
};
/** Ajusta UVs de uma caixa para escala de textura em metros (projeção por face) */
V3.boxUV = (geo, sizeM = 1) => {
  const pos = geo.attributes.position, nrm = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i)), ny = Math.abs(nrm.getY(i));
    let u, v; const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (ny > 0.5) { u = x; v = z; } else if (nx > 0.5) { u = z; v = y; } else { u = x; v = y; }
    uv.setXY(i, u / sizeM, v / sizeM);
  }
  uv.needsUpdate = true;
};

/* ---------- construção da cena ---------- */
V3.clear = () => {
  for (const c of [...V3.root.children]) { V3.root.remove(c); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  V3.pickables = [];
};
V3.box = (w, h, d, matId, parent, pos, rotY = 0, data = null, opts = {}) => {
  const geo = new THREE.BoxGeometry(Math.max(0.001, w), Math.max(0.001, h), Math.max(0.001, d));
  const m = AS.mat(matId), tex = V3.texture(m);
  const mesh = new THREE.Mesh(geo, opts.material || V3.material(matId));
  mesh.position.set(pos.x, pos.y, pos.z); mesh.rotation.y = rotY;
  if (tex && !opts.material) { geo.translate(0, 0, 0); V3.boxUV(geo, tex.userData.sizeM); }
  mesh.castShadow = opts.cast !== false && m.pattern !== 'glass'; mesh.receiveShadow = true;
  if (data) { mesh.userData = data; V3.pickables.push(mesh); }
  parent.add(mesh); return mesh;
};

V3.build = () => {
  if (!V3.ok) return;
  V3.lastBuild = performance.now(); V3.dirty = false; V3.builtVersion = S.version;
  V3.clear();
  const p = S.project, vs = p.view3d;
  const floors = vs.allFloors ? p.floors.filter(f => f.visible !== false) : [AS.floor()];
  const activeIdx = p.floors.indexOf(AS.floor());
  for (const fl of floors) {
    const idx = p.floors.indexOf(fl);
    if (vs.allFloors && idx > activeIdx && vs.cutaway) continue; // corta pavimentos acima do ativo
    const g = new THREE.Group(); g.position.y = (fl.elevation || 0) / 100; g.userData.floorId = fl.id; V3.root.add(g);
    V3.buildFloor(fl, g, vs);
  }
  V3.sun.castShadow = !!vs.shadows; V3.renderer.shadowMap.enabled = !!vs.shadows;
  const pts = floors.flatMap(f => f.walls.flatMap(w => [w.a, w.b]));
  if (pts.length) {
    const b = AS.geo.bbox(pts), cx = (b.x0 + b.w / 2) / 100, cz = (b.y0 + b.h / 2) / 100, r = Math.max(b.w, b.h) / 100 * 0.8 + 3;
    V3.sun.position.set(cx + r * 0.7, r * 1.6, cz + r * 0.5); V3.sun.target.position.set(cx, 0, cz);
    const sc = V3.sun.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.5; sc.far = r * 5; sc.updateProjectionMatrix();
  }
  V3.highlight(); V3.needsRender = true;
};

V3.buildFloor = (fl, g, vs) => {
  const cut = vs.cutaway ? 1.2 : null;
  // pisos dos cômodos
  const { rooms } = AS.rooms(fl);
  for (const r of rooms) {
    if (r.inner.length < 3) continue;
    const shape = new THREE.Shape(r.inner.map(q => new THREE.Vector2(q.x / 100, q.y / 100)));
    const geo = new THREE.ShapeGeometry(shape); geo.rotateX(Math.PI / 2);
    const matId = r.meta?.floorMaterial || AS.roomType(r.meta?.type).floor;
    const m = AS.mat(matId), tex = V3.texture(m);
    if (tex) { const uv = geo.attributes.uv, pos = geo.attributes.position; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tex.userData.sizeM, pos.getZ(i) / tex.userData.sizeM); }
    const mesh = new THREE.Mesh(geo, V3.material(matId, { side: THREE.DoubleSide })); mesh.position.y = 0.005; mesh.receiveShadow = true;
    mesh.userData = r.meta ? { kind: 'room', id: r.meta.id, floorId: fl.id } : { kind: 'roomraw', floorId: fl.id }; V3.pickables.push(mesh); g.add(mesh);
    if (vs.ceilings && !vs.cutaway && r.meta?.type !== 'varanda') {
      const c = new THREE.Mesh(geo.clone(), V3.material('pint_branca', { side: THREE.DoubleSide, noTex: true })); c.position.y = (fl.height || 280) / 100; c.receiveShadow = true; g.add(c);
    }
  }
  // laje/base sob as paredes externas (contorno simples por bbox dos cômodos)
  if (rooms.length && (fl.elevation || 0) > 0) {
    for (const r of rooms) { const shape = new THREE.Shape(r.poly.map(q => new THREE.Vector2(q.x / 100, q.y / 100))); const geo = new THREE.ExtrudeGeometry(shape, { depth: (fl.slab || 12) / 100, bevelEnabled: false }); geo.rotateX(Math.PI / 2); const mesh = new THREE.Mesh(geo, V3.material('concreto', { noTex: true })); mesh.position.y = 0; mesh.receiveShadow = true; mesh.castShadow = true; g.add(mesh); }
  }
  // paredes com recortes reais das aberturas
  for (const w of fl.walls) {
    if (w.hidden) continue;
    const L = AS.wallLen(w); if (L < 1) continue;
    const ext = R2.wallExt(w, fl);
    const dir = AS.wallDir(w), ang = Math.atan2(dir.y, dir.x);
    const H = Math.min(w.height, cut ? cut * 100 : Infinity) / 100, T = w.thickness / 100;
    const ops = fl.openings.filter(o => o.wallId === w.id && !o.hidden).map(o => ({ o, s: o.t - o.width / 2, e: o.t + o.width / 2 })).sort((a, b) => a.s - b.s);
    const grp = new THREE.Group();
    const origin = AS.geo.sub(w.a, AS.geo.mul(dir, ext.a));
    grp.position.set(origin.x / 100, 0, origin.y / 100); grp.rotation.y = -ang; g.add(grp);
    const total = L + ext.a + ext.b;
    const data = { kind: 'wall', id: w.id, floorId: fl.id };
    const matId = w.material || 'pint_branca';
    // segmentos ao longo da parede (coordenadas locais, em cm a partir da origem estendida)
    let x = 0;
    const seg = (x0, x1, y0, y1) => { if (x1 - x0 < 0.2 || y1 - y0 < 0.2) return; V3.box((x1 - x0) / 100, (y1 - y0) / 100, T, matId, grp, { x: (x0 + x1) / 200, y: (y0 + y1) / 200, z: 0 }, 0, data); };
    for (const { o, s, e } of ops) {
      const S0 = s + ext.a, E0 = e + ext.a;
      seg(x, S0, 0, H * 100);
      const sill = o.kind === 'window' ? o.sill : 0, top = sill + o.height;
      if (sill > 0) seg(S0, E0, 0, Math.min(sill, H * 100));
      if (top < H * 100) seg(S0, E0, top, H * 100);
      x = E0;
      V3.buildOpening(o, grp, S0, E0, T, sill, Math.min(top, H * 100), fl);
    }
    seg(x, total, 0, H * 100);
    // face externa diferente (material externo) — fina camada
    if (w.materialExt && w.type === 'exterior' && !cut) {
      const c = R2._center || { x: 0, y: 0 };
      const n = AS.geo.perp(dir), mid = AS.geo.lerp(w.a, w.b, 0.5), outSide = AS.geo.dot(AS.geo.sub(mid, c), n) > 0 ? 1 : -1;
      x = 0;
      const skin = (x0, x1, y0, y1) => { if (x1 - x0 < 0.2 || y1 - y0 < 0.2) return; V3.box((x1 - x0) / 100, (y1 - y0) / 100, 0.004, w.materialExt, grp, { x: (x0 + x1) / 200, y: (y0 + y1) / 200, z: outSide * (T / 2 + 0.002) }, 0, data, { cast: false }); };
      for (const { o, s, e } of ops) { const S0 = s + ext.a, E0 = e + ext.a; skin(x, S0, 0, H * 100); const sill = o.kind === 'window' ? o.sill : 0, top = sill + o.height; if (sill > 0) skin(S0, E0, 0, sill); if (top < H * 100) skin(S0, E0, top, H * 100); x = E0; }
      skin(x, total, 0, H * 100);
    }
  }
  // mobiliário
  if (S.project.settings.showFurniture) for (const f of fl.furniture) if (!f.hidden) V3.buildFurniture(f, g, fl);
};

V3.buildOpening = (o, grp, S0, E0, T, sill, top, fl) => {
  const w = (E0 - S0) / 100, cx = (S0 + E0) / 200, data = { kind: 'opening', id: o.id, floorId: fl.id };
  const frame = o.frame || (o.kind === 'door' ? 'mad_freijo' : 'aluminio');
  const fT = 0.04, h = (top - sill) / 100, y0 = sill / 100;
  if (h <= 0.01) return;
  // marco
  if (o.type !== 'passagem') {
    V3.box(fT, h, T + 0.01, frame, grp, { x: S0 / 100 + fT / 2, y: y0 + h / 2, z: 0 }, 0, data);
    V3.box(fT, h, T + 0.01, frame, grp, { x: E0 / 100 - fT / 2, y: y0 + h / 2, z: 0 }, 0, data);
    V3.box(w, fT, T + 0.01, frame, grp, { x: cx, y: y0 + h - fT / 2, z: 0 }, 0, data);
    if (o.kind === 'window') V3.box(w, fT, T + 0.03, frame, grp, { x: cx, y: y0 + fT / 2, z: 0 }, 0, data);
  }
  if (o.kind === 'window') {
    const panes = o.type === 'correr' ? 2 : 1;
    for (let i = 0; i < panes; i++) {
      const pw = (w - fT * 2) / panes, px = S0 / 100 + fT + pw * (i + 0.5), pz = panes === 2 ? (i ? 0.012 : -0.012) : 0;
      V3.box(pw + (panes === 2 ? 0.03 : 0), h - fT * 2, 0.01, o.material || 'vidro', grp, { x: px, y: y0 + h / 2, z: pz }, 0, data, { cast: false });
      V3.box(0.025, h - fT * 2, 0.03, frame, grp, { x: px - pw / 2, y: y0 + h / 2, z: pz }, 0, data);
    }
  } else if (o.type === 'giro' || o.type === 'dupla') {
    const leaves = o.type === 'dupla' ? 2 : 1, lw = (w - fT * 2) / leaves;
    for (let i = 0; i < leaves; i++) {
      const hingeLeft = leaves === 2 ? i === 0 : o.hinge !== 'b';
      const pivot = new THREE.Group();
      const hx = hingeLeft ? S0 / 100 + fT : E0 / 100 - fT;
      pivot.position.set(hx, y0, (o.side || 1) * (T / 2));
      const openA = AS.rad(72) * (o.side || 1) * (hingeLeft ? -1 : 1);
      pivot.rotation.y = openA; grp.add(pivot);
      V3.box(lw, h - fT - 0.01, 0.035, o.material || 'mad_freijo', pivot, { x: (hingeLeft ? 1 : -1) * lw / 2, y: (h - fT) / 2, z: 0 }, 0, data);
      V3.box(0.02, 0.02, 0.12, 'inox', pivot, { x: (hingeLeft ? 1 : -1) * (lw - 0.07), y: 1.05, z: 0 }, 0, data);
    }
  } else if (o.type === 'correr') {
    const pw = (w - fT * 2) / 2 + 0.03;
    V3.box(pw, h - fT, 0.035, o.material || 'mad_freijo', grp, { x: S0 / 100 + fT + pw / 2 + pw * 0.35, y: y0 + (h - fT) / 2, z: -T / 2 - 0.03 }, 0, data);
    if (o.material === 'vidro' || o.material === 'vidro_fume') V3.box(pw, h - fT, 0.035, o.material, grp, { x: E0 / 100 - fT - pw / 2, y: y0 + (h - fT) / 2, z: -T / 2 - 0.07 }, 0, data, { cast: false });
  }
};

V3.buildFurniture = (f, g, fl) => {
  const grp = new THREE.Group(); grp.position.set(f.x / 100, (f.elev || 0) / 100, f.y / 100); grp.rotation.y = -AS.rad(f.rot || 0); g.add(grp);
  const data = { kind: 'furniture', id: f.id, floorId: fl.id };
  const W = f.w / 100, D = f.d / 100, H = f.h / 100, M = f.material || AS.furnDef(f.type).mat;
  const B = (w, h, d, x, y, z, mat = M) => V3.box(w, h, d, mat, grp, { x, y, z }, 0, data);
  const cyl = (r, h, x, y, z, mat = M, seg = 20) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), V3.material(mat, { noTex: true })); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; m.userData = data; V3.pickables.push(m); grp.add(m); return m; };
  const legs = (w, d, h, r = 0.02, mat = 'aluminio_preto') => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(r * 2, h, r * 2, sx * (w / 2 - r * 2), h / 2, sz * (d / 2 - r * 2), mat); };
  switch (f.type) {
    case 'cama_casal': case 'cama_queen': case 'cama_solteiro':
      B(W, 0.28, D, 0, 0.14, 0, 'mad_freijo'); B(W - 0.04, 0.22, D - 0.06, 0, 0.39, 0.02, 'tecido_areia'); B(W, 1.0, 0.06, 0, 0.5, -D / 2 + 0.03, 'mad_freijo');
      B(W - 0.04, 0.05, D * 0.6, 0, 0.52, D * 0.18, M);
      if (f.type === 'cama_solteiro') B(W * 0.7, 0.12, 0.35, 0, 0.56, -D / 2 + 0.28, 'pint_branca'); else { B(W * 0.4, 0.12, 0.35, -W * 0.24, 0.56, -D / 2 + 0.28, 'pint_branca'); B(W * 0.4, 0.12, 0.35, W * 0.24, 0.56, -D / 2 + 0.28, 'pint_branca'); }
      break;
    case 'sofa3': case 'sofa2': case 'poltrona':
      B(W, 0.42, D, 0, 0.21, 0); B(W, 0.45, 0.2, 0, 0.62, -D / 2 + 0.1); B(0.18, 0.25, D, -W / 2 + 0.09, 0.55, 0); B(0.18, 0.25, D, W / 2 - 0.09, 0.55, 0); break;
    case 'mesa_jantar4': case 'mesa_jantar6': case 'escrivaninha': case 'mesa_centro':
      B(W, 0.04, D, 0, H - 0.02, 0); legs(W, D, H - 0.04, 0.025, f.type === 'mesa_centro' ? M : 'aluminio_preto');
      if (f.type.startsWith('mesa_jantar')) { const n = f.type === 'mesa_jantar6' ? 3 : 2; for (let i = 0; i < n; i++) for (const sz of [-1, 1]) { const cx = -W / 2 + W * (i + 0.5) / n, cz = sz * (D / 2 + 0.18); B(0.42, 0.04, 0.42, cx, 0.46, cz, 'mad_carvalho'); B(0.42, 0.42, 0.03, cx, 0.68, cz + sz * 0.2, 'mad_carvalho'); legs(0.42, 0.42, 0.44, 0.015); } }
      break;
    case 'mesa_redonda': cyl(W / 2, 0.04, 0, H - 0.02, 0); cyl(0.05, H - 0.04, 0, (H - 0.04) / 2, 0, 'aluminio_preto'); break;
    case 'cadeira': B(W, 0.04, D, 0, 0.46, 0); B(W, 0.42, 0.03, 0, 0.68, -D / 2 + 0.015); legs(W, D, 0.44, 0.015); break;
    case 'banqueta': cyl(W / 2, 0.05, 0, H - 0.025, 0); cyl(0.03, H - 0.05, 0, (H - 0.05) / 2, 0, 'aluminio_preto'); break;
    case 'guarda_roupa': case 'armario_alto': case 'estante': case 'rack': case 'armario_coz': case 'criado': {
      B(W, H, D, 0, H / 2, 0);
      const n = Math.max(1, Math.round(f.w / 50));
      for (let i = 1; i < n; i++) B(0.006, H * 0.96, 0.005, -W / 2 + W * i / n, H / 2, D / 2 + 0.003, 'aluminio_preto');
      if (f.type === 'armario_coz') B(W + 0.02, 0.03, D + 0.02, 0, H + 0.015, 0, 'granito_preto');
      if (f.type === 'estante') for (let k = 1; k < 5; k++) B(W - 0.02, 0.02, D, 0, H * k / 5, 0.01, 'mad_escura');
      break;
    }
    case 'geladeira': B(W, H, D, 0, H / 2, 0); B(0.02, 0.4, 0.03, W / 2 - 0.08, H * 0.7, D / 2 + 0.015, 'aluminio_preto'); B(W, 0.008, 0.005, 0, H * 0.62, D / 2 + 0.003, 'aluminio_preto'); break;
    case 'fogao': B(W, H, D, 0, H / 2, 0); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(0.05, 0.02, x * W * 0.23, H + 0.01, z * D * 0.22, 'granito_preto'); break;
    case 'cooktop': B(W, 0.02, D, 0, H, 0, 'granito_preto'); break;
    case 'pia_coz': case 'lavatorio': case 'tanque':
      B(W, H - 0.04, D, 0, (H - 0.04) / 2, 0, f.type === 'tanque' ? 'loucas' : 'mdf_branco'); B(W, 0.04, D, 0, H - 0.02, 0, M);
      B(Math.min(W * 0.5, 0.5), 0.01, D * 0.6, 0, H + 0.001, 0, 'inox'); cyl(0.012, 0.25, 0, H + 0.12, -D / 2 + 0.06, 'inox'); break;
    case 'maq_lavar': B(W, H, D, 0, H / 2, 0); cyl(0.2, 0.02, 0, H * 0.5, D / 2, 'vidro_fume').rotation.x = Math.PI / 2; break;
    case 'box': B(W, 0.04, D, 0, 0.02, 0, 'ceram_branca'); B(W, H, 0.01, 0, H / 2, D / 2, 'vidro'); B(0.01, H, D, W / 2, H / 2, 0, 'vidro'); cyl(0.1, 0.02, 0, 2.05, -D / 2 + 0.15, 'inox'); break;
    case 'vaso': B(W * 0.9, 0.38, D * 0.55, 0, 0.19, D * 0.15, 'loucas'); B(W, 0.35, 0.18, 0, 0.55, -D / 2 + 0.09, 'loucas'); break;
    case 'banheira': B(W, H, D, 0, H / 2, 0, 'loucas'); B(W - 0.1, 0.02, D - 0.1, 0, H - 0.01, 0, 'ceram_branca'); break;
    case 'planta': cyl(W * 0.3, 0.4, 0, 0.2, 0, 'concreto'); { const s = new THREE.Mesh(new THREE.IcosahedronGeometry(W * 0.55, 1), new THREE.MeshStandardMaterial({ color: 0x5c7f4b, roughness: 0.9, flatShading: true })); s.position.y = 0.4 + W * 0.6; s.scale.y = 1.3; s.castShadow = true; s.userData = data; V3.pickables.push(s); grp.add(s); } break;
    case 'tapete': B(W, 0.012, D, 0, 0.006, 0); break;
    case 'carro': B(W, 0.6, D, 0, 0.45, 0, M); B(W * 0.9, 0.5, D * 0.5, 0, 0.98, -D * 0.05, 'vidro_fume'); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const c = cyl(0.32, 0.22, sx * (W / 2 - 0.1), 0.32, sz * (D / 2 - 0.75), 'aluminio_preto'); c.rotation.z = Math.PI / 2; } break;
    case 'escada_reta': {
      const n = Math.max(2, Math.round(f.d / 28)), rise = H / n, run = D / n;
      for (let i = 0; i < n; i++) B(W, rise * (i + 1), run, 0, rise * (i + 1) / 2, D / 2 - run * (i + 0.5), M);
      break;
    }
    default: B(W, H, D, 0, H / 2, 0);
  }
};

/* ---------- seleção ---------- */
V3.pick = (e) => {
  const r = V3.renderer.domElement.getBoundingClientRect();
  const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  const ray = new THREE.Raycaster(); ray.setFromCamera(m, V3.camera);
  const hits = ray.intersectObjects(V3.pickables, false);
  const h = hits.find(x => x.object.userData.kind && x.object.userData.kind !== 'roomraw');
  if (!h) { AS.editor.select([]); return; }
  const d = h.object.userData;
  if (d.floorId && d.floorId !== S.project.activeFloor) { S.project.activeFloor = d.floorId; AS.changed(false); AS.bus.emit('floor'); }
  AS.editor.select([{ kind: d.kind, id: d.id }], e.shiftKey);
};
V3.highlight = () => {
  if (!V3.ok) return;
  const sel = new Set(S.sel.map(s => s.id));
  for (const m of V3.pickables) {
    const on = sel.has(m.userData.id);
    if (on && !m.userData._hl) { m.userData._orig = m.material; const c = m.material.clone(); c.emissive = new THREE.Color(0xff6a1a); c.emissiveIntensity = 0.35; m.material = c; m.userData._hl = true; }
    else if (!on && m.userData._hl) { m.material.dispose(); m.material = m.userData._orig; m.userData._hl = false; }
  }
  V3.needsRender = true;
};
V3.snapshot = () => { if (!V3.ok) throw new Error('3D indisponível'); V3.updateCamera(); V3.renderer.render(V3.scene, V3.camera); return V3.renderer.domElement.toDataURL('image/png'); };
