"use client";
import { RefObject } from "react";
import htmlToImage from "html-to-image";

export function PlotExportButton({ targetRef, label, filenameBase }: { targetRef: RefObject<HTMLElement>; label: string; filenameBase: string }) {
  const handle = async () => {
    if (!targetRef.current) return;
    const dataUrl = await htmlToImage.toPng(targetRef.current, { backgroundColor: "white", pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filenameBase}.png`;
    a.click();
  };
  return <button className="ghost-button" type="button" onClick={handle}>{label}</button>;
}
