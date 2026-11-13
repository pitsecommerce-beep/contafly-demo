'use client';

import { hallazgos, MARIANA, pendientes } from '@contafly/datos-demo';
import {
  centavos,
  fechaLarga,
  formatoMxn,
  PARAMETROS_2026,
  retencionEsperada,
} from '@contafly/motor-fiscal';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { accionDemo } from '../lib/api';
import { useChat, usePersonaChat } from '../lib/chat';
import { type Narracion, useDemo, useNarracion } from '../lib/contexto';
import { leerSesion } from '../lib/sesion';
import { Barra, Chip, Encabezado, Notificacion, Renglon, type Tono } from './ui';

type Paso =
  | 'diagnostico'
  | 'sat'
  | 'conectando'
  | 'hallazgos'
  | 'calculo'
  | 'plan'
  | 'resolviendo'
  | 'exito';

const APPS = ['Uber', 'DiDi', 'Rappi', 'Mercado Libre', 'Amazon', 'Airbnb'] as const;
const MONTOS = [
  { id: '10k', texto: 'Menos de $10,000', pesos: '8000' },
  { id: '30k', texto: '$10,000 a $30,000', pesos: '20000' },
  { id: '60k', texto: '$30,000 a $60,000', pesos: '45000' },
  { id: '60k+', texto: 'Más de $60,000', pesos: '70000' },
] as const;
const NOMBRE_APP: Record<string, string> = { mercado_libre: 'Mercado Libre', amazon: 'Amazon' };
const f = formatoMxn;
const TONO: Record<string, Tono> = {
  rojo: 'rojo',
  ambar: 'ambar',
  listo: 'verde',
  presentado: 'verde',
};
const ESTADO: Record<string, string> = {
  rojo: 'Vencida',
  ambar: 'Revisar',
  listo: 'Lista',
  presentado: 'Presentada',
};

const NARRACION: Record<Paso, Narracion> = {
  diagnostico: {
    paso: 'Caso A, paso 1',
    titulo: 'Diagnóstico gratis, sin claves',
    texto: [
      'Con tres preguntas Contafly estima cuánto le están reteniendo las apps y si le conviene inscribirse.',
      'No pide contraseñas para esta parte.',
    ],
  },
  sat: {
    paso: 'Caso A, paso 2',
    titulo: 'Entrar al SAT (simulado)',
    texto: [
      'En el producto, Mariana autoriza a Contafly a leer su información fiscal.',
      'En esta demo los campos son decorativos: lo que se escriba no se guarda ni se envía a ningún lado.',
    ],
  },
  conectando: {
    paso: 'Caso A, paso 2',
    titulo: 'Leyendo la información fiscal',
    texto: [
      'Constancia de situación fiscal, facturas de ingresos y gastos, retenciones de las apps y declaraciones presentadas.',
    ],
  },
  hallazgos: {
    paso: 'Caso A, paso 3',
    titulo: 'Lo que encontramos',
    texto: [
      'Cada hallazgo trae una explicación corta y su consecuencia, tomada de los parámetros fiscales vigentes.',
    ],
  },
  calculo: {
    paso: 'Caso A, paso 4',
    titulo: 'Cálculo de cada mes',
    texto: [
      'El motor fiscal calcula ISR e IVA de cada mes con la tarifa 2026, restando lo que retuvieron las apps.',
      'Detecta que en octubre Amazon retuvo 1% en lugar de 2.5%. Ese mes queda en ámbar para que lo revise un contador.',
      'Los recargos y la actualización se calculan al presentar.',
    ],
  },
  plan: {
    paso: 'Caso A, paso 5',
    titulo: 'Plan para ponerse al corriente',
    texto: [
      'Qué se presenta primero, cuánto suma y cuándo vence. Los meses vencidos y en ámbar pasan por un contador humano antes de presentar.',
    ],
  },
  resolviendo: {
    paso: 'Caso A, paso 5',
    titulo: 'Contafly se encarga',
    texto: [
      'Un contador revisa los meses señalados y Contafly presenta en orden. En la demo es una simulación.',
    ],
  },
  exito: {
    paso: 'Caso A, listo',
    titulo: 'Mariana está al corriente',
    texto: [
      'Sus acuses y líneas de captura de demostración quedan listos y le llegan por WhatsApp.',
    ],
  },
};

