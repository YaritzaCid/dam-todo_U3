import {
  loginSchema,
  normalizeEmail,
  registrationSchema,
  todoTitleSchema,
} from '../lib/validation-schemas';

function expectValidationMessage(result: { success: boolean; error?: { issues: Array<{ message: string }> } }, message: string) {
  expect(result.success).toBe(false);
  expect(result.error?.issues).toHaveLength(1);
  expect(result.error?.issues[0]?.message).toBe(message);
}

describe('validation schemas', () => {
  test('normaliza correo con espacios y mayúsculas', () => {
    expect(normalizeEmail('  Persona@Example.COM  ')).toBe('persona@example.com');
  });

  describe('loginSchema', () => {
    test('acepta login válido y normaliza correo', () => {
      const result = loginSchema.safeParse({ email: '  Persona@Example.COM  ', password: 'secret1' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ email: 'persona@example.com', password: 'secret1' });
      }
    });

    test('rechaza correo y contraseña vacíos', () => {
      expectValidationMessage(
        loginSchema.safeParse({ email: '  ', password: '' }),
        'Introduce correo y contraseña.'
      );
    });

    test('rechaza correo vacío', () => {
      expectValidationMessage(
        loginSchema.safeParse({ email: ' ', password: 'secret1' }),
        'Introduce correo.'
      );
    });

    test('rechaza contraseña vacía con mensaje requerido', () => {
      expectValidationMessage(
        loginSchema.safeParse({ email: 'persona@example.com', password: '' }),
        'Faltan piezas: introduce contraseña'
      );
    });

    test('rechaza contraseña corta', () => {
      expectValidationMessage(
        loginSchema.safeParse({ email: 'persona@example.com', password: '12345' }),
        'La contraseña debe tener mínimo 6 caracteres.'
      );
    });

    test('rechaza correo inválido', () => {
      expectValidationMessage(
        loginSchema.safeParse({ email: 'persona.example.com', password: 'secret1' }),
        'Usa un correo válido.'
      );
    });
  });

  describe('registrationSchema', () => {
    test('acepta registro válido y normaliza campos', () => {
      const result = registrationSchema.safeParse({
        name: '  Ana  ',
        email: '  ANA@Example.COM  ',
        password: 'secret1',
        confirmPassword: 'secret1',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Ana',
          email: 'ana@example.com',
          password: 'secret1',
          confirmPassword: 'secret1',
        });
      }
    });

    test('rechaza nombre vacío', () => {
      expectValidationMessage(
        registrationSchema.safeParse({ name: ' ', email: 'ana@example.com', password: 'secret1', confirmPassword: 'secret1' }),
        'Introduce tu nombre para crear tu cuenta.'
      );
    });

    test('rechaza correo vacío', () => {
      expectValidationMessage(
        registrationSchema.safeParse({ name: 'Ana', email: ' ', password: 'secret1', confirmPassword: 'secret1' }),
        'Introduce correo para crear tu cuenta.'
      );
    });

    test('rechaza correo inválido', () => {
      expectValidationMessage(
        registrationSchema.safeParse({ name: 'Ana', email: 'ana.example.com', password: 'secret1', confirmPassword: 'secret1' }),
        'Usa un correo válido.'
      );
    });

    test('rechaza contraseña vacía', () => {
      expectValidationMessage(
        registrationSchema.safeParse({ name: 'Ana', email: 'ana@example.com', password: '', confirmPassword: 'secret1' }),
        'Introduce contraseña.'
      );
    });

    test('rechaza contraseña corta', () => {
      expectValidationMessage(
        registrationSchema.safeParse({ name: 'Ana', email: 'ana@example.com', password: '12345', confirmPassword: '12345' }),
        'La contraseña debe tener mínimo 6 caracteres.'
      );
    });

    test('rechaza confirmación vacía', () => {
      expectValidationMessage(
        registrationSchema.safeParse({ name: 'Ana', email: 'ana@example.com', password: 'secret1', confirmPassword: '' }),
        'Confirma la contraseña para cerrar el registro.'
      );
    });

    test('rechaza contraseñas distintas', () => {
      expectValidationMessage(
        registrationSchema.safeParse({ name: 'Ana', email: 'ana@example.com', password: 'secret1', confirmPassword: 'secret2' }),
        'Las contraseñas no coinciden. Revísalas.'
      );
    });
  });

  describe('todoTitleSchema', () => {
    test('acepta título y elimina espacios', () => {
      expect(todoTitleSchema.parse('  Comprar pan  ')).toBe('Comprar pan');
    });

    test('rechaza título vacío', () => {
      const result = todoTitleSchema.safeParse('   ');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Escribe una tarea antes de añadirla.');
      }
    });
  });
});
