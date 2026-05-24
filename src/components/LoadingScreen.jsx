import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const ACCENT = "#00ffe7";
const ACCENT2 = "#7f5af0";
const ACCENT3 = "#ff2d78";

/* ─── tiny CSS injected once ─── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');

.nxl-root {
  position:fixed;inset:0;z-index:99999;
  background:#000;
  overflow:hidden;
  font-family:'Share Tech Mono',monospace;
}
.nxl-canvas { position:absolute;inset:0;width:100%;height:100%; }

/* scanline overlay */
.nxl-scanlines {
  position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(
    0deg,transparent,transparent 2px,rgba(0,0,0,.18) 2px,rgba(0,0,0,.18) 4px
  );
  animation:nxl-scan 8s linear infinite;
}
@keyframes nxl-scan {
  0%{background-position:0 0} 100%{background-position:0 100vh}
}

/* vignette */
.nxl-vignette {
  position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.85) 100%);
}

/* center UI */
.nxl-ui {
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:0;
  pointer-events:none;
}

/* holographic ring */
.nxl-ring-wrap {
  position:relative;width:180px;height:180px;
  display:flex;align-items:center;justify-content:center;
  margin-bottom:32px;
}
.nxl-ring {
  position:absolute;border-radius:50%;border:2px solid transparent;
}
.nxl-ring-1 {
  width:160px;height:160px;
  border-top-color:var(--a1);border-right-color:var(--a1);
  box-shadow:0 0 18px var(--a1),inset 0 0 18px rgba(0,255,231,.08);
  animation:nxl-spin1 2s linear infinite;
}
.nxl-ring-2 {
  width:130px;height:130px;
  border-bottom-color:var(--a2);border-left-color:var(--a2);
  box-shadow:0 0 14px var(--a2),inset 0 0 14px rgba(127,90,240,.08);
  animation:nxl-spin2 1.4s linear infinite;
}
.nxl-ring-3 {
  width:100px;height:100px;
  border-top-color:var(--a3);border-right-color:transparent;border-bottom-color:var(--a3);
  box-shadow:0 0 10px var(--a3);
  animation:nxl-spin3 .9s linear infinite;
}
@keyframes nxl-spin1{to{transform:rotate(360deg)}}
@keyframes nxl-spin2{to{transform:rotate(-360deg)}}
@keyframes nxl-spin3{to{transform:rotate(360deg)}}

/* icon inside ring */
.nxl-icon {
  width:54px;height:54px;position:relative;z-index:2;
  filter:drop-shadow(0 0 12px var(--a1));
}

/* logo text */
.nxl-logo {
  font-family:'Orbitron',sans-serif;
  font-size:clamp(28px,5vw,48px);
  font-weight:900;
  letter-spacing:.18em;
  color:#fff;
  text-shadow:0 0 30px var(--a1),0 0 60px rgba(0,255,231,.3);
  position:relative;
  animation:nxl-pulse-text 3s ease-in-out infinite;
}
@keyframes nxl-pulse-text{
  0%,100%{text-shadow:0 0 30px var(--a1),0 0 60px rgba(0,255,231,.3)}
  50%{text-shadow:0 0 50px var(--a1),0 0 100px rgba(0,255,231,.5),0 0 140px rgba(0,255,231,.2)}
}

/* glitch layers */
.nxl-logo::before,.nxl-logo::after {
  content:attr(data-text);
  position:absolute;top:0;left:0;width:100%;
}
.nxl-logo::before {
  color:var(--a3);
  animation:nxl-glitch1 4s infinite;
  clip-path:polygon(0 20%,100% 20%,100% 40%,0 40%);
}
.nxl-logo::after {
  color:var(--a2);
  animation:nxl-glitch2 4s infinite;
  clip-path:polygon(0 60%,100% 60%,100% 80%,0 80%);
}
@keyframes nxl-glitch1 {
  0%,90%,100%{transform:none;opacity:0}
  91%{transform:translate(-3px,1px);opacity:.8}
  93%{transform:translate(3px,-1px);opacity:.8}
  95%{transform:translate(-2px,0);opacity:.8}
  97%{transform:none;opacity:0}
}
@keyframes nxl-glitch2 {
  0%,85%,100%{transform:none;opacity:0}
  86%{transform:translate(3px,2px);opacity:.7}
  88%{transform:translate(-3px,-2px);opacity:.7}
  90%{transform:none;opacity:0}
}

