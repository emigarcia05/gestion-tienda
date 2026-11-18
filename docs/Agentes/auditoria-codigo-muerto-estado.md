# Auditoría de código muerto — estado

Plan de recorrido. No es un agente: no va en la tabla de `docs/Agentes/README.md`.

- Siguiente: 33
- Total de pasos: 194
- Hechos: 32
- Archivos en el plan: 973

Cada paso queda en pendiente hasta ejecutarse. Al cerrar un paso: estado `hecho`, líneas revisadas (las de abajo, antes de borrar), líneas eliminadas, porcentaje y dudosos.

Una tanda junta pasos pendientes seguidos. `src/app`: hasta 2.500 líneas o 8 pasos. `src/components`, `src/actions`, `src/services`, `src/lib` y `scripts`: hasta 1.500 líneas o 2 pasos. Un archivo de más de 1.500 líneas va solo. No mezclar `src/app` con el resto. No abrir un paso si al sumarlo se pasa el tope. El cierre suma la tanda; el estado sigue por paso.

## Índice

1. src/app/ventas (1/3) — hecho — 702 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
2. src/app/ventas (2/3) — hecho — 501 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
3. src/app/ventas (3/3) — hecho — 18 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
4. src/app/administrador (1/3) — hecho — 455 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
5. src/app/administrador (2/3) — hecho — 450 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
6. src/app/administrador (3/3) — hecho — 360 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
7. src/app/finanzas (1/2) — hecho — 444 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
8. src/app/finanzas (2/2) — hecho — 256 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
9. src/app/marketing — hecho — 178 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
10. src/app/ingresar — hecho — 26 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
11. src/app/cc — hecho — 74 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
12. src/app/conductor — hecho — 45 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
13. src/app/api (1/3) — hecho — 505 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
14. src/app/api (2/3) — hecho — 729 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
15. src/app/api (3/3) — hecho — 10 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
16. src/app (raíz) (1/3) — hecho — 156 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
17. src/app (raíz) (2/3) — hecho — 2760 líneas revisadas, 73 eliminadas (2,64%). Dudosos: ninguno
18. src/app (raíz) (3/3) — hecho — 75 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
19. src (raíz) — hecho — 113 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
20. src/components/ui (1/2) — hecho — 923 líneas revisadas, 9 eliminadas (0,98%). Dudosos: ninguno
21. src/components/ui (2/2) — hecho — 29 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
22. src/components/shared (1/5) — hecho — 1425 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
23. src/components/shared (2/5) — hecho — 1359 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
24. src/components/shared (3/5) — hecho — 1272 líneas revisadas, 128 eliminadas (10,06%). Dudosos: ninguno
25. src/components/shared (4/5) — hecho — 1425 líneas revisadas, 1 eliminada (0,07%). Dudosos: ninguno
26. src/components/shared (5/5) — hecho — 224 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
27. src/components/layout — hecho — 983 líneas revisadas, 26 eliminadas (2,64%). Dudosos: ninguno
28. src/components (raíz) — hecho — 201 líneas revisadas, 33 eliminadas (16,42%). Dudosos: ninguno
29. src/components/asistente-ia (1/3) — hecho — 1446 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
30. src/components/asistente-ia (2/3) — hecho — 1280 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
31. src/components/asistente-ia (3/3) — hecho — 256 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
32. src/components/desc-promos (1/2) — hecho — 1050 líneas revisadas, 0 eliminadas (0,00%). Dudosos: ninguno
33. src/components/desc-promos (2/2) — pendiente — 3 archivos, 769 líneas
34. src/components/envios (1/3) — pendiente — 2 archivos, 948 líneas
35. src/components/envios (2/3) — pendiente — 3 archivos, 1426 líneas
36. src/components/envios (3/3) — pendiente — 11 archivos, 1292 líneas
37. src/components/estadisticas-productos (1/5) — pendiente — 4 archivos, 1241 líneas
38. src/components/estadisticas-productos (2/5) — pendiente — 1 archivos, 600 líneas
39. src/components/estadisticas-productos (3/5) — pendiente — 2 archivos, 1341 líneas
40. src/components/estadisticas-productos (4/5) — pendiente — 3 archivos, 1460 líneas
41. src/components/estadisticas-productos (5/5) — pendiente — 1 archivos, 716 líneas
42. src/components/facturacion (1/10) — pendiente — 5 archivos, 1289 líneas
43. src/components/facturacion (2/10) — pendiente — 3 archivos, 1500 líneas
44. src/components/facturacion (3/10) — pendiente — 2 archivos, 1313 líneas
45. src/components/facturacion (4/10) — pendiente — 1 archivos, 1291 líneas
46. src/components/facturacion (5/10) — pendiente — 1 archivos, 1455 líneas
47. src/components/facturacion (6/10) — pendiente — 2 archivos, 820 líneas
48. src/components/facturacion (7/10) — pendiente — 2 archivos, 928 líneas
49. src/components/facturacion (8/10) — pendiente — 1 archivos, 1232 líneas
50. src/components/facturacion (9/10) — pendiente — 6 archivos, 1497 líneas
51. src/components/facturacion (10/10) — pendiente — 3 archivos, 381 líneas
52. src/components/finanzas (1/15) — pendiente — 6 archivos, 1445 líneas
53. src/components/finanzas (2/15) — pendiente — 6 archivos, 1309 líneas
54. src/components/finanzas (3/15) — pendiente — 8 archivos, 1320 líneas
55. src/components/finanzas (4/15) — pendiente — 3 archivos, 978 líneas
56. src/components/finanzas (5/15) — pendiente — 1 archivos, 656 líneas
57. src/components/finanzas (6/15) — pendiente — 2 archivos, 1445 líneas
58. src/components/finanzas (7/15) — pendiente — 6 archivos, 1486 líneas
59. src/components/finanzas (8/15) — pendiente — 3 archivos, 1492 líneas
60. src/components/finanzas (9/15) — pendiente — 2 archivos, 1084 líneas
61. src/components/finanzas (10/15) — pendiente — 3 archivos, 1288 líneas
62. src/components/finanzas (11/15) — pendiente — 4 archivos, 1459 líneas
63. src/components/finanzas (12/15) — pendiente — 4 archivos, 1309 líneas
64. src/components/finanzas (13/15) — pendiente — 3 archivos, 1172 líneas
65. src/components/finanzas (14/15) — pendiente — 5 archivos, 1266 líneas
66. src/components/finanzas (15/15) — pendiente — 4 archivos, 965 líneas
67. src/components/import — pendiente — 1 archivos, 146 líneas
68. src/components/ingreso — pendiente — 1 archivos, 297 líneas
69. src/components/marketing (1/4) — pendiente — 7 archivos, 1188 líneas
70. src/components/marketing (2/4) — pendiente — 4 archivos, 1338 líneas
71. src/components/marketing (3/4) — pendiente — 5 archivos, 1497 líneas
72. src/components/marketing (4/4) — pendiente — 5 archivos, 666 líneas
73. src/components/pedido-a-fabrica (1/2) — pendiente — 3 archivos, 1256 líneas
74. src/components/pedido-a-fabrica (2/2) — pendiente — 1 archivos, 515 líneas
75. src/components/pedidos (1/7) — pendiente — 8 archivos, 1371 líneas
76. src/components/pedidos (2/7) — pendiente — 5 archivos, 1288 líneas
77. src/components/pedidos (3/7) — pendiente — 4 archivos, 1464 líneas
78. src/components/pedidos (4/7) — pendiente — 1 archivos, 1352 líneas
79. src/components/pedidos (5/7) — pendiente — 4 archivos, 1048 líneas
80. src/components/pedidos (6/7) — pendiente — 4 archivos, 1294 líneas
81. src/components/pedidos (7/7) — pendiente — 2 archivos, 517 líneas
82. src/components/precios-competencia (1/2) — pendiente — 8 archivos, 1420 líneas
83. src/components/precios-competencia (2/2) — pendiente — 2 archivos, 351 líneas
84. src/components/proveedores (1/8) — pendiente — 8 archivos, 1245 líneas
85. src/components/proveedores (2/8) — pendiente — 1 archivos, 875 líneas
86. src/components/proveedores (3/8) — pendiente — 2 archivos, 1239 líneas
87. src/components/proveedores (4/8) — pendiente — 4 archivos, 1011 líneas
88. src/components/proveedores (5/8) — pendiente — 6 archivos, 1313 líneas
89. src/components/proveedores (6/8) — pendiente — 3 archivos, 1168 líneas
90. src/components/proveedores (7/8) — pendiente — 5 archivos, 1004 líneas
91. src/components/proveedores (8/8) — pendiente — 4 archivos, 1079 líneas
92. src/components/providers — pendiente — 1 archivos, 11 líneas
93. src/components/px-competencia — pendiente — 5 archivos, 971 líneas
94. src/components/px-listas-precios (1/2) — pendiente — 2 archivos, 798 líneas
95. src/components/px-listas-precios (2/2) — pendiente — 1 archivos, 746 líneas
96. src/components/reposicion-corp — pendiente — 2 archivos, 388 líneas
97. src/components/stock (1/4) — pendiente — 7 archivos, 1422 líneas
98. src/components/stock (2/4) — pendiente — 2 archivos, 826 líneas
99. src/components/stock (3/4) — pendiente — 2 archivos, 1075 líneas
100. src/components/stock (4/4) — pendiente — 2 archivos, 1133 líneas
101. src/components/tienda (1/5) — pendiente — 5 archivos, 1230 líneas
102. src/components/tienda (2/5) — pendiente — 5 archivos, 1168 líneas
103. src/components/tienda (3/5) — pendiente — 4 archivos, 1364 líneas
104. src/components/tienda (4/5) — pendiente — 4 archivos, 1145 líneas
105. src/components/tienda (5/5) — pendiente — 1 archivos, 403 líneas
106. src/components/usuarios — pendiente — 7 archivos, 1312 líneas
107. src/components/ventas — pendiente — 3 archivos, 902 líneas
108. src/components/vtas-cobros (1/2) — pendiente — 4 archivos, 1309 líneas
109. src/components/vtas-cobros (2/2) — pendiente — 4 archivos, 872 líneas
110. src/components/whatsapp — pendiente — 1 archivos, 73 líneas
111. src/actions (1/8) — pendiente — 10 archivos, 1494 líneas
112. src/actions (2/8) — pendiente — 9 archivos, 1172 líneas
113. src/actions (3/8) — pendiente — 5 archivos, 1302 líneas
114. src/actions (4/8) — pendiente — 8 archivos, 1474 líneas
115. src/actions (5/8) — pendiente — 6 archivos, 1286 líneas
116. src/actions (6/8) — pendiente — 10 archivos, 1146 líneas
117. src/actions (7/8) — pendiente — 11 archivos, 1477 líneas
118. src/actions (8/8) — pendiente — 7 archivos, 1030 líneas
119. src/services (1/31) — pendiente — 6 archivos, 968 líneas
120. src/services (2/31) — pendiente — 5 archivos, 1427 líneas
121. src/services (3/31) — pendiente — 2 archivos, 1330 líneas
122. src/services (4/31) — pendiente — 1 archivos, 1386 líneas
123. src/services (5/31) — pendiente — 4 archivos, 1436 líneas
124. src/services (6/31) — pendiente — 6 archivos, 1264 líneas
125. src/services (7/31) — pendiente — 5 archivos, 1376 líneas
126. src/services (8/31) — pendiente — 1 archivos, 933 líneas
127. src/services (9/31) — pendiente — 3 archivos, 1154 líneas
128. src/services (10/31) — pendiente — 6 archivos, 1446 líneas
129. src/services (11/31) — pendiente — 2 archivos, 283 líneas
130. src/services (12/31) — pendiente — 1 archivos, 3094 líneas
131. src/services (13/31) — pendiente — 5 archivos, 1464 líneas
132. src/services (14/31) — pendiente — 7 archivos, 887 líneas
133. src/services (15/31) — pendiente — 1 archivos, 962 líneas
134. src/services (16/31) — pendiente — 5 archivos, 1226 líneas
135. src/services (17/31) — pendiente — 3 archivos, 640 líneas
136. src/services (18/31) — pendiente — 1 archivos, 1793 líneas
137. src/services (19/31) — pendiente — 7 archivos, 1384 líneas
138. src/services (20/31) — pendiente — 5 archivos, 1291 líneas
139. src/services (21/31) — pendiente — 1 archivos, 1753 líneas
140. src/services (22/31) — pendiente — 1 archivos, 1396 líneas
141. src/services (23/31) — pendiente — 11 archivos, 1283 líneas
142. src/services (24/31) — pendiente — 6 archivos, 1411 líneas
143. src/services (25/31) — pendiente — 5 archivos, 1370 líneas
144. src/services (26/31) — pendiente — 2 archivos, 912 líneas
145. src/services (27/31) — pendiente — 3 archivos, 1354 líneas
146. src/services (28/31) — pendiente — 2 archivos, 1266 líneas
147. src/services (29/31) — pendiente — 1 archivos, 328 líneas
148. src/services (30/31) — pendiente — 1 archivos, 1403 líneas
149. src/services (31/31) — pendiente — 9 archivos, 1090 líneas
150. src/lib (raíz) (1/20) — pendiente — 9 archivos, 1382 líneas
151. src/lib (raíz) (2/20) — pendiente — 3 archivos, 993 líneas
152. src/lib (raíz) (3/20) — pendiente — 12 archivos, 1220 líneas
153. src/lib (raíz) (4/20) — pendiente — 12 archivos, 877 líneas
154. src/lib (raíz) (5/20) — pendiente — 10 archivos, 1379 líneas
155. src/lib (raíz) (6/20) — pendiente — 11 archivos, 1147 líneas
156. src/lib (raíz) (7/20) — pendiente — 5 archivos, 843 líneas
157. src/lib (raíz) (8/20) — pendiente — 2 archivos, 1394 líneas
158. src/lib (raíz) (9/20) — pendiente — 7 archivos, 1243 líneas
159. src/lib (raíz) (10/20) — pendiente — 6 archivos, 1472 líneas
160. src/lib (raíz) (11/20) — pendiente — 8 archivos, 1349 líneas
161. src/lib (raíz) (12/20) — pendiente — 1 archivos, 399 líneas
162. src/lib (raíz) (13/20) — pendiente — 1 archivos, 1394 líneas
163. src/lib (raíz) (14/20) — pendiente — 12 archivos, 1339 líneas
164. src/lib (raíz) (15/20) — pendiente — 12 archivos, 951 líneas
165. src/lib (raíz) (16/20) — pendiente — 12 archivos, 1167 líneas
166. src/lib (raíz) (17/20) — pendiente — 12 archivos, 867 líneas
167. src/lib (raíz) (18/20) — pendiente — 12 archivos, 614 líneas
168. src/lib (raíz) (19/20) — pendiente — 12 archivos, 1228 líneas
169. src/lib (raíz) (20/20) — pendiente — 7 archivos, 509 líneas
170. src/lib/arca (1/2) — pendiente — 7 archivos, 1230 líneas
171. src/lib/arca (2/2) — pendiente — 2 archivos, 458 líneas
172. src/lib/hooks — pendiente — 6 archivos, 455 líneas
173. src/lib/validations (1/7) — pendiente — 12 archivos, 554 líneas
174. src/lib/validations (2/7) — pendiente — 11 archivos, 1296 líneas
175. src/lib/validations (3/7) — pendiente — 12 archivos, 1164 líneas
176. src/lib/validations (4/7) — pendiente — 12 archivos, 666 líneas
177. src/lib/validations (5/7) — pendiente — 12 archivos, 692 líneas
178. src/lib/validations (6/7) — pendiente — 12 archivos, 833 líneas
179. src/lib/validations (7/7) — pendiente — 5 archivos, 117 líneas
180. src/lib/whatsapp — pendiente — 2 archivos, 133 líneas
181. src/hooks — pendiente — 1 archivos, 70 líneas
182. src/types — pendiente — 5 archivos, 100 líneas
183. scripts (1/6) — pendiente — 5 archivos, 308 líneas
184. scripts (2/6) — pendiente — 1 archivos, 3129 líneas
185. scripts (3/6) — pendiente — 12 archivos, 832 líneas
186. scripts (4/6) — pendiente — 12 archivos, 656 líneas
187. scripts (5/6) — pendiente — 12 archivos, 1325 líneas
188. scripts (6/6) — pendiente — 1 archivos, 165 líneas
189. scripts/alba-scraper — pendiente — 5 archivos, 676 líneas
190. scripts/alba-scraper/src — pendiente — 11 archivos, 1293 líneas
191. scripts/alba-scraper/output (1/4) — pendiente — 1 archivos, 3183 líneas
192. scripts/alba-scraper/output (2/4) — pendiente — 1 archivos, 1654 líneas
193. scripts/alba-scraper/output (3/4) — pendiente — 1 archivos, 3183 líneas
194. scripts/alba-scraper/output (4/4) — pendiente — 1 archivos, 8 líneas

