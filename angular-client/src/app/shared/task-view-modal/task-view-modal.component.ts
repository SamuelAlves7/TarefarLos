import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { Task } from '../../core/models/app.models';

@Component({
  selector: 'app-task-view-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-view-modal.component.html',
  styleUrl: './task-view-modal.component.css',
})
export class TaskViewModalComponent {
  @Input() open = false;
  @Input() task: Task | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() duplicateRequested = new EventEmitter<Task>();
  @Output() deleteRequested = new EventEmitter<Task>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.closed.emit();
    }
  }

  get statusText(): string {
    if (!this.task) return '';
    if (this.task.concluida) return 'Concluida';
    if (this.task.emExecucao) return 'Em execucao';
    return 'Pendente';
  }
}
