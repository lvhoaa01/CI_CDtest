const taskForm = document.querySelector('#task-form');
const titleInput = document.querySelector('#task-title');
const formError = document.querySelector('#form-error');
const taskList = document.querySelector('#task-list');
const taskTemplate = document.querySelector('#task-template');
const emptyState = document.querySelector('#empty-state');
const taskCount = document.querySelector('#task-count');
const filterButtons = [...document.querySelectorAll('.filter')];

let tasks = [];
let activeFilter = 'all';

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `Request failed with status ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

function visibleTasks() {
  if (activeFilter === 'open') {
    return tasks.filter((task) => !task.completed);
  }
  if (activeFilter === 'done') {
    return tasks.filter((task) => task.completed);
  }
  return tasks;
}

function render() {
  taskList.replaceChildren();

  for (const task of visibleTasks()) {
    const fragment = taskTemplate.content.cloneNode(true);
    const listItem = fragment.querySelector('.task-item');
    const toggle = fragment.querySelector('.task-toggle');
    const title = fragment.querySelector('.task-title');
    const deleteButton = fragment.querySelector('.delete-button');

    listItem.dataset.id = task.id;
    listItem.classList.toggle('completed', task.completed);
    toggle.checked = task.completed;
    title.textContent = task.title;

    toggle.addEventListener('change', () => updateTask(task.id, { completed: toggle.checked }));
    deleteButton.addEventListener('click', () => deleteTask(task.id));
    taskList.append(fragment);
  }

  const openTasks = tasks.filter((task) => !task.completed).length;
  taskCount.textContent = `${openTasks} đang làm / ${tasks.length} tổng`;
  emptyState.hidden = visibleTasks().length > 0;
}

async function loadApplication() {
  try {
    const [tasksPayload, info] = await Promise.all([
      request('/api/tasks'),
      request('/api/info'),
    ]);
    tasks = tasksPayload.tasks;
    document.querySelector('#release-version').textContent = `version ${info.version}`;
    document.querySelector('#release-commit').textContent = `commit ${info.commit.slice(0, 12)}`;
    render();
  } catch (error) {
    formError.textContent = `Không thể kết nối API: ${error.message}`;
  }
}

async function updateTask(id, changes) {
  try {
    const payload = await request(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(changes),
    });
    tasks = tasks.map((task) => (task.id === id ? payload.task : task));
    render();
  } catch (error) {
    formError.textContent = error.message;
    render();
  }
}

async function deleteTask(id) {
  try {
    await request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    tasks = tasks.filter((task) => task.id !== id);
    render();
  } catch (error) {
    formError.textContent = error.message;
  }
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formError.textContent = '';

  try {
    const payload = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: titleInput.value }),
    });
    tasks.push(payload.task);
    taskForm.reset();
    titleInput.focus();
    render();
  } catch (error) {
    formError.textContent = error.message;
  }
});

for (const button of filterButtons) {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    for (const candidate of filterButtons) {
      candidate.classList.toggle('active', candidate === button);
    }
    render();
  });
}

loadApplication();