## Detalle

### 1. src/app/ventas (1/3)

- Estado: hecho
- Líneas revisadas: 702
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: los 12 archivos son `page.tsx` o `error.tsx` (entrada de Next.js). Imports, funciones locales y exports se usan en el mismo archivo o los consume el framework. Sin código comentado abandonado.

Archivos:

- src/app/ventas/clientes/cuentas-corrientes/page.tsx
- src/app/ventas/clientes/error.tsx
- src/app/ventas/clientes/lista-clientes/page.tsx
- src/app/ventas/compras/compras-emitidas/error.tsx
- src/app/ventas/compras/compras-emitidas/page.tsx
- src/app/ventas/compras/compras-recepcionadas/page.tsx
- src/app/ventas/compras/pedir-mercaderia/page.tsx
- src/app/ventas/compras/tintometrico/page.tsx
- src/app/ventas/envios/conductor/page.tsx
- src/app/ventas/envios/error.tsx
- src/app/ventas/envios/programados/page.tsx
- src/app/ventas/herramientas/buscar-cod-imagen/page.tsx

### 2. src/app/ventas (2/3)

- Estado: hecho
- Líneas revisadas: 501
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: los 12 archivos son `page.tsx` o `error.tsx`. `dynamic`, `metadata` y `maxDuration` los consume Next.js. Imports y variables locales se usan en el mismo archivo. Sin código comentado abandonado.

Archivos:

- src/app/ventas/herramientas/calculadora-lts/page.tsx
- src/app/ventas/herramientas/disenar/page.tsx
- src/app/ventas/page.tsx
- src/app/ventas/stock/control-stock/page.tsx
- src/app/ventas/stock/movimientos/error.tsx
- src/app/ventas/stock/movimientos/page.tsx
- src/app/ventas/stock/transf-depositos/page.tsx
- src/app/ventas/ventas/comprobantes/page.tsx
- src/app/ventas/ventas/crear/page.tsx
- src/app/ventas/ventas/error.tsx
- src/app/ventas/ventas/presupuestos/page.tsx
- src/app/ventas/ventas/px-sugeridos/page.tsx

### 3. src/app/ventas (3/3)

- Estado: hecho
- Líneas revisadas: 18
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx` de Next.js. `dynamic` lo consume el framework. Imports y variables locales se usan en el mismo archivo.

Archivos:

- src/app/ventas/ventas/px-tintometrico/page.tsx

### 4. src/app/administrador (1/3)

- Estado: hecho
- Líneas revisadas: 455
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: los 12 archivos son `page.tsx` o `error.tsx`. `dynamic` lo consume Next.js. `formas-pago-presupuesto/page.tsx` redirige a descuentos y es entrada de ruta. Imports y variables locales se usan en el mismo archivo. Sin código comentado abandonado.

Archivos:

- src/app/administrador/cobros-desc/cobros-cajas/error.tsx
- src/app/administrador/cobros-desc/cobros-cajas/page.tsx
- src/app/administrador/cobros-desc/cobros-cx-fina/error.tsx
- src/app/administrador/cobros-desc/cobros-cx-fina/page.tsx
- src/app/administrador/cobros-desc/descuentos/page.tsx
- src/app/administrador/cobros-desc/formas-pago-presupuesto/page.tsx
- src/app/administrador/cobros-desc/margen-contribucion/page.tsx
- src/app/administrador/cobros-desc/ptos-vtas/error.tsx
- src/app/administrador/cobros-desc/ptos-vtas/page.tsx
- src/app/administrador/cobros-desc/seguimiento-fiscal/error.tsx
- src/app/administrador/cobros-desc/seguimiento-fiscal/page.tsx
- src/app/administrador/estadisticas/carga-de-datos/error.tsx

### 5. src/app/administrador (2/3)

- Estado: hecho
- Líneas revisadas: 450
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx` y `error.tsx`. `dynamic` lo consume Next.js. Imports y funciones locales se usan en el mismo archivo.

Archivos:

- src/app/administrador/estadisticas/carga-de-datos/page.tsx
- src/app/administrador/estadisticas/configuracion/error.tsx
- src/app/administrador/estadisticas/configuracion/page.tsx
- src/app/administrador/estadisticas/error.tsx
- src/app/administrador/estadisticas/ventas/error.tsx
- src/app/administrador/estadisticas/ventas/page.tsx
- src/app/administrador/page.tsx
- src/app/administrador/pedidos-a-fabrica/conf-reposicion/page.tsx
- src/app/administrador/pedidos-a-fabrica/pedido-reposicion/page.tsx
- src/app/administrador/pedidos-a-fabrica/pedidos-a-fabrica/page.tsx
- src/app/administrador/productos/analisis-cat/page.tsx
- src/app/administrador/productos/cx-compra/page.tsx

### 6. src/app/administrador (3/3)

- Estado: hecho
- Líneas revisadas: 360
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx`. `cx-compra` y `reglas-descuentos` redirigen y son entrada de ruta. Imports y variables locales se usan.

Archivos:

- src/app/administrador/productos/lista-productos/page.tsx
- src/app/administrador/productos/px-competencia/page.tsx
- src/app/administrador/productos/px-listas/page.tsx
- src/app/administrador/proveedores/lista-prod-prov/page.tsx
- src/app/administrador/proveedores/lista-prod-prov/reglas-descuentos/page.tsx
- src/app/administrador/proveedores/proveedores/page.tsx
- src/app/administrador/usuarios/sucursales/page.tsx
- src/app/administrador/usuarios/usuarios/page.tsx
- src/app/administrador/whatsapp/prueba/page.tsx

### 7. src/app/finanzas (1/2)

- Estado: hecho
- Líneas revisadas: 444
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx`. El índice de Balance redirige a Balance mensual. Helpers locales (`clampAnio`, `primerSearchParam`, `parseMesesSearchParam`) se usan en el mismo archivo.

Archivos:

- src/app/finanzas/balance/balance-iibb/page.tsx
- src/app/finanzas/balance/balance-iva/page.tsx
- src/app/finanzas/balance/balance-mensual/page.tsx
- src/app/finanzas/balance/catalogo-gastos/page.tsx
- src/app/finanzas/balance/cx-fin-cobros/page.tsx
- src/app/finanzas/balance/cx-merc-vend/page.tsx
- src/app/finanzas/balance/gastos/page.tsx
- src/app/finanzas/balance/page.tsx
- src/app/finanzas/balance/ventas-mensuales/page.tsx
- src/app/finanzas/operaciones/comp-compras/page.tsx
- src/app/finanzas/operaciones/venc-gastos/page.tsx
- src/app/finanzas/page.tsx

### 8. src/app/finanzas (2/2)

- Estado: hecho
- Líneas revisadas: 256
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx`. Imports, constantes y helpers de flujo de fondos se usan en el mismo archivo.

Archivos:

- src/app/finanzas/tesoreria/cajas/page.tsx
- src/app/finanzas/tesoreria/flujo-de-fondos/page.tsx
- src/app/finanzas/tesoreria/movimientos/page.tsx

### 9. src/app/marketing

- Estado: hecho
- Líneas revisadas: 178
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx`, incluido el hub que renderiza vacío. Imports y variables locales se usan.

Archivos:

- src/app/marketing/base-multimedia/base-multimedia/page.tsx
- src/app/marketing/base-multimedia/colores-marca/page.tsx
- src/app/marketing/page.tsx
- src/app/marketing/publicaciones/calendario/page.tsx
- src/app/marketing/publicaciones/ideas-contenido/page.tsx
- src/app/marketing/publicaciones/objetivos/page.tsx

