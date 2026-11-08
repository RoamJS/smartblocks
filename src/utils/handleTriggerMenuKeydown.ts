import { isCurrentTriggerSelection } from "./getTriggerSelection";
import type { TriggerSelection } from "./getTriggerSelection";
import { getMenuKeyAction } from "./smartblocksMenu";
import type { MenuKeyAction } from "./smartblocksMenu";

const handleTriggerMenuKeydown = ({
  event,
  editor,
  selection,
  onAction,
  onClose,
}: {
  event: KeyboardEvent;
  editor: HTMLTextAreaElement;
  selection: TriggerSelection;
  onAction: (action: NonNullable<MenuKeyAction>) => void;
  onClose: () => void;
}): void => {
  if (!isCurrentTriggerSelection(selection, editor)) {
    onClose();
    return;
  }
  const action = getMenuKeyAction(event);
  if (!action) return;
  event.stopPropagation();
  event.preventDefault();
  onAction(action);
};

export default handleTriggerMenuKeydown;