/* tagline */
.nxl-tagline {
  font-size:11px;
  letter-spacing:.35em;
  color:rgba(255,255,255,.45);
  margin-top:6px;
  text-transform:uppercase;
}

/* progress bar */
.nxl-progress-wrap {
  margin-top:40px;
  width:min(380px,80vw);
  position:relative;
}
.nxl-progress-track {
  height:2px;background:rgba(255,255,255,.08);
  border-radius:2px;overflow:visible;position:relative;
}
.nxl-progress-fill {
  height:100%;border-radius:2px;
  background:linear-gradient(90deg,var(--a2),var(--a1),var(--a3));
  background-size:200% 100%;
  animation:nxl-grad-move 2s linear infinite;
  box-shadow:0 0 12px var(--a1),0 0 24px rgba(0,255,231,.4);
  transition:width .25s ease;
  position:relative;
}
.nxl-progress-fill::after {
  content:'';position:absolute;right:-1px;top:50%;
  transform:translateY(-50%);
  width:8px;height:8px;border-radius:50%;
  background:var(--a1);
  box-shadow:0 0 12px var(--a1),0 0 24px var(--a1);
}
@keyframes nxl-grad-move{
  0%{background-position:0% 0%}100%{background-position:200% 0%}
}

/* progress label row */
.nxl-progress-labels {
  display:flex;justify-content:space-between;
  margin-top:10px;font-size:10px;letter-spacing:.12em;
}
.nxl-progress-status { color:var(--a1); }
.nxl-progress-pct    { color:rgba(255,255,255,.5); }

/* status log ticker */
.nxl-ticker {
  margin-top:28px;
  width:min(380px,80vw);
  height:72px;overflow:hidden;
  border:1px solid rgba(0,255,231,.12);
  border-radius:4px;
  padding:8px 12px;
  background:rgba(0,255,231,.03);
  position:relative;
}
.nxl-ticker::before {
  content:'';position:absolute;bottom:0;left:0;right:0;height:28px;
  background:linear-gradient(transparent,rgba(0,0,0,.95));
  pointer-events:none;z-index:1;
}
.nxl-log-line {
  font-size:9.5px;line-height:1.7;
  color:rgba(255,255,255,.35);
  transition:color .3s;
}
.nxl-log-line.active { color:var(--a1); }

/* corner decorations */
.nxl-corner {
  position:absolute;width:28px;height:28px;
  border-color:var(--a1);border-style:solid;
  opacity:.5;
}
.nxl-corner-tl{top:24px;left:24px;border-width:2px 0 0 2px;}
.nxl-corner-tr{top:24px;right:24px;border-width:2px 2px 0 0;}
.nxl-corner-bl{bottom:24px;left:24px;border-width:0 0 2px 2px;}
.nxl-corner-br{bottom:24px;right:24px;border-width:0 2px 2px 0;}

/* data readouts */
.nxl-data-row {
  position:absolute;font-size:9px;letter-spacing:.1em;
  color:rgba(0,255,231,.3);font-family:'Share Tech Mono',monospace;
  line-height:1.8;
}
.nxl-data-left  { left:36px;top:50%;transform:translateY(-50%); }
.nxl-data-right { right:36px;top:50%;transform:translateY(-50%);text-align:right; }