### 10. src/app/ingresar

- Estado: hecho
- Líneas revisadas: 26
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx`. `metadata` lo consume Next.js. Imports y variables locales se usan.

Archivos:

- src/app/ingresar/page.tsx

### 11. src/app/cc

- Estado: hecho
- Líneas revisadas: 74
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx` y `error.tsx` del link público. Imports y variables locales se usan.

Archivos:

- src/app/cc/[token]/error.tsx
- src/app/cc/[token]/page.tsx

### 12. src/app/conductor

- Estado: hecho
- Líneas revisadas: 45
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `page.tsx` del link público. Imports y variables locales se usan.

Archivos:

- src/app/conductor/[token]/page.tsx

### 13. src/app/api (1/3)

- Estado: hecho
- Líneas revisadas: 505
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `route.ts`. `GET`/`POST`, `runtime` y `maxDuration` los consume Next.js. Imports y helpers locales se usan.

Archivos:

- src/app/api/arca/constancia/route.ts
- src/app/api/arca/health/route.ts
- src/app/api/envios/[id]/comprobante/route.ts
- src/app/api/est-por-prod/eliminar-periodo/route.ts
- src/app/api/facturacion/comprobantes/[id]/detalle/route.ts
- src/app/api/import-est-por-prod/route.ts
- src/app/api/import-est-por-prod/verificar/route.ts
- src/app/api/import-lista-precios/resumen-pdf/route.ts
- src/app/api/import-lista-precios/route.ts
- src/app/api/import-lista-precios/status/route.ts
- src/app/api/notificaciones/[id]/leida/route.ts
- src/app/api/notificaciones/route.ts

### 14. src/app/api (2/3)

- Estado: hecho
- Líneas revisadas: 729
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `route.ts`. Handlers, `maxDuration` e imports se usan. El parámetro `_total` del callback de progreso cumple la firma y va con prefijo `_`.

Archivos:

- src/app/api/parse-lista-precios-pdf/route.ts
- src/app/api/pedidos-historia/[pedidoHistoriaId]/detalle/route.ts
- src/app/api/stock/ajustes/route.ts
- src/app/api/stock/comprobantes/[id]/route.ts
- src/app/api/stock/movimientos/route.ts
- src/app/api/stock/transf-depositos/route.ts
- src/app/api/stock/transf-depositos/saldos/route.ts
- src/app/api/stock/transferencias/[id]/[accion]/route.ts
- src/app/api/stock/transferencias/[id]/route.ts
- src/app/api/stock/transferencias/route.ts
- src/app/api/sync-competencia-precios/cancel/route.ts
- src/app/api/sync-competencia-precios/route.ts

### 15. src/app/api (3/3)

- Estado: hecho
- Líneas revisadas: 10
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `route.ts` de estado de sync. Imports y el handler `GET` se usan.

Archivos:

- src/app/api/sync-competencia-precios/status/route.ts

### 16. src/app (raíz) (1/3)

- Estado: hecho
- Líneas revisadas: 156
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `favicon.ico` es el ícono de la app. `global-error.tsx` es el boundary global; imports y props se usan.

Archivos:

- src/app/favicon.ico
- src/app/global-error.tsx

### 17. src/app (raíz) (2/3)

- Estado: hecho
- Líneas revisadas: 2760
- Líneas eliminadas: 73
- Porcentaje: 2,64
- Dudosos: ninguno
- Nota: en `globals.css` se borraron clases sin ninguna aparición fuera del archivo: `boton-encubierto--cabecera-visor`, `sidebar-nav-tree--nested`, `sidebar-funciones-panel`, `cx-compra-subfila-cx-prod` y sus dos modificadores. Las reglas de `.sidebar-nav-item` que compartían selector con el panel quedaron solo con `.sidebar-container`.

Archivos:

- src/app/globals.css

### 18. src/app (raíz) (3/3)

- Estado: hecho
- Líneas revisadas: 75
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `layout.tsx` y `page.tsx`. `metadata` lo consume Next.js. El home redirige al hub de Ventas. Imports y variables locales se usan.

Archivos:

- src/app/layout.tsx
- src/app/page.tsx

### 19. src (raíz)

- Estado: hecho
- Líneas revisadas: 113
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `middleware.ts`. `middleware` y `config` los consume Next.js. Imports y `cookieVisorOptions` se usan.

Archivos:

- src/middleware.ts

### 20. src/components/ui (1/2)

- Estado: hecho
- Líneas revisadas: 923
- Líneas eliminadas: 9
- Porcentaje: 0,98
- Dudosos: ninguno
- Nota: se borró `src/components/ui/collapsible.tsx` (9 líneas). `Collapsible`, `CollapsibleTrigger` y `CollapsibleContent` no los importa nadie. El resto de exports de `ui` (`Badge`, `Button`, `Card`, `CardContent`, `Dialog` y partes, `Input`, `Label`, `Select` y partes, `Separator`, `Toaster`, `Switch`, `Table` y partes, `EmptyTableRow`) se usa fuera del archivo. `DialogPortal`, `DialogOverlay`, `SelectGroup`, `SelectLabel` y `SelectSeparator` se usan dentro de su archivo.

Archivos:

- src/components/ui/badge.tsx
- src/components/ui/button.tsx
- src/components/ui/card.tsx
- src/components/ui/collapsible.tsx
- src/components/ui/dialog.tsx
- src/components/ui/input.tsx
- src/components/ui/label.tsx
- src/components/ui/select.tsx
- src/components/ui/separator.tsx
- src/components/ui/sonner.tsx
- src/components/ui/switch.tsx
- src/components/ui/table.tsx

### 21. src/components/ui (2/2)

- Estado: hecho
- Líneas revisadas: 29
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `Tooltip`, `TooltipTrigger`, `TooltipContent` y `TooltipProvider` se importan fuera del archivo.

Archivos:

- src/components/ui/tooltip.tsx

### 22. src/components/shared (1/5)

- Estado: hecho
- Líneas revisadas: 1425
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: los 11 componentes se importan fuera del archivo. `AppModalProps`, `CatalogoFinderGastoFinalDetalle`, `ClassicFilteredTableLayoutProps`, `ClassicPageHeaderProps` y `FiltroBusquedaInputProps` se usan en el mismo archivo. `FiltroMultiSelectOpcion` se importa en desc-promos. Sin código comentado abandonado.

Archivos:

- src/components/shared/AppModal.tsx
- src/components/shared/catalogo-finder/CatalogoFinderColumn.tsx
- src/components/shared/catalogo-finder/CatalogoFinderEmpty.tsx
- src/components/shared/catalogo-finder/CatalogoFinderRow.tsx
- src/components/shared/CeldaDifPct.tsx
- src/components/shared/ClassicFilteredTableLayout.tsx
- src/components/shared/ClassicPageHeader.tsx
- src/components/shared/CodColorTintometricoInput.tsx
- src/components/shared/EnteroStepperInput.tsx
- src/components/shared/FiltroBusquedaInput.tsx
- src/components/shared/FiltroMultiSelect.tsx

### 23. src/components/shared (2/5)

- Estado: hecho
- Líneas revisadas: 1359
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: los 8 componentes se importan fuera del archivo. `unwrapHeaderActionNodes` se usa en `HeaderAccionesMenu`. `ColumnaModalTabla` y `ModalTablaQuantityItem` se importan en modales de tabla. Modos `single`, `multi`, `multiQuantity` y `singleConfirm` forman la API del componente (el default `single` sigue en el código).

Archivos:

- src/components/shared/FiltroRangoFechasCalendarioModal.tsx
- src/components/shared/HeaderAccionesMenu.tsx
- src/components/shared/LineaLecturaModal.tsx
- src/components/shared/MensajeProceso.tsx
- src/components/shared/ModalFeedbackRegion.tsx
- src/components/shared/ModalMicroLabel.tsx
- src/components/shared/ModalSiNoChoice.tsx
- src/components/shared/ModalTablaConFiltros.tsx

### 24. src/components/shared (3/5)

- Estado: hecho
- Líneas revisadas: 1272
- Líneas eliminadas: 128
- Porcentaje: 10,06
- Dudosos: ninguno
- Nota: se borró `MontoArSaldoEnteroInput.tsx` (nadie lo importaba). Se quitó su nombre del catálogo de máscaras en `docs/FRONTEND_GUIDELINES.md`. El resto de los 8 archivos se importa. `showPctSuffix={false}` y `emptyWhenZero` de `PorcentajeCentInput` no tienen call site; siguen en la API del componente.

Archivos:

- src/components/shared/MontoArInput.tsx
- src/components/shared/MontoArSaldoEnteroInput.tsx
- src/components/shared/NotificacionesHeaderButton.tsx
- src/components/shared/NotificacionesModal.tsx
- src/components/shared/NumeroComprobanteBloquesInput.tsx
- src/components/shared/PageSectionHeader.tsx
- src/components/shared/PaginacionClient.tsx
- src/components/shared/PaginacionTabla.tsx
- src/components/shared/PorcentajeCentInput.tsx

### 25. src/components/shared (4/5)

- Estado: hecho
- Líneas revisadas: 1425
- Líneas eliminadas: 1
- Porcentaje: 0,07
- Dudosos: ninguno
- Nota: los 9 archivos se importan. Se quitó la variante `flex: "auto"` de `SobreStockReposicionAdvertenciaModal` (el único uso pide `grow`). `tituloLado="izquierda"` de `ProcesoPaso` no tiene call site; la guía lo nombra como API vigente. `layoutGap="tight"` tampoco se pasa; el prop sigue en el componente.

Archivos:

- src/components/shared/PorcentajeEnteroMaskInput.tsx
- src/components/shared/ProcesoPaso.tsx
- src/components/shared/PxListaEnteroInput.tsx
- src/components/shared/ReposicionProveedorPrioritarioModal.tsx
- src/components/shared/SelectSearchInput.tsx
- src/components/shared/SidebarAreaSwitcher.tsx
- src/components/shared/SobreStockReposicionAdvertenciaModal.tsx
- src/components/shared/TablaControlItem.tsx
- src/components/shared/TablaSubencabezadoSeccionRow.tsx

### 26. src/components/shared (5/5)

- Estado: hecho
- Líneas revisadas: 224
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `TableEmptyState` y sus variantes exportadas se usan. `ToolbarActionButton` se usa. `density="tight"` no tiene call site; el prop sigue en el componente. `modalListLoadingVariants` `padding: "compact"` tampoco se pasa.

Archivos:

- src/components/shared/TableEmptyState.tsx
- src/components/shared/ToolbarActionButton.tsx

### 27. src/components/layout

- Estado: hecho
- Líneas revisadas: 983
- Líneas eliminadas: 26
- Porcentaje: 2,64
- Dudosos: ninguno
- Nota: 970 líneas de los 6 archivos más 13 de `.sidebar-nav-divider` en `globals.css`. Se borró `SidebarNavDivider.tsx` (nadie lo importaba) y esa regla. El resto del layout se importa (`AppShell` desde `layout.tsx`). `NavModule.href` no está seteado en los módulos actuales; el campo sigue en el tipo.

Archivos:

- src/components/layout/AdministracionAccordionNav.tsx
- src/components/layout/AppShell.tsx
- src/components/layout/ImportStatusIndicator.tsx
- src/components/layout/Sidebar.tsx
- src/components/layout/SidebarModulosRecuadro.tsx
- src/components/layout/SidebarNavDivider.tsx

### 28. src/components (raíz)

- Estado: hecho
- Líneas revisadas: 201
- Líneas eliminadas: 33
- Porcentaje: 16,42
- Dudosos: ninguno
- Nota: se borró `SectionHeader.tsx` (nadie lo importaba; el header vigente es `ClassicPageHeader`). Se quitó su nombre de `docs/FRONTEND_GUIDELINES.md` y del comentario de `PageSectionHeader`. `FilterBar` y sus exports se usan, incluidos `columnas` 4, 5 y 6.

Archivos:

- src/components/FilterBar.tsx
- src/components/SectionHeader.tsx

### 29. src/components/asistente-ia (1/3)

