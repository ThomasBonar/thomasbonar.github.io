// 3D viewers built with three.js (bundled locally, no outside services).
import * as THREE from 'three';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const loader = new GLTFLoader();
const cache = {};
function loadModel(url) {
  if (!cache[url]) cache[url] = new Promise((res, rej) => loader.load(url, g => res(g.scene), undefined, rej));
  return cache[url];
}

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
  catch (e) { return false; }
}

// Build solid + feature-edge meshes from a loaded model
function buildPart(scene, { color = 0x9fb4c6, edgeColor = 0x5fe1ff, edgeOpacity = 0.55, angle = 28 } = {}) {
  const group = new THREE.Group();
  const solidMat = new THREE.MeshStandardMaterial({ color, metalness: 0.82, roughness: 0.3, envMapIntensity: 1.1 });
  const wireMat = new THREE.MeshBasicMaterial({ color: edgeColor, wireframe: true, transparent: true, opacity: 0.16 });
  const edgeMat = new THREE.LineBasicMaterial({ color: edgeColor, transparent: true, opacity: edgeOpacity });
  const parts = { solid: [], wire: [], edges: [] };
  scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry; g.computeVertexNormals();
    const s = new THREE.Mesh(g, solidMat); parts.solid.push(s); group.add(s);
    const w = new THREE.Mesh(g, wireMat); w.visible = false; parts.wire.push(w); group.add(w);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, angle), edgeMat); parts.edges.push(e); group.add(e);
  });
  group.userData.parts = parts;
  return group;
}

function setMode(group, mode) {
  const p = group.userData.parts;
  p.solid.forEach(m => m.visible = mode !== 'wire');
  p.wire.forEach(m => m.visible = mode === 'wire');
  p.edges.forEach(m => m.visible = mode !== 'solid');
}

function makeRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
  return r;
}

function lights(scene, renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x5fe1ff, 2.4); rim.position.set(-5, 1, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x223344, 0.6));
}


// ---------------- Procedural gear train (stylized, based on the ME 314 accessory gearbox) ----------------
function gearGeometry(N, m, depth, bore) {
  const r = m * N / 2, ra = r + m, rf = r - 1.25 * m, pitch = Math.PI * 2 / N;
  const shape = new THREE.Shape();
  const pts = [];
  for (let i = 0; i < N; i++) {
    const a = i * pitch;
    // tooth centered on angle a: root -> flank -> tip -> flank -> root
    const rootHalf = pitch * 0.30, tipHalf = pitch * 0.15, pitchHalf = pitch * 0.25;
    const seq = [[a - pitch / 2, rf], [a - rootHalf, rf], [a - pitchHalf, r], [a - tipHalf, ra], [a + tipHalf, ra], [a + pitchHalf, r], [a + rootHalf, rf]];
    seq.forEach(([ang, rad]) => pts.push([Math.cos(ang) * rad, Math.sin(ang) * rad]));
  }
  shape.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => shape.lineTo(q[0], q[1])); shape.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, bore, 0, Math.PI * 2, true); shape.holes.push(hole);
  // keyway
  // lightening holes on larger gears
  if (N >= 28) {
    const k = 6, rr = (rf + bore) / 2, hr = (rf - bore) * 0.28;
    for (let i = 0; i < k; i++) { const h = new THREE.Path(); const a = i / k * Math.PI * 2; h.absarc(Math.cos(a) * rr, Math.sin(a) * rr, hr, 0, Math.PI * 2, true); shape.holes.push(h); }
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.06, bevelSize: m * 0.08, bevelSegments: 1, curveSegments: 24 });
  g.translate(0, 0, -depth / 2);
  return g;
}

export function buildGearTrain() {
  const m = 0.012, group = new THREE.Group();
  const solid = new THREE.MeshStandardMaterial({ color: 0xa9bccc, metalness: 0.85, roughness: 0.28, envMapIntensity: 1.15 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x2aa3c8, metalness: 0.7, roughness: 0.35, envMapIntensity: 1.0, emissive: 0x0a3a4a, emissiveIntensity: 0.4 });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x5fe1ff, transparent: true, opacity: 0.55 });
  // gear list: teeth, angle from parent (rad), parent index, z layer
  const spec = [
    { N: 40, parent: -1 },
    { N: 18, parent: 0, ang: 0.35 },
    { N: 30, parent: 1, ang: -0.55 },
    { N: 22, parent: 0, ang: 2.35 },
    { N: 34, parent: 3, ang: 1.75 },
    { N: 14, parent: 0, ang: 4.35 },
    { N: 26, parent: 2, ang: -1.9 },
  ];
  const gears = [];
  spec.forEach((s, i) => {
    const pitch = Math.PI * 2 / s.N, r = m * s.N / 2;
    let x = 0, y = 0, k = 1, c = 0;
    if (s.parent >= 0) {
      const P = gears[s.parent], d = m * (P.N + s.N) / 2;
      x = P.x + Math.cos(s.ang) * d; y = P.y + Math.sin(s.ang) * d;
      k = -P.k * P.N / s.N;
      const pP = (s.ang - P.c) / P.pitch;
      c = s.ang + Math.PI - pitch * (0.5 - pP);
    }
    const depth = 0.05 + (i % 2) * 0.012;
    const geo = gearGeometry(s.N, m, depth, Math.max(0.028, r * 0.22));
    const mesh = new THREE.Mesh(geo, i === 0 ? accent : solid);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat);
    const g = new THREE.Group(); g.add(mesh); g.add(edges);
    // shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.028, r * 0.22) * 0.92, Math.max(0.028, r * 0.22) * 0.92, 0.11, 24), solid);
    shaft.rotation.x = Math.PI / 2;
    const holder = new THREE.Group(); holder.position.set(x, y, 0); holder.add(g); holder.add(shaft);
    group.add(holder);
    gears.push({ N: s.N, x, y, k, c, pitch, g });
  });
  // center the cluster
  const box = new THREE.Box3().setFromObject(group), ctr = box.getCenter(new THREE.Vector3());
  group.children.forEach(h => h.position.sub(ctr));
  const size = box.getSize(new THREE.Vector3()), s = 0.98 / Math.max(size.x, size.y);
  group.scale.setScalar(s);
  group.userData.update = t => gears.forEach(G => { G.g.rotation.z = G.k * t + G.c; });
  return group;
}

