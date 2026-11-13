# Motor fiscal

`packages/motor-fiscal` calcula todos los montos de la demo. El contador virtual nunca calcula: solo explica lo que devuelve este paquete.

## Principios

- Funciones puras, sin red ni fechas implícitas. Quien llama pasa `hoy` (en la demo, `DEMO_FECHA`).
- Montos en centavos enteros y tasas en puntos base (2.1% = 210). Redondeo half-up en cada multiplicación por tasa.
- Cada resultado trae el desglose línea por línea, `versionMotor` y `versionParametros`.
- Parámetros en `src/parametros/2026.ts`, cada uno con su fuente. Los que no tienen fuente validada quedan en `null` y la interfaz muestra "se calcula al presentar".

## Qué calcula

| Función | Qué hace |
|---|---|
| `calcularAcumulado` | Declarar y deducir: pago provisional acumulado de enero al mes (art. 106 LISR) e IVA del mes |
| `calcularPagoDefinitivo` | Lo retenido es el pago (art. 113-B LISR, 18-M LIVA) |
| `recomendar` | Calcula ambos caminos cuando aplica el pago definitivo y recomienda el más barato |
| `evaluarCompuertas` | Verde, ámbar (tasa del CFDI distinta al parámetro) o rojo (extemporáneo o cambio de régimen). Ámbar y rojo bloquean presentar |
| `compararSinRfc` | Retención sin RFC contra lo que aporta inscrito |
| `fechaVencimiento`, `textoVencimiento` | Día 17 del mes siguiente, recorrido al siguiente día hábil (art. 12 CFF, feriados del art. 74 LFT) |

## Supuestos que debe revisar un contador

1. **Tarifa acumulada.** Se construye desde la mensual del Anexo 8: límite superior y cuota fija por N, límite inferior igual al superior acumulado del renglón anterior más un centavo. La prueba compara enero y octubre contra la tabla del brief. No se pudo descargar el PDF oficial del SAT desde el entorno de desarrollo, así que falta compararla contra el Anexo 8 publicado.
2. **Inicio de actividades a mitad de año (Mariana).** Los meses previos al alta cuentan con ingresos en cero y la tarifa usa el número de mes del ejercicio. Confirmar si el periodo debe contarse desde el alta.
3. **Redondeo en el método acumulado.** Con meses idénticos, el ISR de cada mes puede diferir un centavo del cálculo mensual porque el ISR acumulado se redondea cada mes. Octubre de Luis coincide exacto ($2,490.45).
4. **Montos con centavos.** La declaración real se redondea a pesos (art. 20 CFF). La demo muestra centavos para que cuadre con el pitch.
5. **Pendientes sin número:** tasa de recargos 2026, factor de actualización (INPC) y multas por declaración omitida.

## Cómo probar

```bash
pnpm --filter @contafly/motor-fiscal test   # incluye cobertura, umbral 100%
```