- Estado: hecho
- Líneas revisadas: 1446
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: la página de buscar código y la de diseñar importan `AsistenteIaBuscarColorImagenPageClient`. Ese cliente usa el tile, el paso, el cuentagotas y la vista de diseñar. Los tipos exportados se usan en el mismo archivo o en ese cliente. `_configBuscarCodigo` y `_config` quedan por convención de props no leídas.

Archivos:

- src/components/asistente-ia/AsistenteIaBuscarColorImagenPageClient.tsx
- src/components/asistente-ia/AsistenteIaDisenarColoresVista.tsx
- src/components/asistente-ia/AsistenteIaFuncionTile.tsx
- src/components/asistente-ia/AsistenteIaProcesoPaso.tsx
- src/components/asistente-ia/CuentagotasImagenMuestra.tsx

### 30. src/components/asistente-ia (2/3)

- Estado: hecho
- Líneas revisadas: 1280
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: el cliente del asistente importa el hub y el modal de prompts. El hub importa el modal de catálogo. Las 7 claves de `COPY_BY_KIND` las abre el hub. Las funciones locales de los tres archivos se usan.

Archivos:

- src/components/asistente-ia/GestionarProdIaDisenoCatalogoNombreModal.tsx
- src/components/asistente-ia/GestionarProdIaDisenoHubModal.tsx
- src/components/asistente-ia/GestionarProdIaDisenoPrompModal.tsx

### 31. src/components/asistente-ia (3/3)

- Estado: hecho
- Líneas revisadas: 256
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `GestionarProdIaDisenoPrompVarsModal` lo abre el modal de prompts. `etiquetaModuloVariable` y `etiquetasModulosFuente` se usan al armar las filas.

Archivos:

- src/components/asistente-ia/GestionarProdIaDisenoPrompVarsModal.tsx

### 32. src/components/desc-promos (1/2)

- Estado: hecho
- Líneas revisadas: 1050
- Líneas eliminadas: 0
- Porcentaje: 0,00
- Dudosos: ninguno
- Nota: `DescPromosPageClient` importa `CrearEditarDescPromoModal` y los tipos `DescPromoOpcionPago` y `DescPromoOpcionProductoUi`. El modal de alta importa `DescPromoAgregarProductosModal`. Los helpers del formulario se usan.

Archivos:

- src/components/desc-promos/CrearEditarDescPromoModal.tsx
- src/components/desc-promos/DescPromoAgregarProductosModal.tsx

### 33. src/components/desc-promos (2/2)

- Estado: pendiente
- Líneas revisadas: 769
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/desc-promos/DescPromosPageClient.tsx
- src/components/desc-promos/EliminarDescPromoModal.tsx
- src/components/desc-promos/VerDescPromoModal.tsx

### 34. src/components/envios (1/3)

- Estado: pendiente
- Líneas revisadas: 948
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/envios/CrearEditarClienteModal.tsx
- src/components/envios/CrearEditarEnviosDireccionModal.tsx

### 35. src/components/envios (2/3)

- Estado: pendiente
- Líneas revisadas: 1426
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/envios/CrearEnvioWizardModal.tsx
- src/components/envios/EnviosConductorDireccionesModal.tsx
- src/components/envios/EnviosConductorPageClient.tsx

### 36. src/components/envios (3/3)

- Estado: pendiente
- Líneas revisadas: 1292
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/envios/EnviosConsumidoresDePintorModal.tsx
- src/components/envios/EnviosFechaHorarioCampos.tsx
- src/components/envios/EnviosMapsLink.tsx
- src/components/envios/EnviosPageClient.tsx
- src/components/envios/EnviosPintorConsumidoresButton.tsx
- src/components/envios/EnviosProyectoListadoLineas.tsx
- src/components/envios/EnviosTelLink.tsx
- src/components/envios/EnviosWizardPasos.tsx
- src/components/envios/leerPdfComprobante.ts
- src/components/envios/SeleccionarPintorModal.tsx
- src/components/envios/VerEnvioModal.tsx

### 37. src/components/estadisticas-productos (1/5)

- Estado: pendiente
- Líneas revisadas: 1241
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/estadisticas-productos/EstCategorizacionPageClient.tsx
- src/components/estadisticas-productos/EstPorProdPageClient.tsx
- src/components/estadisticas-productos/EstVtasGraficoBarrasMensual.tsx
- src/components/estadisticas-productos/EstVtasGraficoTopProductos.tsx

### 38. src/components/estadisticas-productos (2/5)

- Estado: pendiente
- Líneas revisadas: 600
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/estadisticas-productos/EstVtasGraficoVarianteBarras.tsx

### 39. src/components/estadisticas-productos (3/5)

- Estado: pendiente
- Líneas revisadas: 1341
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/estadisticas-productos/EstVtasPageClient.tsx
- src/components/estadisticas-productos/GestionarEstPorProdColoresModal.tsx

### 40. src/components/estadisticas-productos (4/5)

- Estado: pendiente
- Líneas revisadas: 1460
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/estadisticas-productos/GestionarEstPorProdPresentacionModal.tsx
- src/components/estadisticas-productos/GestionarEstPorProdTerminacionModal.tsx
- src/components/estadisticas-productos/GestionarEstPorProdUnPresentacionModal.tsx

### 41. src/components/estadisticas-productos (5/5)

- Estado: pendiente
- Líneas revisadas: 716
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/estadisticas-productos/ImportarEstPorProdModal.tsx

### 42. src/components/facturacion (1/10)

- Estado: pendiente
- Líneas revisadas: 1289
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaBusquedaAvanzadaModal.tsx
- src/components/facturacion/FacturaClienteAsociadosDetalle.tsx
- src/components/facturacion/FacturaClienteProyectosDetalle.tsx
- src/components/facturacion/FacturaClientesListaPageClient.tsx
- src/components/facturacion/FacturaClienteTypeahead.tsx

### 43. src/components/facturacion (2/10)

- Estado: pendiente
- Líneas revisadas: 1500
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaCobroDetalleModal.tsx
- src/components/facturacion/FacturaComprobanteCobrosModal.tsx
- src/components/facturacion/FacturaComprobanteDetalleModal.tsx

### 44. src/components/facturacion (3/10)

- Estado: pendiente
- Líneas revisadas: 1313
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaComprobantePdfAccionModal.tsx
- src/components/facturacion/FacturaCrearLineasBlock.tsx

### 45. src/components/facturacion (4/10)

- Estado: pendiente
- Líneas revisadas: 1291
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaCrearPageClient.tsx

### 46. src/components/facturacion (5/10)

- Estado: pendiente
- Líneas revisadas: 1455
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaCuentaCorrientePageClient.tsx

### 47. src/components/facturacion (6/10)

- Estado: pendiente
- Líneas revisadas: 820
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaDescEspecialesItemModal.tsx
- src/components/facturacion/FacturaDescuentoModal.tsx

### 48. src/components/facturacion (7/10)

- Estado: pendiente
- Líneas revisadas: 928
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaGenerarComprobanteModal.tsx
- src/components/facturacion/FacturaLineaComentarioModal.tsx

### 49. src/components/facturacion (8/10)

- Estado: pendiente
- Líneas revisadas: 1232
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaListadoPageClient.tsx

### 50. src/components/facturacion (9/10)

- Estado: pendiente
- Líneas revisadas: 1497
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaMovimientosVentaModal.tsx
- src/components/facturacion/FacturaPagoCuentaCorrienteModal.tsx
- src/components/facturacion/FacturaProductoBusquedaLista.tsx
- src/components/facturacion/FacturaProductoDescEspecialCelda.tsx
- src/components/facturacion/FacturaProductoStockCelda.tsx
- src/components/facturacion/FacturaProductoStockModal.tsx

### 51. src/components/facturacion (10/10)

- Estado: pendiente
- Líneas revisadas: 381
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/facturacion/FacturaPxSugeridosModal.tsx
- src/components/facturacion/FacturaSaldoClienteModal.tsx
- src/components/facturacion/FacturaTintometricoModal.tsx

### 52. src/components/finanzas (1/15)

- Estado: pendiente
- Líneas revisadas: 1445
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/ActualizarMontoCajaTesoreriaModal.tsx
- src/components/finanzas/AjusteSaldoLibroControl.tsx
- src/components/finanzas/BalanceMensualDetalleGastosPorRubroModal.tsx
- src/components/finanzas/BalanceMensualDetalleGastosRubroModal.tsx
- src/components/finanzas/BalanceMensualDetallePorRubroModal.tsx
- src/components/finanzas/BalanceMensualGastoHistoricoModal.tsx

### 53. src/components/finanzas (2/15)

- Estado: pendiente
- Líneas revisadas: 1309
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/CalculoCxTotalFinAnaCosFinaModal.tsx
- src/components/finanzas/CeldaVerComprobante.tsx
- src/components/finanzas/ChequesEmitidosCajaTesoreriaModal.tsx
- src/components/finanzas/ControlComprobantesPageClient.tsx
- src/components/finanzas/CrearEditarFinBalCatalogoItemModal.tsx
- src/components/finanzas/CrearEditarFinBalGastoFinalModal.tsx

### 54. src/components/finanzas (3/15)

- Estado: pendiente
- Líneas revisadas: 1320
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/CrearEntidadTesoreriaModal.tsx
- src/components/finanzas/DetalleMovimientoTesoreriaCuerpo.tsx
- src/components/finanzas/EditarCajaTesoreriaModal.tsx
- src/components/finanzas/EditarFinAnaCosFinaModal.tsx
- src/components/finanzas/EliminarCajaTesoreriaModal.tsx
- src/components/finanzas/EliminarFinBalCatalogoItemModal.tsx
- src/components/finanzas/EliminarFinBalGastoFinalModal.tsx
- src/components/finanzas/EliminarFinBalGastoMensualModal.tsx

### 55. src/components/finanzas (4/15)

- Estado: pendiente
- Líneas revisadas: 978
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/FiltrosFinBalCx.tsx
- src/components/finanzas/FinAnaCosFinaPageClient.tsx
- src/components/finanzas/FinAnaMargenContribucionPageClient.tsx

### 56. src/components/finanzas (5/15)

- Estado: pendiente
- Líneas revisadas: 656
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/FinanzasBalanceGastosPageClient.tsx

### 57. src/components/finanzas (6/15)

- Estado: pendiente
- Líneas revisadas: 1445
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/FinanzasBalanceMensualPageClient.tsx
- src/components/finanzas/FinanzasTesoreriaMovimientosPageClient.tsx

### 58. src/components/finanzas (7/15)

- Estado: pendiente
- Líneas revisadas: 1486
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/FinanzasTesoreriaPageClient.tsx
- src/components/finanzas/FinanzasVencimientosGastosPageClient.tsx
- src/components/finanzas/FinanzasVencPorFechaPageClient.tsx
- src/components/finanzas/FinBalBalanceIibbPageClient.tsx
- src/components/finanzas/FinBalBalanceIvaPageClient.tsx
- src/components/finanzas/FinBalCxFinCobrosPageClient.tsx

### 59. src/components/finanzas (8/15)

- Estado: pendiente
- Líneas revisadas: 1492
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/FinBalCxMercVendPageClient.tsx
- src/components/finanzas/FinBalGastosCatalogoPageClient.tsx
- src/components/finanzas/GastoUnicoBalanceModal.tsx

### 60. src/components/finanzas (9/15)

- Estado: pendiente
- Líneas revisadas: 1084
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/GestionarCategoriasMargenContribucionModal.tsx
- src/components/finanzas/GestionarCuotasFinAnaCosFinaModal.tsx

### 61. src/components/finanzas (10/15)

- Estado: pendiente
- Líneas revisadas: 1288
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/GestionarGlobalPtoVtasModal.tsx
- src/components/finanzas/GestionarMarcasFinAnaCosFinaModal.tsx
- src/components/finanzas/GestionarPagosFinAnaCosFinaModal.tsx

### 62. src/components/finanzas (11/15)

- Estado: pendiente
- Líneas revisadas: 1459
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/GestionarTesoreriaTipoCajaModal.tsx
- src/components/finanzas/GestionarVencimientosProveedorModal.tsx
- src/components/finanzas/GestionCxYFormulasMargenContribucionModal.tsx
- src/components/finanzas/GraficoMcVsPorcUtilidad.tsx

### 63. src/components/finanzas (12/15)

