// Gera src/wasm-pkg/wasm-b64.ts com o núcleo WebAssembly em base64 (evita fetch na versão web).
import { readFileSync, writeFileSync } from "node:fs";
const b64 = readFileSync("src/wasm-pkg/plu_wasm_bg.wasm").toString("base64");
writeFileSync("src/wasm-pkg/wasm-b64.ts", `// Gerado por scripts/embed-wasm.mjs — não editar.\nexport const WASM_B64 = "${b64}";\n`);
console.log("wasm embutido:", b64.length, "caracteres");
