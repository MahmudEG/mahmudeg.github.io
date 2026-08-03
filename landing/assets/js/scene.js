/* Hero WebGL scene — particle network + wireframe terrain, terminal-green on black.
   Loads three.js from CDN; fails silently (CSS grid backdrop remains) if WebGL
   or the network is unavailable. Skipped entirely under prefers-reduced-motion. */

const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("scene");

if (canvas && !reduced) {
  try {
    const THREE = await import("https://unpkg.com/three@0.160.0/build/three.module.js");
    init(THREE);
  } catch (e) {
    /* no WebGL / offline — static backdrop is fine */
  }
}

function init(THREE) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a0c, 0.055);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.set(0, 2.1, 9);

  const ACCENT = 0x00e68a;

  /* --- wireframe terrain, slowly scrolling toward the camera --- */
  const terrainGeo = new THREE.PlaneGeometry(46, 46, 56, 56);
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position;
  const baseY = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    baseY[i] = Math.sin(x * 0.45) * Math.cos(z * 0.38) * 0.55;
  }
  const terrain = new THREE.Mesh(
    terrainGeo,
    new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: 0.07 })
  );
  terrain.position.y = -2.4;
  scene.add(terrain);

  /* --- particle field --- */
  const COUNT = 320;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(COUNT * 3);
  const vel = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 22;
    pPos[i * 3 + 1] = Math.random() * 8 - 1.5;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 14;
    vel[i * 3] = (Math.random() - 0.5) * 0.004;
    vel[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
    vel[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ color: ACCENT, size: 0.045, transparent: true, opacity: 0.85, sizeAttenuation: true })
  );
  scene.add(points);

  /* --- connective lines between nearby particles (rebuilt cheaply each frame) --- */
  const MAX_LINKS = 400;
  const lGeo = new THREE.BufferGeometry();
  const lPos = new Float32Array(MAX_LINKS * 6);
  lGeo.setAttribute("position", new THREE.BufferAttribute(lPos, 3));
  const lines = new THREE.LineSegments(
    lGeo,
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.14 })
  );
  scene.add(lines);

  /* --- pointer parallax --- */
  let mx = 0, my = 0;
  window.addEventListener("pointermove", (e) => {
    mx = (e.clientX / window.innerWidth - 0.5) * 2;
    my = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  }

  const LINK_DIST = 2.3;
  let t = 0;
  let running = true;

  /* pause rendering when hero is off-screen or in pro mode */
  new IntersectionObserver((en) => { running = en[0].isIntersecting; }, { threshold: 0 })
    .observe(canvas);

  renderer.setAnimationLoop(() => {
    if (!running || document.documentElement.getAttribute("data-mode") === "pro") return;
    resize();
    t += 0.016;

    /* terrain wave */
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, baseY[i] + Math.sin(t * 0.6 + x * 0.35 + z * 0.3) * 0.35);
    }
    pos.needsUpdate = true;

    /* particles drift + wrap */
    for (let i = 0; i < COUNT; i++) {
      for (let a = 0; a < 3; a++) {
        let v = pPos[i * 3 + a] + vel[i * 3 + a];
        const lim = a === 1 ? 8 : (a === 0 ? 11 : 7);
        if (v > lim) v = -lim; else if (v < -lim) v = lim;
        pPos[i * 3 + a] = v;
      }
    }
    pGeo.attributes.position.needsUpdate = true;

    /* rebuild links */
    let li = 0;
    for (let i = 0; i < COUNT && li < MAX_LINKS; i++) {
      for (let j = i + 1; j < COUNT && li < MAX_LINKS; j++) {
        const dx = pPos[i * 3] - pPos[j * 3];
        const dy = pPos[i * 3 + 1] - pPos[j * 3 + 1];
        const dz = pPos[i * 3 + 2] - pPos[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < LINK_DIST * LINK_DIST) {
          lPos.set([pPos[i * 3], pPos[i * 3 + 1], pPos[i * 3 + 2],
                    pPos[j * 3], pPos[j * 3 + 1], pPos[j * 3 + 2]], li * 6);
          li++;
        }
      }
    }
    lGeo.setDrawRange(0, li * 2);
    lGeo.attributes.position.needsUpdate = true;

    /* camera parallax */
    camera.position.x += (mx * 1.1 - camera.position.x) * 0.04;
    camera.position.y += (2.1 - my * 0.7 - camera.position.y) * 0.04;
    camera.lookAt(0, 1.2, 0);

    renderer.render(scene, camera);
  });
}