- Estado: pendiente
- Líneas revisadas: 1309
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/IvaDiscriminaCargaMesModal.tsx
- src/components/finanzas/NuevaCajaTesoreriaModal.tsx
- src/components/finanzas/PagoCuentaCorrienteProveedoresModal.tsx
- src/components/finanzas/RegistrarMontoPagoFinBalGastoMensualModal.tsx

### 64. src/components/finanzas (13/15)

- Estado: pendiente
- Líneas revisadas: 1172
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/ResumenAcreditacionCajaModal.tsx
- src/components/finanzas/TablaControlComprobantes.tsx
- src/components/finanzas/TablaFinAnaCosFina.tsx

### 65. src/components/finanzas (14/15)

- Estado: pendiente
- Líneas revisadas: 1266
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/TablaFinAnaMargenContribucion.tsx
- src/components/finanzas/TablaFinAnaMcResumenFormasPago.tsx
- src/components/finanzas/TablaFlujoDeFondo.tsx
- src/components/finanzas/TablaGastos.tsx
- src/components/finanzas/TablaResumenCxMercVend.tsx

### 66. src/components/finanzas (15/15)

- Estado: pendiente
- Líneas revisadas: 965
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/finanzas/TablaTesoreriaCajas.tsx
- src/components/finanzas/TablaVencimientosGastosNoMercaderia.tsx
- src/components/finanzas/TransferenciaCajaTesoreriaModal.tsx
- src/components/finanzas/VentasMensualesPageClient.tsx

### 67. src/components/import

- Estado: pendiente
- Líneas revisadas: 146
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/import/ImportResultContext.tsx

### 68. src/components/ingreso

- Estado: pendiente
- Líneas revisadas: 297
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/ingreso/IngresarPageClient.tsx

### 69. src/components/marketing (1/4)

- Estado: pendiente
- Líneas revisadas: 1188
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/marketing/CrearEditarMktColorMarcaModal.tsx
- src/components/marketing/CrearEditarMktContenidoUrlDriveModal.tsx
- src/components/marketing/CrearEditarMktIdeaDetalleModal.tsx
- src/components/marketing/CrearEditarMktIdeaSeccionModal.tsx
- src/components/marketing/CrearEditarMktPublicacionModal.tsx
- src/components/marketing/EliminarMktIdeaModal.tsx
- src/components/marketing/EliminarMktPublicacionModal.tsx

### 70. src/components/marketing (2/4)

- Estado: pendiente
- Líneas revisadas: 1338
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/marketing/GestionarMktCatalogoNombreModal.tsx
- src/components/marketing/GestionarMktContenidoDriveTipoModal.tsx
- src/components/marketing/MarketingBaseMultimediaPageClient.tsx
- src/components/marketing/MarketingCalendarioPageClient.tsx

### 71. src/components/marketing (3/4)

- Estado: pendiente
- Líneas revisadas: 1497
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/marketing/MarketingColoresMarcaPageClient.tsx
- src/components/marketing/MarketingIdeasPageClient.tsx
- src/components/marketing/MarketingObjetivosPageClient.tsx
- src/components/marketing/MktCalendarioPublicacionesGrid.tsx
- src/components/marketing/MktMultiSelectCatalogo.tsx

### 72. src/components/marketing (4/4)

- Estado: pendiente
- Líneas revisadas: 666
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/marketing/MktPublicacionesCuadroMando.tsx
- src/components/marketing/MktPublicacionesDiaModal.tsx
- src/components/marketing/MktRedSocialIcon.tsx
- src/components/marketing/VerMktIdeaDetalleModal.tsx
- src/components/marketing/VerMktIdeaSeccionModal.tsx

### 73. src/components/pedido-a-fabrica (1/2)

- Estado: pendiente
- Líneas revisadas: 1256
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedido-a-fabrica/DetalleSucursalesPedidoAFabricaModal.tsx
- src/components/pedido-a-fabrica/InfoPromedioPedidoAFabricaModal.tsx
- src/components/pedido-a-fabrica/PedidoAFabricaPageClient.tsx

### 74. src/components/pedido-a-fabrica (2/2)

- Estado: pendiente
- Líneas revisadas: 515
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedido-a-fabrica/TablaPedidoAFabrica.tsx

### 75. src/components/pedidos (1/7)

- Estado: pendiente
- Líneas revisadas: 1371
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedidos/AgregarProductosModal.tsx
- src/components/pedidos/AgregarTintometricoModal.tsx
- src/components/pedidos/BorrarReposicionPedirModal.tsx
- src/components/pedidos/CantidadPedidoModal.tsx
- src/components/pedidos/CantidadPedidoUrgenteModal.tsx
- src/components/pedidos/CantPedirMercaderiaModal.tsx
- src/components/pedidos/ComprasPageClient.tsx
- src/components/pedidos/ConfigurarReposicionModal.tsx

### 76. src/components/pedidos (2/7)

- Estado: pendiente
- Líneas revisadas: 1288
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedidos/FiltrosCompras.tsx
- src/components/pedidos/FiltrosEnviarPedido.tsx
- src/components/pedidos/FiltrosHistorialPedidos.tsx
- src/components/pedidos/FiltrosPedidoUrgente.tsx
- src/components/pedidos/FiltrosReposicion.tsx

### 77. src/components/pedidos (3/7)

- Estado: pendiente
- Líneas revisadas: 1464
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedidos/GenerarPedidoToolbarButton.tsx
- src/components/pedidos/HistorialPedidosPageClient.tsx
- src/components/pedidos/NuevoItemTintometricoModal.tsx
- src/components/pedidos/PedidoHistoriaBorrarConfirmModal.tsx

### 78. src/components/pedidos (4/7)

- Estado: pendiente
- Líneas revisadas: 1352
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedidos/PedidoHistoriaDetalleModal.tsx

### 79. src/components/pedidos (5/7)

- Estado: pendiente
- Líneas revisadas: 1048
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedidos/PedidoHistoriaLecturaModal.tsx
- src/components/pedidos/PedidoTintometricoPageClient.tsx
- src/components/pedidos/PedirMercaderiaPageClient.tsx
- src/components/pedidos/PosicionIvaComparacionAutoRefresh.tsx

### 80. src/components/pedidos (6/7)

- Estado: pendiente
- Líneas revisadas: 1294
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedidos/ReposicionConfigForm.tsx
- src/components/pedidos/SeleccionarBaseTintometricaModal.tsx
- src/components/pedidos/SelectorProductosReposicionModal.tsx
- src/components/pedidos/TablaPedidoUrgente.tsx

### 81. src/components/pedidos (7/7)

- Estado: pendiente
- Líneas revisadas: 517
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/pedidos/TablaPedirMercaderia.tsx
- src/components/pedidos/TablaReposicion.tsx

### 82. src/components/precios-competencia (1/2)

- Estado: pendiente
- Líneas revisadas: 1420
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/precios-competencia/AgregarProveedorUrlCompetenciaModal.tsx
- src/components/precios-competencia/AltaCompetidorModal.tsx
- src/components/precios-competencia/AsociarUrlsCompetenciaModal.tsx
- src/components/precios-competencia/CompetenciaExtraccionReglasEditor.tsx
- src/components/precios-competencia/CompetenciaSyncProgresoBanner.tsx
- src/components/precios-competencia/CompetidorProveedorNombrePaginaFields.tsx
- src/components/precios-competencia/ConfiguracionCompetidorModal.tsx
- src/components/precios-competencia/GestionCompetidoresModal.tsx

### 83. src/components/precios-competencia (2/2)

- Estado: pendiente
- Líneas revisadas: 351
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/precios-competencia/RelevamientoUltimoMensaje.tsx
- src/components/precios-competencia/SincronizarCompetenciaModal.tsx

### 84. src/components/proveedores (1/8)

- Estado: pendiente
- Líneas revisadas: 1245
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/comparacion-categorias/AsignarProductosModal.tsx
- src/components/proveedores/comparacion-categorias/CeldaDifPxRefManualComparacion.tsx
- src/components/proveedores/comparacion-categorias/CeldaDtoExtraComparacion.tsx
- src/components/proveedores/comparacion-categorias/ComparacionCategoriaSelector.tsx
- src/components/proveedores/comparacion-categorias/ComparacionReferenciaCompetenciaColumn.tsx
- src/components/proveedores/comparacion-categorias/CrearEditarComparacionCategoriaModal.tsx
- src/components/proveedores/comparacion-categorias/ElegirReferenciaCompetenciaModal.tsx
- src/components/proveedores/comparacion-categorias/EliminarComparacionCategoriaModal.tsx

### 85. src/components/proveedores (2/8)

- Estado: pendiente
- Líneas revisadas: 875
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/ComparacionCategoriasClient.tsx

### 86. src/components/proveedores (3/8)

- Estado: pendiente
- Líneas revisadas: 1239
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/ConvertirPdfListaPreciosModal.tsx
- src/components/proveedores/CotizacionUsdListaPreciosControl.tsx

### 87. src/components/proveedores (4/8)

- Estado: pendiente
- Líneas revisadas: 1011
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/CrearEditarReglaDescEspecialModal.tsx
- src/components/proveedores/CrearEditarReglaDescuentoListaPrecioModal.tsx
- src/components/proveedores/CrearProductoListaPreciosModal.tsx
- src/components/proveedores/CrearProveedorModal.tsx

### 88. src/components/proveedores (5/8)

- Estado: pendiente
- Líneas revisadas: 1313
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/DescuentosAplicadosListaPreciosModal.tsx
- src/components/proveedores/DescuentosListaPreciosCelda.tsx
- src/components/proveedores/EdicionMasivaListaPreciosModal.tsx
- src/components/proveedores/EliminarListaPrecioModal.tsx
- src/components/proveedores/EliminarReglaDescEspecialModal.tsx
- src/components/proveedores/EliminarReglaDescuentoListaPrecioModal.tsx

### 89. src/components/proveedores (6/8)

- Estado: pendiente
- Líneas revisadas: 1168
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/ImportarListaPreciosModal.tsx
- src/components/proveedores/ListaPreciosPageClient.tsx
- src/components/proveedores/ListaPreciosTablaConFiltros.tsx

### 90. src/components/proveedores (7/8)

- Estado: pendiente
- Líneas revisadas: 1004
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/ProveedorForm.tsx
- src/components/proveedores/ProveedorModal.tsx
- src/components/proveedores/ReglaDescEspecialAgregarProductosModal.tsx
- src/components/proveedores/ReglaDescuentoItemListaPreciosModal.tsx
- src/components/proveedores/ReglasDescEspecificasListaPreciosPanel.tsx

### 91. src/components/proveedores (8/8)

- Estado: pendiente
- Líneas revisadas: 1079
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/proveedores/ReglasDescuentosListaPrecioModal.tsx
- src/components/proveedores/SugeridosPageClient.tsx
- src/components/proveedores/SugeridosTablaConFiltros.tsx
- src/components/proveedores/TablaProveedoresLista.tsx

### 92. src/components/providers

- Estado: pendiente
- Líneas revisadas: 11
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/providers/TooltipProvider.tsx

### 93. src/components/px-competencia

- Estado: pendiente
- Líneas revisadas: 971
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/px-competencia/AgregarProductoComparacionModal.tsx
- src/components/px-competencia/FiltrosPxCompetencia.tsx
- src/components/px-competencia/PxCompetenciaDetalleFilas.tsx
- src/components/px-competencia/PxCompetenciaPageClient.tsx
- src/components/px-competencia/TablaPxCompetencia.tsx

### 94. src/components/px-listas-precios (1/2)

- Estado: pendiente
- Líneas revisadas: 798
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/px-listas-precios/FiltrosPxListasPrecios.tsx
- src/components/px-listas-precios/PxListasPreciosPageClient.tsx

### 95. src/components/px-listas-precios (2/2)

- Estado: pendiente
- Líneas revisadas: 746
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/px-listas-precios/TablaPxListasPrecios.tsx

### 96. src/components/reposicion-corp

- Estado: pendiente
- Líneas revisadas: 388
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/reposicion-corp/FiltrosReposicionCorp.tsx
- src/components/reposicion-corp/ReposicionCorpPageClient.tsx

### 97. src/components/stock (1/4)

