import React from "react";
import { Button, Intent } from "@blueprintjs/core";
import { IconName } from "@blueprintjs/icons";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getShallowTreeByParentUid from "roamjs-components/queries/getShallowTreeByParentUid";
import { getCustomWorkflows, getCleanCustomWorkflows, sbBomb } from "./utils/core";
import extractRef from "roamjs-components/util/extractRef";
import createBlock from "roamjs-components/writes/createBlock";
import updateBlock from "roamjs-components/writes/updateBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getParentUidByBlockUid from "roamjs-components/queries/getParentUidByBlockUid";

export interface EnhancedSmartBlockConfig {
  label?: string;
  smartBlock?: string;
  keepButton?: boolean;
  icon?: IconName | string;
  intent?: Intent;
  minimal?: boolean;
  outlined?: boolean;
  styling?: string;
  [key: string]: any; // Allow arbitrary custom properties
}

export function parseEnhancedSmartBlockConfig(parentUid: string): EnhancedSmartBlockConfig {
  const children = getShallowTreeByParentUid(parentUid);
  const config: EnhancedSmartBlockConfig = {};

  children.forEach(child => {
    const childText = child.text.trim();
    const childChildren = getShallowTreeByParentUid(child.uid);
    
    if (childChildren.length > 0) {
      const value = childChildren[0].text.trim();
      
      switch (childText.toLowerCase()) {
        case 'label':
          config.label = value;
          break;
        case 'smartblock':
          config.smartBlock = extractRef(value) || value;
          break;
        case 'options':
          // Parse options sub-children
          const optionChildren = getShallowTreeByParentUid(child.uid);
          optionChildren.forEach(option => {
            const optionChildren = getShallowTreeByParentUid(option.uid);
            if (optionChildren.length > 0) {
              const optionKey = option.text.trim().toLowerCase();
              const optionValue = optionChildren[0].text.trim();
              
              switch (optionKey) {
                case 'keepbutton':
                  config.keepButton = optionValue.toLowerCase() === 'true';
                  break;
                case 'icon':
                  config.icon = optionValue as IconName;
                  break;
                case 'intent':
                  config.intent = optionValue.toLowerCase() as Intent;
                  break;
                case 'minimal':
                  config.minimal = optionValue.toLowerCase() === 'true';
                  break;
                case 'outlined':
                  config.outlined = optionValue.toLowerCase() === 'true';
                  break;
                case 'styling':
                  // Handle CSS styling - could be in a code block
                  if (optionValue.startsWith('```css') && optionValue.endsWith('```')) {
                    config.styling = optionValue.slice(6, -3).trim();
                  } else {
                    config.styling = optionValue;
                  }
                  break;
                default:
                  // Store custom properties
                  config[option.text.trim()] = optionValue;
                  break;
              }
            }
          });
          break;
        default:
          // Store any other properties
          config[childText] = value;
          break;
      }
    }
  });

  return config;
}

export function renderEnhancedSmartBlockButton(
  config: EnhancedSmartBlockConfig,
  parentUid: string,
  onTrigger: () => void
): React.ReactElement {
  const buttonStyle: React.CSSProperties = {};
  
  // Apply custom styling if provided
  if (config.styling) {
    try {
      // Parse CSS-like styling
      const styles = config.styling.split(';').filter(Boolean);
      styles.forEach(style => {
        const [property, value] = style.split(':').map(s => s.trim());
        if (property && value) {
          // Convert kebab-case to camelCase
          const camelProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
          buttonStyle[camelProperty as any] = value;
        }
      });
    } catch (e) {
      console.warn('Failed to parse custom styling:', e);
    }
  }

  return (
    <Button
      icon={config.icon}
      intent={config.intent}
      minimal={config.minimal}
      outlined={config.outlined}
      style={buttonStyle}
      onClick={onTrigger}
    >
      {config.label || 'SmartBlock Button'}
    </Button>
  );
}

export const registerEnhancedSmartBlockTrigger = ({
  textContent,
  text,
  el,
  parentUid,
}: {
  textContent: string;
  text: string;
  el: HTMLElement;
  parentUid: string;
}) => {
  // Match enhanced SmartBlock button pattern: {{Enhanced:SmartBlock:ConfigBlockUid}}
  const regex = new RegExp(
    `{{Enhanced:SmartBlock:(.*?)}}`
  );
  const match = regex.exec(text);
  
  if (!match) {
    return () => {};
  }

  const configBlockUid = match[1].trim();
  
  try {
    const config = parseEnhancedSmartBlockConfig(configBlockUid);
    
    if (!config.smartBlock) {
      console.warn('Enhanced SmartBlock button missing smartBlock configuration');
      return () => {};
    }

    const clickListener = () => {
      const workflows = getCustomWorkflows();
      const availableWorkflows = getCleanCustomWorkflows(workflows);
      const { uid: srcUid } = availableWorkflows.find(({ name }) => name === config.smartBlock) || {};
      
      if (!srcUid) {
        createBlock({
          node: {
            text: "Could not find custom workflow with the name:",
            children: [{ text: config.smartBlock || 'Unknown' }],
          },
          parentUid,
        });
        return;
      }

      // Prepare variables from config
      const variables: Record<string, string> = {};
      Object.keys(config).forEach(key => {
        if (!['label', 'smartBlock', 'keepButton', 'icon', 'intent', 'minimal', 'outlined', 'styling'].includes(key)) {
          variables[key] = String(config[key]);
        }
      });

      const keepButton = config.keepButton !== false; // Default to true
      const fullMatch = match[0];
      const index = text.indexOf(fullMatch);

      const props = {
        srcUid,
        variables,
        mutableCursor: !(workflows.find((w) => w.uid === srcUid)?.name || "").includes("<%NOCURSOR%>"),
        triggerUid: parentUid,
      };

      if (keepButton) {
        createBlock({
          node: { text: "" },
          parentUid,
          order: 0,
        }).then((targetUid) =>
          sbBomb({
            ...props,
            target: {
              uid: targetUid,
              start: 0,
              end: 0,
            },
          }).then((n) => {
            if (n === 0) deleteBlock(targetUid);
          })
        );
      } else {
        updateBlock({
          uid: parentUid,
          text: `${text.substring(0, index)}${text.substring(index + fullMatch.length)}`,
        }).then(() =>
          sbBomb({
            ...props,
            target: {
              uid: parentUid,
              start: index,
              end: index,
            },
          })
        );
      }
    };

    el.addEventListener("click", clickListener);
    
    return () => {
      el.removeEventListener("click", clickListener);
    };
  } catch (error) {
    console.error('Error setting up enhanced SmartBlock button:', error);
    return () => {};
  }
};