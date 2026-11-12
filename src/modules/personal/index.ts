import type { ModuleDef } from "../types";
import "../../styles/personal.css";
import { HabitsView } from "./HabitsView";
import { RoutineDetail } from "./RoutineDetail";
import { ProjectDetail } from "./ProjectDetail";
import { GoalDetail } from "./GoalDetail";
import { PomodoroHeader } from "./Pomodoro";
import { TimeTrackerHeader } from "./TimeTracker";
import { MindMapEditor } from "./MindMap";
import { ReadingHeader } from "./Reading";
import { VocabReview } from "./VocabReview";
import { HealthHeader } from "./HealthHeader";
import { NotesView } from "./NotesView";

/** Conecta visões/detalhes especializados aos módulos pessoais. */
export function applyPersonalExtensions(mods: ModuleDef[]): void {
  const set = (id: string, patch: Partial<ModuleDef>) => {
    const m = mods.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
  };
  set("habits", { view: HabitsView });
  set("routine", { detail: RoutineDetail });
  set("projects", { detail: ProjectDetail });
  set("goals", { detail: GoalDetail });
  set("pomodoro_session", { header: PomodoroHeader });
  set("time_session", { header: TimeTrackerHeader });
  set("mindmap", { detail: MindMapEditor });
  set("book", { header: ReadingHeader });
  set("language", { detail: VocabReview });
  set("health_appointment", { header: HealthHeader });
  set("notes", { view: NotesView });
}
