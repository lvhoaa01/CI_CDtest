import { randomUUID } from 'node:crypto';

export class TaskStore {
  #tasks;

  constructor(initialTasks = []) {
    this.#tasks = initialTasks.map((task) => ({ ...task }));
  }

  list() {
    return this.#tasks.map((task) => ({ ...task }));
  }

  create(title) {
    const cleanTitle = normalizeTitle(title);
    const task = {
      id: randomUUID(),
      title: cleanTitle,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    this.#tasks.push(task);
    return { ...task };
  }

  update(id, changes) {
    const index = this.#tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return null;
    }

    const current = this.#tasks[index];
    const updated = { ...current };

    if (Object.hasOwn(changes, 'title')) {
      updated.title = normalizeTitle(changes.title);
    }

    if (Object.hasOwn(changes, 'completed')) {
      if (typeof changes.completed !== 'boolean') {
        throw new TaskValidationError('completed must be a boolean');
      }
      updated.completed = changes.completed;
    }

    this.#tasks[index] = updated;
    return { ...updated };
  }

  delete(id) {
    const index = this.#tasks.findIndex((task) => task.id === id);
    if (index === -1) {
      return false;
    }

    this.#tasks.splice(index, 1);
    return true;
  }
}

export class TaskValidationError extends Error {}

function normalizeTitle(title) {
  if (typeof title !== 'string') {
    throw new TaskValidationError('title must be a string');
  }

  const cleanTitle = title.trim();
  if (cleanTitle.length < 2 || cleanTitle.length > 120) {
    throw new TaskValidationError('title must contain 2 to 120 characters');
  }

  return cleanTitle;
}
