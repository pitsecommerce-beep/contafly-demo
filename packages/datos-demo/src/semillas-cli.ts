import { DEMO_FECHA_POR_DEFECTO } from './index.js';
import { generarSemillas } from './semillas.js';

process.stdout.write(generarSemillas(process.env.DEMO_FECHA ?? DEMO_FECHA_POR_DEFECTO));
