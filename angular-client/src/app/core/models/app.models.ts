export interface Task {
  id: string;
  titulo: string;
  projeto: string;
  tipo: string;
  prioridade: string;
  descricao: string;
  imagem: string | null;
  criadaEm: string;
  emExecucao: boolean;
  concluida: boolean;
}

export interface CreateTaskPayload {
  titulo: string;
  projeto: string;
  tipo: string;
  prioridade: string;
  descricao: string;
  imagem?: string | null;
}

export interface TaskStatusPayload {
  emExecucao: boolean;
  concluida: boolean;
}

export type BoardTool = 'select' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface BoardBase {
  color: string;
  size: number;
}

export interface PenElement extends BoardBase {
  type: 'pen';
  points: Point[];
}

export interface ShapeElement extends BoardBase {
  type: 'rect' | 'ellipse' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TextElement extends BoardBase {
  type: 'text';
  x: number;
  y: number;
  text: string;
}

export type BoardElement = PenElement | ShapeElement | TextElement;
