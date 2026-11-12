// Saúde: aviso de responsabilidade e gestão de profissionais.
import { useState } from "react";
import { Icon } from "../../components/Icon";
import { getModule } from "../registry";
import { ModulePage } from "../ModulePage";
import type { ModuleViewProps } from "../types";

export function HealthHeader({ ws }: ModuleViewProps) {
  const [open, setOpen] = useState(false);
  const prof = getModule("health_professional");
  return (
    <div className="col" style={{ marginBottom: 16 }}>
      <div className="alert warning small" role="note">
        <Icon name="Info" size={18} />
        <span>Este módulo apenas guarda informações que <b>você</b> registra. O PERSONAL LIFE ULTRA não faz diagnósticos, não prescreve medicamentos, não recomenda tratamentos e não substitui profissionais de saúde. Os dados ficam somente no seu perfil.</span>
      </div>
      <div className="row">
        <button className="btn" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name="User" size={15} /> {open ? "Ocultar profissionais" : "Profissionais de saúde"}</button>
      </div>
      {open && prof && (
        <div className="card card-pad">
          <h3 style={{ marginBottom: 10 }}>Profissionais de saúde</h3>
          <ModulePage mod={prof} ws={ws} embedded />
        </div>
      )}
    </div>
  );
}
