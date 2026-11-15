import { isCurrentTriggerSelection } from "./getTriggerSelection";
import type { TriggerSelection } from "./getTriggerSelection";

const handleTriggerMenuKeydown = ({
  event,
  menu,
  editor,
  selection,
  setActiveIndex,
  onSelect,
  onClose,
}: {
  event: KeyboardEvent;
  menu: HTMLUListElement | null;
  editor: HTMLTextAreaElement | undefined;
  selection: TriggerSelection;
  setActiveIndex: (index: number) => void;
  onSelect: (index: number, event: KeyboardEvent) => void;
  onClose: () => void;
}): void => {
  if (!menu) return;
  if (!editor || !isCurrentTriggerSelection(selection, editor)) {
    onClose();
    return;
  }

  const isDown =
    event.key === "ArrowDown" ||
    (event.ctrlKey && (event.key === "n" || event.key === "j"));
  const isUp =
    event.key === "ArrowUp" ||
    (event.ctrlKey && (event.key === "p" || event.key === "k"));
  if (isDown || isUp) {
    const index = Number(menu.getAttribute("data-active-index"));
    const count = menu.childElementCount;
    setActiveIndex((index + (isDown ? 1 : count - 1)) % count);
    event.stopPropagation();
    event.preventDefault();
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.stopPropagation();
    event.preventDefault();
  } else if (event.key === "Enter") {
    onSelect(Number(menu.getAttribute("data-active-index")), event);
  } else if (event.key === "Escape") {
    onClose();
  }
};

export default handleTriggerMenuKeydown;