- Estado: pendiente
- Líneas revisadas: 1422
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/stock/CrearTransferenciaModal.tsx
- src/components/stock/EditarCoeficientesModal.tsx
- src/components/stock/FiltrosStock.tsx
- src/components/stock/FiltrosTransfDepositos.tsx
- src/components/stock/ImprimirStockButton.tsx
- src/components/stock/PrintStock.tsx
- src/components/stock/StockComprobanteDetalleModal.tsx

### 98. src/components/stock (2/4)

- Estado: pendiente
- Líneas revisadas: 826
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/stock/StockMovimientosPageClient.tsx
- src/components/stock/StockPageWithActions.tsx

### 99. src/components/stock (3/4)

- Estado: pendiente
- Líneas revisadas: 1075
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/stock/StockTransferenciaModal.tsx
- src/components/stock/TablaStock.tsx

### 100. src/components/stock (4/4)

- Estado: pendiente
- Líneas revisadas: 1133
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/stock/TablaTransfDepositos.tsx
- src/components/stock/TransfDepositosPageClient.tsx

### 101. src/components/tienda (1/5)

- Estado: pendiente
- Líneas revisadas: 1230
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/tienda/AgregarProductoTiendaModal.tsx
- src/components/tienda/EditarProductoTiendaModal.tsx
- src/components/tienda/FiltrosTienda.tsx
- src/components/tienda/GestionarCatalogosProductoTienda.tsx
- src/components/tienda/GestionarMarcasModal.tsx

### 102. src/components/tienda (2/5)

- Estado: pendiente
- Líneas revisadas: 1168
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/tienda/GestionarRubrosModal.tsx
- src/components/tienda/GestionTiposPinturaModal.tsx
- src/components/tienda/ListaProductosPageClient.tsx
- src/components/tienda/ModalExportarInformeAumento.tsx
- src/components/tienda/ProductoTiendaCampos.tsx

### 103. src/components/tienda (3/5)

- Estado: pendiente
- Líneas revisadas: 1364
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/tienda/PxListasItemEnProducto.tsx
- src/components/tienda/SeleccionarComponenteCompuestoModal.tsx
- src/components/tienda/SeleccionarProductoModal.tsx
- src/components/tienda/TablaComponentesCompuesto.tsx

### 104. src/components/tienda (4/5)

- Estado: pendiente
- Líneas revisadas: 1145
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/tienda/TablaTienda.tsx
- src/components/tienda/TiendaCalcLitrosPageClient.tsx
- src/components/tienda/TiendaCalcTintometricoPageClient.tsx
- src/components/tienda/VerProductoTiendaModal.tsx

### 105. src/components/tienda (5/5)

- Estado: pendiente
- Líneas revisadas: 403
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/tienda/VinculosCostoProductoTienda.tsx

### 106. src/components/usuarios

- Estado: pendiente
- Líneas revisadas: 1312
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/usuarios/EditarSucursalModal.tsx
- src/components/usuarios/EditarUsuarioModal.tsx
- src/components/usuarios/EliminarSucursalModal.tsx
- src/components/usuarios/EliminarUsuarioModal.tsx
- src/components/usuarios/RestablecerContrasenaUsuarioModal.tsx
- src/components/usuarios/SucursalesPageClient.tsx
- src/components/usuarios/UsuariosPageClient.tsx

### 107. src/components/ventas

- Estado: pendiente
- Líneas revisadas: 902
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/ventas/GraficoMesesTablero.tsx
- src/components/ventas/ParticipacionTablero.tsx
- src/components/ventas/TableroVentas.tsx

### 108. src/components/vtas-cobros (1/2)

- Estado: pendiente
- Líneas revisadas: 1309
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/vtas-cobros/CobrosPorSucursalPageClient.tsx
- src/components/vtas-cobros/CrearEditarCobroModal.tsx
- src/components/vtas-cobros/FacturaFiscalObligatoriaTabla.tsx
- src/components/vtas-cobros/GestionarTesoreriaTitularesModal.tsx

### 109. src/components/vtas-cobros (2/2)

- Estado: pendiente
- Líneas revisadas: 872
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/vtas-cobros/PtosVtasPageClient.tsx
- src/components/vtas-cobros/PtoVtaFacturaTabla.tsx
- src/components/vtas-cobros/ReglasPtosVtasModal.tsx
- src/components/vtas-cobros/SeguimientoFiscalPageClient.tsx

### 110. src/components/whatsapp

- Estado: pendiente
- Líneas revisadas: 73
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/components/whatsapp/WhatsappPruebaPageClient.tsx

### 111. src/actions (1/8)

- Estado: pendiente
- Líneas revisadas: 1494
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/balIibb.ts
- src/actions/balIva.ts
- src/actions/cajasTesoreria.ts
- src/actions/cobrosPorSucursal.ts
- src/actions/comparacionCategorias.ts
- src/actions/comparacionCompetencia.ts
- src/actions/competenciaPrecios.ts
- src/actions/controlComprobantes.ts
- src/actions/cotizacionUsd.ts
- src/actions/cuentaCorrientePublica.ts

### 112. src/actions (2/8)

- Estado: pendiente
- Líneas revisadas: 1172
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/cxPxTienda.ts
- src/actions/descEspecialReglas.ts
- src/actions/descPromo.ts
- src/actions/descuentosListaPrecioReglas.ts
- src/actions/envios.ts
- src/actions/estPorProdColores.ts
- src/actions/estPorProdPresentacion.ts
- src/actions/estPorProdTerminacion.ts
- src/actions/estPorProdUnPresentacion.ts

### 113. src/actions (3/8)

- Estado: pendiente
- Líneas revisadas: 1302
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/factura.ts
- src/actions/facturaFiscalObligatoria.ts
- src/actions/finAnaCosFina.ts
- src/actions/finAnaMargenContribucion.ts
- src/actions/finBalGastoMensualBalance.ts

### 114. src/actions (4/8)

- Estado: pendiente
- Líneas revisadas: 1474
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/finBalGastosCatalogo.ts
- src/actions/globalPersonal.ts
- src/actions/globalPtoVtas.ts
- src/actions/listaPrecios.ts
- src/actions/listaProductos.ts
- src/actions/mktColoresMarca.ts
- src/actions/mktContenidoDriveTipo.ts
- src/actions/mktContenidoUrlDrive.ts

### 115. src/actions (5/8)

- Estado: pendiente
- Líneas revisadas: 1286
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/mktPublicaciones.ts
- src/actions/mktPublicacionesCatalogo.ts
- src/actions/mktPublicacionesIdeas.ts
- src/actions/mktPublicacionesObj.ts
- src/actions/pedidoAFabrica.ts
- src/actions/pedidos.ts

### 116. src/actions (6/8)

- Estado: pendiente
- Líneas revisadas: 1146
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/pedidosHistoria.ts
- src/actions/prodIaDisenoCatalogos.ts
- src/actions/prodIaDisenoPromp.ts
- src/actions/prodIaDisenoPrompVar.ts
- src/actions/prodPreciosRex.ts
- src/actions/productosTienda.ts
- src/actions/proveedores.ts
- src/actions/ptoVtaFactura.ts
- src/actions/pxCompetencia.ts
- src/actions/pxListasPrecios.ts

### 117. src/actions (7/8)

- Estado: pendiente
- Líneas revisadas: 1477
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/reposicion.ts
- src/actions/reposicionCorp.ts
- src/actions/sesion.ts
- src/actions/stock.ts
- src/actions/stockMovimientos.ts
- src/actions/sucursalesCatalogo.ts
- src/actions/tesoreriaCheques.ts
- src/actions/tesoreriaChequesEmitidos.ts
- src/actions/tesoreriaMovimientos.ts
- src/actions/tesoreriaTipoCaja.ts
- src/actions/tesoreriaTitulares.ts

### 118. src/actions (8/8)

- Estado: pendiente
- Líneas revisadas: 1030
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/actions/tienda.ts
- src/actions/tiendaBultos.ts
- src/actions/tintometrico.ts
- src/actions/tiposPinturaRendimientos.ts
- src/actions/ventaMovimientosStock.ts
- src/actions/vinculos.ts
- src/actions/whatsappPrueba.ts

### 119. src/services (1/31)

- Estado: pendiente
- Líneas revisadas: 968
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/arcaAuth.service.ts
- src/services/arcaConstancia.service.ts
- src/services/balanceMensualHistorialFila.service.ts
- src/services/balanceMensualLibros.service.ts
- src/services/balCxFinanciero.service.ts
- src/services/balCxFinCobros.service.ts

### 120. src/services (2/31)

- Estado: pendiente
- Líneas revisadas: 1427
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/balCxMercaderia.service.ts
- src/services/balIibb.service.ts
- src/services/balIibbSync.service.ts
- src/services/balIva.service.ts
- src/services/balIvaSync.service.ts

### 121. src/services (3/31)

- Estado: pendiente
- Líneas revisadas: 1330
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/cajasTesoreria.service.ts
- src/services/categoriasComparacion.service.ts

### 122. src/services (4/31)

- Estado: pendiente
- Líneas revisadas: 1386
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/clientes.service.ts

### 123. src/services (5/31)

- Estado: pendiente
- Líneas revisadas: 1436
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/cobrosComprobante.service.ts
- src/services/cobrosCuotas.service.ts
- src/services/cobrosPorSucursal.service.ts
- src/services/comparacionCompetencia.service.ts

### 124. src/services (6/31)

- Estado: pendiente
- Líneas revisadas: 1264
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/competencia.service.ts
- src/services/competenciaPrecioScraping.service.ts
- src/services/competenciaPxSugerido.service.ts
- src/services/competenciaVinculo.service.ts
- src/services/compras.service.ts
- src/services/comprobanteCompraNumero.service.ts

### 125. src/services (7/31)

- Estado: pendiente
- Líneas revisadas: 1376
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/controlComprobantes.service.ts
- src/services/costoListaTienda.service.ts
- src/services/cotizacionUsd.service.ts
- src/services/cxPxTiendaRows.service.ts
- src/services/descEspecialReglas.service.ts

### 126. src/services (8/31)

- Estado: pendiente
- Líneas revisadas: 933
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/descPromo.service.ts

### 127. src/services (9/31)

- Estado: pendiente
- Líneas revisadas: 1154
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/descuentosListaPrecioReglas.service.ts
- src/services/enviosConductorPublico.service.ts
- src/services/enviosDirecciones.service.ts

### 128. src/services (10/31)

- Estado: pendiente
- Líneas revisadas: 1446
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/enviosFinal.service.ts
- src/services/estCategorizacion.service.ts
- src/services/estPorProd.service.ts
- src/services/estPorProdColores.service.ts
- src/services/estPorProdPresentacion.service.ts
- src/services/estPorProdTerminacion.service.ts

### 129. src/services (11/31)

- Estado: pendiente
- Líneas revisadas: 283
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/estPorProdUnPresentacion.service.ts
- src/services/estVtas.service.ts

### 130. src/services (12/31)

- Estado: pendiente
- Líneas revisadas: 3094
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/facturaComprobantes.service.ts

### 131. src/services (13/31)

- Estado: pendiente
- Líneas revisadas: 1464
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/facturaComprobantesListado.service.ts
- src/services/facturaFiscalObligatoria.service.ts
- src/services/facturaProductos.service.ts
- src/services/facturaSucursalAutorizada.service.ts
- src/services/finAnaCosFina.service.ts

### 132. src/services (14/31)

- Estado: pendiente
- Líneas revisadas: 887
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/finAnaCosFinaMatriz.service.ts
- src/services/finAnaCosFinaPago.service.ts
- src/services/finAnaCosFinaTerminalMarca.service.ts
- src/services/finAnaMargenContribucion.service.ts
- src/services/finAnaMcCategorias.service.ts
- src/services/finAnaMcConfig.service.ts
- src/services/finAnaMcFormulas.service.ts

### 133. src/services (15/31)

- Estado: pendiente
- Líneas revisadas: 962
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/finBalGastoMensualBalance.service.ts

### 134. src/services (16/31)

- Estado: pendiente
- Líneas revisadas: 1226
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/finBalGastosCatalogo.service.ts
- src/services/finBalPosicionIvaComparacionPedido.service.ts
- src/services/finBalPosicionIvaComparacionRevision.service.ts
- src/services/globalPersonal.service.ts
- src/services/globalPtoVtas.service.ts

### 135. src/services (17/31)

