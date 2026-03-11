import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, inject, signal, ViewChild } from '@angular/core';
import { BoardElement, BoardTool, Point } from '../../core/models/app.models';
import { BoardStoreService } from '../../core/services/board-store.service';

@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './board-page.component.html',
  styleUrl: './board-page.component.css',
})
export class BoardPageComponent implements AfterViewInit {
  @ViewChild('boardCanvas') private readonly canvasRef?: ElementRef<HTMLCanvasElement>;

  private readonly boardStore = inject(BoardStoreService);
  private ctx?: CanvasRenderingContext2D;
  private drawing = false;
  private currentElement: BoardElement | null = null;
  private selectedIndex = -1;
  private dragStart: Point | null = null;
  private redoStack: BoardElement[] = [];

  readonly tools: { id: BoardTool; icon: string; label: string }[] = [
    { id: 'select', icon: '🖱', label: 'Selecionar' },
    { id: 'pen', icon: '✏', label: 'Caneta' },
    { id: 'rect', icon: '▭', label: 'Retangulo' },
    { id: 'ellipse', icon: '◯', label: 'Elipse' },
    { id: 'arrow', icon: '➜', label: 'Seta' },
    { id: 'text', icon: 'T', label: 'Texto' },
  ];

  readonly currentTool = signal<BoardTool>('select');
  readonly strokeColor = signal('#1f2937');
  readonly strokeWidth = signal(2);
  readonly elements = this.boardStore.elements;

  async ngAfterViewInit(): Promise<void> {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    this.ctx = canvas.getContext('2d') ?? undefined;
    this.resizeCanvas();
    await this.boardStore.load();
    this.renderBoard();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
    this.renderBoard();
  }

  setTool(tool: BoardTool): void {
    this.currentTool.set(tool);
    this.selectedIndex = -1;
    this.renderBoard();
  }

  async clearBoard(): Promise<void> {
    if (!confirm('Deseja limpar toda a lousa?')) return;
    this.redoStack = [];
    this.selectedIndex = -1;
    await this.boardStore.save([]);
    this.renderBoard();
  }

  async undo(): Promise<void> {
    const elements = [...this.elements()];
    const removed = elements.pop();
    if (!removed) return;
    this.redoStack.push(removed);
    this.selectedIndex = -1;
    await this.boardStore.save(elements);
    this.renderBoard();
  }

  async redo(): Promise<void> {
    const restored = this.redoStack.pop();
    if (!restored) return;
    const elements = [...this.elements(), restored];
    this.selectedIndex = elements.length - 1;
    await this.boardStore.save(elements);
    this.renderBoard();
  }

  exportPng(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `lousa-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
    link.click();
  }

  async pointerDown(event: PointerEvent): Promise<void> {
    const point = this.getPoint(event);
    this.drawing = true;

    if (this.currentTool() === 'select') {
      this.selectedIndex = -1;
      for (let i = this.elements().length - 1; i >= 0; i -= 1) {
        if (this.hitElement(this.elements()[i], point)) {
          this.selectedIndex = i;
          this.dragStart = point;
          break;
        }
      }
      this.renderBoard();
      return;
    }

    this.redoStack = [];

    if (this.currentTool() === 'text') {
      this.drawing = false;
      const text = prompt('Digite o texto para inserir na lousa:');
      if (!text?.trim()) return;

      const elements = [
        ...this.elements(),
        { type: 'text', x: point.x, y: point.y, text: text.trim(), color: this.strokeColor(), size: this.strokeWidth() } as BoardElement,
      ];
      this.selectedIndex = elements.length - 1;
      await this.boardStore.save(elements);
      this.renderBoard();
      return;
    }

    if (this.currentTool() === 'pen') {
      this.currentElement = { type: 'pen', points: [point], color: this.strokeColor(), size: this.strokeWidth() };
    } else {
      this.currentElement = {
        type: this.currentTool() as 'rect' | 'ellipse' | 'arrow',
        x1: point.x,
        y1: point.y,
        x2: point.x,
        y2: point.y,
        color: this.strokeColor(),
        size: this.strokeWidth(),
      };
    }

    this.selectedIndex = this.elements().length;
    this.boardStore.elements.set([...this.elements(), this.currentElement]);
    this.renderBoard();
  }

  pointerMove(event: PointerEvent): void {
    if (!this.drawing) return;
    const point = this.getPoint(event);

    if (this.currentTool() === 'select') {
      if (this.selectedIndex >= 0 && this.dragStart) {
        const elements = [...this.elements()];
        const dx = point.x - this.dragStart.x;
        const dy = point.y - this.dragStart.y;
        this.moveElement(elements[this.selectedIndex], dx, dy);
        this.dragStart = point;
        this.boardStore.elements.set(elements);
        this.renderBoard();
      }
      return;
    }

    if (!this.currentElement) return;

    const elements = [...this.elements()];
    const current = elements[this.selectedIndex];
    if (!current) return;

    if (current.type === 'pen') {
      current.points = [...current.points, point];
    } else if (current.type !== 'text') {
      current.x2 = point.x;
      current.y2 = point.y;
    }

    this.boardStore.elements.set(elements);
    this.renderBoard();
  }

  async pointerUp(): Promise<void> {
    if (!this.drawing) return;
    this.drawing = false;
    this.currentElement = null;
    this.dragStart = null;
    await this.boardStore.save([...this.elements()]);
    this.renderBoard();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth ?? 1200;
    const height = Math.min(window.innerHeight * 0.68, 720);

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.height = `${height}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(ratio, ratio);
  }

