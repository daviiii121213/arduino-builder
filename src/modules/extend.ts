// Liga as visões especializadas aos módulos do registro.
import { MODULES } from "./registry";
import { applyPersonalExtensions } from "./personal";
import { applyFamilyExtensions } from "./family";

applyPersonalExtensions(MODULES);
applyFamilyExtensions(MODULES);
