import type * as AlistoDb from '../lib/alisto-db';

const mockRandomUUID = jest.fn();
const mockDigestStringAsync = jest.fn();
const mockOpenDatabaseAsync = jest.fn();

let clearSession: typeof AlistoDb.clearSession;
let createTodo: typeof AlistoDb.createTodo;
let deleteTodo: typeof AlistoDb.deleteTodo;
let listTodos: typeof AlistoDb.listTodos;
let loadSession: typeof AlistoDb.loadSession;
let loginUser: typeof AlistoDb.loginUser;
let registerUser: typeof AlistoDb.registerUser;
let renameTodo: typeof AlistoDb.renameTodo;
let saveSession: typeof AlistoDb.saveSession;
let setTodoCompleted: typeof AlistoDb.setTodoCompleted;
let setTodoLocation: typeof AlistoDb.setTodoLocation;
let setTodoPhoto: typeof AlistoDb.setTodoPhoto;


type UserRow = {
  id: string;
  email: string;
  display_name: string | null;
  password_hash: string | null;
  password_salt: string | null;
  created_at?: string | null;
};

type TodoRow = {
  id: string;
  user_id: string;
  title: string;
  completed: number | null;
  photo_uri: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type TodoSyncRow = {
  local_id: string;
  user_id: string;
  remote_id: string | null;
  remote_synced_at: string | null;
  import_source: string | null;
  import_external_id: string | null;
  deleted_at: string | null;
};

type SessionRow = {
  id: number;
  user_id: string;
  email?: string;
  updated_at?: string;
};

function fakeHash(value: string) {
  return `hash:${Array.from(value).reduce((total, character) => total + character.charCodeAt(0), 0)}`;
}

function createNativeDatabase() {
  const state = {
    users: [] as UserRow[],
    todos: [] as TodoRow[],
    syncRows: [] as TodoSyncRow[],
    session: null as SessionRow | null,
  };

  const columnNames = {
    users: ['display_name', 'password_hash', 'password_salt', 'created_at'],
    sessions: ['user_id', 'email', 'updated_at'],
    todos: ['user_id', 'title', 'completed', 'created_at', 'updated_at', 'photo_uri', 'location_latitude', 'location_longitude'],
  };

  const db = {
    execAsync: jest.fn(async () => undefined),
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql === 'PRAGMA table_info(users)') {
        return columnNames.users.map((name) => ({ name }));
      }

      if (sql === 'PRAGMA table_info(sessions)') {
        return columnNames.sessions.map((name) => ({ name }));
      }

      if (sql === 'PRAGMA table_info(todos)') {
        return columnNames.todos.map((name) => ({ name }));
      }

      if (sql.includes('FROM todos WHERE user_id = ?')) {
        const userId = params[0] as string;
        return state.todos
          .filter((todo) => todo.user_id === userId)
          .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)));
      }

      if (sql.includes('FROM todo_sync WHERE user_id = ?')) {
        const userId = params[0] as string;
        return state.syncRows.filter((row) => row.user_id === userId);
      }

      throw new Error(`Unexpected getAllAsync query: ${sql}`);
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('FROM users WHERE email = ?')) {
        const email = params[0] as string;
        return state.users.find((user) => user.email === email) ?? null;
      }

      if (sql.includes('FROM sessions')) {
        if (!state.session) {
          return null;
        }

        const user = state.users.find((storedUser) => storedUser.id === state.session?.user_id);
        return user ? {
          id: user.id,
          email: user.email,
          name: user.display_name && user.display_name !== '' ? user.display_name : user.email,
        } : null;
      }

      if (sql.includes('FROM todo_sync WHERE local_id = ? AND user_id = ?')) {
        const [localId, userId] = params as [string, string];
        return state.syncRows.find((row) => row.local_id === localId && row.user_id === userId) ?? null;
      }

      throw new Error(`Unexpected getFirstAsync query: ${sql}`);
    }),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.startsWith("UPDATE users SET display_name = email")) {
        for (const user of state.users) {
          if (!user.display_name) {
            user.display_name = user.email;
          }
        }
        return { changes: 0 };
      }

      if (sql.startsWith("UPDATE todos SET title = 'Tarea sin título'")) {
        for (const todo of state.todos) {
          if (!todo.title) {
            todo.title = 'Tarea sin título';
          }
        }
        return { changes: 0 };
      }

      if (sql.startsWith('UPDATE todos SET completed = 0 WHERE completed IS NULL')) {
        for (const todo of state.todos) {
          if (todo.completed === null) {
            todo.completed = 0;
          }
        }
        return { changes: 0 };
      }

      if (sql.startsWith('UPDATE todos SET created_at = ? WHERE created_at IS NULL')) {
        const [createdAt] = params as [string];
        for (const todo of state.todos) {
          if (!todo.created_at) {
            todo.created_at = createdAt;
          }
        }
        return { changes: 0 };
      }

      if (sql.startsWith('UPDATE todos SET updated_at = COALESCE(created_at, ?) WHERE updated_at IS NULL')) {
        const [updatedAt] = params as [string];
        for (const todo of state.todos) {
          if (!todo.updated_at) {
            todo.updated_at = todo.created_at ?? updatedAt;
          }
        }
        return { changes: 0 };
      }

      if (sql.startsWith('INSERT INTO users')) {
        const [id, email, displayName, passwordHash, passwordSalt, createdAt] = params as string[];
        state.users.push({
          id,
          email,
          display_name: displayName,
          password_hash: passwordHash,
          password_salt: passwordSalt,
          created_at: createdAt,
        });
        return { changes: 1 };
      }

      if (sql.startsWith('UPDATE users SET display_name = ?')) {
        const [displayName, passwordHash, passwordSalt, createdAt, id] = params as string[];
        const user = state.users.find((storedUser) => storedUser.id === id);
        if (user) {
          user.display_name = displayName;
          user.password_hash = passwordHash;
          user.password_salt = passwordSalt;
          user.created_at = user.created_at ?? createdAt;
        }
        return { changes: user ? 1 : 0 };
      }

      if (sql.startsWith('INSERT OR REPLACE INTO sessions')) {
        const [id, userId, email, updatedAt] = params as [number, string, string | undefined, string | undefined];
        state.session = { id, user_id: userId, email, updated_at: updatedAt };
        return { changes: 1 };
      }

      if (sql.startsWith('DELETE FROM sessions WHERE id = 1')) {
        state.session = null;
        return { changes: 1 };
      }

      if (sql.startsWith('INSERT INTO todos')) {
        const [id, userId, title, completed, photoUri, locationLatitude, locationLongitude, createdAt, updatedAt] = params as [string, string, string, number, string | null, number | null, number | null, string, string];
        state.todos.push({
          id,
          user_id: userId,
          title,
          completed,
          photo_uri: photoUri,
          location_latitude: locationLatitude,
          location_longitude: locationLongitude,
          created_at: createdAt,
          updated_at: updatedAt,
        });
        return { changes: 1 };
      }

      if (sql.startsWith('UPDATE todos SET completed = ?')) {
        const [completed, updatedAt, todoId, userId] = params as [number, string, string, string];
        const todo = state.todos.find((storedTodo) => storedTodo.id === todoId && storedTodo.user_id === userId);
        if (todo) {
          todo.completed = completed;
          todo.updated_at = updatedAt;
        }
        return { changes: todo ? 1 : 0 };
      }

      if (sql.startsWith('UPDATE todos SET title = ?')) {
        const [title, updatedAt, todoId, userId] = params as [string, string, string, string];
        const todo = state.todos.find((storedTodo) => storedTodo.id === todoId && storedTodo.user_id === userId);
        if (todo) {
          todo.title = title;
          todo.updated_at = updatedAt;
        }
        return { changes: todo ? 1 : 0 };
      }

      if (sql.startsWith('UPDATE todos SET photo_uri = ?')) {
        const [photoUri, updatedAt, todoId, userId] = params as [string, string, string, string];
        const todo = state.todos.find((storedTodo) => storedTodo.id === todoId && storedTodo.user_id === userId);
        if (todo) {
          todo.photo_uri = photoUri;
          todo.updated_at = updatedAt;
        }
        return { changes: todo ? 1 : 0 };
      }

      if (sql.startsWith('UPDATE todos SET location_latitude = ?')) {
        const [latitude, longitude, updatedAt, todoId, userId] = params as [number, number, string, string, string];
        const todo = state.todos.find((storedTodo) => storedTodo.id === todoId && storedTodo.user_id === userId);
        if (todo) {
          todo.location_latitude = latitude;
          todo.location_longitude = longitude;
          todo.updated_at = updatedAt;
        }
        return { changes: todo ? 1 : 0 };
      }

      if (sql.startsWith('INSERT INTO todo_sync')) {
        const [localId, userId, remoteId, remoteSyncedAt, importSource, importExternalId, deletedAt] = params as [string, string, string | null, string | null, string | null, string | null, string | null];
        const rowIndex = state.syncRows.findIndex((row) => row.local_id === localId);
        const nextRow = {
          local_id: localId,
          user_id: userId,
          remote_id: remoteId,
          remote_synced_at: remoteSyncedAt,
          import_source: importSource,
          import_external_id: importExternalId,
          deleted_at: deletedAt,
        };
        if (rowIndex >= 0) {
          state.syncRows[rowIndex] = nextRow;
        } else {
          state.syncRows.push(nextRow);
        }
        return { changes: 1 };
      }

      if (sql.startsWith('DELETE FROM todos WHERE id = ? AND user_id = ?')) {
        const [todoId, userId] = params as [string, string];
        state.todos = state.todos.filter((todo) => todo.id !== todoId || todo.user_id !== userId);
        return { changes: 1 };
      }

      throw new Error(`Unexpected runAsync query: ${sql}`);
    }),
  };

  return { db, state };
}

