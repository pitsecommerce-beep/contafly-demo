'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { accionDemo } from '../lib/api';
import { useChat } from '../lib/chat';
import { useDemo } from '../lib/contexto';
import {
  aE164,
  borrarSesion,
  enmascarar,
  guardarSesion,
  leerSesion,
  type SesionLocal,
} from '../lib/sesion';

export interface ConfigWhatsApp {
  /** Número del remitente sin "whatsapp:" ni "+", por ejemplo 14155238886 */
  numero: string | null;
  /** Palabra del sandbox; null si ya es un remitente aprobado */
  codigo: string | null;
}

export function ConectarWhatsApp({ config }: { config: ConfigWhatsApp }) {
  const { whatsappReal } = useDemo();
  return whatsappReal ? <ConectarReal config={config} /> : <WhatsAppDeLaDemo />;
}

/** Sin Twilio: la conversación ocurre en el WhatsApp simulado de la propia web. */
function WhatsAppDeLaDemo() {
  const { setAbierto, llamar } = useChat();
  return (
    <div className="tarjeta pila">
      <h2 className="subtitulo">Habla con tu contador</h2>
      <p className="texto-mid" style={{ margin: 0 }}>
        En esta demo, WhatsApp y las llamadas pasan dentro de la página. En computadora lo ves a la
        derecha; en el celular, con el botón verde. No necesitas dar tu número.
      </p>
      <div className="opciones">
        <button
          type="button"
          className="boton"
          style={{ flex: 1 }}
          onClick={() => setAbierto(true)}
        >
          Abrir WhatsApp
        </button>
        <button type="button" className="boton boton-sec" style={{ flex: 1 }} onClick={llamar}>
          Que me llame
        </button>
      </div>
    </div>
  );
}

function ConectarReal({ config }: { config: ConfigWhatsApp }) {
  const idAyuda = useId();
  const [sesion, setSesion] = useState<SesionLocal | null>(null);
  const [telefono, setTelefono] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setSesion(leerSesion()), []);

  const enlace =
    config.numero && config.codigo
      ? `https://wa.me/${config.numero}?text=${encodeURIComponent(`join ${config.codigo}`)}`
      : config.numero
        ? `https://wa.me/${config.numero}?text=${encodeURIComponent('Hola Contafly')}`
        : null;

  async function conectar() {
    const e164 = aE164(telefono);
    if (!e164) {
      setError('Revisa el número. Escribe 10 dígitos o el número con lada internacional.');
      return;
    }
    setError(null);
    setEnviando(true);
    const s: SesionLocal = { telefono: e164, consentimientoAt: new Date().toISOString() };
    const r = await accionDemo('conectar', { telefono: e164, consentimiento: true });
    if (r.ok && r.sesionId) s.sesionId = r.sesionId;
    guardarSesion(s);
    setSesion(s);
    setEnviando(false);
  }

  async function borrar() {
    if (sesion)
      await accionDemo('borrar', { telefono: sesion.telefono, sesionId: sesion.sesionId });
    borrarSesion();
    setSesion(null);
    setTelefono('');
    setAcepto(false);
  }

  if (sesion) {
    return (
      <div className="tarjeta pila entrada">
        <div className="fila">
          <h2 className="subtitulo">Tu WhatsApp</h2>
          <span className="chip chip-verde">Conectado</span>
        </div>
        <p className="texto-mid" style={{ margin: 0 }}>
          Te escribiremos a <span className="num">{enmascarar(sesion.telefono)}</span>.
        </p>
        {enlace ? (
          <>
            {config.codigo && (
              <p style={{ margin: 0 }}>
                Para recibir mensajes, manda <strong>join {config.codigo}</strong> desde tu
                WhatsApp. Es un paso de una sola vez.
              </p>
            )}
            {/* biome-ignore lint/performance/noImgElement: QR generado al vuelo */}
            <img
              className="qr"
              src={`/api/qr?t=${encodeURIComponent(enlace)}`}
              alt="Código QR para abrir WhatsApp con el mensaje listo"
            />
            <a className="boton" href={enlace} target="_blank" rel="noreferrer">
              Abrir WhatsApp
            </a>
          </>
        ) : (
          <p className="aviso" style={{ margin: 0 }}>
            El WhatsApp de la demo todavía no está configurado. Los mensajes aparecerán como
            notificaciones en pantalla.
          </p>
        )}
        <button type="button" className="boton-link" onClick={borrar}>
          Borrar mis datos de la demo
        </button>
      </div>
    );
  }

  return (
    <form
      className="tarjeta pila"
      onSubmit={(e) => {
        e.preventDefault();
        void conectar();
      }}
    >
      <h2 className="subtitulo">Recibe a tu contador en WhatsApp</h2>
      <p className="texto-mid" style={{ margin: 0 }}>
        Te mandamos tu línea de captura de ejemplo, recordatorios y, si lo pides, una llamada.
      </p>
      <label className="campo">
        <span>Tu número de WhatsApp</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="55 1234 5678"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          aria-describedby={idAyuda}
          aria-invalid={error ? true : undefined}
        />
      </label>
      <p id={idAyuda} className="texto-low" style={{ margin: 0 }}>
        México por defecto. Para otro país, empieza con + y la lada.
      </p>
      {error && (
        <p role="alert" style={{ color: 'var(--rojo)', margin: 0 }}>
          {error}
        </p>
      )}
      <label
        className="fila"
        style={{ justifyContent: 'flex-start', alignItems: 'flex-start', fontSize: 14 }}
      >
        <input
          type="checkbox"
          checked={acepto}
          onChange={(e) => setAcepto(e.target.checked)}
          style={{ marginTop: 4 }}
        />
        <span>
          Acepto recibir mensajes de WhatsApp y llamadas de esta demostración. Leí el{' '}
          <Link href="/privacidad">aviso de privacidad</Link>.
        </span>
      </label>
      <button type="submit" className="boton" disabled={!acepto || !telefono || enviando}>
        {enviando ? 'Conectando' : 'Conectar mi WhatsApp'}
      </button>
    </form>
  );
}
