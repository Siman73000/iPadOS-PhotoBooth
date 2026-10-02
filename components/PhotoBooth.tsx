"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

type Mode = "single" | "strip";
type Screen = "home" | "choose" | "camera" | "review" | "qr" | "error";

type SavedPhoto = {
  id: string;
  downloadUrl: string;
};

const DEFAULT_SHOTS = 3;
const COUNTDOWN_SECONDS = 3;

function getAbsoluteUrl(path: string) {
  return `${window.location.origin}${path}`;
}

function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9) {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Could not create JPEG.");
  return blob;
}

async function compressCanvas(canvas: HTMLCanvasElement) {
  let quality = 0.9;
  let blob = await canvasToJpeg(canvas, quality);

  while (blob.size > 4_000_000 && quality > 0.58) {
    quality -= 0.06;
    blob = await canvasToJpeg(canvas, quality);
  }

  return blob;
}

export default function PhotoBooth() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureLockRef = useRef(false);

  const [screen, setScreen] = useState<Screen>("home");
  const [mode, setMode] = useState<Mode>("single");
  const [shotCount, setShotCount] = useState(DEFAULT_SHOTS);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savedPhoto, setSavedPhoto] = useState<SavedPhoto | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const openCamera = useCallback(async () => {
    setCameraError(null);
    setScreen("camera");

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
      } catch (firstError) {
        console.warn("Rear camera exact constraint failed; retrying with preferred environment camera.", firstError);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      console.error(error);
      setCameraError("Camera access is unavailable. Please make sure Safari has permission to use the iPad camera, then try again.");
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTracks(streamRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const resetToHome = useCallback(() => {
    stopTracks(streamRef.current);
    streamRef.current = null;
    setCountdown(null);
    setSavedPhoto(null);
    setMessage(null);
    setCameraError(null);
    setScreen("home");
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }, [previewUrl]);

  const makeSinglePhotoCanvas = useCallback(() => {
    const video = videoRef.current;
    if (!video) throw new Error("Camera is not ready.");

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const targetWidth = 1600;
    const targetHeight = Math.round((sourceHeight / sourceWidth) * targetWidth);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
    return canvas;
  }, []);

  const takeFrame = useCallback(() => makeSinglePhotoCanvas(), [makeSinglePhotoCanvas]);

  const takePhotoSequence = useCallback(async () => {
    if (captureLockRef.current) return;
    captureLockRef.current = true;
    setMessage(null);

    try {
      const canvases: HTMLCanvasElement[] = [];

      for (let shot = 0; shot < (mode === "single" ? 1 : shotCount); shot++) {
        for (let tick = COUNTDOWN_SECONDS; tick >= 1; tick--) {
          setCountdown(tick);
          await new Promise((resolve) => setTimeout(resolve, 900));
        }
        setCountdown(null);
        setFlash(true);
        canvases.push(takeFrame());
        await new Promise((resolve) => setTimeout(resolve, 350));
        setFlash(false);
        if (mode === "strip" && shot < shotCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (canvases.length === 1) {
        const blob = await compressCanvas(canvases[0]);
        const localUrl = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(localUrl);
        setScreen("review");
      } else {
        const strip = buildPhotoStrip(canvases);
        const blob = await compressCanvas(strip);
        const localUrl = URL.createObjectURL(blob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(localUrl);
        setScreen("review");
      }
    } catch (error) {
      console.error(error);
      setCameraError("Something went wrong while taking the photo. Please try again.");
      setScreen("error");
    } finally {
      setCountdown(null);
      setFlash(false);
      captureLockRef.current = false;
    }
  }, [mode, previewUrl, shotCount, takeFrame]);

  const buildPhotoStrip = (frames: HTMLCanvasElement[]) => {
    const width = 1200;
    const gap = 22;
    const side = 42;
    const top = 48;
    const bottom = 170;
    const usableWidth = width - side * 2;
    const frameRatio = frames[0].height / frames[0].width;
    const frameHeight = Math.round(usableWidth * frameRatio);
    const height = top + frames.length * frameHeight + (frames.length - 1) * gap + bottom;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    frames.forEach((frame, index) => {
      const y = top + index * (frameHeight + gap);
      ctx.drawImage(frame, side, y, usableWidth, frameHeight);
    });

    ctx.fillStyle = "#173d6b";
    ctx.textAlign = "center";
    ctx.font = "700 36px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText("OUR WEDDING", width / 2, height - 105);
    ctx.fillStyle = "#6b7d96";
    ctx.font = "500 24px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
    ctx.fillText(new Date().toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }), width / 2, height - 66);

    return canvas;
  };

  const uploadPhoto = useCallback(async () => {
    if (!previewUrl) throw new Error("No photo ready.");
    setMessage("Saving your photo…");

    const response = await fetch(previewUrl);
    const blob = await response.blob();
    const image = new Image();
    const imageLoaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not inspect photo."));
    });
    image.src = previewUrl;
    await imageLoaded;

    const upload = await fetch("/api/photos", {
      method: "POST",
      headers: {
        "Content-Type": "image/jpeg",
        "X-Photo-Metadata": JSON.stringify({ width: image.naturalWidth, height: image.naturalHeight, kind: mode }),
      },
      body: blob,
    });

    const data = await upload.json();
    if (!upload.ok) throw new Error(data.error ?? "Could not save photo.");

    setSavedPhoto({ id: data.id, downloadUrl: data.downloadUrl });
    setMessage(null);
    stopTracks(streamRef.current);
    streamRef.current = null;
    setScreen("qr");
  }, [mode, previewUrl]);

  const start = async (selectedMode: Mode) => {
    setMode(selectedMode);
    setScreen("choose");
  };

  useEffect(() => {
    if (screen !== "choose") return;
    void openCamera();
  }, [openCamera, screen]);

  useEffect(() => {
    if (screen !== "qr") return;
    const timer = window.setTimeout(() => resetToHome(), 30000);
    return () => window.clearTimeout(timer);
  }, [resetToHome, screen]);

  return (
    <main className="booth-shell">
      {screen === "home" && (
        <section className="screen welcome-screen">
          <div className="brand-mark"><span className="brand-mark-dot" /> Wedding Photo Booth</div>
          <h1 className="welcome-title">Capture the moment.<br />Keep it forever.</h1>
          <p className="welcome-subtitle">Tap below to take a photo and share it to your phone.</p>
          <button className="primary-button" onClick={() => start("single")}>TAKE A PHOTO</button>
          <button className="secondary-button" style={{ marginTop: 14 }} onClick={() => start("strip")}>PHOTO STRIP</button>
        </section>
      )}

      {screen === "choose" && (
        <section className="screen camera-screen">
          <div className="loading"><div className="spinner" /><h2>Starting the camera…</h2><p style={{ color: "var(--muted)" }}>Safari may ask for camera permission.</p></div>
        </section>
      )}

      {screen === "camera" && (
        <section className="screen camera-screen">
          <div className="camera-wrap">
            <video ref={videoRef} className="camera-video" playsInline muted autoPlay />
            <div className="camera-top"><span className="camera-hint">Stand where everyone can see you</span><span className="camera-badge">Rear camera</span></div>
            {countdown !== null && <div className="countdown">{countdown}</div>}
            {flash && <div className="shutter-flash" />}
          </div>
          <div className="camera-footer">
            <button className="shoot-button" onClick={() => void takePhotoSequence()} disabled={countdown !== null}>{mode === "strip" ? `START ${shotCount}-PHOTO STRIP` : "TAKE PHOTO"}</button>
          </div>
        </section>
      )}

      {screen === "review" && previewUrl && (
        <section className="screen review-screen">
          <div className="review-card">
            <img className="review-image" src={previewUrl} alt="Your wedding photo preview" />
            <h2 className="review-title">Looks good?</h2>
            <p className="review-copy">Keep it to get a QR code you can scan with your phone.</p>
            <div className="action-row">
              <button className="secondary-button" onClick={() => { setScreen("camera"); void openCamera(); }}>RETAKE</button>
              <button className="primary-button" style={{ minWidth: 0, marginTop: 0, minHeight: 66, borderRadius: 22, fontSize: 20 }} onClick={() => void uploadPhoto()}>KEEP &amp; GET QR CODE</button>
            </div>
            {message && <p style={{ marginTop: 16, color: "var(--muted)", textAlign: "center" }}>{message}</p>}
          </div>
        </section>
      )}

      {screen === "qr" && savedPhoto && (
        <section className="screen qr-screen">
          <div className="qr-card">
            <h2 className="qr-title">Your photo is ready!</h2>
            <p className="qr-copy">Scan this QR code with your phone to view and download your photo.</p>
            <div className="qr-frame"><QRCodeSVG value={getAbsoluteUrl(savedPhoto.downloadUrl)} size={320} level="M" includeMargin fgColor="#102c50" bgColor="#ffffff" /></div>
            <p className="qr-note">You can hold your phone camera over the code. No app required.</p>
            <p className="auto-return">Returning to the welcome screen automatically…</p>
          </div>
        </section>
      )}

      {screen === "error" && (
        <section className="screen welcome-screen">
          <div className="error-card">
            <h2>Let's try that again.</h2>
            <p>{cameraError ?? "The photo booth ran into a temporary problem."}</p>
            <button className="primary-button" style={{ minWidth: 0, width: "100%", marginTop: 24 }} onClick={resetToHome}>BACK TO START</button>
          </div>
        </section>
      )}
    </main>
  );
}
