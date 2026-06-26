import { useRef, useEffect } from 'react';
import { fabric } from 'fabric';
import { ActiveSettings, EditTool } from '../types';

function generateChangeId(pageIndex: number): string {
  return `chg-${pageIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface UseFabricCanvasProps {
  pageIndex: number;
  width: number;
  height: number;
  zoom: number;
  activeSettings: ActiveSettings;
  savedState: any; // JSON object or null
  onSaveState: (pageIndex: number, state: any) => void;
  onUndoRedoAvailable: (pageIndex: number, canUndo: boolean, canRedo: boolean) => void;
}

export function useFabricCanvas({
  pageIndex,
  width,
  height,
  zoom,
  activeSettings,
  savedState,
  onSaveState,
  onUndoRedoAvailable,
}: UseFabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fbCanvasRef = useRef<fabric.Canvas | null>(null);
  
  // History stacks
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoRedoActionRef = useRef<boolean>(false);

  // Helper to save state into history stack and trigger callbacks
  const saveToHistory = (canvas: fabric.Canvas) => {
    if (isUndoRedoActionRef.current) return;
    
    const stateJson = JSON.stringify(canvas.toObject(['id', 'selectable', 'evented', 'changeType']));
    
    // Check if it matches current top of history
    if (historyRef.current[historyIndexRef.current] === stateJson) {
      return;
    }

    // Chop any future history if we were in the middle of undo stack
    const updatedHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    updatedHistory.push(stateJson);
    
    // Throttle / Limit size of history stack (e.g. 50 states)
    if (updatedHistory.length > 50) {
      updatedHistory.shift();
    }
    
    historyRef.current = updatedHistory;
    historyIndexRef.current = updatedHistory.length - 1;

    onUndoRedoAvailable(
      pageIndex,
      historyIndexRef.current > 0,
      historyIndexRef.current < historyRef.current.length - 1
    );

    // Save payload to parent state
    onSaveState(pageIndex, canvas.toObject(['id', 'selectable', 'evented', 'changeType']));
  };

  // Undo function
  const undo = () => {
    const canvas = fbCanvasRef.current;
    if (!canvas || historyIndexRef.current <= 0) return;

    isUndoRedoActionRef.current = true;
    historyIndexRef.current -= 1;
    const targetState = JSON.parse(historyRef.current[historyIndexRef.current]);

    canvas.loadFromJSON(targetState, () => {
      canvas.renderAll();
      isUndoRedoActionRef.current = false;
      onUndoRedoAvailable(
        pageIndex,
        historyIndexRef.current > 0,
        historyIndexRef.current < historyRef.current.length - 1
      );
      onSaveState(pageIndex, canvas.toObject(['id', 'selectable', 'evented', 'changeType']));
    });
  };

  // Redo function
  const redo = () => {
    const canvas = fbCanvasRef.current;
    if (!canvas || historyIndexRef.current >= historyRef.current.length - 1) return;

    isUndoRedoActionRef.current = true;
    historyIndexRef.current += 1;
    const targetState = JSON.parse(historyRef.current[historyIndexRef.current]);

    canvas.loadFromJSON(targetState, () => {
      canvas.renderAll();
      isUndoRedoActionRef.current = false;
      onUndoRedoAvailable(
        pageIndex,
        historyIndexRef.current > 0,
        historyIndexRef.current < historyRef.current.length - 1
      );
      onSaveState(pageIndex, canvas.toObject(['id', 'selectable', 'evented', 'changeType']));
    });
  };

  // Clear Canvas
  const clearObjects = () => {
    const canvas = fbCanvasRef.current;
    if (!canvas) return;
    canvas.clear();
    saveToHistory(canvas);
  };

  // Delete Active Object
  const deleteActiveObject = () => {
    const canvas = fbCanvasRef.current;
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    // Do not delete if currently in text editing mode
    if ((activeObj as any).isEditing) {
      return;
    }

    if (activeObj.type === 'activeSelection') {
      const activeSelection = activeObj as fabric.ActiveSelection;
      activeSelection.forEachObject((obj) => {
        canvas.remove(obj);
      });
      canvas.discardActiveObject();
    } else {
      canvas.remove(activeObj);
    }
    canvas.requestRenderAll();
  };

  // Remove a specific object by its tagged id (used to reject a tracked change)
  const removeObjectById = (id: string) => {
    const canvas = fbCanvasRef.current;
    if (!canvas) return;
    const target = canvas.getObjects().find((obj) => (obj as any).id === id);
    if (target) {
      canvas.remove(target);
      canvas.requestRenderAll();
    }
  };

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // Dispose old canvas if any exists
    if (fbCanvasRef.current) {
      fbCanvasRef.current.dispose();
      fbCanvasRef.current = null;
    }

    // Fabric options
    const fbCanvas = new fabric.Canvas(canvasRef.current, {
      width: width * zoom,
      height: height * zoom,
      backgroundColor: 'transparent',
      selection: true, // enable group selection when in select mode
    });

    fbCanvasRef.current = fbCanvas;

    // Set initial size scale (so all drawings are drawn relative to 1x and scaled dynamically by zoom)
    fbCanvas.setZoom(zoom);

    // Initial state loading
    if (savedState) {
      isUndoRedoActionRef.current = true;
      fbCanvas.loadFromJSON(savedState, () => {
        fbCanvas.renderAll();
        isUndoRedoActionRef.current = false;
        
        // Feed into history Ref if empty
        if (historyRef.current.length === 0) {
          const stateJson = JSON.stringify(fbCanvas.toObject(['id', 'selectable', 'evented', 'changeType']));
          historyRef.current = [stateJson];
          historyIndexRef.current = 0;
        }
      });
    } else {
      // Empty template state
      const stateJson = JSON.stringify(fbCanvas.toObject(['id', 'selectable', 'evented', 'changeType']));
      historyRef.current = [stateJson];
      historyIndexRef.current = 0;
    }

    // Setup event listeners
    const triggerSave = () => {
      saveToHistory(fbCanvas);
    };

    fbCanvas.on('object:added', triggerSave);
    fbCanvas.on('object:modified', triggerSave);
    fbCanvas.on('object:removed', triggerSave);
    fbCanvas.on('path:created', (options: any) => {
      // Freehand drawing/highlighter strokes are newly added content
      if (options?.path) {
        options.path.changeType = 'addition';
        options.path.id = generateChangeId(pageIndex);
      }
      triggerSave();
    });
    fbCanvas.on('text:changed', triggerSave);

    // Mouse interactions: e.g. text annotation click-to-place
    fbCanvas.on('mouse:down', (options) => {
      const mode = activeSettings.tool;
      const pointer = fbCanvas.getPointer(options.e);

      if (mode === 'text' && !options.target) {
        // Create an IText box where clicked
        const text = new fabric.IText('Double click to edit text', {
          left: pointer.x / zoom, // divide by zoom to store in unzoomed coordinates
          top: pointer.y / zoom,
          fontSize: activeSettings.fontSize,
          fontFamily: activeSettings.fontFamily,
          fill: activeSettings.color,
          fontWeight: activeSettings.fontWeight,
          fontStyle: activeSettings.fontStyle,
          transparentCorners: true,
          cornerColor: '#3b82f6',
          cornerSize: 6,
          cornerStyle: 'circle',
          borderColor: '#3b82f6',
          hasBorders: true,
          lineHeight: 1.15,
          padding: 4,
        });
        (text as any).changeType = 'addition';
        (text as any).id = generateChangeId(pageIndex);
        fbCanvas.add(text);
        fbCanvas.setActiveObject(text);
        text.enterEditing();
        fbCanvas.renderAll();
        saveToHistory(fbCanvas);
      } else if (mode === 'rect' && !options.target) {
        // Create a Rectangle
        const isRedaction = activeSettings.redact;
        const rect = new fabric.Rect({
          left: pointer.x / zoom,
          top: pointer.y / zoom,
          width: 120,
          height: 60,
          fill: isRedaction ? activeSettings.color : 'transparent',
          stroke: isRedaction ? 'transparent' : activeSettings.color,
          strokeWidth: isRedaction ? 0 : activeSettings.strokeWidth,
          transparentCorners: true,
          cornerColor: '#3b82f6',
          cornerSize: 6,
          cornerStyle: 'circle',
          borderColor: '#3b82f6',
          hasBorders: true,
        });
        // Redaction rects cover/remove existing content (deletion); everything else is newly added content
        (rect as any).changeType = isRedaction ? 'deletion' : 'addition';
        (rect as any).id = generateChangeId(pageIndex);
        fbCanvas.add(rect);
        fbCanvas.setActiveObject(rect);
        fbCanvas.renderAll();
        saveToHistory(fbCanvas);
      } else if (mode === 'eraser' && options.target) {
        // Erase clicked shape
        fbCanvas.remove(options.target);
        fbCanvas.renderAll();
        saveToHistory(fbCanvas);
      }
    });

    // Cleanup on unmount
    return () => {
      if (fbCanvasRef.current) {
        fbCanvasRef.current.dispose();
        fbCanvasRef.current = null;
      }
    };
  }, [pageIndex, width, height]); // Recreate when dimensions or index change

  // Sync zoom and active tools dynamically
  useEffect(() => {
    const canvas = fbCanvasRef.current;
    if (!canvas) return;

    // Apply dimensions at zoom
    canvas.setDimensions({
      width: width * zoom,
      height: height * zoom,
    });
    canvas.setZoom(zoom);
    canvas.renderAll();
  }, [zoom, width, height]);

  // Sync tool settings and properties
  useEffect(() => {
    const canvas = fbCanvasRef.current;
    if (!canvas) return;

    const tool = activeSettings.tool;
    
    // Common properties for selecting/drawing
    if (tool === 'select') {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
        obj.hoverCursor = 'move';
      });
    } else if (tool === 'eraser') {
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = true;
        obj.hoverCursor = 'not-allowed';
      });
    } else if (tool === 'draw') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      // Configure drawing brush
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = activeSettings.color;
        canvas.freeDrawingBrush.width = activeSettings.strokeWidth;
        // Reset full opacity
        (canvas.freeDrawingBrush as any).opacity = 1.0;
      }
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
    } else if (tool === 'highlight') {
      canvas.isDrawingMode = true;
      canvas.selection = false;
      // Configure transparent highlight brush
      if (canvas.freeDrawingBrush) {
        // Highlighters are normally semi-transparent yellow, or custom highlights
        // Yellow-ish default, or use hex to rgba
        // Standard highlighters are semi transparent
        canvas.freeDrawingBrush.color = activeSettings.color.startsWith('rgb') 
          ? activeSettings.color 
          : 'rgba(253, 224, 71, 0.45)'; // elegant gold highlight
        canvas.freeDrawingBrush.width = 24; // Thicker size for highlighters
        (canvas.freeDrawingBrush as any).opacity = 0.45;
      }
      canvas.forEachObject((obj) => {
        obj.selectable = false;
        obj.evented = false;
      });
    } else {
      // For rectangle & text, we click to place, so objects are active or set selectable based on preferences
      canvas.isDrawingMode = false;
      canvas.selection = false;
      canvas.forEachObject((obj) => {
        obj.selectable = true;
        obj.evented = true;
      });
    }

    canvas.renderAll();
  }, [
    activeSettings.tool,
    activeSettings.color,
    activeSettings.strokeWidth,
    activeSettings.redact,
  ]);

  return {
    canvasRef,
    fbCanvasInstance: fbCanvasRef,
    undo,
    redo,
    clearObjects,
    deleteActive: deleteActiveObject,
    removeObjectById,
    canUndo: historyIndexRef.current > 0,
    canRedo: historyIndexRef.current < historyRef.current.length - 1,
  };
}