export function CasoA() {
  const { hoy } = useDemo();
  usePersonaChat('mariana');
  const [paso, setPaso] = useState<Paso>('diagnostico');
  useNarracion(NARRACION[paso]);
  const ir = (p: Paso) => setPaso(p);

  return (
    <main className="pantalla">
      <div className="fila" style={{ marginBottom: 8 }}>
        <Link href="/" className="boton-link">
          ‹ Casos
        </Link>
        <span className="texto-low">Hola, {MARIANA.nombre}</span>
      </div>
      {paso === 'diagnostico' && <Diagnostico onSeguir={() => ir('sat')} />}
      {paso === 'sat' && (
        <EntrarSat onAtras={() => ir('diagnostico')} onEntrar={() => ir('conectando')} />
      )}
      {paso === 'conectando' && <Conectando onListo={() => ir('hallazgos')} />}
      {paso === 'hallazgos' && <Hallazgos hoy={hoy} onSeguir={() => ir('calculo')} />}
      {paso === 'calculo' && (
        <Calculo hoy={hoy} onAtras={() => ir('hallazgos')} onSeguir={() => ir('plan')} />
      )}
      {(paso === 'plan' || paso === 'resolviendo' || paso === 'exito') && (
        <Plan
          hoy={hoy}
          paso={paso}
          onAtras={() => ir('calculo')}
          onResolver={() => ir('resolviendo')}
          onExito={() => ir('exito')}
        />
      )}
    </main>
  );
}

