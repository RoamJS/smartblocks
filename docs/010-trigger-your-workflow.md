# Table of Contents

1. [Trigger Your Workflow](010-trigger-your-workflow.md)
2. [Understanding Commands](020-understanding-commands.md)
3. [Using Pre-Defined Workflows](030-using-pre-defined-workflows.md)
4. [Make Your Own Workflows](040-make-your-own-workflows.md)
5. [Command Reference](050-command-reference.md)
6. [Alternative Methods](060-alternative-methods.md)
7. [Developer Docs](070-developer-docs.md)

# Overview

Each workflow, whether predefined or customized, is initiated in the same way. A **trigger** followed by the workflow name.

# How to Trigger a SmartBlock Workflow

**Trigger:** keystrokes you type to initiate the workflow defined in your SmartBlock
To initiate a SmartBlocks workflow, type the keystrokes that initiate the workflow. By default, this is `jj` (two j's). A list will popup with available SmartBlocks Actions. Keep typing the name of the workflow to filter the list, using the up and down arrow to navigate.
Press enter or click on the workflow you want to run

![](media/how-to-trigger.gif)

The trigger could be customized by going to the SmartBlocks tab in your Roam Depot Settings and editing the `Trigger` field.

# Roam42

For WorkBench users: SmartBlocks appear in the WorkBench drop-down (triggered by `Ctrl-;`) for convenience.
If you had a trigger defined by a `#42Setting`, that setting will take precedence over the config page.

## Preview, pins, and workflow source

- Press the right arrow to show the selected workflow's template. Up/down arrows change the selection and preview; the left arrow hides the preview. The preview displays source text and child blocks without executing commands, prompts, queries, or embedded macros.
- Click a workflow's pin icon to keep it at the top of the unfiltered menu. Pins are stored in this graph's SmartBlocks extension settings. Search keeps its usual fuzzy ranking and never repeats a pinned workflow.
- Press **Shift+Enter** (or click **Source** in the footer) to open a custom workflow's source block in Roam's right sidebar without running it. Built-in workflows have no source block, so their Source action is unavailable; their definitions are still visible in the preview.
- **Enter**, clicking a workflow, and **Run** execute the selected workflow as usual. **Escape** dismisses the menu. Ctrl+J/N and Ctrl+K/P continue to move down/up.
