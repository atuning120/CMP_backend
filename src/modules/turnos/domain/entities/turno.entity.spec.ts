import { Turno } from './turno.entity';

const HORA = 60 * 60 * 1000;
const inicio = new Date('2026-10-05T08:00:00Z');
const nuevoTurno = () => new Turno(1, 10, 20, inicio, null, 1000, null, 'EN_CURSO');

describe('Turno', () => {
  it('no excede la duración máxima hasta pasadas 12 horas', () => {
    const turno = nuevoTurno();
    expect(turno.excedeDuracionMaxima(new Date(inicio.getTime() + 12 * HORA))).toBe(false);
    expect(turno.excedeDuracionMaxima(new Date(inicio.getTime() + 12 * HORA + 1))).toBe(true);
  });

  it('finalizar lo deja CERRADO con horómetro final', () => {
    const turno = nuevoTurno();
    const fin = new Date(inicio.getTime() + 8 * HORA);
    turno.finalizar(fin, 1008);
    expect(turno.estadoActual).toBe('CERRADO');
    expect(turno.fechaFin).toEqual(fin);
    expect(turno.horometroFinal).toBe(1008);
    expect(turno.enCurso).toBe(false);
  });

  it('rechaza un horómetro final menor al inicial', () => {
    expect(() => nuevoTurno().finalizar(new Date(), 999)).toThrow();
  });

  it('cerrarAutomaticamente fija el término en inicio + 12 h y estado CERRADO_AUTO', () => {
    const turno = nuevoTurno();
    turno.cerrarAutomaticamente();
    expect(turno.estadoActual).toBe('CERRADO_AUTO');
    expect(turno.fechaFin).toEqual(new Date(inicio.getTime() + 12 * HORA));
    expect(turno.horometroFinal).toBeNull();
  });

  it('un turno cerrado no puede volver a cerrarse', () => {
    const turno = nuevoTurno();
    turno.cerrarAutomaticamente();
    expect(() => turno.cerrarAutomaticamente()).toThrow();
    expect(() => turno.finalizar(new Date(), 2000)).toThrow();
    expect(turno.excedeDuracionMaxima(new Date(inicio.getTime() + 48 * HORA))).toBe(false);
  });
});
