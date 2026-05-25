// src/components/LoadingScreen.jsx
// Optimized:
//   1. three.js still lazy loaded (no bundle impact)
//   2. Minimum display time reduced from ~4s to 1.8s max
//   3. Progress runs faster so animation completes quicker
//   4. WebGL scene simplified (fewer objects = less GPU)
//   5. Tab visibility pause retained

import { useEffect, useRef, useState } from "react";

const ACCENT  = "#00ffe7";
const ACCENT2 = "#7f5af0";
const ACCENT3 = "#ff2d78";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@900&family=Share+Tech+Mono&display=swap');

.nxl-root {
  position:fixed;inset:0;z-index:99999;
  background:#000;overflow:hidden;
  font-family:'Share Tech Mono',monospace;
}
.nxl-canvas { position:absolute;inset:0;width:100%;height:100%; }
.nxl-scanlines {
  position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(
    0deg,transparent,transparent 2px,rgba(0,0,0,.18) 2px,rgba(0,0,0,.18) 4px
  );
}
.nxl-vignette {
  position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at center,transparent 40%,rgba(0,0,0,.85) 100%);
}
.nxl-ui {
  position:absolute;inset:0;display:flex;flex-direction:column;
  align-items:center;justify-content:center;
  pointer-events:none;
}
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
  box-shadow:0 0 14px var(--a2);
  animation:nxl-spin2 1.4s linear infinite;
}
.nxl-ring-3 {
  width:100px;height:100px;
  border-top-color:var(--a3);border-bottom-color:var(--a3);
  box-shadow:0 0 10px var(--a3);
  animation:nxl-spin3 .9s linear infinite;
}
@keyframes nxl-spin1{to{transform:rotate(360deg)}}
@keyframes nxl-spin2{to{transform:rotate(-360deg)}}
@keyframes nxl-spin3{to{transform:rotate(360deg)}}
.nxl-icon {
  width:54px;height:54px;position:relative;z-index:2;
  filter:drop-shadow(0 0 12px var(--a1));
}
.nxl-logo {
  font-family:'Orbitron',sans-serif;
  font-size:clamp(28px,5vw,48px);font-weight:900;
  letter-spacing:.18em;color:#fff;
  text-shadow:0 0 30px var(--a1),0 0 60px rgba(0,255,231,.3);
  animation:nxl-pulse-text 3s ease-in-out infinite;
}
@keyframes nxl-pulse-text{
  0%,100%{text-shadow:0 0 30px var(--a1),0 0 60px rgba(0,255,231,.3)}
  50%{text-shadow:0 0 50px var(--a1),0 0 100px rgba(0,255,231,.5)}
}
.nxl-tagline {
  font-size:11px;letter-spacing:.35em;
  color:rgba(255,255,255,.45);margin-top:6px;text-transform:uppercase;
}
.nxl-progress-wrap {
  margin-top:40px;width:min(380px,80vw);
}
.nxl-progress-track {
  height:2px;background:rgba(255,255,255,.08);border-radius:2px;overflow:visible;
}
.nxl-progress-fill {
  height:100%;border-radius:2px;
  background:linear-gradient(90deg,var(--a2),var(--a1),var(--a3));
  background-size:200% 100%;
  animation:nxl-grad-move 2s linear infinite;
  box-shadow:0 0 12px var(--a1),0 0 24px rgba(0,255,231,.4);
  transition:width .18s ease;
  position:relative;
}
.nxl-progress-fill::after {
  content:'';position:absolute;right:-1px;top:50%;
  transform:translateY(-50%);
  width:8px;height:8px;border-radius:50%;
  background:var(--a1);box-shadow:0 0 12px var(--a1);
}
@keyframes nxl-grad-move{0%{background-position:0%}100%{background-position:200%}}
.nxl-progress-labels {
  display:flex;justify-content:space-between;
  margin-top:10px;font-size:10px;letter-spacing:.12em;
}
.nxl-progress-status{color:var(--a1);}
.nxl-progress-pct{color:rgba(255,255,255,.5);}
.nxl-ticker {
  margin-top:28px;width:min(380px,80vw);height:72px;overflow:hidden;
  border:1px solid rgba(0,255,231,.12);border-radius:4px;
  padding:8px 12px;background:rgba(0,255,231,.03);position:relative;
}
.nxl-ticker::before {
  content:'';position:absolute;bottom:0;left:0;right:0;height:28px;
  background:linear-gradient(transparent,rgba(0,0,0,.95));
  pointer-events:none;z-index:1;
}
.nxl-log-line{font-size:9.5px;line-height:1.7;color:rgba(255,255,255,.35);}
.nxl-log-line.active{color:var(--a1);}
.nxl-corner{position:absolute;width:28px;height:28px;border-color:var(--a1);border-style:solid;opacity:.5;}
.nxl-corner-tl{top:24px;left:24px;border-width:2px 0 0 2px;}
.nxl-corner-tr{top:24px;right:24px;border-width:2px 2px 0 0;}
.nxl-corner-bl{bottom:24px;left:24px;border-width:0 0 2px 2px;}
.nxl-corner-br{bottom:24px;right:24px;border-width:0 2px 2px 0;}
.nxl-fadeout{animation:nxl-bye .6s ease forwards;}
@keyframes nxl-bye{to{opacity:0;transform:scale(1.03)}}
`;

const LOGS = [
  "Initializing secure connection...",
  "Calibrating audio nodes...",
  "Establishing P2P channels...",
  "Loading bitrate engine...",
  "Activating encryption...",
  "NexMeet is ready.",
];

export default function LoadingScreen({ onComplete }) {
  const canvasRef               = useRef(null);
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState([LOGS[0]]);
  const [currentLog, setCurrentLog] = useState(0);
  const [done, setDone]         = useState(false);

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById("nxl-style")) return;
    const s = document.createElement("style");
    s.id = "nxl-style"; s.textContent = CSS;
    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // Lazy load three.js — simplified scene (fewer objects)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let animId;
    let renderer;

    import("three").then((THREE) => {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
      renderer.setPixelRatio(1);
      renderer.setSize(window.innerWidth, window.innerHeight);

      const scene  = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 500);
      camera.position.set(0, 0, 22);

      // ── Simplified: just aurora + floating icosahedron + starfield ──
      // (removed DNA helix and torus to reduce GPU load)

      const auroraMat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
          uniform float uTime;varying vec2 vUv;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
          void main(){
            vec2 uv=vUv-.5;float t=uTime*.18;
            float n=(noise(uv*2.+vec2(t,t*.4))+.5*noise(uv*4.-vec2(t*.6,t)))/1.5;
            float aurora=smoothstep(.3,.7,n)*smoothstep(1.,.4,abs(uv.y+.1)*4.);
            vec3 col=mix(vec3(.05,0.,.12),vec3(.1,.04,.3),n)*aurora*1.8+vec3(0.,.02,.06)*(1.-aurora);
            gl_FragColor=vec4(col,1.);
          }`,
        side: THREE.FrontSide,
      });
      scene.add(new THREE.Mesh(new THREE.PlaneGeometry(80, 45), auroraMat));

      // Icosahedron wireframe
      const ico = new THREE.Mesh(
        new THREE.IcosahedronGeometry(2.2, 1),
        new THREE.MeshBasicMaterial({ color: ACCENT, wireframe: true, transparent: true, opacity: .18 })
      );
      scene.add(ico);

      // Reduced starfield (400 instead of 800)
      const starPos = new Float32Array(400 * 3);
      for (let i = 0; i < 400 * 3; i++) starPos[i] = (Math.random() - .5) * 200;
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: .1, color: 0xffffff, transparent: true, opacity: .5 })));

      let frame = 0;
      const animate = () => {
        animId = requestAnimationFrame(animate);
        const t = (frame++) * .01;
        auroraMat.uniforms.uTime.value = t;
        ico.rotation.x = t * .2;
        ico.rotation.y = t * .3;
        renderer.render(scene, camera);
      };
      animate();

      const onResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", onResize);
      return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener("resize", onResize);
        auroraMat.dispose(); starGeo.dispose(); renderer.dispose();
      };
    });

    return () => { cancelAnimationFrame(animId); renderer?.dispose(); };
  }, []);

  // ── Progress: faster (max ~1.8s instead of ~4s) ──
  useEffect(() => {
    let pct = 0, logIdx = 0;
    const iv = setInterval(() => {
      // Bigger increments = finishes faster
      pct += Math.random() * 8 + 5;
      if (pct > 100) pct = 100;
      setProgress(Math.floor(pct));

      const newIdx = Math.min(Math.floor((pct / 100) * LOGS.length), LOGS.length - 1);
      if (newIdx !== logIdx) {
        logIdx = newIdx;
        setCurrentLog(newIdx);
        setLogLines(prev => [...prev.slice(-4), LOGS[newIdx]]);
      }

      if (pct >= 100) {
        clearInterval(iv);
        setTimeout(() => {
          setDone(true);
          setTimeout(() => onComplete?.(), 600);
        }, 300); // reduced from 600ms
      }
    }, 100); // reduced from 120ms
    return () => clearInterval(iv);
  }, [onComplete]);

  // Data ticker with tab visibility pause
  const [dataVals, setDataVals] = useState({ ping: "12ms", nodes: "7", enc: "AES-256-GCM" });
  useEffect(() => {
    const tick = () => setDataVals({
      ping:  `${8 + Math.floor(Math.random() * 10)}ms`,
      nodes: String(4 + Math.floor(Math.random() * 6)),
      enc:   "AES-256-GCM",
    });
    let iv = setInterval(tick, 900);
    const onVis = () => { if (document.hidden) clearInterval(iv); else iv = setInterval(tick, 900); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return (
    <div className={`nxl-root${done ? " nxl-fadeout" : ""}`}
      style={{ "--a1": ACCENT, "--a2": ACCENT2, "--a3": ACCENT3 }}>
      <canvas ref={canvasRef} className="nxl-canvas" />
      <div className="nxl-scanlines" />
      <div className="nxl-vignette" />
      <div className="nxl-corner nxl-corner-tl" />
      <div className="nxl-corner nxl-corner-tr" />
      <div className="nxl-corner nxl-corner-bl" />
      <div className="nxl-corner nxl-corner-br" />

      <div className="nxl-ui">
        <div className="nxl-ring-wrap">
          <div className="nxl-ring nxl-ring-1" />
          <div className="nxl-ring nxl-ring-2" />
          <div className="nxl-ring nxl-ring-3" />
          <svg className="nxl-icon" viewBox="0 0 54 54" fill="none">
            <circle cx="27" cy="27" r="26" stroke={ACCENT} strokeWidth="1.5" opacity=".3"/>
            <rect x="8" y="16" width="28" height="22" rx="4" stroke={ACCENT} strokeWidth="2"/>
            <path d="M36 21l10-5v22l-10-5V21z" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round"/>
            <circle cx="22" cy="27" r="5" stroke={ACCENT} strokeWidth="2"/>
            <circle cx="22" cy="27" r="2" fill={ACCENT}/>
          </svg>
        </div>

        <div className="nxl-logo">NEXMEET</div>
        <div className="nxl-tagline">Next generation video conferencing</div>

        <div className="nxl-progress-wrap">
          <div className="nxl-progress-track">
            <div className="nxl-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="nxl-progress-labels">
            <span className="nxl-progress-status">{LOGS[currentLog]}</span>
            <span className="nxl-progress-pct">{progress}%</span>
          </div>
        </div>

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