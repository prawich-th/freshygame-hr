"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Crop, RotateCcw, RotateCw } from "lucide-react";

type CropArea = {x: number; y: number; width: number; height: number};

export function RotatableDocumentPreview({label, url, disabled, onSave, clearsSignature = false}: {
  label: string; url: string; disabled: boolean;
  onSave: (file: File) => Promise<void>;
  clearsSignature?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const dragStart = useRef<{x: number; y: number; pointerId: number} | null>(null);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [turns, setTurns] = useState(0);
  const [crop, setCrop] = useState<CropArea | null>(null);
  const [cropping, setCropping] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    void (async () => {
      try {
        const response = await fetch(url, {signal:controller.signal});
        if (!response.ok) throw new Error("Could not load image");
        objectUrl = URL.createObjectURL(await response.blob());
        const image = new Image(); image.src = objectUrl; await image.decode();
        if (!controller.signal.aborted) setSource(image);
      } catch { if (!controller.signal.aborted) setError("Could not load this image. Close and reopen the record to retry."); }
      finally { if (objectUrl) URL.revokeObjectURL(objectUrl); }
    })();
    return () => controller.abort();
  }, [url]);
  useEffect(() => {
    const element = canvas.current;
    if (!source || !element) return;
    const scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
    const width = Math.round(source.naturalWidth * scale), height = Math.round(source.naturalHeight * scale);
    element.width = turns % 2 ? height : width; element.height = turns % 2 ? width : height;
    const context = element.getContext("2d");
    if (!context) return;
    context.fillStyle = "white"; context.fillRect(0, 0, element.width, element.height);
    context.translate(element.width / 2, element.height / 2);
    context.rotate(turns * Math.PI / 2);
    context.drawImage(source, -width / 2, -height / 2, width, height);
  }, [source, turns]);
  const locked = disabled || saving || !source;
  const dirty = turns !== 0 || crop !== null;
  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {x:Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(event.clientY-bounds.top)/bounds.height))};
  }
  function selectCrop(event: PointerEvent<HTMLCanvasElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId || locked) return;
    const end = point(event);
    setCrop({x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)});
  }
  async function save() {
    const current = canvas.current;
    if (!current) return;
    if (crop && (crop.width * current.width < 20 || crop.height * current.height < 20)) {setError("Select a larger crop (at least 20 × 20 pixels).");return;}
    setSaving(true); setError("");
    try {
      const output = document.createElement("canvas");
      const selected = crop ?? {x:0,y:0,width:1,height:1};
      const x = Math.round(selected.x * current.width), y = Math.round(selected.y * current.height);
      output.width = Math.max(1,Math.min(current.width-x,Math.round(selected.width * current.width)));
      output.height = Math.max(1,Math.min(current.height-y,Math.round(selected.height * current.height)));
      const context = output.getContext("2d");
      if (!context) throw new Error("Image editing unavailable");
      context.drawImage(current,x,y,output.width,output.height,0,0,output.width,output.height);
      const blob = await new Promise<Blob>((resolve,reject) => output.toBlob(value => value ? resolve(value) : reject(new Error("Could not process image")),"image/png"));
      await onSave(new File([blob],"edited-image.png",{type:"image/png"}));
      setTurns(0);setCrop(null);setCropping(false);
    } catch { setError("Could not save image changes. Please try again."); }
    finally { setSaving(false); }
  }
  return <div className="document-preview image-editor">
    <small>{label}</small>
    <div className="image-editor__stage">
      <canvas ref={canvas} aria-label={`${label} preview. ${cropping ? "Drag to select a crop." : "Use rotation or crop controls to edit."}`} style={{display:"block",width:"100%",height:"auto",touchAction:cropping?"none":"auto",cursor:cropping?"crosshair":"default"}}
        onPointerDown={event => {if (locked || !cropping || dragStart.current) return;dragStart.current={...point(event),pointerId:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);setCrop(null);setError("");}}
        onPointerMove={selectCrop} onPointerUp={event=>{selectCrop(event);dragStart.current=null;}} onPointerCancel={()=>{dragStart.current=null;setCrop(null);}}/>
      {crop && <span className="image-editor__crop" style={{left:`${crop.x*100}%`,top:`${crop.y*100}%`,width:`${crop.width*100}%`,height:`${crop.height*100}%`}}/>}
    </div>
    <div className="image-editor__controls">
      <button type="button" className="button button--soft" disabled={locked} aria-label={`Rotate ${label} left`} onClick={()=>{setTurns(current=>(current+3)%4);setCrop(null);}}><RotateCcw size={16}/> Left</button>
      <button type="button" className="button button--soft" disabled={locked} aria-label={`Rotate ${label} right`} onClick={()=>{setTurns(current=>(current+1)%4);setCrop(null);}}><RotateCw size={16}/> Right</button>
      <button type="button" className="button button--soft" disabled={locked} aria-pressed={cropping} onClick={()=>setCropping(current=>!current)}><Crop size={16}/> Crop</button>
      {crop && <button type="button" className="button button--ghost" disabled={locked} onClick={()=>setCrop(null)}>Reset crop</button>}
      {dirty && <><button type="button" className="button button--primary" disabled={locked} onClick={()=>void save()}>{saving?"Saving…":"Save changes"}</button><button type="button" className="button button--ghost" disabled={locked} onClick={()=>{setTurns(0);setCrop(null);setCropping(false);setError("");}}>Cancel</button></>}
    </div>
    {cropping && <p className="image-editor__hint">Drag over the image to keep only the selected area. Keep all ID details visible. Rotating resets the crop.</p>}
    {dirty && <p className="image-editor__hint">Changes are not saved yet. {clearsSignature && "Saving this ID image clears the saved signature; the participant must sign again."}</p>}
    {error && <p role="alert" className="notice notice--error">{error}</p>}
  </div>;
}
