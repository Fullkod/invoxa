# QA en navegador: Playwright, no Chrome

Date: 2026-11-04
Fuente: Roberto, sesión de PRP-002 ("recuerda no usar chrome, usa playwright").

- Para revisar la UI usa **Playwright** (skill `tf-playwright-cli`, scripts `.mjs` como los de `.titan/qa/`),
  nunca la extensión Claude in Chrome.
- Si hace falta una sesión real, abre Playwright en modo visible y deja que Roberto inicie sesión a mano;
  guarda el `storageState` fuera del repo (scratchpad). Nunca escribas contraseñas.
- Playwright no está en `package.json`: se instala en una carpeta temporal (los navegadores ya están en
  `~/AppData/Local/ms-playwright`).
