import * as bcrypt from 'bcryptjs';
import { exigirPasswordSegura } from '../../auth/application/password-segura';
import type { AccesoUsuario, FichaOperador } from '../domain/repositories/usuario.repository.port';
import { normalizarRut } from './rut';
import { usuarioError } from './usuario.errors';

// Validación común al crear y al editar usuarios desde el panel web

const LARGO_MAXIMO_NOMBRE = 50; // nombre + apellido caben en usuario.nombre (100)
const LARGO_MAXIMO_NOMBRE_COMPLETO = 100;
const LARGO_MAXIMO_EMAIL = 150;
const LARGO_MAXIMO_TELEFONO = 20;
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const texto = (valor: unknown) => (typeof valor === 'string' ? valor.trim() : '');

// Correo en minúsculas: el login lo compara sin distinguir mayúsculas
export const leerEmail = (valor: unknown): string => {
  const email = texto(valor).toLowerCase();
  if (!email) throw usuarioError('DATOS_INCOMPLETOS');
  if (email.length > LARGO_MAXIMO_EMAIL || !FORMATO_EMAIL.test(email)) throw usuarioError('EMAIL_INVALIDO');
  return email;
};

// Nombre completo de un usuario web (en la tabla USUARIO va en un solo campo)
export const leerNombreCompleto = (valor: unknown): string => {
  const nombre = texto(valor);
  if (!nombre) throw usuarioError('DATOS_INCOMPLETOS');
  if (nombre.length > LARGO_MAXIMO_NOMBRE_COMPLETO) throw usuarioError('NOMBRE_DEMASIADO_LARGO');
  return nombre;
};

export const leerNombreYApellido = (datos: { nombre?: unknown; apellido?: unknown }) => {
  const nombre = texto(datos.nombre);
  const apellido = texto(datos.apellido);
  if (!nombre || !apellido) throw usuarioError('DATOS_INCOMPLETOS');
  if (nombre.length > LARGO_MAXIMO_NOMBRE || apellido.length > LARGO_MAXIMO_NOMBRE) throw usuarioError('NOMBRE_DEMASIADO_LARGO');
  return { nombre, apellido };
};

export const leerFichaOperador = (datos: { nombre?: unknown; apellido?: unknown; rut?: unknown; telefono?: unknown }): FichaOperador => {
  const { nombre, apellido } = leerNombreYApellido(datos);
  const rut = normalizarRut(datos.rut);
  if (!rut) throw usuarioError('RUT_INVALIDO');
  const telefono = texto(datos.telefono) || null;
  if (telefono && telefono.length > LARGO_MAXIMO_TELEFONO) throw usuarioError('TELEFONO_INVALIDO');
  return { nombre, apellido, rut, telefono };
};

// La contraseña escrita, o null si viene vacía
export const leerPassword = (valor: unknown): string | null =>
  typeof valor === 'string' && valor !== '' ? exigirPasswordSegura(valor) : null;

export const accesoConPassword = async (password: string): Promise<AccesoUsuario> => ({
  proveedorAuth: 'CREDENCIALES',
  passwordHash: await bcrypt.hash(password, 10),
});

// Sin contraseña: la cuenta se vincula por correo en su primer login con Microsoft
export const ACCESO_MICROSOFT: AccesoUsuario = { proveedorAuth: 'MICROSOFT', passwordHash: null };
