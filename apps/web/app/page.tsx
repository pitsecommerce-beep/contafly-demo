import { ConectarWhatsApp } from '../components/ConectarWhatsApp';
import { Entrada } from '../components/Entrada';

export default function Inicio() {
  const from =
    process.env.TWILIO_WHATSAPP_FROM?.replace(/^whatsapp:/, '').replace(/^\+/, '') || null;
  const codigo = process.env.TWILIO_SANDBOX_JOIN_CODE || null;
  return (
    <Entrada>
      <ConectarWhatsApp config={{ numero: from, codigo }} />
    </Entrada>
  );
}