function Diagnostico({ onSeguir }: { onSeguir: () => void }) {
  const [apps, setApps] = useState<string[]>(['Mercado Libre', 'Amazon']);
  const [monto, setMonto] = useState<(typeof MONTOS)[number]['id']>('30k');
  const [rfc, setRfc] = useState<'si' | 'no' | 'nose'>('si');
  const pesos = MONTOS.find((m) => m.id === monto)?.pesos ?? '20000';
  const transporte = ['Uber', 'DiDi', 'Rappi'];
  const giro =
    apps.length > 0 && apps.every((a) => transporte.includes(a))
      ? 'transporte'
      : apps.length > 0 && apps.every((a) => a === 'Airbnb')
        ? 'hospedaje'
        : 'ventas';
  const con = retencionEsperada(centavos(pesos), giro, true, PARAMETROS_2026);
  const sin = retencionEsperada(centavos(pesos), giro, false, PARAMETROS_2026);

  return (
    <div className="pila entrada">
      <h1 className="titulo">Diagnóstico gratis</h1>
      <p className="texto-mid" style={{ marginTop: 0 }}>
        Tres preguntas. Sin contraseñas.
      </p>
      <fieldset className="tarjeta" style={{ border: '1px solid var(--borde)' }}>
        <legend className="subtitulo" style={{ padding: '0 4px' }}>
          ¿En qué apps cobras?
        </legend>
        <div className="opciones">
          {APPS.map((a) => (
            <button
              key={a}
              type="button"
              className="opcion"
              aria-pressed={apps.includes(a)}
              onClick={() => setApps((v) => (v.includes(a) ? v.filter((x) => x !== a) : [...v, a]))}
            >
              {a}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="tarjeta" style={{ border: '1px solid var(--borde)' }}>
        <legend className="subtitulo" style={{ padding: '0 4px' }}>
          ¿Cuánto cobras al mes, aproximadamente?
        </legend>
        <div className="opciones">
          {MONTOS.map((m) => (
            <button
              key={m.id}
              type="button"
              className="opcion"
              aria-pressed={monto === m.id}
              onClick={() => setMonto(m.id)}
            >
              {m.texto}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="tarjeta" style={{ border: '1px solid var(--borde)' }}>
        <legend className="subtitulo" style={{ padding: '0 4px' }}>
          ¿Le diste tu RFC a las apps?
        </legend>
        <div className="opciones">
          {(
            [
              ['si', 'Sí'],
              ['no', 'No'],
              ['nose', 'No sé'],
            ] as const
          ).map(([id, t]) => (
            <button
              key={id}
              type="button"
              className="opcion"
              aria-pressed={rfc === id}
              onClick={() => setRfc(id)}
            >
              {t}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="tarjeta" aria-live="polite">
        <h2 className="subtitulo">Tu estimado del mes</h2>
        <Renglon etiqueta="Retención con RFC" valor={f(con.isrCent + con.ivaCent)} />
        <Renglon etiqueta="Retención sin RFC" valor={f(sin.isrCent + sin.ivaCent)} />
        <p style={{ margin: '8px 0 0' }}>
          {rfc === 'si'
            ? 'Con RFC te retienen menos, pero tienes que declarar cada mes. Revisemos si estás al corriente.'
            : `Sin RFC las apps te retienen ${f(sin.isrCent + sin.ivaCent - con.isrCent - con.ivaCent)} más al mes. Inscribirte te conviene.`}
        </p>
      </div>
      <button type="button" className="boton" onClick={onSeguir} disabled={apps.length === 0}>
        Revisar mi situación en el SAT
      </button>
    </div>
  );
}

function EntrarSat({ onAtras, onEntrar }: { onAtras: () => void; onEntrar: () => void }) {
  return (
    <div className="pila entrada">
      <Encabezado onAtras={onAtras} />
      <h1 className="titulo">Entrar al SAT</h1>
      <p className="aviso" role="note">
        Demostración: escribe cualquier dato, no se guarda ni se envía a ningún lado.
      </p>
      {/* Sin name ni action: estos campos nunca viajan al servidor */}
      <form
        className="tarjeta pila"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLFormElement).reset();
          onEntrar();
        }}
      >
        <label className="campo">
          <span>RFC</span>
          <input type="text" autoComplete="off" spellCheck={false} placeholder="XAXX010101000" />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" autoComplete="off" placeholder="Cualquier texto" />
        </label>
        <button type="submit" className="boton">
          Entrar
        </button>
      </form>
    </div>
  );
}

function Conectando({ onListo }: { onListo: () => void }) {
  const pasos = ['Leyendo tu constancia', 'Descargando facturas', 'Revisando declaraciones'];
  const [hechos, setHechos] = useState(0);
  const listo = useRef(onListo);
  listo.current = onListo;
  useEffect(() => {
    const t = [1, 2, 3].map((n) => window.setTimeout(() => setHechos(n), n * 900));
    const fin = window.setTimeout(() => listo.current(), 3300);
    return () => {
      for (const x of t) window.clearTimeout(x);
      window.clearTimeout(fin);
    };
  }, []);
  return (
    <div className="pila entrada">
      <h1 className="titulo">Conectando</h1>
      <div className="tarjeta">
        <Barra valor={(hechos / pasos.length) * 100} />
        <div style={{ marginTop: 12 }}>
          {pasos.map((p, i) => (
            <div className="paso-check" key={p}>
              {hechos > i ? <span className="marca">✓</span> : <span className="girando" />}
              <span>{p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hallazgos({ hoy, onSeguir }: { hoy: string; onSeguir: () => void }) {
  const lista = useMemo(() => hallazgos(MARIANA, hoy), [hoy]);
  return (
    <div className="pila entrada">
      <h1 className="titulo">Lo que encontramos</h1>
      {lista.map((h, i) => (
        <div key={h.clave} className="tarjeta entrada" style={{ animationDelay: `${i * 80}ms` }}>
          <div className="fila" style={{ alignItems: 'flex-start' }}>
            <strong>{h.titulo}</strong>
            <Chip tono={h.severidad}>
              {h.severidad === 'rojo' ? 'Urgente' : h.severidad === 'ambar' ? 'Atender' : 'Activo'}
            </Chip>
          </div>
          <p style={{ margin: '6px 0 4px' }}>{h.explicacion}</p>
          <p className="texto-low" style={{ margin: 0 }}>
            {h.consecuencia}
          </p>
        </div>
      ))}
      <button type="button" className="boton" onClick={onSeguir}>
        Ver cálculo por mes
      </button>
    </div>
  );
}

function Calculo({
  hoy,
  onAtras,
  onSeguir,
}: {
  hoy: string;
  onAtras: () => void;
  onSeguir: () => void;
}) {
  const meses = useMemo(() => pendientes(MARIANA, hoy), [hoy]);
  return (
    <div className="pila entrada">
      <Encabezado onAtras={onAtras} />
      <h1 className="titulo">Cálculo por mes</h1>
      {meses.map((m) => {
        const r = m.resultado;
        const p = MARIANA.periodos.find((x) => x.mes === m.mes);
        return (
          <div key={m.mes} className="tarjeta">
            <div className="fila">
              <h2 className="subtitulo" style={{ textTransform: 'capitalize' }}>
                {m.nombreMes}
              </h2>
              <Chip tono={TONO[m.estado] ?? 'ambar'}>{ESTADO[m.estado]}</Chip>
            </div>
            {p?.ingresos.map((i) => (
              <Renglon
                key={i.app}
                etiqueta={
                  <>
                    {NOMBRE_APP[i.app]}
                    <div className="texto-low">
                      Retuvo {f(i.isrRetenidoCent)} de ISR y {f(i.ivaRetenidoCent)} de IVA
                    </div>
                  </>
                }
                valor={f(i.subtotalCent)}
              />
            ))}
            <Renglon etiqueta="Gastos con factura" valor={f(-r.gastosCent)} />
            <Renglon etiqueta="ISR a pagar" valor={f(r.isr.aPagarCent)} />
            <Renglon etiqueta="IVA a pagar" valor={f(r.iva.aPagarCent)} />
            <Renglon
              etiqueta="Recargos y actualización"
              valor={<span className="texto-low">Se calculan al presentar</span>}
            />
            <Renglon etiqueta="Total del mes" valor={f(r.totalCent)} total />
            {m.compuertas.motivos.map((t) => (
              <p key={t} className="texto-low" style={{ margin: '6px 0 0' }}>
                {t}
              </p>
            ))}
          </div>
        );
      })}
      <button type="button" className="boton" onClick={onSeguir}>
        Ver mi plan
      </button>
    </div>
  );
}

function Plan({
  hoy,
  paso,
  onAtras,
  onResolver,
  onExito,
}: {
  hoy: string;
  paso: Paso;
  onAtras: () => void;
  onResolver: () => void;
  onExito: () => void;
}) {
  const meses = useMemo(() => pendientes(MARIANA, hoy), [hoy]);
  const suma = meses.reduce((t, m) => t + m.resultado.totalCent, 0);
  const [progreso, setProgreso] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const { whatsappReal } = useDemo();
  const chat = useChat();
  const etapas = [
    'Un contador revisa tus meses',
    ...meses.map((m) => `Presentando ${m.nombreMes}`),
  ];
  const exito = useRef(onExito);
  exito.current = onExito;

  // biome-ignore lint/correctness/useExhaustiveDependencies: solo se dispara al entrar a "resolviendo"
  useEffect(() => {
    if (paso !== 'resolviendo') return;
    const t = etapas.map((_, i) =>
      window.setTimeout(() => setProgreso(((i + 1) / etapas.length) * 100), (i + 1) * 900),
    );
    const fin = window.setTimeout(
      () => {
        exito.current();
        const textoFinal = `Listo, ya estás al corriente. Te mandé ${meses.length} líneas de captura por ${f(suma)} en total, más recargos y actualización. Págalas en tu banco; la de octubre vence el 17 de noviembre.`;
        if (!whatsappReal) {
          // Sin Twilio: los PDFs y el mensaje llegan al WhatsApp simulado de la web
          void chat.recibir([
            ...meses.map((m) => ({ tipo: 'pdf' as const, mes: m.mes })),
            { tipo: 'texto', texto: textoFinal },
          ]);
          setAviso(textoFinal);
          return;
        }
        const s = leerSesion();
        void accionDemo('presentar', {
          persona: 'mariana',
          meses: meses.map((m) => m.mes),
          telefono: s?.telefono,
          sesionId: s?.sesionId,
        }).then((res) =>
          setAviso(
            res.ok
              ? 'Revisa tu WhatsApp: ahí están tus líneas de captura.'
              : (res.mensaje ??
                  'Conecta tu WhatsApp en el inicio para recibir tus líneas de captura.'),
          ),
        );
      },
      etapas.length * 900 + 400,
    );
    return () => {
      for (const x of t) window.clearTimeout(x);
      window.clearTimeout(fin);
    };
  }, [paso]);

  if (paso === 'exito') {
    return (
      <div className="pila entrada">
        {aviso && (
          <Notificacion titulo="WhatsApp, Contafly" texto={aviso} onCerrar={() => setAviso(null)} />
        )}
        <div style={{ textAlign: 'center' }}>
          <div
            className="marca"
            style={{ width: 56, height: 56, fontSize: 28, margin: '16px auto 12px' }}
          >
            ✓
          </div>
          <h1 className="titulo">Ya estás al corriente</h1>
          <p className="texto-mid">
            Tus acuses y líneas de captura de demostración están listos y te llegan por WhatsApp.
          </p>
        </div>
        {meses.map((m) => (
          <a
            key={m.mes}
            className="tarjeta fila"
            href={`/api/acuse?persona=mariana&mes=${m.mes}`}
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <div>
              <strong style={{ textTransform: 'capitalize' }}>{m.nombreMes}</strong>
              <div className="texto-low">PDF de demostración por {f(m.resultado.totalCent)}</div>
            </div>
            <Chip tono="verde">Presentada</Chip>
          </a>
        ))}
        <p className="texto-low">
          Los PDFs llevan marca de agua y datos ficticios. No son documentos del SAT ni sirven para
          pagar.
        </p>
        <Link href="/" className="boton boton-sec">
          Volver a los casos
        </Link>
      </div>
    );
  }

  if (paso === 'resolviendo') {
    return (
      <div className="pila entrada">
        <h1 className="titulo">Poniéndote al corriente</h1>
        <div className="tarjeta">
          <Barra valor={progreso} />
          <div style={{ marginTop: 12 }}>
            {etapas.map((e, i) => (
              <div key={e} className="paso-check">
                {progreso >= ((i + 1) / etapas.length) * 100 ? (
                  <span className="marca">✓</span>
                ) : (
                  <span className="girando" />
                )}
                <span>{e}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pila entrada">
      <Encabezado onAtras={onAtras} />
      <h1 className="titulo">Tu plan</h1>
      <div className="tarjeta">
        <span className="texto-mid">Para ponerte al corriente</span>
        <div className="monto">{f(suma)}</div>
        <p className="texto-low" style={{ margin: 0 }}>
          Más recargos y actualización, que se calculan al presentar.
        </p>
      </div>
      <ol className="tarjeta" style={{ paddingLeft: 32, margin: 0 }}>
        {meses.map((m) => (
          <li key={m.mes} style={{ padding: '6px 0' }}>
            <div className="fila">
              <strong style={{ textTransform: 'capitalize' }}>{m.nombreMes}</strong>
              <span className="num">{f(m.resultado.totalCent)}</span>
            </div>
            <div className="texto-low">
              {m.estado === 'rojo'
                ? `Venció el ${fechaLarga(m.venceEl)}. Lo revisa un contador antes de presentar.`
                : m.estado === 'ambar'
                  ? `Vence el ${fechaLarga(m.venceEl)}. Un contador revisa la retención de Amazon.`
                  : `Vence el ${fechaLarga(m.venceEl)}.`}
            </div>
          </li>
        ))}
      </ol>
      <div className="tarjeta">
        <strong>Buzón tributario</strong>
        <p className="texto-low" style={{ margin: '4px 0 0' }}>
          Lo habilitamos contigo en el mismo paso para evitar la multa de 2027.
        </p>
      </div>
      <button type="button" className="boton" onClick={onResolver}>
        Ponerme al corriente
      </button>
    </div>
  );
}