const nativeDatabase = createNativeDatabase();

describe('alisto-db native auth and CRUD', () => {
  beforeEach(() => {
    nativeDatabase.state.users = [];
    nativeDatabase.state.todos = [];
    nativeDatabase.state.syncRows = [];
    nativeDatabase.state.session = null;
    nativeDatabase.db.execAsync.mockClear();
    nativeDatabase.db.getAllAsync.mockClear();
    nativeDatabase.db.getFirstAsync.mockClear();
    nativeDatabase.db.runAsync.mockClear();
    mockOpenDatabaseAsync.mockResolvedValue(nativeDatabase.db);
    mockRandomUUID.mockReset();
    mockDigestStringAsync.mockReset();
    mockDigestStringAsync.mockImplementation((_algorithm: string, value: string) => Promise.resolve(fakeHash(value)));
    jest.resetModules();
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('expo-crypto', () => ({
      randomUUID: mockRandomUUID,
      digestStringAsync: mockDigestStringAsync,
      CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    }));
    jest.doMock('expo-sqlite', () => ({
      openDatabaseAsync: mockOpenDatabaseAsync,
    }));
    ({
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
    } = require('../lib/alisto-db'));

    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-04T05:06:07.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('registra usuario nativo nuevo con correo normalizado y contraseña hasheada', async () => {
    mockRandomUUID.mockReturnValueOnce('user-1').mockReturnValueOnce('salt-1');

    await expect(registerUser('Ana', '  ANA@Example.COM  ', 'secret1')).resolves.toEqual({
      ok: true,
      account: { id: 'user-1', email: 'ana@example.com', name: 'Ana' },
    });

    expect(mockOpenDatabaseAsync).toHaveBeenCalledWith('piezario.db');
    expect(mockDigestStringAsync).toHaveBeenCalledWith('SHA256', 'salt-1:ana@example.com:secret1');
    expect(nativeDatabase.state.users).toEqual([
      expect.objectContaining({
        id: 'user-1',
        email: 'ana@example.com',
        display_name: 'Ana',
        password_hash: fakeHash('salt-1:ana@example.com:secret1'),
        password_salt: 'salt-1',
        created_at: '2026-03-04T05:06:07.000Z',
      }),
    ]);
    expect(JSON.stringify(nativeDatabase.state.users[0])).not.toContain('secret1');
  });

  test('rechaza duplicado nativo y completa usuario legacy sin duplicarlo', async () => {
    nativeDatabase.state.users.push({
      id: 'existing-user',
      email: 'ana@example.com',
      display_name: 'Ana',
      password_hash: fakeHash('salt-existing:ana@example.com:secret1'),
      password_salt: 'salt-existing',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await expect(registerUser('Ana 2', 'ANA@example.com', 'secret2')).resolves.toEqual({
      ok: false,
      message: 'Ese correo ya tiene cuenta. Inicia sesión.',
    });

    nativeDatabase.state.users = [
      {
        id: 'legacy-user',
        email: 'legacy@example.com',
        display_name: null,
        password_hash: null,
        password_salt: null,
        created_at: null,
      },
    ];
    mockRandomUUID.mockReturnValueOnce('salt-legacy');

    await expect(registerUser('Legacy', 'LEGACY@example.com', 'secret1')).resolves.toEqual({
      ok: true,
      account: { id: 'legacy-user', email: 'legacy@example.com', name: 'Legacy' },
    });

    expect(nativeDatabase.state.users).toHaveLength(1);
    expect(nativeDatabase.state.users[0]).toMatchObject({
      id: 'legacy-user',
      display_name: 'Legacy',
      password_hash: fakeHash('salt-legacy:legacy@example.com:secret1'),
      password_salt: 'salt-legacy',
      created_at: '2026-03-04T05:06:07.000Z',
    });
  });

  test('devuelve errores relevantes de login nativo', async () => {
    nativeDatabase.state.users.push(
      {
        id: 'incomplete-user',
        email: 'incomplete@example.com',
        display_name: 'Cuenta incompleta',
        password_hash: null,
        password_salt: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'user-1',
        email: 'ana@example.com',
        display_name: 'Ana',
        password_hash: fakeHash('salt-1:ana@example.com:secret1'),
        password_salt: 'salt-1',
        created_at: '2026-01-01T00:00:00.000Z',
      }
    );

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

  test('login nativo correcto guarda sesión y loadSession la lee', async () => {
    nativeDatabase.state.users.push({
      id: 'user-1',
      email: 'ana@example.com',
      display_name: null,
      password_hash: fakeHash('salt-1:ana@example.com:secret1'),
      password_salt: 'salt-1',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await expect(loginUser(' ANA@example.com ', 'secret1')).resolves.toEqual({
      ok: true,
      session: { id: 'user-1', email: 'ana@example.com', name: 'ana@example.com' },
    });
    await expect(loadSession()).resolves.toEqual({ id: 'user-1', email: 'ana@example.com', name: 'ana@example.com' });

    expect(nativeDatabase.state.session).toMatchObject({
      id: 1,
      user_id: 'user-1',
      email: 'ana@example.com',
      updated_at: '2026-03-04T05:06:07.000Z',
    });
  });

  test('saveSession y clearSession gestionan sesión nativa', async () => {
    nativeDatabase.state.users.push({
      id: 'user-2',
      email: 'bea@example.com',
      display_name: 'Bea',
      password_hash: fakeHash('salt-2:bea@example.com:secret2'),
      password_salt: 'salt-2',
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await saveSession({ id: 'user-2', email: 'bea@example.com', name: 'Bea' });
    await expect(loadSession()).resolves.toEqual({ id: 'user-2', email: 'bea@example.com', name: 'Bea' });

    await clearSession();
    await expect(loadSession()).resolves.toBeNull();
  });

  test('saveSession nativo funciona con tabla sessions legacy', async () => {
    const defaultGetAllAsync = nativeDatabase.db.getAllAsync.getMockImplementation();
    if (!defaultGetAllAsync) {
      throw new Error('Missing default getAllAsync mock implementation.');
    }
    let sessionPragmaCalls = 0;

    nativeDatabase.state.users.push({
      id: 'legacy-session-user',
      email: 'legacy@example.com',
      display_name: 'Legacy',
      password_hash: fakeHash('salt-legacy:legacy@example.com:secret1'),
      password_salt: 'salt-legacy',
      created_at: '2026-01-01T00:00:00.000Z',
    });
    nativeDatabase.db.getAllAsync.mockImplementation(async (sql: string, ...params: unknown[]) => {
      if (sql === 'PRAGMA table_info(sessions)') {
        sessionPragmaCalls += 1;
        return sessionPragmaCalls > 1 ? [{ name: 'user_id' }] : [{ name: 'user_id' }, { name: 'email' }, { name: 'updated_at' }];
      }

      return defaultGetAllAsync(sql, ...params);
    });

    await saveSession({ id: 'legacy-session-user', email: 'legacy@example.com', name: 'Legacy' });

    expect(nativeDatabase.state.session).toEqual({
      id: 1,
      user_id: 'legacy-session-user',
      email: undefined,
      updated_at: undefined,
    });
  });

  test('crea y lista tareas nativas del usuario con conversión de filas', async () => {
    mockRandomUUID.mockReturnValueOnce('todo-1');

    await expect(createTodo('user-1', '  Comprar pan  ', 'photo://one')).resolves.toEqual({
      id: 'todo-1',
      userId: 'user-1',
      title: 'Comprar pan',
      completed: false,
      createdAt: '2026-03-04T05:06:07.000Z',
      updatedAt: '2026-03-04T05:06:07.000Z',
      photoUri: 'photo://one',
      locationLatitude: null,
      locationLongitude: null,
    });

    nativeDatabase.state.todos.push({
      id: 'todo-other',
      user_id: 'user-2',
      title: 'Otro usuario',
      completed: 1,
      photo_uri: null,
      location_latitude: null,
      location_longitude: null,
      created_at: '2026-03-05T00:00:00.000Z',
      updated_at: '2026-03-05T00:00:00.000Z',
    });

    await expect(listTodos('user-1')).resolves.toEqual([
      {
        id: 'todo-1',
        userId: 'user-1',
        title: 'Comprar pan',
        completed: false,
        createdAt: '2026-03-04T05:06:07.000Z',
        updatedAt: '2026-03-04T05:06:07.000Z',
        photoUri: 'photo://one',
        locationLatitude: null,
        locationLongitude: null,
      },
    ]);
  });

  test('actualiza completed, título, foto y ubicación en tarea nativa propia', async () => {
    nativeDatabase.state.todos.push(
      {
        id: 'todo-1',
        user_id: 'user-1',
        title: 'Original',
        completed: 0,
        photo_uri: null,
        location_latitude: null,
        location_longitude: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 'todo-1',
        user_id: 'user-2',
        title: 'Otro usuario',
        completed: 0,
        photo_uri: null,
        location_latitude: null,
        location_longitude: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      }
    );

    await expect(setTodoCompleted('user-1', 'todo-1', true)).resolves.toBe('2026-03-04T05:06:07.000Z');
    await setTodoCompleted('user-1', 'todo-1', false);
    await renameTodo('user-1', 'todo-1', '  Renombrada  ');
    await setTodoPhoto('user-1', 'todo-1', 'photo://updated');
    await setTodoLocation('user-1', 'todo-1', 40.4168, -3.7038);
    await renameTodo('user-1', 'missing', 'No existe');

    expect(nativeDatabase.state.todos.find((todo) => todo.id === 'todo-1' && todo.user_id === 'user-1')).toMatchObject({
      title: 'Renombrada',
      completed: 0,
      photo_uri: 'photo://updated',
      location_latitude: 40.4168,
      location_longitude: -3.7038,
      updated_at: '2026-03-04T05:06:07.000Z',
    });
    expect(nativeDatabase.state.todos.find((todo) => todo.id === 'todo-1' && todo.user_id === 'user-2')).toMatchObject({
      title: 'Otro usuario',
      completed: 0,
      photo_uri: null,
      location_latitude: null,
      location_longitude: null,
    });
  });

  test('deleteTodo nativo borra local y conserva tombstone remoto', async () => {
    nativeDatabase.state.todos.push(
      {
        id: 'synced-todo',
        user_id: 'user-1',
        title: 'Sincronizada',
        completed: 0,
        photo_uri: null,
        location_latitude: null,
        location_longitude: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 'synced-todo',
        user_id: 'user-2',
        title: 'Otro usuario',
        completed: 0,
        photo_uri: null,
        location_latitude: null,
        location_longitude: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      },
      {
        id: 'local-todo',
        user_id: 'user-1',
        title: 'Local',
        completed: 0,
        photo_uri: null,
        location_latitude: null,
        location_longitude: null,
        created_at: '2026-02-01T00:00:00.000Z',
        updated_at: '2026-02-01T00:00:00.000Z',
      }
    );
    nativeDatabase.state.syncRows.push({
      local_id: 'synced-todo',
      user_id: 'user-1',
      remote_id: 'remote-1',
      remote_synced_at: '2026-02-02T00:00:00.000Z',
      import_source: null,
      import_external_id: null,
      deleted_at: null,
    });

    await deleteTodo('user-1', 'synced-todo');
    await deleteTodo('user-1', 'local-todo');

    expect(nativeDatabase.state.todos).toEqual([
      expect.objectContaining({ id: 'synced-todo', user_id: 'user-2', title: 'Otro usuario' }),
    ]);
    expect(nativeDatabase.state.syncRows).toEqual([
      expect.objectContaining({
        local_id: 'synced-todo',
        user_id: 'user-1',
        remote_id: 'remote-1',
        deleted_at: '2026-03-04T05:06:07.000Z',
      }),
    ]);
  });
});