/* fade out */
.nxl-fadeout { animation:nxl-bye .7s ease forwards; }
@keyframes nxl-bye { to{opacity:0;transform:scale(1.04)} }
`;

/* ─── status messages ─── */
const LOGS = [
  "Initializing quantum mesh renderer...",
  "Calibrating spatial audio nodes...",
  "Establishing encrypted P2P channels...",
  "Loading adaptive bitrate engine...",
  "Mounting WebRTC peer connectors...",
  "Syncing Firebase auth tokens...",
  "Compiling WASM video codecs...",
  "Activating end-to-end encryption...",
  "Bootstrapping room state machine...",
  "NexMeet is ready.",
];

export default function LoadingScreen({ onComplete }) {
  const canvasRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState([LOGS[0]]);
  const [currentLog, setCurrentLog] = useState(0);
  const [done, setDone] = useState(false);

  /* ── inject CSS once ── */
  useEffect(() => {
    if (document.getElementById("nxl-style")) return;
    const s = document.createElement("style");
    s.id = "nxl-style";
    s.textContent = CSS;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  /* ── Three.js scene ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 22);

    /* ── Aurora background plane with custom shader ── */
    const auroraMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;
        vec3 palette(float t){
          vec3 a=vec3(.05,.0,.12);
          vec3 b=vec3(.04,.04,.1);
          vec3 c=vec3(.3,.15,.4);
          vec3 d=vec3(0.,.33,.67);
          return a+b*cos(6.28318*(c*t+d));
        }
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){
          vec2 i=floor(p);vec2 f=fract(p);
          vec2 u=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),
                     mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);
        }
        void main(){
          vec2 uv=vUv-.5;uv.y*=.6;
          float t=uTime*.18;
          float n=noise(uv*2.+vec2(t,t*.4))
                 +.5*noise(uv*4.-vec2(t*.6,t))
                 +.25*noise(uv*8.+vec2(0.,t*1.3));
          n/=1.75;
          float aurora=smoothstep(.3,.7,n)*smoothstep(1.,.4,abs(uv.y+.1)*4.);
          vec3 col=palette(n+t*.1)*aurora*1.8;
          col+=vec3(.0,.02,.06)*(1.-aurora);
          gl_FragColor=vec4(col,1.);
        }
      `,
      side: THREE.FrontSide,
    });
    const auroraMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 45), auroraMat);
    auroraMesh.position.z = -20;
    scene.add(auroraMesh);

    /* ── DNA Helix particles ── */
    const helixCount = 220;
    const helixGeo = new THREE.BufferGeometry();
    const helixPos = new Float32Array(helixCount * 3);
    const helixCol = new Float32Array(helixCount * 3);
    for (let i = 0; i < helixCount; i++) {
      const t = (i / helixCount) * Math.PI * 8 - Math.PI * 4;
      const strand = i % 2 === 0 ? 1 : -1;
      helixPos[i * 3]     = Math.cos(t) * 4 * strand;
      helixPos[i * 3 + 1] = t * 1.1;
      helixPos[i * 3 + 2] = Math.sin(t) * 4 * strand;
      // color alternates
      const c = new THREE.Color(i % 2 === 0 ? ACCENT : ACCENT2);
      helixCol[i * 3] = c.r; helixCol[i * 3 + 1] = c.g; helixCol[i * 3 + 2] = c.b;
    }
    helixGeo.setAttribute("position", new THREE.BufferAttribute(helixPos, 3));
    helixGeo.setAttribute("color", new THREE.BufferAttribute(helixCol, 3));
    const helixMat = new THREE.PointsMaterial({ size: .22, vertexColors: true, transparent: true, opacity: .85 });
    const helix = new THREE.Points(helixGeo, helixMat);
    scene.add(helix);

    /* ── Neural network nodes ── */
    const nodeCount = 42;
    const nodePositions = Array.from({ length: nodeCount }, () =>
      new THREE.Vector3((Math.random() - .5) * 36, (Math.random() - .5) * 20, (Math.random() - .5) * 10 - 6)
    );
    // node spheres
    const nodeMeshes = nodePositions.map((pos) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: .7 })
      );
      m.position.copy(pos);
      scene.add(m);
      return m;
    });
    // edges
    const edgeGroup = new THREE.Group();
    for (let i = 0; i < nodeCount; i++) {
      for (let j = i + 1; j < nodeCount; j++) {
        if (nodePositions[i].distanceTo(nodePositions[j]) < 8) {
          const geo = new THREE.BufferGeometry().setFromPoints([nodePositions[i], nodePositions[j]]);
          const mat = new THREE.LineBasicMaterial({ color: ACCENT2, transparent: true, opacity: .15 });
          edgeGroup.add(new THREE.Line(geo, mat));
        }
      }
    }
    scene.add(edgeGroup);

    /* ── Floating icosahedron ── */
    const icoGeo = new THREE.IcosahedronGeometry(2.2, 1);
    const icoMat = new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: .18 });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    scene.add(ico);

    /* ── Outer torus ring ── */
    const torusGeo = new THREE.TorusGeometry(8, .04, 8, 120);
    const torusMat = new THREE.MeshBasicMaterial({ color: ACCENT3, transparent: true, opacity: .35 });
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.rotation.x = Math.PI / 2.4;
    scene.add(torus);

    /* ── Starfield ── */
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(3000 * 3);
    for (let i = 0; i < 3000 * 3; i++) starPos[i] = (Math.random() - .5) * 200;
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: .08, color: 0xffffff, transparent: true, opacity: .5 })));

    /* ── Data stream particles ── */
    const streamCount = 80;
    const streamGeo = new THREE.BufferGeometry();
    const streamPos = new Float32Array(streamCount * 3);
    const streamVel = new Float32Array(streamCount);
    for (let i = 0; i < streamCount; i++) {
      streamPos[i * 3]     = (Math.random() - .5) * 30;
      streamPos[i * 3 + 1] = Math.random() * 25 - 12;
      streamPos[i * 3 + 2] = (Math.random() - .5) * 6;
      streamVel[i] = .04 + Math.random() * .12;
    }
    streamGeo.setAttribute("position", new THREE.BufferAttribute(streamPos, 3));
    const streamMat = new THREE.PointsMaterial({ size: .08, color: ACCENT, transparent: true, opacity: .5 });
    const stream = new THREE.Points(streamGeo, streamMat);
    scene.add(stream);

    let frame = 0;
    const animate = () => {
      const id = requestAnimationFrame(animate);
      frame++;
      const t = frame * .01;

      auroraMat.uniforms.uTime.value = t;
      helix.rotation.y = t * .35;
      ico.rotation.x = t * .2;
      ico.rotation.y = t * .3;
      torus.rotation.z = t * .1;
      torus.rotation.y = t * .05;

      // bob nodes
      nodeMeshes.forEach((m, i) => {
        m.position.y = nodePositions[i].y + Math.sin(t + i) * .15;
      });

      // falling data stream
      const sp = streamGeo.attributes.position.array;
      for (let i = 0; i < streamCount; i++) {
        sp[i * 3 + 1] -= streamVel[i];
        if (sp[i * 3 + 1] < -13) sp[i * 3 + 1] = 12;
      }
      streamGeo.attributes.position.needsUpdate = true;

      // camera gentle drift
      camera.position.x = Math.sin(t * .12) * 1.5;
      camera.position.y = Math.cos(t * .08) * .8;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      return id;
    };
    const animId = animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  /* ── Progress simulation ── */
  useEffect(() => {
    let pct = 0;
    let logIdx = 0;
    const iv = setInterval(() => {
      pct += Math.random() * 3.5 + 1.2;
      if (pct > 100) pct = 100;
      setProgress(Math.floor(pct));

      const newIdx = Math.min(Math.floor((pct / 100) * LOGS.length), LOGS.length - 1);
      if (newIdx !== logIdx) {
        logIdx = newIdx;
        setCurrentLog(newIdx);
        setLogLines((prev) => [...prev.slice(-4), LOGS[newIdx]]);
      }

      if (pct >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          setDone(true);
          setTimeout(() => onComplete?.(), 700);
        }, 600);
      }
    }, 120);
    return () => clearInterval(iv);
  }, [onComplete]);

  /* random data readout values */
  const [dataVals, setDataVals] = useState({ lat: "28.6139", lng: "77.2090", enc: "AES-256", fps: "60", ping: "12ms", nodes: "7" });
  useEffect(() => {
    const iv = setInterval(() => {
      setDataVals({
        lat: (28 + Math.random() * .01).toFixed(4),
        lng: (77 + Math.random() * .01).toFixed(4),
        enc: "AES-256-GCM",
        fps: String(55 + Math.floor(Math.random() * 8)),
        ping: `${8 + Math.floor(Math.random() * 10)}ms`,
        nodes: String(4 + Math.floor(Math.random() * 6)),
      });
    }, 900);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      className={`nxl-root${done ? " nxl-fadeout" : ""}`}
      style={{ "--a1": ACCENT, "--a2": ACCENT2, "--a3": ACCENT3 }}
    >
      <canvas ref={canvasRef} className="nxl-canvas" />
      <div className="nxl-scanlines" />
      <div className="nxl-vignette" />

      {/* corner brackets */}
      <div className="nxl-corner nxl-corner-tl" />
      <div className="nxl-corner nxl-corner-tr" />
      <div className="nxl-corner nxl-corner-bl" />
      <div className="nxl-corner nxl-corner-br" />

      {/* side data readouts */}
      <div className="nxl-data-row nxl-data-left">
        <div>LAT  {dataVals.lat}°N</div>
        <div>LNG  {dataVals.lng}°E</div>
        <div>ENC  {dataVals.enc}</div>
        <div>FPS  {dataVals.fps}</div>
        <div>PING {dataVals.ping}</div>
        <div>NODES {dataVals.nodes}</div>
      </div>
      <div className="nxl-data-row nxl-data-right">
        <div>BUILD  v2.0.34</div>
        <div>ENV    PROD</div>
        <div>CODEC  VP9/H264</div>
        <div>P2P    ACTIVE</div>
        <div>ICE    READY</div>
        <div>WS     SECURE</div>
      </div>

      {/* main UI */}
      <div className="nxl-ui">
        {/* holographic rings */}
        <div className="nxl-ring-wrap">
          <div className="nxl-ring nxl-ring-1" />
          <div className="nxl-ring nxl-ring-2" />
          <div className="nxl-ring nxl-ring-3" />
          {/* camera icon */}
          <svg className="nxl-icon" viewBox="0 0 54 54" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="27" cy="27" r="26" stroke={ACCENT} strokeWidth="1.5" opacity=".3"/>
            <rect x="8" y="16" width="28" height="22" rx="4" stroke={ACCENT} strokeWidth="2"/>
            <path d="M36 21l10-5v22l-10-5V21z" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round"/>
            <circle cx="22" cy="27" r="5" stroke={ACCENT} strokeWidth="2"/>
            <circle cx="22" cy="27" r="2" fill={ACCENT}/>
          </svg>
        </div>

        {/* logo */}
        <div className="nxl-logo" data-text="NEXMEET">NEXMEET</div>
        <div className="nxl-tagline">Next generation video conferencing</div>

        {/* progress */}
        <div className="nxl-progress-wrap">
          <div className="nxl-progress-track">
            <div className="nxl-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="nxl-progress-labels">
            <span className="nxl-progress-status">{LOGS[currentLog]}</span>
            <span className="nxl-progress-pct">{progress}%</span>
          </div>
        </div>

        {/* log ticker */}
        <div className="nxl-ticker">
          {logLines.map((line, i) => (
            <div key={i} className={`nxl-log-line${i === logLines.length - 1 ? " active" : ""}`}>
              &gt; {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}