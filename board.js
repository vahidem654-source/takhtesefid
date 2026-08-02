// ============================================================
// Shared tool state (read by every drawing surface)
// ============================================================
window.ToolState = {
  tool: 'pen',        // pen | line | rect | circle | triangle | eraser
  color: '#5B5FEF',
  size: 4,
  panMode: false
};

// Palette shown as quick swatches
window.PALETTE = ['#171923', '#5B5FEF', '#17C3B2', '#FF4757', '#FFB020', '#FFFFFF'];

// ============================================================
// DrawSurface: binds one <canvas> to one "page" (a plain object
// holding a strokes array). Handles rendering + input + undo/redo.
// ============================================================
class DrawSurface {
  constructor(canvas, page, opts = {}) {
    this.canvas = canvas;
    this.page = page; // { strokes: [], undo: [], redo: [] }
    this.ctx = canvas.getContext('2d', { willReadFrequently: false });
    this.opts = opts; // { getSize: () => ({w,h}), panTarget: scrollableElement, onChange }
    this.drawing = false;
    this.current = null;
    this.onChange = opts.onChange || (() => {});
    this.activeTouches = new Map(); // pointerId -> {x,y} for touch-type pointers only
    this.drawPointerId = null;      // which pointer is currently drawing
    this.panActive = false;
    this.panLast = null;
    this._bind();
  }

