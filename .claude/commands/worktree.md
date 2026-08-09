---
description: Crea un worktree de git aislado para un requerimiento, y ejecuta ahí las instrucciones
argument-hint: <descripción del requerimiento / instrucciones a ejecutar>
---

Requerimiento del usuario: $ARGUMENTS

Pasos a seguir:

1. Deriva un nombre corto en kebab-case, **en español**, para el worktree, basado en el requerimiento anterior (ej: `arreglar-pieza-fantasma`, `agregar-funcion-guardar`). Este nombre irá en `[nombre]`.
2. Crea el worktree y su rama asociada:
   ```bash
   git worktree add trees/[nombre] -b [nombre]
   ```
   Si la rama `[nombre]` ya existe, usa en su lugar:
   ```bash
   git worktree add trees/[nombre] [nombre]
   ```
3. Cambia tu directorio de trabajo a `trees/[nombre]` (usa rutas absolutas dentro de esa carpeta para el resto de la tarea).
4. Ejecuta ahí, de forma aislada del código principal (no toques archivos fuera de `trees/[nombre]`), las instrucciones del requerimiento indicado arriba.
5. Al finalizar, informa en qué worktree y rama quedó el trabajo, y qué cambios se hicieron, sin hacer merge ni push a menos que el usuario lo pida explícitamente.
