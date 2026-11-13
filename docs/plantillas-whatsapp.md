# Plantillas de WhatsApp

WhatsApp solo permite mensajes libres dentro de las 24 horas siguientes al último mensaje de la persona. Fuera de esa ventana hay que usar plantillas aprobadas por Meta. En el sandbox de Twilio la demo funciona sin plantillas mientras el inversionista haya escrito en las últimas 24 horas.

Para registrarlas: Twilio Console, Messaging, Content Template Builder. Categoría **Utility** (notificaciones de una cuenta), idioma **Spanish (MEX)**. Las variables van entre llaves dobles, como pide Twilio.

## contafly_declaracion_presentada

Se envía al confirmar una declaración. Lleva el PDF como encabezado de tipo documento.

> Listo, presentamos tu declaración de {{1}}. Aquí está tu línea de captura por {{2}}. Págala en tu banco cuando quieras, antes del {{3}}.

Ejemplo: {{1}} = octubre, {{2}} = $2,538.45, {{3}} = 17 de noviembre.

## contafly_mes_listo (día 10)

> Tu mes está listo. {{1}} suma {{2}} y vence el {{3}}. ¿Lo presentamos?

Botones de respuesta rápida: "Sí, preséntalo" y "Tengo una duda".

## contafly_faltan_dos_dias (día 15)

> Faltan 2 días para el {{1}}. Tu declaración de {{2}} es de {{3}}.

## contafly_vence_hoy (día 17)

> Hoy vence tu declaración de {{1}} por {{2}}. Si quieres, la presento ahora y te mando la línea de captura.

## contafly_al_corriente (caso A)

> Listo, ya estás al corriente. Te mandé {{1}} líneas de captura por {{2}} en total, más recargos y actualización. Págalas en tu banco; la de {{3}} vence el {{4}}.

## Notas

- Las plantillas de categoría Utility no deben incluir promociones.
- Cuando estén aprobadas, se envían con `contentSid` y `contentVariables` en lugar de `body` (cambio en `apps/api/src/servicios/whatsapp.ts`).
- Para dejar el sandbox: registrar el remitente de WhatsApp Business con nombre "Contafly", verificar la cuenta de Meta y cambiar `TWILIO_WHATSAPP_FROM`. Sin `TWILIO_SANDBOX_JOIN_CODE`, la web deja de mostrar el paso de `join`.