// ---------------- HERO ----------------
export async function initHero(canvas, url, fallbackSel) {
  if (!canvas) return;
  if (!webglOK()) { const fb = document.querySelector(fallbackSel); if (fb) fb.hidden = false; return; }
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  lights(scene, renderer);

  // particle field (blueprint dust)
  const N = 900, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 9; pos[i * 3 + 1] = (Math.random() - .5) * 6; pos[i * 3 + 2] = (Math.random() - .5) * 6 - 1; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x5fe1ff, size: 0.012, transparent: true, opacity: 0.55 }));
  scene.add(dust);

  // reference rings
  const ringMat = new THREE.LineBasicMaterial({ color: 0x5fe1ff, transparent: true, opacity: 0.18 });
  const rings = new THREE.Group();
  [0.78, 0.95].forEach(rad => {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, 0)); }
    rings.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
  });
  scene.add(rings);

  const holder = new THREE.Group(); scene.add(holder);
  const part = buildGearTrain();
  holder.add(part);
  holder.rotation.set(-0.55, 0.35, 0.2);

  let w = 0, h = 0;
  const resize = () => {
    w = canvas.clientWidth; h = canvas.clientHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const mobile = w < 700;
    camera.position.set(0, 0, mobile ? 3.6 : 2.6);
    holder.position.set(mobile ? 0 : 0.62, mobile ? 0.55 : 0, 0);
    rings.position.copy(holder.position);
  };
  resize(); window.addEventListener('resize', resize);

  let mx = 0, my = 0;
  window.addEventListener('pointermove', e => { mx = e.clientX / window.innerWidth - .5; my = e.clientY / window.innerHeight - .5; }, { passive: true });

  let visible = true;
  new IntersectionObserver(es => visible = es[0].isIntersecting).observe(canvas);
  const clock = new THREE.Clock();
  const tick = () => {
    requestAnimationFrame(tick);
    if (!visible) return;
    const t = clock.getElapsedTime();
    if (!reduce) {
      part.userData.update(t * 0.9);
      holder.rotation.x += ((-0.55 + my * 0.25) - holder.rotation.x) * 0.04;
      holder.rotation.y += ((0.35 + mx * 0.35) - holder.rotation.y) * 0.04;
      dust.rotation.y = t * 0.02;
      rings.rotation.z = -t * 0.05;
    }
    renderer.render(scene, camera);
  };
  if (reduce) part.userData.update(0.6);
  tick();
  canvas.classList.add('ready');
}

// ---------------- STUDIO (interactive) ----------------
export function initStudio(root) {
  if (!root) return;
  const canvas = root.querySelector('canvas');
  const hud = root.querySelector('.hud');
  const loading = root.querySelector('.loading');
  if (!webglOK()) { loading.textContent = '3D preview needs WebGL. Try a newer browser.'; return; }
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  camera.position.set(1.15, 0.55, 1.35);
  lights(scene, renderer);
  const grid = new THREE.GridHelper(4, 40, 0x1f4a5e, 0x10283a); grid.position.y = -0.56; scene.add(grid);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.autoRotate = !reduce; controls.autoRotateSpeed = 1.2;
  controls.minDistance = 0.8; controls.maxDistance = 5; controls.enablePan = false;
  canvas.addEventListener('pointerdown', () => controls.autoRotate = false);

  let current = null, mode = 'both';
  const resize = () => {
    const w = root.clientWidth, h = root.clientHeight; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  resize(); window.addEventListener('resize', resize);

  async function show(btn) {
    root.parentElement.querySelectorAll('.model-btn').forEach(b => b.classList.toggle('active', b === btn));
    loading.style.display = 'grid';
    const m = await loadModel(btn.dataset.model);
    if (current) scene.remove(current);
    current = new THREE.Group();
    const part = buildPart(m.clone(), { edgeOpacity: 0.6, angle: 30 });
    const [rx, ry, rz] = (btn.dataset.rot || '0,0,0').split(',').map(Number);
    part.rotation.set(rx, ry, rz);
    current.add(part); scene.add(current); setMode(part, mode);
    current.userData.part = part;
    hud.innerHTML = btn.dataset.hud;
    loading.style.display = 'none';
  }
  root.parentElement.querySelectorAll('.model-btn').forEach(b => b.addEventListener('click', () => show(b)));
  root.parentElement.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    root.parentElement.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b));
    if (current) setMode(current.userData.part, mode);
  }));
  const first = root.parentElement.querySelector('.model-btn');
  let started = false;
  new IntersectionObserver(es => { if (es[0].isIntersecting && !started) { started = true; show(first); } }, { rootMargin: '200px' }).observe(root);

  let visible = true;
  new IntersectionObserver(es => visible = es[0].isIntersecting).observe(canvas);
  const tick = () => { requestAnimationFrame(tick); if (!visible) return; controls.update(); renderer.render(scene, camera); };
  tick();
}
