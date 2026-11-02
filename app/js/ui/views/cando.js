// Can-do checklist per situation (PRD FR-P4). Embedded in the dashboard; reads ctx.state at render time.
import { renderCanDos } from "../components/can-dos.js";

export { renderCanDos };

export function render(root, ctx) {
  renderCanDos(root, ctx);
}