- Estado: pendiente
- Líneas revisadas: 640
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/importListaPdf.service.ts
- src/services/ingreso.service.ts
- src/services/limpiarHuerfanosProdTienda.service.ts

### 136. src/services (18/31)

- Estado: pendiente
- Líneas revisadas: 1793
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/listaPrecios.service.ts

### 137. src/services (19/31)

- Estado: pendiente
- Líneas revisadas: 1384
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/listaProductos.service.ts
- src/services/margenContribucionDesc.service.ts
- src/services/mktColoresMarca.service.ts
- src/services/mktContenidoDriveTipo.service.ts
- src/services/mktContenidoUrlDrive.service.ts
- src/services/mktPublicaciones.service.ts
- src/services/mktPublicacionesCatalogo.service.ts

### 138. src/services (20/31)

- Estado: pendiente
- Líneas revisadas: 1291
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/mktPublicacionesIdeas.service.ts
- src/services/mktPublicacionesObj.service.ts
- src/services/notificaciones.service.ts
- src/services/parseListaPreciosPdfMatriz.service.ts
- src/services/pedidoAFabrica.service.ts

### 139. src/services (21/31)

- Estado: pendiente
- Líneas revisadas: 1753
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/pedidosEnvio.service.ts

### 140. src/services (22/31)

- Estado: pendiente
- Líneas revisadas: 1396
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/pedidosHistoria.service.ts

### 141. src/services (23/31)

- Estado: pendiente
- Líneas revisadas: 1283
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/pedidosReposicionProveedor.service.ts
- src/services/prodIaDisenoCatalogos.service.ts
- src/services/prodIaDisenoPromp.service.ts
- src/services/prodIaDisenoPrompVar.service.ts
- src/services/prodPropiosCatalogos.service.ts
- src/services/prodTiendaPrecios.service.ts
- src/services/prodTiendaStock.service.ts
- src/services/producto.service.ts
- src/services/productoCompuesto.service.ts
- src/services/productoPropioTienda.service.ts
- src/services/productosTienda.service.ts

### 142. src/services (24/31)

- Estado: pendiente
- Líneas revisadas: 1411
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/proveedor.service.ts
- src/services/ptoVtaFactura.service.ts
- src/services/pxCompetenciaPage.service.ts
- src/services/pxCompetenciaRows.service.ts
- src/services/pxListasCambiosLote.service.ts
- src/services/pxListasCompetenciaRef.service.ts

### 143. src/services (25/31)

- Estado: pendiente
- Líneas revisadas: 1370
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/pxListasPrecioEdicion.service.ts
- src/services/pxListasPreciosPage.service.ts
- src/services/reposicionCorp.service.ts
- src/services/rubrosProdTienda.service.ts
- src/services/seguimientoFiscal.service.ts

### 144. src/services (26/31)

- Estado: pendiente
- Líneas revisadas: 912
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/sobreStock.service.ts
- src/services/stockMovimientos.service.ts

### 145. src/services (27/31)

- Estado: pendiente
- Líneas revisadas: 1354
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/stockTransferencias.service.ts
- src/services/sucursalesCatalogo.service.ts
- src/services/syncCompetenciaPrecios.service.ts

### 146. src/services (28/31)

- Estado: pendiente
- Líneas revisadas: 1266
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/tableroVentas.service.ts
- src/services/tesoreriaCheques.service.ts

### 147. src/services (29/31)

- Estado: pendiente
- Líneas revisadas: 328
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/tesoreriaChequesEmitidos.service.ts

### 148. src/services (30/31)

- Estado: pendiente
- Líneas revisadas: 1403
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/tesoreriaMovimientos.service.ts

### 149. src/services (31/31)

- Estado: pendiente
- Líneas revisadas: 1090
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/services/tesoreriaTipoCaja.service.ts
- src/services/tesoreriaTitulares.service.ts
- src/services/tiendaBultos.service.ts
- src/services/tintometrico.service.ts
- src/services/transfDepositos.service.ts
- src/services/vencimientosPorFecha.service.ts
- src/services/ventaMovimientosStock.service.ts
- src/services/ventasMensuales.service.ts
- src/services/whatsappPrueba.service.ts

### 150. src/lib (raíz) (1/20)

- Estado: pendiente
- Líneas revisadas: 1382
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/actionGates.ts
- src/lib/actionResult.ts
- src/lib/administracionNav.ts
- src/lib/administracionNavIcons.ts
- src/lib/apiFetchJson.ts
- src/lib/apiRouteAuth.ts
- src/lib/apiRouteJson.ts
- src/lib/appRoutes.ts
- src/lib/arcaConstancia.ts

### 151. src/lib (raíz) (2/20)

- Estado: pendiente
- Líneas revisadas: 993
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/asistenteIa.ts
- src/lib/aumentoCostoCompra.ts
- src/lib/balanceMensual.ts

### 152. src/lib (raíz) (3/20)

- Estado: pendiente
- Líneas revisadas: 1220
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/balanceMensualDetalle.ts
- src/lib/balanceMensualHistorialFila.ts
- src/lib/balanceMensualLibros.ts
- src/lib/balCxFinCobros.ts
- src/lib/balCxMercVend.ts
- src/lib/balIibb.ts
- src/lib/busqueda.ts
- src/lib/cajasTesoreriaEntidades.ts
- src/lib/cajasTesoreriaTipoCaja.ts
- src/lib/cajasTesoreriaTipos.ts
- src/lib/cajasTesoreriaTitulares.ts
- src/lib/calculos.ts

### 153. src/lib (raíz) (4/20)

- Estado: pendiente
- Líneas revisadas: 877
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/cantidadUnDecimal.ts
- src/lib/cobrosCuotas.ts
- src/lib/codColorTintometrico.ts
- src/lib/codigos.ts
- src/lib/colorMuestraImagen.ts
- src/lib/comparacionCategoriasFormat.ts
- src/lib/comparacionCategoriasLayout.ts
- src/lib/competenciaConfigExtraccion.ts
- src/lib/competenciaPreciosFilaResumen.ts
- src/lib/competenciaPreciosProgressDb.ts
- src/lib/competenciaRelevamiento.ts
- src/lib/competenciaUltimaComparacion.ts

### 154. src/lib (raíz) (5/20)

- Estado: pendiente
- Líneas revisadas: 1379
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/comprobanteCuotasPlazoPago.ts
- src/lib/contrasena.ts
- src/lib/controlStockSesion.ts
- src/lib/cuentaCorrientePublica.ts
- src/lib/cxPxTienda.ts
- src/lib/descargarPdfBase64.ts
- src/lib/descEspecialProductosUi.ts
- src/lib/descPromo.ts
- src/lib/descuentosListaPrecioReglasConstants.ts
- src/lib/descuentosListaPrecioReglasUi.ts

### 155. src/lib (raíz) (6/20)

- Estado: pendiente
- Líneas revisadas: 1147
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/envios.ts
- src/lib/enviosConductorPublico.ts
- src/lib/estadisticasProductosRoutes.ts
- src/lib/estCategorizacionTypes.ts
- src/lib/estFiltrosMulti.ts
- src/lib/estPorProdColores.ts
- src/lib/estPorProdPeriodo.ts
- src/lib/estPorProdPresentacion.ts
- src/lib/estPorProdTerminacion.ts
- src/lib/estPorProdTypes.ts
- src/lib/estPorProdUnPresentacion.ts

### 156. src/lib (raíz) (7/20)

- Estado: pendiente
- Líneas revisadas: 843
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/estVtasAgregar.ts
- src/lib/estVtasTypes.ts
- src/lib/exportAproximacionCodigoPdfClient.ts
- src/lib/exportPxDiffTypes.ts
- src/lib/exportPxPdfClient.ts

### 157. src/lib (raíz) (8/20)

- Estado: pendiente
- Líneas revisadas: 1394
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/factura.ts
- src/lib/facturacionRoutes.ts

### 158. src/lib (raíz) (9/20)

- Estado: pendiente
- Líneas revisadas: 1243
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/facturaComprobantePdfClient.ts
- src/lib/facturaComprobantePdfEmisor.ts
- src/lib/facturaComprobantePdfRedes.ts
- src/lib/facturaComprobanteQr.ts
- src/lib/facturaFiscal.ts
- src/lib/facturaFormasPagoPdf.ts
- src/lib/facturaStockCobertura.ts

### 159. src/lib (raíz) (10/20)

- Estado: pendiente
- Líneas revisadas: 1472
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/fechaArgentina.ts
- src/lib/fetchPedidoHistoriaDetalle.ts
- src/lib/finAnaCosFina.ts
- src/lib/finAnaCosFinaPagos.ts
- src/lib/finAnaCosFinaTerminalesMarcas.ts
- src/lib/finAnaMargenContribucion.ts

### 160. src/lib (raíz) (11/20)

- Estado: pendiente
- Líneas revisadas: 1349
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/finAnaMcCategorias.ts
- src/lib/finAnaMcColumnas.ts
- src/lib/finAnaMcConfig.ts
- src/lib/finAnaMcFormulas.ts
- src/lib/finTesoreriaCajaTouch.ts
- src/lib/flujoDeFondoFilas.ts
- src/lib/format.ts
- src/lib/generarPdfAproximacionCodigoImagen.ts

### 161. src/lib (raíz) (12/20)

- Estado: pendiente
- Líneas revisadas: 399
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/generarPdfAumentosPx.ts

### 162. src/lib (raíz) (13/20)

- Estado: pendiente
- Líneas revisadas: 1394
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/generarPdfFacturaComprobante.ts

### 163. src/lib (raíz) (14/20)

- Estado: pendiente
- Líneas revisadas: 1339
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/generarPdfPedido.ts
- src/lib/generarPdfResumenAumentosImport.ts
- src/lib/gestionProductosRoutes.ts
- src/lib/globalPtoVtas.ts
- src/lib/horarioSucursal.ts
- src/lib/importListaPdf.ts
- src/lib/importProgressDb.ts
- src/lib/ingreso.ts
- src/lib/ivaDesdeTotalBruto21.ts
- src/lib/listaPreciosFiltros.ts
- src/lib/listaPreciosPdfMatriz.ts
- src/lib/listaProductos.ts

### 164. src/lib (raíz) (15/20)

- Estado: pendiente
- Líneas revisadas: 951
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/main-app-areas.ts
- src/lib/marketingRoutes.ts
- src/lib/mensajeWhatsappPresupuesto.ts
- src/lib/mktCalendarioPublicaciones.ts
- src/lib/mktColoresMarca.ts
- src/lib/mktContenidoUrlDrive.ts
- src/lib/mktPublicaciones.ts
- src/lib/mktPublicacionesCatalogo.ts
- src/lib/mktPublicacionesEstadisticas.ts
- src/lib/mktPublicacionesIdeas.ts
- src/lib/mktPublicacionesObj.ts
- src/lib/montoArMask.ts

### 165. src/lib (raíz) (16/20)

- Estado: pendiente
- Líneas revisadas: 1167
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/numeroComprobanteCompra.ts
- src/lib/pagination.ts
- src/lib/parsearImport.ts
- src/lib/parseEstPorProdExcelClient.ts
- src/lib/parsePrecioArgentino.ts
- src/lib/parseRespuestaIaCoincidencias.ts
- src/lib/pdfjsServerLoad.ts
- src/lib/pedidoAFabricaPromVta.ts
- src/lib/pedidoAFabricaRoutes.ts
- src/lib/pedidos.ts
- src/lib/pedidosTintometrico.ts
- src/lib/pedidoUrgenteCantidades.ts

### 166. src/lib (raíz) (17/20)

- Estado: pendiente
- Líneas revisadas: 867
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/pedidoUrgenteMatchDux.ts
- src/lib/permisos.ts
- src/lib/porcentajeCentMask.ts
- src/lib/precioComparacionPedidoUrgenteReposicion.ts
- src/lib/prisma.ts
- src/lib/prodIaDisenoCatalogos.ts
- src/lib/prodListaTerminacion.ts
- src/lib/productoCompuesto.ts
- src/lib/ptoVtaFactura.ts
- src/lib/ptoVtaReglas.ts
- src/lib/pxCompetencia.ts
- src/lib/pxCompetenciaFiltros.ts

### 167. src/lib (raíz) (18/20)

