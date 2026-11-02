# Agentes

Carpeta de prompts para copiar a un chat nuevo. En otra computadora, con este mismo proyecto abierto, el agente entrega la misma lista.

Cada agente nuevo se agrega a la tabla de abajo. El texto para copiar es el archivo de esa fila.

## Cómo pedirlo

1. En un chat de este proyecto: **«Dame la lista de prompts»**.
2. Elegí uno por número o por nombre.
3. El agente devuelve **ese prompt completo**, en un bloque para copiar.
4. Abrí un chat nuevo (Agent) y pegalo.

## Regla para el agente

Cuando pidan la lista o un prompt para copiar:

1. Leer este archivo. La única lista es la tabla de abajo.
2. No inventar agentes. No ofrecer los prompts viejos de `.cursor/prompts.md` ni de `.cursor/*_promp.md`.
3. Si la tabla está vacía: decir que todavía no hay agentes.
4. Si piden la **lista**: responder solo número, nombre y para qué sirve. No pegar el texto del prompt.
5. Si eligen **uno**: leer el archivo de la fila y devolverlo **entero**, en un solo bloque de texto, sin resumir y sin empezar el trabajo de ese agente en este chat.

## Lista

| # | Nombre | Para qué | Archivo |
|---|--------|----------|---------|
| 1 | API ARCA | Facturación electrónica y constancia de inscripción contra la API oficial de ARCA | [api-arca.md](./api-arca.md) |