  destroy() {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this._down);
    c.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerup', this._up);
    window.removeEventListener('pointercancel', this._up);
  }

  _bind() {
    this._down = this._onDown.bind(this);
    this._move = this._onMove.bind(this);
    this._up = this._onUp.bind(this);
    this.canvas.addEventListener('pointerdown', this._down);
    this.canvas.addEventListener('pointermove', this._move);
    window.addEventListener('pointerup', this._up);
    window.addEventListener('pointercancel', this._up);
  }

  size() {
    if (this.opts.getSize) return this.opts.getSize();
    const r = this.canvas.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  resize() {
    const dpr = Math.max(window.devicePixelRatio || 1, 1);
    const { w, h } = this.size();
    if (w <= 0 || h <= 0) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  _local(e) {
    const r = this.canvas.getBoundingClientRect();
    const w = r.width, h = r.height;
    return { x: (e.clientX - r.left) / w, y: (e.clientY - r.top) / h, w, h };
  }

  _beginStroke(e) {
    const p = this._local(e);
    this.drawing = true;
    this.drawPointerId = e.pointerId;
    const tool = ToolState.tool;
    if (tool === 'pen' || tool === 'eraser') {
      this.current = { type: tool, color: ToolState.color, size: ToolState.size, points: [[p.x, p.y]] };
    } else {
      this.current = { type: tool, color: ToolState.color, size: ToolState.size, x0: p.x, y0: p.y, x1: p.x, y1: p.y };
    }
    this._renderPreview();
  }

  _cancelStroke() {
    this.drawing = false;
    this.current = null;
    this.drawPointerId = null;
    this.redraw();
  }

  _onDown(e) {
    if (e.pointerType === 'mouse') {
      if (e.button !== undefined && e.button !== 0) return;
      this.canvas.setPointerCapture(e.pointerId);
      if (ToolState.panMode) return;
      this._beginStroke(e);
      return;
    }

    // touch or pen
    if (ToolState.panMode) return; // forced scroll-only mode: let native scrolling handle it untouched

    this.canvas.setPointerCapture(e.pointerId);
    if (e.pointerType === 'touch') this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const touchCount = this.activeTouches.size;

    if (e.pointerType === 'pen') {
      this._beginStroke(e); // stylus always draws (palm-rejection friendly)
      return;
    }

    if (touchCount === 1) {
      this._beginStroke(e); // single finger draws
    } else if (touchCount >= 2) {
      if (this.drawing) this._cancelStroke(); // second finger = intent to scroll, abandon the in-progress mark
      this.panActive = true;
      this.panLast = { x: e.clientX, y: e.clientY };
    }
  }

  _onMove(e) {
    if (e.pointerType === 'touch' && this.activeTouches.has(e.pointerId)) {
      this.activeTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (this.panActive) {
      const dx = e.clientX - this.panLast.x;
      const dy = e.clientY - this.panLast.y;
      this.panLast = { x: e.clientX, y: e.clientY };
      const target = this.opts.panTarget;
      if (target) { target.scrollTop -= dy; target.scrollLeft -= dx; }
      e.preventDefault && e.preventDefault();
      return;
    }

    if (!this.drawing || !this.current || e.pointerId !== this.drawPointerId) return;
    const p = this._local(e);
    const tool = this.current.type;
    if (tool === 'pen' || tool === 'eraser') {
      this.current.points.push([p.x, p.y]);
    } else {
      this.current.x1 = p.x;
      this.current.y1 = p.y;
    }
    this._renderPreview();
  }

  _onUp(e) {
    if (e.pointerType === 'touch') this.activeTouches.delete(e.pointerId);

    if (this.panActive) {
      const remainingTouches = this.activeTouches.size;
      if (remainingTouches < 2) this.panActive = false;
      return;
    }

    if (!this.drawing || e.pointerId !== this.drawPointerId) return;
    this.drawing = false;
    this.drawPointerId = null;
    if (this.current) {
      const isDegenerate = (this.current.type !== 'pen' && this.current.type !== 'eraser') &&
        Math.abs(this.current.x1 - this.current.x0) < 0.002 && Math.abs(this.current.y1 - this.current.y0) < 0.002;
      if (!isDegenerate) {
        this.page.strokes.push(this.current);
        this.page.redo = [];
        this.onChange();
      }
    }
    this.current = null;
    this.redraw();
  }

  _renderPreview() {
    this.redraw();
    if (this.current) this._paintStroke(this.ctx, this.current, this.size());
  }

  redraw() {
    const { w, h } = this.size();
    this.ctx.clearRect(0, 0, w, h);
    for (const s of this.page.strokes) this._paintStroke(this.ctx, s, { w, h });
  }

  _paintStroke(ctx, s, { w, h }) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = s.size;
    if (s.type === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
    }

    if (s.type === 'pen' || s.type === 'eraser') {
      const pts = s.points;
      if (pts.length < 2) {
        ctx.beginPath();
        ctx.arc(pts[0][0] * w, pts[0][1] * h, s.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = s.type === 'eraser' ? 'rgba(0,0,0,1)' : s.color;
        if (s.type === 'eraser') ctx.globalCompositeOperation = 'destination-out';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(pts[0][0] * w, pts[0][1] * h);
        for (let i = 1; i < pts.length - 1; i++) {
          const xc = (pts[i][0] + pts[i + 1][0]) / 2 * w;
          const yc = (pts[i][1] + pts[i + 1][1]) / 2 * h;
          ctx.quadraticCurveTo(pts[i][0] * w, pts[i][1] * h, xc, yc);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last[0] * w, last[1] * h);
        ctx.stroke();
      }
    } else if (s.type === 'line') {
      ctx.beginPath();
      ctx.moveTo(s.x0 * w, s.y0 * h);
      ctx.lineTo(s.x1 * w, s.y1 * h);
      ctx.stroke();
    } else if (s.type === 'rect') {
      ctx.strokeRect(Math.min(s.x0, s.x1) * w, Math.min(s.y0, s.y1) * h, Math.abs(s.x1 - s.x0) * w, Math.abs(s.y1 - s.y0) * h);
    } else if (s.type === 'circle') {
      const cx = (s.x0 + s.x1) / 2 * w, cy = (s.y0 + s.y1) / 2 * h;
      const rx = Math.abs(s.x1 - s.x0) / 2 * w, ry = Math.abs(s.y1 - s.y0) / 2 * h;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 0.1), Math.max(ry, 0.1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.type === 'triangle') {
      const x0 = s.x0 * w, y0 = s.y0 * h, x1 = s.x1 * w, y1 = s.y1 * h;
      ctx.beginPath();
      ctx.moveTo((x0 + x1) / 2, y0);
      ctx.lineTo(x0, y1);
      ctx.lineTo(x1, y1);
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  undo() {
    if (!this.page.strokes.length) return;
    this.page.redo.push(this.page.strokes.pop());
    this.redraw();
    this.onChange();
  }
  redo() {
    if (!this.page.redo.length) return;
    this.page.strokes.push(this.page.redo.pop());
    this.redraw();
    this.onChange();
  }
  clear() {
    if (!this.page.strokes.length) return;
    this.page.undoAllBackup = this.page.strokes;
    this.page.strokes = [];
    this.page.redo = [];
    this.redraw();
    this.onChange();
  }

  // Renders the page's strokes onto an arbitrary target canvas at its own size (used for thumbnails / composing)
  paintOnto(targetCtx, w, h) {
    for (const s of this.page.strokes) this._paintStroke(targetCtx, s, { w, h });
  }
}

function makeEmptyPage(kind = 'blank', extra = {}) {
  return Object.assign({
    id: 'p_' + Math.random().toString(36).slice(2, 10),
    kind, // 'blank' | 'file'
    strokes: [],
    redo: []
  }, extra);
}
