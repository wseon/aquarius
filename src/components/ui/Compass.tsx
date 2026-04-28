"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// 전역 refs (ThreeMapView에서 업데이트)
export const compassCameraRef = { current: null as THREE.Camera | null };
export const compassResetRef = { current: () => {} };

export default function Compass() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const size = 100;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 4.5);
    camera.lookAt(0, 0, 0);

    // 조명
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 4);
    scene.add(dirLight);

    // 나침반 그룹
    const compassGroup = new THREE.Group();

    // 원판 (베이스)
    const discGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.08, 48);
    const discMat = new THREE.MeshPhongMaterial({
      color: 0x1a2540,
      transparent: true,
      opacity: 0.85,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    compassGroup.add(disc);

    // 외곽 링
    const ringGeo = new THREE.TorusGeometry(1.2, 0.04, 8, 48);
    const ringMat = new THREE.MeshPhongMaterial({ color: 0x6688aa });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    compassGroup.add(ring);

    // 눈금선 (30도 간격)
    for (let deg = 0; deg < 360; deg += 30) {
      const rad = (deg * Math.PI) / 180;
      const isMajor = deg % 90 === 0;
      const inner = isMajor ? 0.85 : 0.95;
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.sin(rad) * inner, 0.05, -Math.cos(rad) * inner),
        new THREE.Vector3(Math.sin(rad) * 1.15, 0.05, -Math.cos(rad) * 1.15),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: isMajor ? 0x8899bb : 0x556677,
      });
      compassGroup.add(new THREE.Line(lineGeo, lineMat));
    }

    // N 화살표 (빨강)
    const nArrowShape = new THREE.Shape();
    nArrowShape.moveTo(0, 0);
    nArrowShape.lineTo(-0.12, -0.5);
    nArrowShape.lineTo(0, -0.38);
    nArrowShape.lineTo(0.12, -0.5);
    nArrowShape.closePath();
    const nArrowGeo = new THREE.ExtrudeGeometry(nArrowShape, { depth: 0.03, bevelEnabled: false });
    const nArrowMat = new THREE.MeshPhongMaterial({ color: 0xef4444, depthTest: false });
    const nArrow = new THREE.Mesh(nArrowGeo, nArrowMat);
    nArrow.renderOrder = 998;
    nArrow.rotation.x = -Math.PI / 2;
    nArrow.position.set(0, 0.10, -0.55);
    compassGroup.add(nArrow);

    // S 화살표 (흰색)
    const sArrowShape = new THREE.Shape();
    sArrowShape.moveTo(0, 0);
    sArrowShape.lineTo(-0.10, 0.45);
    sArrowShape.lineTo(0, 0.33);
    sArrowShape.lineTo(0.10, 0.45);
    sArrowShape.closePath();
    const sArrowGeo = new THREE.ExtrudeGeometry(sArrowShape, { depth: 0.03, bevelEnabled: false });
    const sArrowMat = new THREE.MeshPhongMaterial({ color: 0x99aabb, depthTest: false });
    const sArrow = new THREE.Mesh(sArrowGeo, sArrowMat);
    sArrow.renderOrder = 998;
    sArrow.rotation.x = -Math.PI / 2;
    sArrow.position.set(0, 0.10, 0.55);
    compassGroup.add(sArrow);

    // 방위 텍스트 스프라이트
    function makeLabel(text: string, color: string, x: number, z: number) {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;
      ctx.font = "bold 40px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = color;
      ctx.fillText(text, 32, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthTest: false });
      const geo = new THREE.PlaneGeometry(0.35, 0.35);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 999;
      mesh.position.set(x, 0.15, z);
      mesh.rotation.x = -Math.PI / 2;
      return mesh;
    }

    compassGroup.add(makeLabel("N", "#ef4444", 0, -0.82));
    compassGroup.add(makeLabel("S", "#8899aa", 0, 0.82));
    compassGroup.add(makeLabel("E", "#8899aa", 0.82, 0));
    compassGroup.add(makeLabel("W", "#8899aa", -0.82, 0));

    scene.add(compassGroup);

    // 애니메이션
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // 메인 카메라의 회전을 나침반에 반영
      const mainCam = compassCameraRef.current;
      if (mainCam) {
        // 카메라의 역방향 회전을 나침반에 적용
        const q = mainCam.quaternion.clone().invert();
        compassGroup.quaternion.copy(q);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="absolute bottom-20 left-4 z-10">
      <div
        ref={mountRef}
        style={{ width: 100, height: 100, cursor: "pointer", position: "relative" }}
      />
      {/* 중앙 리셋 버튼 */}
      <button
        onClick={() => compassResetRef.current()}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "rgba(100, 140, 180, 0.6)",
          border: "1.5px solid rgba(150, 180, 210, 0.8)",
          cursor: "pointer",
          padding: 0,
          zIndex: 1,
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = "rgba(130, 170, 210, 0.9)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = "rgba(100, 140, 180, 0.6)";
        }}
        title="초기 뷰포인트로 이동"
      />
    </div>
  );
}
