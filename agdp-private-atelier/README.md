# AGDP Private Atelier

Esta carpeta contiene la rama canónica y privada del configurador. `index.html` es el punto de entrada. Los contenedores `#agdp-header-mount` y `#agdp-footer-mount` quedan vacíos para integrar después la navegación del sitio.

## Integración

1. Publicar la carpeta completa bajo una ruta privada y servirla por HTTPS. No abrir `index.html` mediante `file://`.
2. Proteger la ruta en el servidor, CDN o plataforma de identidad. La directiva `noindex` evita indexación ordinaria, pero no sustituye autenticación.
3. Mantener juntos los siete archivos canónicos enumerados en `atelier.manifest.json`.
4. Si el sitio aplica Content Security Policy, permitir temporalmente los módulos fijados de `unpkg.com` o, de preferencia, descargar esas dos dependencias y servirlas desde el mismo origen antes del despliegue definitivo.
5. Integrar header y footer dentro de sus montajes sin modificar los identificadores internos del configurador.

## Alcance técnico

El resultado “Topología aprobada” significa que la malla es finita, cerrada, manifold y tiene el número esperado de cuerpos conectados. No significa que la pieza esté aprobada para fundición, engaste o uso.

El vaciado experimental por duplicado escalado está desactivado. Toda pieza requiere comprobar en CAD o mediante análisis equivalente el espesor local, holguras, tolerancias de fundición, pulido, retención de gemas, ajuste corporal y funcionamiento del mecanismo. Clips, ear cuffs, mancuernillas, aretes y engastes requieren también prototipo físico y revisión de banco.

La exportación genera tres archivos con el mismo nombre base:

- `.obj`: metal y gemas como grupos separados;
- `.mtl`: referencias visuales de materiales;
- `.json`: semilla, versión, dimensiones, masa calculada y estado técnico.

## Prueba de consistencia

Con Node.js instalado:

```bash
npm test
```

La prueba verifica la estructura de entrega y las correcciones críticas que pueden comprobarse sin cargar WebGL o las dependencias remotas.

## Archivos deliberadamente excluidos

`configurator.runtime.js`, las versiones antiguas de `configurator.gemstones.js` y `configurator.lapidary.js`, así como los prototipos duplicados `atelier-private*` y `private-ateliers*`, no forman parte de esta rama. Cargarlos junto con estos archivos podría sobrescribir APIs o reinstalar una validación ficticia.
