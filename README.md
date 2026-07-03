# nominas-hogar

Web estatica, local y sin backend para generar recibos de nomina sencillos para empleadas de hogar.

## Objetivo

Tener una pagina muy facil de usar donde introducir los datos del empleador/a y de la trabajadora, seleccionar año y mes, calcular correctamente los dias naturales de cada mes, revisar los importes y guardar/imprimir la nomina como PDF desde el navegador.

## Archivos

- `index.html`: estructura de la aplicacion.
- `styles.css`: estilos de pantalla e impresion A4.
- `app.js`: calculos, historial local y generacion de nominas.

## Mejoras respecto a la muestra inicial

- Calcula correctamente los dias de cada mes, incluyendo febrero en años bisiestos.
- Permite indicar dias trabajados dentro del mes y prorratea salario base y pagas extra.
- Permite editar salario base, pagas extra, otros devengos, IRPF y tipos de deduccion.
- Guarda historial local por trabajadora/mes/año usando `localStorage`.
- Mejora la vista responsive y la impresion en A4.
- Sigue funcionando como una web local sin servidor ni base de datos.

## Uso

Abrir `index.html` en el navegador.

En Linux, desde esta carpeta:

```bash
xdg-open index.html
```

Para generar un PDF, pulsa `Imprimir / Guardar PDF` y elige guardar como PDF en el dialogo del navegador.

## Nota importante

Los importes y tipos legales pueden cambiar. La herramienta esta pensada como ayuda practica, no como asesoramiento laboral/fiscal definitivo.
