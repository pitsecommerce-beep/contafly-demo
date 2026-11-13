import Link from 'next/link';

export default function Privacidad() {
  return (
    <main className="pantalla">
      <Link href="/" className="boton-link">
        ‹ Atrás
      </Link>
      <h1 className="titulo">Aviso de privacidad simplificado</h1>
      <div className="tarjeta pila" style={{ marginTop: 12 }}>
        <p style={{ margin: 0 }}>
          Orkesta Labs usa tu número de WhatsApp solo para esta demostración de Contafly: enviarte
          mensajes de ejemplo, recordatorios simulados y, si lo pides, una llamada de tu contador
          virtual.
        </p>
        <p style={{ margin: 0 }}>
          No pedimos ni guardamos contraseñas del SAT ni e.firma. Los datos fiscales que ves son de
          ejemplo y no se conectan al SAT.
        </p>
        <p style={{ margin: 0 }}>
          Guardamos tu número, tu consentimiento y los mensajes de la demo. Puedes borrarlos cuando
          quieras con el botón &quot;Borrar mis datos de la demo&quot;. En los registros técnicos tu
          número aparece enmascarado.
        </p>
        <p style={{ margin: 0 }}>
          No compartimos tus datos con terceros, salvo los proveedores que envían los mensajes y
          llamadas.
        </p>
      </div>
    </main>
  );
}