- Estado: pendiente
- Líneas revisadas: 614
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/pxCompetenciaVinculos.ts
- src/lib/pxListaEnteroMask.ts
- src/lib/pxListasCompetenciaRef.ts
- src/lib/pxListasPrecios.ts
- src/lib/pxListasPreciosCategoria.ts
- src/lib/pxListasPreciosCelda.ts
- src/lib/pxListasPreciosFiltros.ts
- src/lib/pxListasPreciosFormat.ts
- src/lib/reposicionCorp.ts
- src/lib/revalidatePedidosMercaderia.ts
- src/lib/revalidatePedidoUrgenteTrasCambioIvaSaldo.ts
- src/lib/seguimientoFiscalAlias.ts

### 168. src/lib (raíz) (19/20)

- Estado: pendiente
- Líneas revisadas: 1228
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/selectSearch.ts
- src/lib/sesion.ts
- src/lib/sesion-arranque.ts
- src/lib/stockTransferenciaNumero.ts
- src/lib/stockTransferenciasClient.ts
- src/lib/sucursalPreferida.ts
- src/lib/tiendaCalculosLts.ts
- src/lib/tintometricoFormatoCod.ts
- src/lib/transfDepositosControl.ts
- src/lib/transfDepositosTypes.ts
- src/lib/types.ts
- src/lib/ui-classes.ts

### 169. src/lib (raíz) (20/20)

- Estado: pendiente
- Líneas revisadas: 509
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/usuarios.ts
- src/lib/usuarioSesion.ts
- src/lib/utils.ts
- src/lib/ventaMovimientosStock.ts
- src/lib/vinculosTiendaUi.ts
- src/lib/vtasCobrosRoutes.ts
- src/lib/vwTextPdfFuente.ts

### 170. src/lib/arca (1/2)

- Estado: pendiente
- Líneas revisadas: 1230
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/arca/cms.ts
- src/lib/arca/constancia.ts
- src/lib/arca/env.ts
- src/lib/arca/index.ts
- src/lib/arca/soap.ts
- src/lib/arca/types.ts
- src/lib/arca/wsaa.ts

### 171. src/lib/arca (2/2)

- Estado: pendiente
- Líneas revisadas: 458
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/arca/wsfev1.ts
- src/lib/arca/xml.ts

### 172. src/lib/hooks

- Estado: pendiente
- Líneas revisadas: 455
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/hooks/useAplicarSucursalPreferidaSiVacia.ts
- src/lib/hooks/useCatalogosProductoTienda.ts
- src/lib/hooks/useFiltrosConBusqueda.ts
- src/lib/hooks/usePosicionIvaComparacionAutoRefresh.ts
- src/lib/hooks/useProductoCompuestoTienda.ts
- src/lib/hooks/useTitularesFinancierosTesoreria.ts

### 173. src/lib/validations (1/7)

- Estado: pendiente
- Líneas revisadas: 554
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/validations/arcaConstancia.ts
- src/lib/validations/balCxFinanciero.ts
- src/lib/validations/balCxMercaderia.ts
- src/lib/validations/balIibb.ts
- src/lib/validations/balIva.ts
- src/lib/validations/cajasTesoreria.ts
- src/lib/validations/cobrosCuota.ts
- src/lib/validations/cobrosPorSucursal.ts
- src/lib/validations/common.ts
- src/lib/validations/comparacionCategorias.ts
- src/lib/validations/comparacionCompetencia.ts
- src/lib/validations/competenciaPrecios.ts

### 174. src/lib/validations (2/7)

- Estado: pendiente
- Líneas revisadas: 1296
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/validations/controlComprobantes.ts
- src/lib/validations/cotizacionUsd.ts
- src/lib/validations/descEspecialReglas.ts
- src/lib/validations/descPromo.ts
- src/lib/validations/descuentosListaPrecioReglas.ts
- src/lib/validations/envios.ts
- src/lib/validations/estPorProd.ts
- src/lib/validations/estPorProdColores.ts
- src/lib/validations/estPorProdPresentacion.ts
- src/lib/validations/estPorProdTerminacion.ts
- src/lib/validations/estPorProdUnPresentacion.ts

### 175. src/lib/validations (3/7)

- Estado: pendiente
- Líneas revisadas: 1164
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/validations/factura.ts
- src/lib/validations/facturaFiscalObligatoria.ts
- src/lib/validations/finAnaCosFina.ts
- src/lib/validations/finAnaCosFinaPago.ts
- src/lib/validations/finAnaCosFinaTerminalMarca.ts
- src/lib/validations/finAnaMcCategorias.ts
- src/lib/validations/finAnaMcConfig.ts
- src/lib/validations/finBalGastoMensualBalance.ts
- src/lib/validations/finBalGastosCatalogo.ts
- src/lib/validations/globalPersonal.ts
- src/lib/validations/globalPtoVtas.ts
- src/lib/validations/importar.ts

### 176. src/lib/validations (4/7)

- Estado: pendiente
- Líneas revisadas: 666
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/validations/ingreso.ts
- src/lib/validations/iva.ts
- src/lib/validations/listaPrecios.ts
- src/lib/validations/listaProductos.ts
- src/lib/validations/margenContribucionDesc.ts
- src/lib/validations/mktColoresMarca.ts
- src/lib/validations/mktContenidoDriveTipo.ts
- src/lib/validations/mktContenidoUrlDrive.ts
- src/lib/validations/mktPublicaciones.ts
- src/lib/validations/mktPublicacionesCatalogo.ts
- src/lib/validations/mktPublicacionesIdeas.ts
- src/lib/validations/mktPublicacionesObj.ts

### 177. src/lib/validations (5/7)

- Estado: pendiente
- Líneas revisadas: 692
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/validations/parseListaPreciosPdfMatriz.ts
- src/lib/validations/pedidoAFabrica.ts
- src/lib/validations/pedidosLectura.ts
- src/lib/validations/pedidosMutaciones.ts
- src/lib/validations/prodIaDisenoCatalogos.ts
- src/lib/validations/prodIaDisenoPromp.ts
- src/lib/validations/prodIaDisenoPrompVar.ts
- src/lib/validations/prodPreciosRex.ts
- src/lib/validations/productoCompuesto.ts
- src/lib/validations/productoPropioTienda.ts
- src/lib/validations/proveedor.ts
- src/lib/validations/ptoVtaFactura.ts

### 178. src/lib/validations (6/7)

- Estado: pendiente
- Líneas revisadas: 833
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/validations/pxCompetencia.ts
- src/lib/validations/pxListasPrecios.ts
- src/lib/validations/reposicion.ts
- src/lib/validations/seguimientoFiscal.ts
- src/lib/validations/stock.ts
- src/lib/validations/stockMovimientos.ts
- src/lib/validations/stockTransferencias.ts
- src/lib/validations/sucursalCatalogo.ts
- src/lib/validations/tesoreriaCheques.ts
- src/lib/validations/tesoreriaMovimientos.ts
- src/lib/validations/tesoreriaTipoCaja.ts
- src/lib/validations/tesoreriaTitulares.ts

### 179. src/lib/validations (7/7)

- Estado: pendiente
- Líneas revisadas: 117
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/validations/tienda.ts
- src/lib/validations/tiendaBultos.ts
- src/lib/validations/transfDepositos.ts
- src/lib/validations/ventaMovimientosStock.ts
- src/lib/validations/whatsappPrueba.ts

### 180. src/lib/whatsapp

- Estado: pendiente
- Líneas revisadas: 133
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/lib/whatsapp/env.ts
- src/lib/whatsapp/enviarTexto.ts

### 181. src/hooks

- Estado: pendiente
- Líneas revisadas: 70
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/hooks/useCompetenciaSyncStatusPoll.ts

### 182. src/types

- Estado: pendiente
- Líneas revisadas: 100
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- src/types/components.types.ts
- src/types/index.ts
- src/types/producto.types.ts
- src/types/qrcode.d.ts
- src/types/service.types.ts

### 183. scripts (1/6)

- Estado: pendiente
- Líneas revisadas: 308
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/audit-actions-usage.mjs
- scripts/audit-schema-columns.mjs
- scripts/audit-schema-usage.mjs
- scripts/check-pedidos-mercaderia-columns.js
- scripts/check-pedidos-mercaderia-sucursal.js

### 184. scripts (2/6)

- Estado: pendiente
- Líneas revisadas: 3129
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/colores_alba.csv

### 185. scripts (3/6)

- Estado: pendiente
- Líneas revisadas: 832
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/create-lista-precios-proveedores.sql
- scripts/create-lista-precios-tienda.sql
- scripts/diagnose-desc-especial-migration.ts
- scripts/ensure-comparacion-dto-extra-items.js
- scripts/export-db-to-excel.ts
- scripts/fix-lista-precios-proveedores-columnas.ts
- scripts/fix-lista-precios-tienda-cod-ext.ts
- scripts/generar-csr-arca.ts
- scripts/init-schema.ts
- scripts/marcar-tintometricos-prod-propio.ts
- scripts/migrate-abreviatura-to-sufijo.sql
- scripts/migrate-descripciones-listas.sql

### 186. scripts (4/6)

- Estado: pendiente
- Líneas revisadas: 656
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/migrate-proveedores-to-prisma.sql
- scripts/neon-comprobantes-proveedor.sql
- scripts/neon-fin-compras-comprobante.sql
- scripts/neon-plazos-pagos-proveedores.sql
- scripts/normalize-clientes-cel.ts
- scripts/purge-huerfanos-prod-tienda.ts
- scripts/purge-lista-precio-proveedor-sin-vinculo-tienda.ts
- scripts/purge-prod-ped-merc-reposicion-por-bulto.ts
- scripts/README.md
- scripts/recalc-desc-especial.ts
- scripts/recalc-descuentos-lista-precio.ts
- scripts/recalcular-texto-presentaciones.ts

### 187. scripts (5/6)

- Estado: pendiente
- Líneas revisadas: 1325
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/run-create-lista-precios.ts
- scripts/run-create-lista-precios-tienda.ts
- scripts/run-migrate-descripciones-listas.ts
- scripts/run-migrate-prisma.ts
- scripts/schema-proveedores.sql
- scripts/scrape_alba_colores.py
- scripts/seed-prod-competencia.ts
- scripts/seed-px-listas-ref-mer-gar.ts
- scripts/test-aplanar-pdf-matriz.ts
- scripts/test-connection.ts
- scripts/verify-pedidos-reposicion.ts
- scripts/vincular-color-desde-descripcion.ts

### 188. scripts (6/6)

- Estado: pendiente
- Líneas revisadas: 165
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/vincular-presentacion-desde-descripcion.ts

### 189. scripts/alba-scraper

- Estado: pendiente
- Líneas revisadas: 676
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/alba-scraper/.gitignore
- scripts/alba-scraper/package.json
- scripts/alba-scraper/package-lock.json
- scripts/alba-scraper/README.md
- scripts/alba-scraper/tsconfig.json

### 190. scripts/alba-scraper/src

- Estado: pendiente
- Líneas revisadas: 1293
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/alba-scraper/src/catalog.ts
- scripts/alba-scraper/src/colorScience.ts
- scripts/alba-scraper/src/config.ts
- scripts/alba-scraper/src/csv.ts
- scripts/alba-scraper/src/csvIo.ts
- scripts/alba-scraper/src/http.ts
- scripts/alba-scraper/src/images.ts
- scripts/alba-scraper/src/index.ts
- scripts/alba-scraper/src/jpeg-js.d.ts
- scripts/alba-scraper/src/types.ts
- scripts/alba-scraper/src/utils.ts

### 191. scripts/alba-scraper/output (1/4)

- Estado: pendiente
- Líneas revisadas: 3183
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/alba-scraper/output/colores_alba.csv

### 192. scripts/alba-scraper/output (2/4)

- Estado: pendiente
- Líneas revisadas: 1654
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/alba-scraper/output/colores_alba_export.zip

### 193. scripts/alba-scraper/output (3/4)

- Estado: pendiente
- Líneas revisadas: 3183
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/alba-scraper/output/colores_alba_tip_diseno.csv

### 194. scripts/alba-scraper/output (4/4)

- Estado: pendiente
- Líneas revisadas: 8
- Líneas eliminadas: —
- Porcentaje: —
- Dudosos: —

Archivos:

- scripts/alba-scraper/output/scraper-report.json

