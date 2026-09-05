const mockRandomUUID = jest.fn();
const mockDigestStringAsync = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));

jest.mock('expo-crypto', () => ({
  randomUUID: mockRandomUUID,
  digestStringAsync: mockDigestStringAsync,
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

import * as Crypto from 'expo-crypto';

import {
  clearSession,
  createTodo,
  deleteTodo,
  listTodos,
  loadSession,
  loginUser,
  registerUser,
  renameTodo,
  saveSession,
  setTodoCompleted,
  setTodoLocation,
  setTodoPhoto,
  type TodoItem,
} from '../lib/alisto-db';

type StoredValue = Record<string, string>;

type StoredUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  createdAt: string;
};

type StoredSyncRecord = {
  localId: string;
  userId: string;
  remoteId: string | null;
  remoteSyncedAt: string | null;
  importSource: string | null;
  importExternalId: string | null;
  deletedAt: string | null;
};

type StoredWebStore = {
  users: StoredUser[];
  todos: TodoItem[];
  syncRecords: StoredSyncRecord[];
  sessionUserId: string | null;
};

const webStoreKey = 'piezario.webStore.v1';

function createLocalStorage() {
  const store: StoredValue = {};

  return {
    clear: jest.fn(() => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    }),
    getItem: jest.fn((key: string) => store[key] ?? null),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
  };
}

function readWebStore() {
  const storedValue = globalThis.localStorage.getItem(webStoreKey);

  if (!storedValue) {
    throw new Error('Missing web store.');
  }

  return JSON.parse(storedValue) as StoredWebStore;
}

function writeWebStore(store: StoredWebStore) {
  globalThis.localStorage.setItem(webStoreKey, JSON.stringify(store));
}

function fakeHash(value: string) {
  return `hash:${Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0)}`;
}

describe('alisto-db web auth and CRUD', () => {
  beforeEach(() => {
    mockRandomUUID.mockReset();
    mockDigestStringAsync.mockReset();
    mockDigestStringAsync.mockImplementation((_algorithm: string, value: string) => Promise.resolve(fakeHash(value)));
    Object.defineProperty(Crypto, 'randomUUID', {
      configurable: true,
      value: mockRandomUUID,
    });
    Object.defineProperty(Crypto, 'digestStringAsync', {
      configurable: true,
      value: mockDigestStringAsync,
    });
    Object.defineProperty(Crypto, 'CryptoDigestAlgorithm', {
      configurable: true,
      value: { SHA256: 'SHA256' },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createLocalStorage(),
    });
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-03T04:05:06.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('registra cuenta web con correo normalizado y hash de contraseña', async () => {
    mockRandomUUID.mockReturnValueOnce('salt-1').mockReturnValueOnce('user-1');

    await expect(registerUser('Ana', '  ANA@Example.COM  ', 'secret1')).resolves.toEqual({
      ok: true,
      account: { id: 'user-1', email: 'ana@example.com', name: 'Ana' },
    });

    const storedUser = readWebStore().users[0];
    expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA256', 'salt-1:ana@example.com:secret1');
    expect(storedUser).toMatchObject({
      id: 'user-1',
      email: 'ana@example.com',
      displayName: 'Ana',
      passwordHash: fakeHash('salt-1:ana@example.com:secret1'),
      passwordSalt: 'salt-1',
      createdAt: '2026-02-03T04:05:06.000Z',
    });
    expect(JSON.stringify(storedUser)).not.toContain('secret1');
  });

  test('rechaza registro duplicado cuando la cuenta ya tiene contraseña', async () => {
    mockRandomUUID.mockReturnValueOnce('salt-1').mockReturnValueOnce('user-1');
    await registerUser('Ana', 'ana@example.com', 'secret1');

    await expect(registerUser('Ana 2', ' ANA@example.com ', 'secret2')).resolves.toEqual({
      ok: false,
      message: 'Ese correo ya tiene cuenta. Inicia sesión.',
    });
    expect(readWebStore().users).toHaveLength(1);
    expect(mockDigestStringAsync).toHaveBeenCalledTimes(1);
  });

  test('completa una cuenta web legacy sin duplicar usuario', async () => {
    writeWebStore({
      users: [
        {
          id: 'legacy-user',
          email: 'ana@example.com',
          displayName: 'Ana antigua',
          passwordHash: null,
          passwordSalt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      todos: [],
      syncRecords: [],
      sessionUserId: null,
    });
    mockRandomUUID.mockReturnValueOnce('salt-legacy');

    await expect(registerUser('Ana nueva', 'ANA@example.com', 'secret1')).resolves.toEqual({
      ok: true,
      account: { id: 'legacy-user', email: 'ana@example.com', name: 'Ana nueva' },
    });

    const store = readWebStore();
    expect(store.users).toHaveLength(1);
    expect(store.users[0]).toMatchObject({
      id: 'legacy-user',
      displayName: 'Ana nueva',
      passwordSalt: 'salt-legacy',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
  });

  test('valida errores de login web relevantes', async () => {
    writeWebStore({
      users: [
        {
          id: 'incomplete-user',
          email: 'incomplete@example.com',
          displayName: 'Cuenta incompleta',
          passwordHash: null,
          passwordSalt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'user-1',
          email: 'ana@example.com',
          displayName: 'Ana',
          passwordHash: fakeHash('salt-1:ana@example.com:secret1'),
          passwordSalt: 'salt-1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      todos: [],
      syncRecords: [],
      sessionUserId: null,
    });

    await expect(loginUser('missing@example.com', 'secret1')).resolves.toEqual({
      ok: false,
      message: 'No encontramos esa cuenta. Regístrate primero.',
    });
    await expect(loginUser('incomplete@example.com', 'secret1')).resolves.toEqual({
      ok: false,
      message: 'Esta cuenta quedó incompleta. Crea la cuenta de nuevo.',
    });
    await expect(loginUser('ana@example.com', 'wrongpw')).resolves.toEqual({
      ok: false,
      message: 'La contraseña no coincide con ese correo.',
    });
  });

  test('login correcto guarda sesión web y permite limpiarla', async () => {
    writeWebStore({
      users: [
        {
          id: 'user-1',
          email: 'ana@example.com',
          displayName: 'Ana',
          passwordHash: fakeHash('salt-1:ana@example.com:secret1'),
          passwordSalt: 'salt-1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      todos: [],
      syncRecords: [],
      sessionUserId: null,
    });

    await expect(loginUser(' ANA@example.com ', 'secret1')).resolves.toEqual({
      ok: true,
      session: { id: 'user-1', email: 'ana@example.com', name: 'Ana' },
    });
    await expect(loadSession()).resolves.toEqual({ id: 'user-1', email: 'ana@example.com', name: 'Ana' });

    saveSession({ id: 'user-1', email: 'ana@example.com', name: 'Ana' });
    expect(readWebStore().sessionUserId).toBe('user-1');

    await clearSession();
    await expect(loadSession()).resolves.toBeNull();
  });

  test('crea y lista solo tareas del usuario en orden descendente', async () => {
    mockRandomUUID.mockReturnValueOnce('todo-old').mockReturnValueOnce('todo-new').mockReturnValueOnce('todo-other');

    jest.setSystemTime(new Date('2026-02-03T04:05:06.000Z'));
    await expect(createTodo('user-1', '  Tarea antigua  ', 'photo://one')).resolves.toMatchObject({
      id: 'todo-old',
      userId: 'user-1',
      title: 'Tarea antigua',
      completed: false,
      photoUri: 'photo://one',
      locationLatitude: null,
      locationLongitude: null,
    });

    jest.setSystemTime(new Date('2026-02-04T04:05:06.000Z'));
    await createTodo('user-1', 'Tarea nueva');

    jest.setSystemTime(new Date('2026-02-05T04:05:06.000Z'));
    await createTodo('user-2', 'Tarea otro usuario');

    await expect(listTodos('user-1')).resolves.toEqual([
      expect.objectContaining({ id: 'todo-new', title: 'Tarea nueva' }),
      expect.objectContaining({ id: 'todo-old', title: 'Tarea antigua' }),
    ]);
  });

  test('rehidrata el almacén web vacío cuando localStorage está corrupto', async () => {
    globalThis.localStorage.setItem(webStoreKey, '{bad json');
    mockRandomUUID.mockReturnValueOnce('todo-1');

    await createTodo('user-1', 'Tarea recuperada');

    expect(readWebStore().todos).toEqual([
      expect.objectContaining({ id: 'todo-1', title: 'Tarea recuperada' }),
    ]);
  });

  test('actualiza tarea web sin tocar tareas de otros usuarios', async () => {
    writeWebStore({
      users: [],
      todos: [
        {
          id: 'todo-1',
          userId: 'user-1',
          title: 'Original',
          completed: false,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          photoUri: null,
          locationLatitude: null,
          locationLongitude: null,
        },
        {
          id: 'todo-1',
          userId: 'user-2',
          title: 'Otro usuario',
          completed: false,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          photoUri: null,
          locationLatitude: null,
          locationLongitude: null,
        },
      ],
      syncRecords: [],
      sessionUserId: null,
    });

    await setTodoCompleted('user-1', 'todo-1', true);
    await renameTodo('user-1', 'todo-1', '  Renombrada  ');
    await setTodoPhoto('user-1', 'todo-1', 'photo://updated');
    await setTodoLocation('user-1', 'todo-1', 40.4168, -3.7038);
    await renameTodo('user-2', 'missing', 'No existe');

    const store = readWebStore();
    expect(store.todos.find((todo) => todo.id === 'todo-1' && todo.userId === 'user-1')).toMatchObject({
      title: 'Renombrada',
      completed: true,
      photoUri: 'photo://updated',
      locationLatitude: 40.4168,
      locationLongitude: -3.7038,
      updatedAt: '2026-02-03T04:05:06.000Z',
    });
    expect(store.todos.find((todo) => todo.id === 'todo-1' && todo.userId === 'user-2')).toMatchObject({
      title: 'Otro usuario',
      completed: false,
      photoUri: null,
      locationLatitude: null,
      locationLongitude: null,
    });
  });

  test('borra solo la tarea propia y marca tombstone si tiene remoto', async () => {
    writeWebStore({
      users: [],
      todos: [
        {
          id: 'synced-todo',
          userId: 'user-1',
          title: 'Sincronizada',
          completed: false,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          photoUri: null,
          locationLatitude: null,
          locationLongitude: null,
        },
        {
          id: 'synced-todo',
          userId: 'user-2',
          title: 'Otro usuario',
          completed: false,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          photoUri: null,
          locationLatitude: null,
          locationLongitude: null,
        },
        {
          id: 'local-todo',
          userId: 'user-1',
          title: 'Local',
          completed: false,
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
          photoUri: null,
          locationLatitude: null,
          locationLongitude: null,
        },
      ],
      syncRecords: [
        {
          localId: 'synced-todo',
          userId: 'user-1',
          remoteId: 'remote-1',
          remoteSyncedAt: '2026-02-02T00:00:00.000Z',
          importSource: null,
          importExternalId: null,
          deletedAt: null,
        },
      ],
      sessionUserId: null,
    });

    await deleteTodo('user-1', 'synced-todo');
    await deleteTodo('user-1', 'local-todo');

    const store = readWebStore();
    expect(store.todos).toEqual([
      expect.objectContaining({ id: 'synced-todo', userId: 'user-2', title: 'Otro usuario' }),
    ]);
    expect(store.syncRecords).toEqual([
      expect.objectContaining({
        localId: 'synced-todo',
        userId: 'user-1',
        remoteId: 'remote-1',
        deletedAt: '2026-02-03T04:05:06.000Z',
      }),
    ]);
  });
});
