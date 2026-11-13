'use client';

import { comparadorDelMes, LUIS, resumenMeses } from '@contafly/datos-demo';
import { formatoMxn, nombreMes, textoVencimiento } from '@contafly/motor-fiscal';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { accionDemo } from '../lib/api';
import { useChat, usePersonaChat } from '../lib/chat';
import { type Narracion, useDemo, useNarracion } from '../lib/contexto';
import { leerSesion } from '../lib/sesion';
import { Barra, Chip, Hoja, Notificacion, Renglon } from './ui';

type Tab = 'inicio' | 'movimientos' | 'documentos' | 'perfil';
type Flujo = 'nada' | 'desglose' | 'confirmar' | 'biometria' | 'progreso' | 'exito';

const NOMBRE_APP: Record<string, string> = { uber: 'Uber', didi: 'DiDi' };
const PASOS_PROGRESO = ['Conectando', 'Capturando', 'Presentando'];
const f = formatoMxn;

export function CasoB() {
  const { hoy, whatsappReal } = useDemo();
  const chat = useChat();
  usePersonaChat('luis');
  const meses = useMemo(() => resumenMeses(LUIS, hoy), [hoy]);
  const octubre = meses.find((m) => m.mes === 10);
  const periodo = LUIS.periodos.find((p) => p.mes === 10);
  const comparador = useMemo(() => comparadorDelMes(LUIS, 10, hoy), [hoy]);
  const [tab, setTab] = useState<Tab>('inicio');
  const [flujo, setFlujo] = useState<Flujo>('nada');
  const [presentado, setPresentado] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [verCompleto, setVerCompleto] = useState(false);
  const [aviso, setAviso] = useState<{ titulo: string; texto: string } | null>(null);
  const temporizadores = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const t of temporizadores.current) window.clearTimeout(t);
    },
    [],
  );

  const despues = (ms: number, fn: () => void) => {
    temporizadores.current.push(window.setTimeout(fn, ms));
  };

  // Datos fijos de la demo: octubre de Luis siempre existe.
  if (!octubre || !periodo) throw new Error('Faltan los datos de octubre de Luis');
  const r = octubre.resultado;
  const vence = textoVencimiento(hoy, octubre.venceEl);
  const totalTxt = f(r.totalCent);

  const narraciones: Record<string, Narracion> = {
    inicio: {
      paso: 'Caso B',
      titulo: `Luis sabe cuánto paga: ${totalTxt}`,
      texto: [
        'Luis maneja en Uber y DiDi. Contafly leyó sus ingresos, las retenciones que hicieron las apps y sus facturas de gasolina, mantenimiento y celular.',
        'El motor fiscal calcula el ISR y el IVA del mes con la tarifa 2026. La inteligencia artificial solo explica, nunca calcula.',
        `Hoy es 13 de noviembre: ${vence}`,
      ],
    },
    desglose: {
      paso: 'Desglose',
      titulo: 'Cada peso tiene explicación',
      texto: [
        'Ingresos de octubre: $32,000. Gastos con factura: $11,500. La diferencia es la utilidad sobre la que se calcula el ISR.',
        'Lo que ya le retuvieron las apps se resta. Por eso solo paga $1,818.45 de ISR y $720 de IVA.',
      ],
    },
    confirmar: {
      paso: 'Presentar',
      titulo: 'Un toque para presentar',
      texto: [
        'Luis revisa el resumen y confirma con su huella o su cara. Contafly presenta la declaración por él.',
      ],
    },
    progreso: {
      paso: 'Presentar',
      titulo: 'Contafly presenta la declaración',
      texto: [
        'En la demo esto es una simulación. En el producto, Contafly captura y presenta en el portal del SAT.',
      ],
    },
    exito: {
      paso: 'Listo',
      titulo: 'Declaración presentada y línea de captura en WhatsApp',
      texto: [
        'El acuse y la línea de captura quedan en Documentos. Al mismo tiempo llegan por WhatsApp.',
        'Luis paga en su banco cuando quiera antes del 17. Si tiene dudas, le escribe a su contador virtual.',
      ],
    },
    movimientos: {
      paso: 'Movimientos',
      titulo: 'Todo lo que reportaron las apps',
      texto: [
        'Ingresos por app con sus retenciones, y los gastos con factura que bajan el impuesto.',
      ],
    },
    documentos: {
      paso: 'Documentos',
      titulo: 'Acuses y líneas de captura en un solo lugar',
      texto: [
        'Los PDFs de la demo llevan una marca de agua y datos ficticios. No sirven para pagar.',
      ],
    },
    perfil: {
      paso: 'Perfil',
      titulo: 'Buzón tributario al día',
      texto: [
        'Contafly revisa el buzón tributario y avisa si llega algo. Luis puede pedir que su contador le llame.',
      ],
    },
  };
  const claveNarracion =
    flujo === 'nada'
      ? tab
      : flujo === 'biometria'
        ? 'confirmar'
        : flujo === 'desglose'
          ? 'desglose'
          : flujo;
  // biome-ignore lint/style/noNonNullAssertion: todas las claves existen
  useNarracion(narraciones[claveNarracion]!);

  const texto = `Listo, presentamos tu declaración de octubre. Aquí está tu línea de captura por ${totalTxt}. Págala en tu banco cuando quieras, antes del 17 de noviembre.`;

  /** Muestra en el teléfono la notificación de WhatsApp, como llegaría al celular. */
  function notificar(t: string) {
    despues(1400, () => setAviso({ titulo: 'WhatsApp, Contafly', texto: t }));
  }

  function presentar() {
    setFlujo('progreso');
    setProgreso(0);
    for (const i of PASOS_PROGRESO.keys()) {
      despues(700 * (i + 1), () => setProgreso(((i + 1) / PASOS_PROGRESO.length) * 100));
    }
    despues(2400, () => {
      setPresentado(true);
      setFlujo('exito');
      if (!whatsappReal) {
        // Sin Twilio: el PDF y el mensaje llegan al WhatsApp simulado de la web
        void chat.recibir([
          { tipo: 'pdf', mes: 10 },
          { tipo: 'texto', texto },
        ]);
        notificar(texto);
        return;
      }
      const sesion = leerSesion();
      void accionDemo('presentar', {
        persona: 'luis',
        mes: 10,
        telefono: sesion?.telefono,
        sesionId: sesion?.sesionId,
      }).then((res) =>
        setAviso(
          res.ok
            ? {
                titulo: 'Te llegó a WhatsApp',
                texto: 'Revisa tu WhatsApp: ahí están tu PDF y tu línea de captura.',
              }
            : {
                titulo: 'No llegó a tu WhatsApp',
                texto:
                  res.mensaje ??
                  'Conecta tu WhatsApp en el inicio para recibir la línea de captura.',
              },
        ),
      );
    });
  }

  async function llamar() {
    if (!whatsappReal) {
      chat.llamar();
      return;
    }
    const sesion = leerSesion();
    const res = await accionDemo('llamar', {
      persona: 'luis',
      telefono: sesion?.telefono,
      sesionId: sesion?.sesionId,
    });
    setAviso(
      res.ok
        ? { titulo: 'Te estamos llamando', texto: 'Tu contador virtual te marca en unos segundos.' }
        : { titulo: 'No pudimos llamar', texto: res.mensaje ?? 'Intenta de nuevo en un momento.' },
    );
  }

  async function recordatorio(tipo: 'dia10' | 'dia15' | 'dia17') {
    const textos = {
      dia10: `Tu mes está listo. Octubre suma ${totalTxt} y vence el 17 de noviembre. ¿Lo presentamos?`,
      dia15: `Faltan 2 días para el 17 de noviembre. Tu declaración de octubre es de ${totalTxt}.`,
      dia17: `Hoy vence tu declaración de octubre por ${totalTxt}. Si quieres, la presento ahora y te mando la línea de captura.`,
    } as const;
    if (!whatsappReal) {
      void chat.recibir([{ tipo: 'texto', texto: textos[tipo] }]);
      notificar(textos[tipo]);
      return;
    }
    const sesion = leerSesion();
    const res = await accionDemo('recordatorio', {
      persona: 'luis',
      tipo,
      telefono: sesion?.telefono,
      sesionId: sesion?.sesionId,
    });
    setAviso(
      res.ok
        ? { titulo: 'Recordatorio enviado', texto: 'Revisa tu WhatsApp.' }
        : { titulo: 'No se envió', texto: res.mensaje ?? 'Conecta tu WhatsApp en el inicio.' },
    );
  }

  return (
    <>
      {aviso && (
        <Notificacion titulo={aviso.titulo} texto={aviso.texto} onCerrar={() => setAviso(null)} />
      )}
      <main className="pantalla">
        <div className="fila" style={{ marginBottom: 8 }}>
          <Link href="/" className="boton-link">
            ‹ Casos
          </Link>
          <span className="texto-low">Hola, {LUIS.nombre}</span>
        </div>

        {tab === 'inicio' && (
          <div className="pila entrada">
            <div className="tarjeta">
              <div className="fila">
                <span className="texto-mid">Octubre 2026</span>
                {presentado ? (
                  <Chip tono="verde">Presentada</Chip>
                ) : (
                  <Chip tono="ambar">Por presentar</Chip>
                )}
              </div>
              <div className="monto">{totalTxt}</div>
              <p style={{ margin: '0 0 14px' }}>{vence}</p>
              {presentado ? (
                <button
                  type="button"
                  className="boton boton-sec"
                  onClick={() => setTab('documentos')}
                >
                  Ver acuse y línea de captura
                </button>
              ) : (
                <button
                  type="button"
                  className="boton"
                  onClick={() => setFlujo('confirmar')}
                  disabled={!octubre.compuertas.puedePresentar}
                >
                  Confirmar y presentar
                </button>
              )}
              <button type="button" className="boton-link" onClick={() => setFlujo('desglose')}>
                Ver desglose del mes
              </button>
            </div>

            <div className="tarjeta">
              <Renglon etiqueta="ISR a pagar" valor={f(r.isr.aPagarCent)} />
              <Renglon etiqueta="IVA a pagar" valor={f(r.iva.aPagarCent)} />
              <Renglon etiqueta="Total" valor={totalTxt} total />
            </div>

            <div className="tarjeta">
              <h2 className="subtitulo">Inscrito te sale más barato</h2>
              <p style={{ margin: '6px 0 0' }}>
                Sin RFC te habrían retenido{' '}
                <strong className="num">{f(comparador.sinRfcCent)}</strong> este mes. Inscrito,
                entre retenciones y pago:{' '}
                <strong className="num">{f(comparador.inscritoCent)}</strong>.
              </p>
            </div>

            <div className="tarjeta fila">
              <div>
                <strong>Buzón tributario</strong>
                <div className="texto-low">Revisado hoy</div>
              </div>
              <Chip tono="verde">Sin avisos nuevos</Chip>
            </div>
          </div>
        )}

        {tab === 'movimientos' && (
          <div className="pila entrada">
            <h1 className="titulo">Movimientos de octubre</h1>
            <div className="tarjeta">
              <h2 className="subtitulo" style={{ marginBottom: 4 }}>
                Ingresos por app
              </h2>
              {periodo.ingresos.map((i) => (
                <div key={i.app} className="renglon" style={{ display: 'block' }}>
                  <div className="fila">
                    <strong>{NOMBRE_APP[i.app] ?? i.app}</strong>
                    <span className="num">{f(i.subtotalCent)}</span>
                  </div>
                  <div className="fila texto-low">
                    <span>Te retuvo ISR 2.1% e IVA 8%</span>
                    <span className="num">
                      {f(i.isrRetenidoCent)} y {f(i.ivaRetenidoCent)}
                    </span>
                  </div>
                </div>
              ))}
              <Renglon etiqueta="Total antes de IVA" valor={f(r.ingresosCent)} total />
            </div>
            <div className="tarjeta">
              <h2 className="subtitulo" style={{ marginBottom: 4 }}>
                Gastos con factura
              </h2>
              {periodo.gastos.map((g) => (
                <Renglon key={g.concepto} etiqueta={g.concepto} valor={f(g.subtotalCent)} />
              ))}
              <Renglon etiqueta="Total" valor={f(r.gastosCent)} total />
            </div>
          </div>
        )}

        {tab === 'documentos' && (
          <div className="pila entrada">
            <h1 className="titulo">Documentos</h1>
            {presentado && (
              <a
                className="tarjeta fila"
                href="/api/acuse?persona=luis&mes=10"
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div>
                  <strong>Acuse y línea de captura, octubre</strong>
                  <div className="texto-low">PDF de demostración por {totalTxt}</div>
                </div>
                <Chip tono="verde">Nuevo</Chip>
              </a>
            )}
            {meses
              .filter((m) => m.presentado)
              .reverse()
              .slice(0, 3)
              .map((m) => (
                <a
                  key={m.mes}
                  className="tarjeta fila"
                  href={`/api/acuse?persona=luis&mes=${m.mes}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div>
                    <strong>Acuse de {nombreMes(m.mes)}</strong>
                    <div className="texto-low">PDF de demostración</div>
                  </div>
                  <Chip tono="verde">Presentada</Chip>
                </a>
              ))}
            <p className="texto-low">
              Los PDFs llevan marca de agua y datos ficticios. No son documentos del SAT ni sirven
              para pagar.
            </p>
          </div>
        )}

        {tab === 'perfil' && (
          <div className="pila entrada">
            <h1 className="titulo">{LUIS.nombreCompleto}</h1>
            <div className="tarjeta">
              <Renglon etiqueta="RFC (ficticio)" valor={LUIS.rfc} />
              <Renglon etiqueta="Régimen" valor="Plataformas tecnológicas" />
              <Renglon etiqueta="Apps" valor="Uber y DiDi" />
              <Renglon
                etiqueta="Buzón tributario"
                valor={<Chip tono="verde">Sin avisos nuevos</Chip>}
              />
            </div>
            <div className="tarjeta pila">
              <h2 className="subtitulo">Tu contador virtual</h2>
              <button type="button" className="boton" onClick={() => void llamar()}>
                Que mi contador me llame
              </button>
              <p className="texto-low" style={{ margin: 0 }}>
                Simular un recordatorio de WhatsApp:
              </p>
              <div className="opciones">
                <button type="button" className="opcion" onClick={() => void recordatorio('dia10')}>
                  Día 10
                </button>
                <button type="button" className="opcion" onClick={() => void recordatorio('dia15')}>
                  Día 15
                </button>
                <button type="button" className="opcion" onClick={() => void recordatorio('dia17')}>
                  Día 17
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <nav className="tabs" aria-label="Secciones">
        {(
          [
            ['inicio', 'Inicio'],
            ['movimientos', 'Movimientos'],
            ['documentos', 'Documentos'],
            ['perfil', 'Perfil'],
          ] as const
        ).map(([id, nombre]) => (
          <button
            key={id}
            type="button"
            className="tab"
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            {nombre}
          </button>
        ))}
      </nav>

      {flujo === 'desglose' && (
        <Hoja titulo="Desglose de octubre" onCerrar={() => setFlujo('nada')}>
          <Renglon etiqueta="Ingresos de Uber" valor={f(r.ingresosPorApp.uber ?? 0)} />
          <Renglon etiqueta="Ingresos de DiDi" valor={f(r.ingresosPorApp.didi ?? 0)} />
          <Renglon etiqueta="Menos gastos con factura" valor={f(-r.gastosCent)} />
          <Renglon etiqueta="Utilidad del mes" valor={f(r.ingresosCent - r.gastosCent)} total />
          <Renglon etiqueta="ISR del mes" valor={f(r.isr.causadoDelMesCent)} />
          <Renglon etiqueta="Menos ISR que te retuvieron" valor={f(-r.isr.retenidoDelMesCent)} />
          <Renglon etiqueta="ISR a pagar" valor={f(r.isr.aPagarCent)} total />
          <Renglon etiqueta="IVA de tus ingresos (16%)" valor={f(r.iva.trasladadoCent)} />
          <Renglon etiqueta="Menos IVA de tus gastos" valor={f(-r.iva.acreditableCent)} />
          <Renglon etiqueta="Menos IVA que te retuvieron" valor={f(-r.iva.retenidoCent)} />
          <Renglon etiqueta="IVA a pagar" valor={f(r.iva.aPagarCent)} total />
          <Renglon etiqueta="Total a pagar" valor={totalTxt} total />
          <button
            type="button"
            className="boton-link"
            onClick={() => setVerCompleto((v) => !v)}
            aria-expanded={verCompleto}
          >
            {verCompleto ? 'Ocultar cálculo completo' : 'Ver cálculo completo del motor'}
          </button>
          {verCompleto && (
            <div className="texto-mid" style={{ fontSize: 14 }}>
              {r.lineas.map((l) => (
                <Renglon key={l.clave} etiqueta={l.concepto} valor={f(l.montoCent)} />
              ))}
              <p className="texto-low">
                Motor {r.versionMotor}, parámetros {r.versionParametros}.
              </p>
            </div>
          )}
        </Hoja>
      )}

      {flujo === 'confirmar' && (
        <Hoja titulo="Confirma tu declaración" onCerrar={() => setFlujo('nada')}>
          <Renglon etiqueta="Periodo" valor="Octubre 2026" />
          <Renglon etiqueta="ISR" valor={f(r.isr.aPagarCent)} />
          <Renglon etiqueta="IVA" valor={f(r.iva.aPagarCent)} />
          <Renglon etiqueta="Total a pagar" valor={totalTxt} total />
          <p className="texto-low">
            Al confirmar, Contafly presenta tu declaración y te manda la línea de captura.
          </p>
          <button type="button" className="boton" onClick={() => setFlujo('biometria')}>
            Confirmar con tu huella o tu cara
          </button>
        </Hoja>
      )}

      {flujo === 'biometria' && (
        <Biometria
          onListo={() => {
            presentar();
          }}
        />
      )}

      {flujo === 'progreso' && (
        <Hoja titulo="Presentando tu declaración">
          <Barra valor={progreso} />
          <div style={{ marginTop: 12 }}>
            {PASOS_PROGRESO.map((p, i) => {
              const hecho = progreso >= ((i + 1) / PASOS_PROGRESO.length) * 100;
              return (
                <div key={p} className="paso-check">
                  {hecho ? <span className="marca">✓</span> : <span className="girando" />}
                  <span>{p}</span>
                </div>
              );
            })}
          </div>
        </Hoja>
      )}

      {flujo === 'exito' && (
        <Hoja titulo="Listo" onCerrar={() => setFlujo('nada')}>
          <div className="entrada" style={{ textAlign: 'center' }}>
            <div
              className="marca"
              style={{ width: 56, height: 56, fontSize: 28, margin: '8px auto 12px' }}
            >
              ✓
            </div>
            <p className="subtitulo">Presentamos tu declaración de octubre</p>
            <p className="texto-mid">
              Tu línea de captura por <strong className="num">{totalTxt}</strong> ya está en
              Documentos y en tu WhatsApp. Págala en tu banco antes del 17 de noviembre.
            </p>
          </div>
          <button
            type="button"
            className="boton"
            onClick={() => {
              setFlujo('nada');
              setTab('documentos');
            }}
          >
            Ver documentos
          </button>
        </Hoja>
      )}
    </>
  );
}

function Biometria({ onListo }: { onListo: () => void }) {
  const [ok, setOk] = useState(false);
  const listo = useRef(onListo);
  listo.current = onListo;
  useEffect(() => {
    const a = window.setTimeout(() => setOk(true), 900);
    const b = window.setTimeout(() => listo.current(), 1500);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);
  return (
    <Hoja titulo="Confirmación">
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 48 }} aria-hidden>
          {ok ? '✓' : '◎'}
        </div>
        <p>{ok ? 'Identidad confirmada' : 'Mirando a la cámara (simulado)'}</p>
      </div>
    </Hoja>
  );
}
