import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreateTaskPayload, Task } from '../../core/models/app.models';

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task-form-modal.component.html',
  styleUrl: './task-form-modal.component.css',
})
export class TaskFormModalComponent implements OnChanges {
  private readonly formBuilder = inject(FormBuilder);
  @Input() open = false;
  @Input() draftTask: Task | null = null;
  @Input() projects: string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<CreateTaskPayload>();

  private imageData: string | null = null;

  readonly form = this.formBuilder.group({
    titulo: ['', Validators.required],
    projeto: ['', Validators.required],
    tipo: ['', Validators.required],
    prioridade: ['', Validators.required],
    descricao: ['', Validators.required],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['draftTask']) {
      this.form.reset({
        titulo: this.draftTask?.titulo ?? '',
        projeto: this.draftTask?.projeto ?? '',
        tipo: this.draftTask?.tipo ?? '',
        prioridade: this.draftTask?.prioridade ?? '',
        descricao: this.draftTask?.descricao ?? '',
      });
      this.imageData = this.draftTask?.imagem ?? null;
    }

    if (changes['open'] && !this.open) {
      this.form.reset();
      this.imageData = null;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open) {
      this.close();
    }
  }

  close(): void {
    this.closed.emit();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.imageData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Falha ao ler imagem.'));
      reader.readAsDataURL(file);
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saved.emit({
      titulo: value.titulo!.trim(),
      projeto: value.projeto!.trim(),
      tipo: value.tipo!,
      prioridade: value.prioridade!,
      descricao: value.descricao!.trim(),
      imagem: this.imageData,
    });
  }
}
