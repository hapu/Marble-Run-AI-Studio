import React, { useCallback, useEffect, useState } from 'react';

export function useViewportAspect(
  stageWrapperRef: React.RefObject<HTMLDivElement | null>,
  canvasContainerRef: React.RefObject<HTMLDivElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const updateAspect = useCallback(() => {
    if (!stageWrapperRef.current || !canvasContainerRef.current || !canvasRef.current) return;
    const containerW = stageWrapperRef.current.clientWidth;
    const containerH = stageWrapperRef.current.clientHeight;
    if (containerW <= 0 || containerH <= 0) return;

    const portrait = containerW < containerH;
    const targetRatio = portrait ? 9 / 16 : 16 / 9;
    const virtualW = portrait ? 720 : 1280;
    const virtualH = portrait ? 1280 : 720;

    let finalW: number;
    let finalH: number;
    if (containerW / containerH > targetRatio) {
      finalH = containerH;
      finalW = finalH * targetRatio;
    } else {
      finalW = containerW;
      finalH = finalW / targetRatio;
    }

    canvasContainerRef.current.style.width = `${Math.floor(finalW)}px`;
    canvasContainerRef.current.style.height = `${Math.floor(finalH)}px`;
    canvasRef.current.width = virtualW;
    canvasRef.current.height = virtualH;
  }, [stageWrapperRef, canvasContainerRef, canvasRef]);

  const toggleFullscreen = useCallback(() => {
    if (!stageWrapperRef.current) return;
    if (!document.fullscreenElement) {
      stageWrapperRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, [stageWrapperRef]);

  useEffect(() => {
    window.addEventListener('resize', updateAspect);
    updateAspect();
    return () => window.removeEventListener('resize', updateAspect);
  }, [updateAspect]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  return { isFullscreen, toggleFullscreen, updateAspect };
}
