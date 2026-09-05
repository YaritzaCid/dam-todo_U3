import {
  fetchJsonPlaceholderTodos,
  fetchRemoteTodos,
  getRemoteTodoApiUserMessage,
  RemoteTodoApiError,
} from '../lib/remote-todo-api';

const remoteUrl = 'https://mockapi.test/todos';

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number; statusText?: string }) {
  const status = init?.status ?? 200;

  return {
    ok: init?.ok ?? status < 400,
    status,
    statusText: init?.statusText ?? '',
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('remote todo api', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_REMOTE_TODOS_URL = remoteUrl;
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('importación desde JSONPlaceholder queda limitada a 5', async () => {
    const importedTodos = Array.from({ length: 10 }, (_value, index) => ({
      id: index + 1,
      userId: 1,
      title: `remote ${index + 1}`,
      completed: false,
    }));
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse(importedTodos));

    await expect(fetchJsonPlaceholderTodos()).resolves.toHaveLength(5);
  });

  test('error HTTP conserva status técnico', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ message: 'fail' }, { ok: false, status: 500, statusText: 'Server Error' }));

    await expect(fetchRemoteTodos('user-1')).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  test('error de red se clasifica como network', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('offline'));

    await expect(fetchRemoteTodos('user-1')).rejects.toMatchObject({ kind: 'network' });
  });

  test('timeout se clasifica como timeout', async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    (global.fetch as jest.Mock).mockRejectedValue(error);

    await expect(fetchRemoteTodos('user-1')).rejects.toMatchObject({ kind: 'timeout' });
  });

  test('respuesta remota inválida se clasifica como invalid-response', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(jsonResponse({ not: 'a list' }));

    await expect(fetchRemoteTodos('user-1')).rejects.toMatchObject({
      kind: 'invalid-response',
      name: 'RemoteTodoApiError',
    });
  });

  test('traduce errores remotos a mensajes de usuario', () => {
    expect(getRemoteTodoApiUserMessage(new Error('unknown'))).toBe('No pudimos sincronizar. Inténtalo de nuevo.');
    expect(getRemoteTodoApiUserMessage(new RemoteTodoApiError('missing-url', 'missing'))).toBe('Falta configurar la URL de la API.');
    expect(getRemoteTodoApiUserMessage(new RemoteTodoApiError('network', 'offline'))).toBe(
      'No pudimos conectar con la API. Tus tareas locales siguen disponibles.'
    );
    expect(getRemoteTodoApiUserMessage(new RemoteTodoApiError('timeout', 'timeout'))).toBe(
      'No pudimos conectar con la API. Tus tareas locales siguen disponibles.'
    );
    expect(getRemoteTodoApiUserMessage(new RemoteTodoApiError('http', 'server'))).toBe(
      'La API respondió con error. Inténtalo más tarde.'
    );
    expect(getRemoteTodoApiUserMessage(new RemoteTodoApiError('invalid-response', 'bad'))).toBe(
      'La API devolvió datos inválidos.'
    );
    expect(getRemoteTodoApiUserMessage(new RemoteTodoApiError('unexpected', 'boom'))).toBe(
      'No pudimos sincronizar. Inténtalo de nuevo.'
    );
  });
});
