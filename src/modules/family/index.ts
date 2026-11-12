import type { ModuleDef } from "../types";
import { ConversationDetail, DutyDetail, PollDetail, TripDetail } from "./details";
import { AlbumDetail, BirthdayHeader, BoardView, MenuView, PantryView, TreeView } from "./views";

/** Conecta visões/detalhes especializados aos módulos familiares. */
export function applyFamilyExtensions(mods: ModuleDef[]): void {
  const set = (id: string, patch: Partial<ModuleDef>) => {
    const m = mods.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  };
  set("poll", { detail: PollDetail });
  set("conversation", { detail: ConversationDetail });
  set("trip", { detail: TripDetail });
  set("duty", { detail: DutyDetail });
  set("album", { detail: AlbumDetail });
  set("menu", { view: MenuView });
  set("person", { view: TreeView });
  set("pantry", { view: PantryView });
  set("board_post", { view: BoardView });
  set("birthday", { header: BirthdayHeader });
}