  private getPoint(event: PointerEvent): Point {
    const rect = this.canvasRef!.nativeElement.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private hitElement(element: BoardElement, point: Point): boolean {
    if (element.type === 'pen') {
      const xs = element.points.map((item) => item.x);
      const ys = element.points.map((item) => item.y);
      return this.hitRect({ x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }, point, 10);
    }

    if (element.type === 'text') {
      const width = (element.text.length || 1) * 9;
      return point.x >= element.x - 5 && point.x <= element.x + width && point.y >= element.y - 20 && point.y <= element.y + 6;
    }

    return this.hitRect(element, point, 8);
  }

  private hitRect(bounds: { x1: number; y1: number; x2: number; y2: number }, point: Point, pad: number): boolean {
    const minX = Math.min(bounds.x1, bounds.x2) - pad;
    const maxX = Math.max(bounds.x1, bounds.x2) + pad;
    const minY = Math.min(bounds.y1, bounds.y2) - pad;
    const maxY = Math.max(bounds.y1, bounds.y2) + pad;
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }

  private moveElement(element: BoardElement, dx: number, dy: number): void {
    if (element.type === 'pen') {
      element.points = element.points.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      return;
    }

    if (element.type === 'text') {
      element.x += dx;
      element.y += dy;
      return;
    }

    element.x1 += dx;
    element.y1 += dy;
    element.x2 += dx;
    element.y2 += dy;
  }

  private renderBoard(): void {
    const canvas = this.canvasRef?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    this.elements().forEach((element, index) => {
      this.drawElement(ctx, element);
      if (index === this.selectedIndex && this.currentTool() === 'select') {
        this.drawSelectionBox(ctx, element);
      }
    });
  }

  private drawElement(ctx: CanvasRenderingContext2D, element: BoardElement): void {
    ctx.strokeStyle = element.color;
    ctx.fillStyle = element.color;
    ctx.lineWidth = element.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (element.type === 'pen') {
      if (element.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(element.points[0].x, element.points[0].y);
      for (let i = 1; i < element.points.length; i += 1) {
        ctx.lineTo(element.points[i].x, element.points[i].y);
      }
      ctx.stroke();
      return;
    }

    if (element.type === 'rect') {
      ctx.strokeRect(element.x1, element.y1, element.x2 - element.x1, element.y2 - element.y1);
      return;
    }

    if (element.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(
        (element.x1 + element.x2) / 2,
        (element.y1 + element.y2) / 2,
        Math.abs(element.x2 - element.x1) / 2,
        Math.abs(element.y2 - element.y1) / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      return;
    }

    if (element.type === 'arrow') {
      const angle = Math.atan2(element.y2 - element.y1, element.x2 - element.x1);
      const head = Math.max(12, element.size * 6);
      const shaftEndX = element.x2 - Math.cos(angle) * head * 0.75;
      const shaftEndY = element.y2 - Math.sin(angle) * head * 0.75;

      ctx.beginPath();
      ctx.moveTo(element.x1, element.y1);
      ctx.lineTo(shaftEndX, shaftEndY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(element.x2, element.y2);
      ctx.lineTo(element.x2 - head * Math.cos(angle - Math.PI / 7), element.y2 - head * Math.sin(angle - Math.PI / 7));
      ctx.lineTo(element.x2 - head * Math.cos(angle + Math.PI / 7), element.y2 - head * Math.sin(angle + Math.PI / 7));
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (element.type === 'text') {
      ctx.font = `${Math.max(14, element.size * 6)}px Segoe UI`;
      ctx.fillText(element.text, element.x, element.y);
    }
  }

  private drawSelectionBox(ctx: CanvasRenderingContext2D, element: BoardElement): void {
    let x1: number;
    let y1: number;
    let x2: number;
    let y2: number;

    if (element.type === 'pen') {
      const xs = element.points.map((point) => point.x);
      const ys = element.points.map((point) => point.y);
      x1 = Math.min(...xs);
      y1 = Math.min(...ys);
      x2 = Math.max(...xs);
      y2 = Math.max(...ys);
    } else if (element.type === 'text') {
      x1 = element.x - 4;
      y1 = element.y - 20;
      x2 = element.x + Math.max(20, element.text.length * 9);
      y2 = element.y + 5;
    } else {
      x1 = Math.min(element.x1, element.x2);
      y1 = Math.min(element.y1, element.y2);
      x2 = Math.max(element.x1, element.x2);
      y2 = Math.max(element.y1, element.y2);
    }

    ctx.save();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x1 - 4, y1 - 4, x2 - x1 + 8, y2 - y1 + 8);
    ctx.restore();
  }
}
