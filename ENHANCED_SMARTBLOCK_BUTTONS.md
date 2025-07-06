# Enhanced SmartBlock Buttons

This enhancement adds powerful customization capabilities to SmartBlock buttons, including Blueprint.js icon support and child block configuration.

## Features

### 🎨 **Blueprint.js Icon Support**
- Use any icon from the Blueprint.js v3 icon library
- Over 300+ professional icons available
- Consistent styling with Roam Research's UI

### ⚙️ **Child Block Configuration**
- Configure buttons using nested child blocks instead of inline parameters
- More readable and maintainable configuration
- Support for complex styling and custom properties

### 🎯 **Advanced Customization**
- Intent colors (Primary, Success, Warning, Danger)
- Button styles (Minimal, Outlined)
- Custom CSS styling
- Arbitrary custom properties

## Usage

### Basic Syntax

```
{{Enhanced:SmartBlock:ConfigBlockUid}}
```

Where `ConfigBlockUid` is the UID of a block containing the configuration structure.

### Configuration Structure

Create a configuration block with the following child structure:

```
- My Enhanced SmartBlock Button Configuration
    - label
        - Add Me To Meeting
    - smartBlock
        - ((MyWorkflowUid))
    - options
        - keepButton: true
        - icon: calendar
        - intent: primary
        - minimal: false
        - outlined: true
        - styling: ```css
            .custom-button {
                padding: 10px;
                background: linear-gradient(45deg, #ff6b6b, #4ecdc4);
                border-radius: 8px;
            }
            ```
        - customProperty: myValue
```

### Configuration Options

#### **Core Properties**

| Property | Description | Example |
|----------|-------------|---------|
| `label` | Button text | `Add Me To Meeting` |
| `smartBlock` | Reference to SmartBlock workflow | `((fjf786L))` or `My Workflow Name` |

#### **Button Options**

| Property | Type | Description | Values |
|----------|------|-------------|--------|
| `keepButton` | boolean | Whether to keep button after execution | `true`, `false` |
| `icon` | string | Blueprint.js icon name | `calendar`, `add`, `edit`, `search`, etc. |
| `intent` | string | Button color theme | `primary`, `success`, `warning`, `danger` |
| `minimal` | boolean | Minimal button style | `true`, `false` |
| `outlined` | boolean | Outlined button style | `true`, `false` |

#### **Advanced Properties**

| Property | Description | Example |
|----------|-------------|---------|
| `styling` | Custom CSS styles | ````css .btn { padding: 10px } ```` |
| `customProperty` | Any custom value | `myValue`, `#winning` |

### Blueprint.js Icons

The enhanced buttons support all Blueprint.js v3 icons. Popular icons include:

**Common Icons:**
- `add`, `edit`, `delete`, `search`, `filter`
- `calendar`, `time`, `date-range`
- `user`, `people`, `organization`
- `document`, `folder`, `archive`
- `arrow-left`, `arrow-right`, `chevron-up`, `chevron-down`

**Action Icons:**
- `play`, `pause`, `stop`, `refresh`
- `download`, `upload`, `import`, `export`
- `save`, `settings`, `cog`, `wrench`

**Status Icons:**
- `tick`, `cross`, `warning-sign`, `error`
- `info-sign`, `help`, `lightbulb`

**Navigation Icons:**
- `home`, `menu`, `more`, `list`
- `grid-view`, `th`, `applications`

Find the complete list at: [Blueprint.js Icons](https://blueprintjs.com/docs/#icons)

## Examples

### 1. Simple Enhanced Button

```
- Quick Meeting Button Config
    - label
        - Add to Calendar
    - smartBlock
        - ((calendar-workflow-uid))
    - options
        - icon: calendar
        - intent: primary
```

Usage: `{{Enhanced:SmartBlock:((quick-meeting-config-uid))}}`

### 2. Styled Action Button

```
- Custom Action Config
    - label
        - Process Data
    - smartBlock
        - Data Processing Workflow
    - options
        - keepButton: true
        - icon: cog
        - intent: success
        - minimal: true
        - styling: ```css
            .process-btn {
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            ```
```

### 3. Advanced Configuration with Custom Properties

```
- Advanced Button Config
    - label
        - Smart Import
    - smartBlock
        - ((import-workflow-uid))
    - options
        - keepButton: false
        - icon: import
        - intent: warning
        - outlined: true
        - apiEndpoint: https://api.example.com/import
        - maxRetries: 3
        - timeout: 30000
        - styling: ```css
            .import-button {
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: all 0.3s ease;
            }
            .import-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            }
            ```
```

## Migration from Traditional SmartBlock Buttons

### Traditional Format
```
{{Add Meeting:SmartBlock:Meeting Workflow:RemoveButton=false,ButtonStyle=primary}}
```

### Enhanced Format
```
- Meeting Button Config
    - label
        - Add Meeting
    - smartBlock
        - Meeting Workflow
    - options
        - keepButton: true
        - intent: primary
        - icon: calendar

Usage: {{Enhanced:SmartBlock:((meeting-config-uid))}}
```

## Benefits

### ✅ **Readability**
- Configuration is clearly structured in child blocks
- Easy to understand and modify
- Self-documenting approach

### ✅ **Maintainability**
- Changes don't require editing the button trigger
- Configuration can be referenced by multiple buttons
- Version control friendly

### ✅ **Flexibility**
- Support for complex CSS styling
- Unlimited custom properties
- Extensible architecture

### ✅ **Consistency**
- Uses Blueprint.js icons for professional appearance
- Consistent with Roam Research's design system
- Standardized button behaviors

## Backward Compatibility

The enhanced SmartBlock buttons work alongside existing traditional SmartBlock buttons. Both formats are supported:

- Traditional: `{{ButtonText:SmartBlock:WorkflowName:param=value}}`
- Enhanced: `{{Enhanced:SmartBlock:ConfigBlockUid}}`

## Technical Details

### Pattern Recognition
The enhanced system recognizes the pattern `{{Enhanced:SmartBlock:ConfigBlockUid}}` and:

1. Parses the configuration from the specified block UID
2. Extracts all configuration options
3. Renders a Blueprint.js Button component
4. Applies custom styling and properties
5. Integrates with the existing SmartBlock execution system

### Error Handling
- Graceful fallback if configuration block is not found
- Console warnings for invalid configurations
- Default values for missing properties

### Performance
- Configuration is parsed once when the button is rendered
- Minimal performance impact on existing functionality
- Efficient integration with Roam's observer system

---

*Enhanced SmartBlock Buttons provide a powerful, flexible way to create highly customized interactive buttons while maintaining compatibility with existing SmartBlock workflows.*